import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { domainToASCII } from "node:url";

const source = JSON.parse(await readFile(new URL("../reputation/source.json", import.meta.url), "utf8"));
const upstream = process.argv[2]
  ? await readFile(process.argv[2])
  : await fetch(source.url, { redirect: "error", signal: AbortSignal.timeout(30000) })
      .then(async (response) => {
        if (!response.ok) throw new Error("PhishDestroy respondió " + response.status);
        return new Uint8Array(await response.arrayBuffer());
      });

if (createHash("sha256").update(upstream).digest("hex") !== source.sha256) {
  throw new Error("El SHA-256 de la lista de reputación no coincide.");
}

const sharedHosts = new Set([
  "blogspot.com", "github.io", "gitlab.io", "google.com", "netlify.app", "ngrok.io",
  "onrender.com", "pages.dev", "replit.app", "s3.amazonaws.com", "sites.google.com",
  "vercel.app", "web.app", "weebly.com", "wixsite.com", "workers.dev", "wordpress.com"
]);
const dnsName = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const domains = [...new Set(JSON.parse(Buffer.from(upstream)).map((entry) => {
  if (typeof entry !== "string" || /[^\p{L}\p{M}\p{N}.\-]/u.test(entry)) return "";
  return domainToASCII(entry.trim().toLowerCase()).replace(/\.$/, "");
}).filter((name) => name.length <= 253 && dnsName.test(name) && !sharedHosts.has(name)))].sort();

if (domains.length < 100 || domains.length > 250000) throw new Error("Volumen de reputación inesperado.");
const rules = [];
for (let offset = 0; offset < domains.length; offset += 256) {
  rules.push({
    id: rules.length + 1, priority: 2000,
    action: { type: "redirect", redirect: { extensionPath: "/reputation/warning.html" } },
    condition: { requestDomains: domains.slice(offset, offset + 256), resourceTypes: ["main_frame"] }
  });
}

await writeFile(new URL("../rules/reputation.json", import.meta.url),
  "[\n" + rules.map((rule) => "  " + JSON.stringify(rule)).join(",\n") + "\n]\n");
console.log(domains.length + " dominios de reputación; " + rules.length + " reglas.");
