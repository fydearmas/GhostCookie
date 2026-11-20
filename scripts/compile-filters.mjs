import { createHash } from "node:crypto";
import { createReadStream, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { compileNetwork, compileCosmetic, renderJSON } from "./filter-compiler.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const rulesPath = join(root, "rules");
const lock = JSON.parse(readFileSync(join(rulesPath, "easylist.lock.json"), "utf8"));
const includePattern = /^%include easylist:([a-zA-Z0-9_./-]+\.txt)%$/;
const ruleBudget = 28000;

async function checksum(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

function upstreamLines(directory, name) {
  const template = readFileSync(join(directory, name + ".template"), "utf8");
  const lines = [];
  for (const entry of template.split(/\r?\n/)) {
    const line = entry.trim();
    if (!line.startsWith("%include ")) continue;
    const match = line.match(includePattern);
    if (!match || match[1].split("/").includes("..")) {
      throw Error(`Unsupported upstream template include: ${line}`);
    }
    const source = readFileSync(join(directory, match[1]), "utf8");
    let conditionalDepth = 0;
    for (const entry of source.split(/\r?\n/)) {
      const line = entry.trim();
      if (line.startsWith("!#if")) conditionalDepth += 1;
      if (line.startsWith("!#endif")) conditionalDepth -= 1;
      if (conditionalDepth < 0) throw Error(`Unbalanced conditions in ${match[1]}`);
      if (line && !line.startsWith("!") && conditionalDepth === 0) lines.push(line);
    }
    if (conditionalDepth !== 0) throw Error(`Unbalanced conditions in ${match[1]}`);
  }
  return lines;
}

const args = process.argv.slice(2);
const checking = args[0] === "--check";
if (checking) args.shift();
if (args.length !== 1 || !/^[a-f0-9]{40}$/.test(lock.commit) || !/^[a-f0-9]{64}$/.test(lock.archiveSha256)) {
  throw Error("Usage: node scripts/compile-filters.mjs [--check] /path/to/pinned-easylist.tar.gz");
}
const archive = resolve(args[0]);
if (await checksum(archive) !== lock.archiveSha256) throw Error("EasyList archive does not match the locked SHA-256");
const temporary = mkdtempSync(join(tmpdir(), "ghostcookie-easylist-"));
try {
  const source = join(temporary, "source");
  mkdirSync(source);
  const prefix = `easylist-${lock.commit}`;
  // Extract just the upstream rule templates and the three directories they reference.
  execFileSync("tar", [
    "-xzf", archive, "--strip-components=1", "-C", source,
    prefix + "/easylist.template", prefix + "/easyprivacy.template",
    prefix + "/template_header.txt", prefix + "/easylist", prefix + "/easylist_adult",
    prefix + "/easyprivacy",
  ]);
  const ads = upstreamLines(source, "easylist");
  const privacy = upstreamLines(source, "easyprivacy");
  const adRules = compileNetwork(ads);
  const privacyRules = compileNetwork(privacy);
  if (adRules.length + privacyRules.length > ruleBudget) {
    throw Error(`Compiled lists exceed the ${ruleBudget}-rule budget. Review source changes before packaging.`);
  }
  const cosmetic = compileCosmetic([...ads, ...privacy]);
  const banner = "// Derived from The EasyList authors (https://easylist.to/), CC BY-SA 3.0. See THIRD_PARTY_NOTICES.md.\n";
  const files = {
    "easylist.json": renderJSON(adRules),
    "easyprivacy.json": renderJSON(privacyRules),
    "cosmetic-selectors.js": banner + "globalThis.ghostCookieCosmeticRules = " + JSON.stringify(cosmetic) + ";\n",
  };
  for (const [file, data] of Object.entries(files)) {
    const destination = join(rulesPath, file);
    if (checking) {
      if (readFileSync(destination, "utf8") !== data) throw Error(`${basename(file)} differs from locked source`);
    } else {
      writeFileSync(destination, data);
    }
  }
  const domainCount = rules => new Set(rules.filter(rule => rule.action.type === "block")
    .flatMap(rule => rule.condition.requestDomains || [])).size;
  console.log(`EasyList: ${adRules.length} DNR rules, ${domainCount(adRules)} grouped blocking domains`);
  console.log(`EasyPrivacy: ${privacyRules.length} DNR rules, ${domainCount(privacyRules)} grouped blocking domains`);
  console.log(`Cosmetic rules: ${cosmetic.generic.length} generic selectors, ${Object.keys(cosmetic.domains).length} scoped hosts`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
