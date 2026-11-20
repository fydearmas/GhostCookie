import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { compileCosmetic, compileNetwork, renderJSON } from "./filter-compiler.mjs";

const regionalDir = new URL("../rules/adguard-es-pt/", import.meta.url);
export const regionalUrl = "https://filters.adtidy.org/extension/chromium/filters/9.txt";
const license = "https://github.com/AdguardTeam/AdguardFilters/blob/master/LICENSE";
const filterTitle = "AdGuard Spanish/Portuguese filter";

export function normalizeRegionalSource(bytes) {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    .replace(/\r\n/g, "\n").replace(/[\t ]+$/gm, "").trimEnd() + "\n";
}

export function regionalMetadata(text) {
  const title = text.match(/^! Title: (.+)$/m)?.[1];
  const version = text.match(/^! Version: (\d{1,6}(?:\.\d{1,6}){3})$/m)?.[1];
  const updated = text.match(/^! TimeUpdated: (.+)$/m)?.[1];
  const sourceLicense = text.match(/^! License: (.+)$/m)?.[1];
  if (title !== filterTitle || !version || !Number.isFinite(Date.parse(updated)) || sourceLicense !== license) {
    throw new Error("El filtro regional devolvió encabezados inesperados.");
  }
  return { url: regionalUrl, version, revisionUtc: new Date(updated).toISOString(),
    sha256: createHash("sha256").update(text).digest("hex"), license };
}

function compileRegional(text) {
  // Upstream conditional rules may depend on AdGuard-specific behavior.
  let depth = 0;
  const lines = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("!#if")) depth++;
    if (line.startsWith("!#endif")) depth--;
    if (depth < 0) throw new Error("Directivas condicionales regionales sin pareja.");
    if (line && !line.startsWith("!") && depth === 0) lines.push(line);
  }
  if (depth) throw new Error("Directivas condicionales regionales sin cerrar.");
  const network = compileNetwork(lines);
  const { domains, exceptions, skipAll } = compileCosmetic(lines);
  // Apply only site-scoped selectors and keep the existing generic filter set.
  if (network.length === 0 || network.length > 2500 || Object.keys(domains).length === 0) {
    throw new Error("El tamaño del filtro regional está fuera del rango previsto.");
  }
  return { "network.json": renderJSON(network), "cosmetic.json": JSON.stringify({ domains, exceptions, skipAll }) + "\n" };
}

function main() {
  const checking = process.argv[2] === "--check";
  const text = readFileSync(new URL("source.txt", regionalDir), "utf8");
  const metadata = JSON.parse(readFileSync(new URL("source.json", regionalDir), "utf8"));
  const actual = regionalMetadata(text);
  if (Object.keys(actual).some((key) => actual[key] !== metadata[key])) {
    throw new Error("El origen del filtro regional no coincide con sus metadatos fijados.");
  }
  for (const [file, content] of Object.entries(compileRegional(text))) {
    const path = new URL(file, regionalDir);
    if (checking) {
      if (readFileSync(path, "utf8") !== content) throw new Error(file + " no coincide con la fuente regional.");
    } else {
      writeFileSync(path, content);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
