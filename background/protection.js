const FILTERS = ["tracker_rules", "easylist", "easyprivacy", "reputation"];
export const REGIONAL_FILTER = "adguard_es_pt";
const PROTECTION_KEYS = ["protectionEnabled", "regionalEnabled"];
const SITE_ALLOW_ID = 1000001;
const SITE_NAVIGATION_ID = 1000002;
const SITE_IDS = [SITE_ALLOW_ID, SITE_NAVIGATION_ID];
const MAX_PAUSED_SITES = 1000;

const dnr = chrome.declarativeNetRequest;

export const protectionReady = initialize();

async function initialize() {
  await chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  const previous = await chrome.storage.local.get([...PROTECTION_KEYS, "classifyCookies"]);
  // Elimina credenciales y datos de versiones anteriores al actualizar.
  await chrome.storage.local.remove([
    "geminiApiKey", "enableAI", "blockedTrackers", "detectedTrackers", "networkBlocks", "showPrivacyScore"
  ]);
  await setRulesEnabled(previous).catch(() => {});
  return previous.classifyCookies !== false;
}

async function setRulesEnabled(settings) {
  const existing = await dnr.getEnabledRulesets();
  const desired = new Set(settings.protectionEnabled === false ? [] : FILTERS);
  if (desired.size && settings.regionalEnabled === true) desired.add(REGIONAL_FILTER);
  const enableRulesetIds = [...desired].filter((id) => !existing.includes(id));
  const disableRulesetIds = [...FILTERS, REGIONAL_FILTER].filter((id) => existing.includes(id) && !desired.has(id));
  if (enableRulesetIds.length || disableRulesetIds.length) {
    await dnr.updateEnabledRulesets({ enableRulesetIds, disableRulesetIds });
  }
}

export async function readProtection() {
  const classifyCookies = await protectionReady;
  const [rulesets, rules, visitRules, settings] = await Promise.all([
    dnr.getEnabledRulesets(),
    dnr.getDynamicRules({ ruleIds: [SITE_ALLOW_ID] }),
    dnr.getSessionRules(),
    chrome.storage.local.get(["classifyCookies", "regionalEnabled"])
  ]);
  const activeCount = FILTERS.filter((id) => rulesets.includes(id)).length;
  return {
    enabled: activeCount === FILTERS.length,
    regionalEnabled: rulesets.includes(REGIONAL_FILTER),
    regionalPreferred: settings.regionalEnabled === true,
    partial: activeCount > 0 && activeCount < FILTERS.length,
    pausedSites: rules[0]?.condition.topDomains ?? [],
    visits: visitRules.map(({ condition }) => ({ tabId: condition.tabIds[0], host: condition.topDomains[0] })),
    classifyCookies: settings.classifyCookies ?? classifyCookies
  };
}

async function saveRuleSettings(change) {
  await protectionReady;
  const previous = await chrome.storage.local.get(PROTECTION_KEYS);
  await setRulesEnabled({ ...previous, ...change });
  try {
    await chrome.storage.local.set(change);
  } catch (error) {
    await setRulesEnabled(previous);
    throw error;
  }
}

export function setGlobalProtection(enabled) {
  return saveRuleSettings({ protectionEnabled: enabled });
}

export function setRegionalProtection(enabled) {
  return saveRuleSettings({ regionalEnabled: enabled });
}

function domainMatches(host, domain) {
  const normalizedHost = host.replace(/\.$/, "");
  return normalizedHost === domain || normalizedHost.endsWith("." + domain);
}

export function pagePolicy(protection, host, tabId) {
  const pause = protection.pausedSites.find((domain) => domainMatches(host, domain));
  const visitPaused = protection.visits.some((visit) => visit.tabId === tabId && visit.host === normalizeHost(host));
  return { enabled: protection.enabled && !pause && !visitPaused, pause: pause ?? null, visitPaused };
}

function normalizeHost(host) {
  return host.replace(/\.$/, "");
}

export async function changeVisitPause(tabId, host, paused) {
  // Session rules use the tab ID and are discarded when the browser exits.
  const addRules = paused ? [{
    id: tabId, priority: 1000, action: { type: "allow" },
    condition: { tabIds: [tabId], topDomains: [normalizeHost(host)], excludedResourceTypes: ["main_frame"] }
  }] : [];
  await dnr.updateSessionRules({ removeRuleIds: [tabId], addRules });
}

export async function endVisitPause(tabId, host) {
  const [rule] = await dnr.getSessionRules({ ruleIds: [tabId] });
  if (rule && (!host || rule.condition.topDomains[0] !== normalizeHost(host))) {
    await changeVisitPause(tabId, host, false);
  }
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
