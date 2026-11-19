const BRAND_LABELS = new Set(["amazon", "facebook", "google", "instagram", "microsoft", "netflix", "paypal", "whatsapp"]);
const LOOKALIKE_SUFFIXES = new Set(["com", "net", "org"]);
const LOOKALIKE_DIGITS = { 0: "o", 1: "l", 3: "e", 5: "s" };
let bundledDomains;

function looksLikeBrand(labels) {
  const suffix = labels.at(-1);
  const label = labels.at(-2);
  if (!label || !LOOKALIKE_SUFFIXES.has(suffix) || BRAND_LABELS.has(label)) return false;
  const normalized = label.replace(/[0135]/g, (digit) => LOOKALIKE_DIGITS[digit]);
  if (BRAND_LABELS.has(normalized)) return true;
  for (let i = 0; i < label.length - 1; i++) {
    const swapped = label.slice(0, i) + label[i + 1] + label[i] + label.slice(i + 2);
    if (BRAND_LABELS.has(swapped)) return true;
  }
  return false;
}

async function listDomains() {
  const response = await fetch(chrome.runtime.getURL("rules/reputation.json"));
  if (!response.ok) throw new Error("Missing bundled reputation rules");
  const rules = await response.json();
  return new Set(rules.flatMap((rule) => rule.condition.requestDomains));
}

export async function getReputation(url) {
  const indicators = [];
  if (url.protocol === "http:") indicators.push("insecure-http");
  const parts = url.hostname.replace(/\.$/, "").split(".");
  if (parts.some((label) => label.startsWith("xn--"))) {
    indicators.push("internationalized-domain");
  }

  if (looksLikeBrand(parts)) indicators.push("lookalike-domain");

  const domains = await (bundledDomains ??= listDomains()).catch(() => {
    bundledDomains = undefined;
    return null;
  });
  if (!domains) return { threat: "unavailable", indicators };
  for (let index = 0; index < parts.length - 1; index++) {
    if (domains.has(parts.slice(index).join("."))) {
      return { threat: "known", indicators: [...indicators, "known-threat"] };
    }
  }
  return { threat: "none", indicators };
}
