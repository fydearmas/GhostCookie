const FILTERS = ["tracker_rules", "easylist", "easyprivacy", "reputation"];
const SITE_ALLOW_ID = 1000001;
const SITE_NAVIGATION_ID = 1000002;
const SITE_IDS = [SITE_ALLOW_ID, SITE_NAVIGATION_ID];
const MAX_PAUSED_SITES = 1000;

const dnr = chrome.declarativeNetRequest;

export const protectionReady = initialize();

async function initialize() {
  await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  const previous = await chrome.storage.local.get(["protectionEnabled", "classifyCookies"]);
  await chrome.storage.local.remove([
    "geminiApiKey", "enableAI", "blockedTrackers", "detectedTrackers", "networkBlocks", "showPrivacyScore"
  ]);
  await setRulesEnabled(previous.protectionEnabled !== false).catch(() => {});
  return previous.classifyCookies !== false;
}

async function setRulesEnabled(enabled) {
  const existing = await dnr.getEnabledRulesets();
  const changed = FILTERS.filter((id) => existing.includes(id) !== enabled);
  if (changed.length) {
    await dnr.updateEnabledRulesets(enabled
      ? { enableRulesetIds: changed }
      : { disableRulesetIds: changed });
  }
}

export async function readProtection() {
  const classifyCookies = await protectionReady;
  const [rulesets, rules, settings] = await Promise.all([
    dnr.getEnabledRulesets(),
    dnr.getDynamicRules({ ruleIds: [SITE_ALLOW_ID] }),
    chrome.storage.local.get("classifyCookies")
  ]);
  const activeCount = FILTERS.filter((id) => rulesets.includes(id)).length;
  return {
    enabled: activeCount === FILTERS.length,
    partial: activeCount > 0 && activeCount < FILTERS.length,
    pausedSites: rules[0]?.condition.topDomains ?? [],
    classifyCookies: settings.classifyCookies ?? classifyCookies
  };
}

export async function setGlobalProtection(enabled) {
  await protectionReady;
  const { protectionEnabled } = await chrome.storage.local.get("protectionEnabled");
  await setRulesEnabled(enabled);
  try {
    await chrome.storage.local.set({ protectionEnabled: enabled });
  } catch (error) {
    await setRulesEnabled(protectionEnabled !== false);
    throw error;
  }
}

function domainMatches(host, domain) {
  const normalizedHost = host.replace(/\.$/, "");
  return normalizedHost === domain || normalizedHost.endsWith("." + domain);
}

export function pagePolicy(protection, host) {
  const pause = protection.pausedSites.find((domain) => domainMatches(host, domain));
  return { enabled: protection.enabled && !pause, pause: pause ?? null };
}

export async function changeSitePause(host, paused) {
  const { pausedSites } = await readProtection();
  const next = paused
    ? [...new Set([...pausedSites, host.replace(/\.$/, "")])]
    : pausedSites.filter((domain) => !domainMatches(host, domain));
  await writePausedSites(next);
}

export async function resumePausedSite(domain) {
  const { pausedSites } = await readProtection();
  const next = pausedSites.filter((site) => site !== domain);
  if (next.length !== pausedSites.length) await writePausedSites(next);
}

export function clearSitePauses() {
  return writePausedSites([]);
}

async function writePausedSites(domains) {
  if (domains.length > MAX_PAUSED_SITES) throw new Error("Alcanzaste el límite de sitios en pausa.");
  domains.sort();
  const addRules = domains.length ? [
    {
      id: SITE_ALLOW_ID, priority: 1000, action: { type: "allow" },
      condition: { topDomains: domains, excludedResourceTypes: ["main_frame"] }
    },
    {
      id: SITE_NAVIGATION_ID, priority: 1000, action: { type: "allow" },
      condition: { requestDomains: domains, resourceTypes: ["main_frame"] }
    }
  ] : [];
  const existing = await dnr.getDynamicRules({ ruleIds: SITE_IDS });
  if (existing.length || addRules.length) {
    await dnr.updateDynamicRules({ removeRuleIds: existing.map(({ id }) => id), addRules });
  }
}
