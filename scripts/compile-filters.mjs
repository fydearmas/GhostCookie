import { createHash } from "node:crypto";
import { createReadStream, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { domainToASCII, fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const rulesPath = join(root, "rules");
const lock = JSON.parse(readFileSync(join(rulesPath, "easylist.lock.json"), "utf8"));
const includePattern = /^%include easylist:([a-zA-Z0-9_./-]+\.txt)%$/;
const resourceTypes = {
  document: "main_frame",
  subdocument: "sub_frame",
  stylesheet: "stylesheet",
  script: "script",
  image: "image",
  xmlhttprequest: "xmlhttprequest",
  font: "font",
  media: "media",
  object: "object",
  ping: "ping",
  websocket: "websocket",
  webtransport: "webtransport",
  webbundle: "webbundle",
  other: "other",
};
const subresources = Object.values(resourceTypes).filter(type => type !== "main_frame");
const domainBatch = 200;
const genericLimit = 800;
const ruleBudget = 28000;
const allowIdStart = 1000000;

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

function hostname(value) {
  if (!/^[\p{L}\p{N}.-]+$/u.test(value)) return null;
  const ascii = domainToASCII(value);
  const labels = ascii.split(".");
  const validLabel = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
  return ascii.length <= 253 && labels.length >= 2 &&
    labels.every(label => validLabel.test(label)) && /[a-z]/.test(labels.at(-1))
    ? ascii : null;
}

function splitDomains(values) {
  const included = new Set();
  const excluded = new Set();
  for (const raw of values.split("|")) {
    const negative = raw.startsWith("~");
    const domain = hostname(negative ? raw.slice(1) : raw);
    if (!domain) return null;
    (negative ? excluded : included).add(domain);
  }
  return { included: [...included].sort(), excluded: [...excluded].sort() };
}

function networkRule(source) {
  const allow = source.startsWith("@@");
  const line = allow ? source.slice(2) : source;
  const [pattern, suffix = "", ...extra] = line.split("$");
  if (extra.length || !pattern.startsWith("||") || pattern.length > 512) return null;
  const [, rawDomain, path] = pattern.match(/^\|\|([^/^]+)([\s\S]*)$/) || [];
  const domain = rawDomain && hostname(rawDomain);
  if (!domain || !/^(?:\/|\^)/.test(path)) return null;
  // DNR interprets wildcards and separator anchors. Require an ASCII URL filter.
  if (path.includes("##") || path.includes("#@#") || /[^\x21-\x7e]/.test(path) ||
      /[|]/.test(path.slice(0, -1))) return null;

  const positives = new Set();
  const negatives = new Set();
  const condition = {};
  for (const option of suffix ? suffix.split(",") : []) {
    const negative = option.startsWith("~");
    const type = negative ? option.slice(1) : option;
    if (Object.hasOwn(resourceTypes, type)) {
      (negative ? negatives : positives).add(resourceTypes[type]);
    } else if (option === "third-party" || option === "~third-party") {
      if (condition.domainType) return null;
      condition.domainType = negative ? "firstParty" : "thirdParty";
    } else if (option.startsWith("domain=")) {
      if (condition.initiatorDomains || condition.excludedInitiatorDomains) return null;
      const domains = splitDomains(option.slice("domain=".length));
      if (!domains) return null;
      if (domains.included.length) condition.initiatorDomains = domains.included;
      if (domains.excluded.length) condition.excludedInitiatorDomains = domains.excluded;
    } else {
      // Unknown flags can change the meaning of the whole rule.
      return null;
    }
  }

  const navigationException = allow && positives.has("main_frame");
  if (navigationException && [...positives].some(type => type !== "main_frame" && type !== "sub_frame")) {
    return null;
  }
  const defaults = navigationException ? ["main_frame", "sub_frame"] : subresources;
  condition.resourceTypes = defaults.filter(type =>
    (!positives.size || positives.has(type)) && !negatives.has(type)
  );
  if (!condition.resourceTypes.length) return null;

  const wholeDomain = path === "^";
  if (wholeDomain && !allow && !condition.domainType && !condition.initiatorDomains) {
    condition.domainType = "thirdParty";
  }
  if (!wholeDomain) condition.urlFilter = `||${domain}${path}`;
  const action = navigationException ? "allowAllRequests" : allow ? "allow" : "block";
  return { action, condition, domain: wholeDomain ? domain : null };
}

function compileNetwork(lines) {
  const groups = new Map();
  for (const line of lines) {
    const rule = networkRule(line);
    if (!rule) continue;
    const key = JSON.stringify([rule.action, rule.condition]);
    if (!groups.has(key)) groups.set(key, new Set());
    if (rule.domain) groups.get(key).add(rule.domain);
  }

  const compiled = [];
  let blockId = 1;
  let allowId = allowIdStart;
  for (const [key, domains] of [...groups.entries()].sort(([a], [b]) => a < b ? -1 : a === b ? 0 : 1)) {
    const [type, condition] = JSON.parse(key);
    const block = type === "block";
    const append = (condition) => compiled.push({
      id: block ? blockId++ : allowId++,
      priority: block ? 1 : 10,
      action: { type },
      condition,
    });

    if (!domains.size) {
      append(condition);
      continue;
    }
    const sortedDomains = [...domains].sort();
    for (let i = 0; i < sortedDomains.length; i += domainBatch) {
      append({ ...condition, requestDomains: sortedDomains.slice(i, i + domainBatch) });
    }
  }
  return compiled;
}

// Accept bounded class and ID selectors with optional HTML tags, compound names,
// and standard combinators. Permit two explicit AdSense attributes as well.
const component = "(?:[a-zA-Z][a-zA-Z0-9-]*|\\*)?(?:[.#][a-zA-Z_-][a-zA-Z0-9_-]*)+";
const leading = `(?:${component}|[a-zA-Z][a-zA-Z0-9-]*)`;
const combinator = "(?: +| *[>+~] *)";
const safeSelector = new RegExp(`^(?:${leading}${combinator}){0,3}${component}$`);
const adSenseSelector = /^ins\.adsbygoogle\[data-ad-(?:client|slot)\]$/;
const commonContainer = /^[.#](?:ad[-_]?(?:banner|container|frame|slot|unit|wrapper)|sponsored-ad)$/i;
const adLabel = /(?:^(?:ad|ads|advertisement|sponsored)$|^(?:ads?|advert|banner|sponsor)(?:[-_]|[A-Z])|(?:[-_])(?:ads?|advert|sponsor)(?:[-_]|$)|^google[-_]?ads|^ad(?:banner|block|box|container|frame|holder|leaderboard|sidebar|slot|spot|unit|wrapper))/;
const unscopedRoadblock = /^(?:[.#])(?:banner|sponsor|sponsored|sponsored-content|promoted|promotion|adblock|adblocker)$/i;

function sortEntries(map) {
  return Object.fromEntries([...map.entries()].sort(([a], [b]) => a < b ? -1 : a === b ? 0 : 1)
    .map(([key, values]) => [key, [...values].sort()]));
}

function compileCosmetic(lines) {
  const genericPriority = new Set();
  const genericCommon = new Set();
  const genericComplex = new Set();
  const domains = new Map();
  const exceptions = new Map();
  const skipGeneric = new Set(["localhost"]);
  const skipAll = new Set();
  for (const line of lines) {
    const hideException = line.match(/^@@\|\|([^/^]+)\^\$(generichide|elemhide)$/);
    if (hideException) {
      const domain = hostname(hideException[1]);
      if (domain) (hideException[2] === "generichide" ? skipGeneric : skipAll).add(domain);
      continue;
    }
    const isException = line.includes("#@#");
    const parts = line.split(isException ? "#@#" : "##");
    if (parts.length !== 2 || parts[0].includes("#")) continue;
    const [scope, selector] = parts;
    if (selector.length > 140 || !(safeSelector.test(selector) || adSenseSelector.test(selector))) continue;
    if (!scope && !isException) {
      if (adSenseSelector.test(selector) || commonContainer.test(selector)) {
        genericPriority.add(selector);
        continue;
      }
      const labels = selector.match(/[.#][^ .#>+~]+/g) || [];
      if (!labels.some(label => adLabel.test(label.slice(1))) || unscopedRoadblock.test(selector)) continue;
      (/^[.#][\w-]+$/.test(selector) ? genericCommon : genericComplex).add(selector);
      continue;
    }
    const included = scope ? scope.split(",").map(hostname) : ["*"];
    if (included.some(domain => !domain)) continue;
    const target = isException ? exceptions : domains;
    for (const domain of included) {
      if (!target.has(domain)) target.set(domain, new Set());
      target.get(domain).add(selector);
    }
  }
  const generic = [...genericPriority].sort();
  generic.push(...[...genericCommon].sort((a, b) => a.length - b.length || (a < b ? -1 : a === b ? 0 : 1)));
  generic.push(...[...genericComplex].sort((a, b) => a.length - b.length || (a < b ? -1 : a === b ? 0 : 1)));
  return {
    generic: generic.slice(0, genericLimit).sort(),
    domains: sortEntries(domains),
    exceptions: sortEntries(exceptions),
    skipGeneric: [...skipGeneric].sort(),
    skipAll: [...skipAll].sort(),
  };
}

function renderJSON(items) {
  return "[\n" + items.map(item => "  " + JSON.stringify(item)).join(",\n") + "\n]\n";
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
