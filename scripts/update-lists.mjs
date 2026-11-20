import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeRegionalSource, regionalMetadata, regionalUrl } from "./compile-regional.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const reportDir = resolve(process.argv[2] ?? join(root, "dist", "list-update"));
const easyLock = "rules/easylist.lock.json";
const phishLock = "reputation/source.json";
const regionalDir = "rules/adguard-es-pt";
const regionalLock = regionalDir + "/source.json";
const regionalSource = regionalDir + "/source.txt";
const phishFeed = "dns/content_active.json";
const feeds = [
  { name: "EasyList (red)", path: "rules/easylist.json", read: networkRules },
  { name: "EasyPrivacy (red)", path: "rules/easyprivacy.json", read: networkRules },
  { name: "Filtros visuales", path: "rules/cosmetic-selectors.js", read: cosmeticRules },
  { name: "PhishDestroy", path: "rules/reputation.json", read: networkRules },
  { name: "AdGuard Español/Portugués (red)", path: regionalDir + "/network.json", read: networkRules },
  { name: "AdGuard Español/Portugués (visual)", path: regionalDir + "/cosmetic.json", read: (source) => cosmeticEntries(JSON.parse(source)) },
];
const maxFeedBytes = 20 * 1024 * 1024;
const shaPattern = /^[0-9a-f]{40}$/;
const timePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

async function download(url, limit, headers = {}) {
  const response = await fetch(url, { headers, redirect: "error", signal: AbortSignal.timeout(60_000) });
  if (!response.ok || !response.body) throw new Error("HTTP " + response.status + " al consultar " + url);
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > limit) throw new Error("La descarga supera el límite de tamaño: " + url);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, bytes);
}

async function latestRevision(repo, path) {
  const url = new URL("https://api.github.com/repos/" + repo + "/commits");
  url.searchParams.set("per_page", "1");
  if (path) url.searchParams.set("path", path);
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "GhostCookie-list-updater" };
  if (process.env.GH_TOKEN) headers.Authorization = "Bearer " + process.env.GH_TOKEN;
  const [entry] = JSON.parse(await download(url, 1024 * 1024, headers));
  const commit = entry?.sha;
  const date = entry?.commit?.committer?.date;
  if (typeof commit !== "string" || !shaPattern.test(commit)
      || typeof date !== "string" || !timePattern.test(date) || !Number.isFinite(Date.parse(date))) {
    throw new Error("La revisión publicada por " + repo + " es inválida.");
  }
  return { commit, date };
}

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

function networkRules(source) {
  const rules = [];
  for (const { priority, action, condition } of JSON.parse(source)) {
    // Compilers group equivalent domains into batches. Compare the actual policy,
    // keeping a reshuffled batch or reassigned rule ID out of the change report.
    const { requestDomains, ...match } = condition;
    if (requestDomains) {
      for (const domain of requestDomains) {
        rules.push(JSON.stringify({ priority, action, condition: { ...match, requestDomains: [domain] } }));
      }
    } else {
      rules.push(JSON.stringify({ priority, action, condition: match }));
    }
  }
  return new Set(rules);
}

function cosmeticRules(source) {
  const assignment = source.match(/^globalThis\.ghostCookieCosmeticRules = (.+);$/m);
  if (!assignment) throw new Error("Formato inesperado de los filtros visuales.");
  return cosmeticEntries(JSON.parse(assignment[1]));
}

function cosmeticEntries({ generic = [], domains, exceptions, skipGeneric = [], skipAll }) {
  return new Set([
    ...generic.map((selector) => JSON.stringify(["global", selector])),
    ...Object.entries(domains).flatMap(([domain, selectors]) => selectors.map((selector) => JSON.stringify(["sitio", domain, selector]))),
    ...Object.entries(exceptions).flatMap(([domain, selectors]) => selectors.map((selector) => JSON.stringify(["excepción", domain, selector]))),
    ...skipGeneric.map((domain) => JSON.stringify(["pausa global de selectores", domain])),
    ...skipAll.map((domain) => JSON.stringify(["pausa de todos los selectores", domain])),
  ]);
}

function listDiff(feed, before, after) {
  const oldRules = feed.read(before);
  const newRules = feed.read(after);
  return {
    list: feed.name,
    before: oldRules.size,
    after: newRules.size,
    added: [...newRules].filter((rule) => !oldRules.has(rule)).sort().map((rule) => JSON.parse(rule)),
    removed: [...oldRules].filter((rule) => !newRules.has(rule)).sort().map((rule) => JSON.parse(rule)),
  };
}

function compareVersions(version, currentVersion) {
  const current = currentVersion.split(".").map(Number);
  const difference = version.split(".").map((part, index) => Number(part) - current[index]);
  return difference.find((value) => value !== 0) ?? 0;
}

async function prepareLists(stage) {
  const [easy, phish, easyCurrent, phishCurrent, regionalText, regionalCurrent] = await Promise.all([
    latestRevision("easylist/easylist"),
    latestRevision("phishdestroy/destroylist", phishFeed),
    readFile(join(root, easyLock), "utf8").then(JSON.parse),
    readFile(join(root, phishLock), "utf8").then(JSON.parse),
    download(regionalUrl, 2 * 1024 * 1024).then(normalizeRegionalSource),
    readFile(join(root, regionalLock), "utf8").then(JSON.parse),
  ]);
  const regional = regionalMetadata(regionalText);
  const regionalChange = compareVersions(regional.version, regionalCurrent.version);
  if (easy.date < easyCurrent.revisionUtc || phish.date.slice(0, 10) < phishCurrent.snapshotDate ||
      regionalChange < 0 || regional.revisionUtc < regionalCurrent.revisionUtc) {
    throw new Error("Una fuente devolvió una revisión anterior a la instalada.");
  }

  await Promise.all(["scripts", "rules", "reputation"].map((directory) => mkdir(join(stage, directory))));
  const sources = [
    { name: "EasyList y EasyPrivacy", old: easyCurrent.commit, next: easy.commit },
    { name: "PhishDestroy", old: phishCurrent.revision, next: phish.commit },
    { name: "AdGuard Español/Portugués", old: regionalCurrent.version, next: regional.version },
  ];
  const changed = [];
  if (regionalChange > 0 || easy.commit !== easyCurrent.commit) {
    await copyFile(join(root, "scripts/filter-compiler.mjs"), join(stage, "scripts/filter-compiler.mjs"));
  }
  if (regionalChange > 0) {
    await mkdir(join(stage, regionalDir));
    await writeFile(join(stage, regionalSource), regionalText);
    await writeFile(join(stage, regionalLock), JSON.stringify(regional, null, 2) + "\n");
    await copyFile(join(root, "scripts/compile-regional.mjs"), join(stage, "scripts/compile-regional.mjs"));
    execFileSync(process.execPath, [join(stage, "scripts/compile-regional.mjs")], { stdio: "inherit" });
    changed.push(regionalLock, regionalSource, ...feeds.filter(({ path }) => path.startsWith(regionalDir)).map(({ path }) => path));
  }
  if (easy.commit !== easyCurrent.commit) {
    const archiveUrl = "https://codeload.github.com/easylist/easylist/tar.gz/" + easy.commit;
    const archive = await download(archiveUrl, maxFeedBytes);
    const archivePath = join(stage, "easylist.tar.gz");
    await writeFile(archivePath, archive);
    await writeFile(join(stage, easyLock), JSON.stringify({
      revisionUtc: easy.date, commit: easy.commit, archiveUrl, archiveSha256: sha256(archive),
    }, null, 2) + "\n");
    await copyFile(join(root, "scripts/compile-filters.mjs"), join(stage, "scripts/compile-filters.mjs"));
    execFileSync(process.execPath, [join(stage, "scripts/compile-filters.mjs"), archivePath], { stdio: "inherit" });
    changed.push(easyLock, ...feeds.slice(0, 3).map(({ path }) => path));
  }
  if (phish.commit !== phishCurrent.revision) {
    const url = "https://raw.githubusercontent.com/phishdestroy/destroylist/" + phish.commit + "/" + phishFeed;
    const json = await download(url, maxFeedBytes);
    const jsonPath = join(stage, "phishdestroy.json");
    await writeFile(jsonPath, json);
    await writeFile(join(stage, phishLock), JSON.stringify({
      url, revision: phish.commit, sha256: sha256(json), snapshotDate: phish.date.slice(0, 10),
    }, null, 2) + "\n");
    await copyFile(join(root, "scripts/compile-reputation.mjs"), join(stage, "scripts/compile-reputation.mjs"));
    execFileSync(process.execPath, [join(stage, "scripts/compile-reputation.mjs"), jsonPath], { stdio: "inherit" });
    changed.push(phishLock, "rules/reputation.json");
  }

  const summaries = [];
  for (const feed of feeds) {
    if (!changed.includes(feed.path)) continue;
    const [before, after] = await Promise.all([
      readFile(join(root, feed.path), "utf8"), readFile(join(stage, feed.path), "utf8"),
    ]);
    summaries.push(listDiff(feed, before, after));
  }

  await mkdir(reportDir, { recursive: true });
  await writeFile(join(reportDir, "changes.json"), JSON.stringify({ sources, lists: summaries }, null, 2) + "\n");
  const rows = summaries.map(({ list, before, after, added, removed }) =>
    "| " + [list, before, after, added.length, removed.length].join(" | ") + " |");
  const report = [
    "## Listas propuestas para Ghost Cookie", "",
    ...sources.map(({ name, old, next }) => "- " + name + " `" + old.slice(0, 12) + "` → `" + next.slice(0, 12) + "`"),
    "", "| Lista | Antes | Después | Añadidas | Retiradas |", "| --- | ---: | ---: | ---: | ---: |",
    ...rows, "", "Los totales se comparan por dominio o regla efectiva y selector.", "",
  ].join("\n");
  await writeFile(join(reportDir, "summary.md"), report);
  if (!changed.length) console.log("Las listas instaladas ya usan las últimas revisiones.");
  for (const path of changed) await copyFile(join(stage, path), join(root, path));
}

const stage = await mkdtemp(join(tmpdir(), "ghostcookie-filter-update-"));
try {
  await prepareLists(stage);
} finally {
  await rm(stage, { recursive: true, force: true });
}
