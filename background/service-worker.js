import {
  changeSitePause, changeVisitPause, clearSitePauses, endVisitPause, pagePolicy, protectionReady, readProtection,
  REGIONAL_FILTER, resumePausedSite, setGlobalProtection, setRegionalProtection
} from "./protection.js";
import { getReputation } from "./reputation.js";
import { expireCookies, getSiteCookies, summarizeCookies } from "./site-cookies.js";

const POPUP = chrome.runtime.getURL("popup/popup.html");
const OPTIONS = chrome.runtime.getURL("options/options.html");
const NETWORK_FILTERS = ["tracker_rules", "easylist", "easyprivacy", REGIONAL_FILTER];
const documentWrites = new Map();
let policyChange = Promise.resolve();
let regionalCosmetics;

function reconcileOnStart() {
  void protectionReady.catch(() => {});
}

chrome.runtime.onInstalled.addListener(reconcileOnStart);
chrome.runtime.onStartup.addListener(reconcileOnStart);

function webUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

const recordKey = (tabId) => "document:" + tabId;

function writeDocument(tabId, update) {
  const work = (documentWrites.get(tabId) ?? Promise.resolve()).catch(() => {}).then(update);
  documentWrites.set(tabId, work);
  const cleanup = () => {
    if (documentWrites.get(tabId) === work) documentWrites.delete(tabId);
  };
  work.then(cleanup, cleanup);
  return work;
}

chrome.webNavigation.onCommitted.addListener(({ tabId, frameId, documentId, url }) => {
  if (frameId !== 0) return;
  void queuePolicyChange(() => endVisitPause(tabId, webUrl(url)?.hostname)).catch(() => {});
  const key = recordKey(tabId);
  void writeDocument(tabId, () => webUrl(url)
    ? chrome.storage.session.set({ [key]: { documentId, detections: [], hidden: 0 } })
    : chrome.storage.session.remove(key)).catch(() => {});
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void queuePolicyChange(() => endVisitPause(tabId)).catch(() => {});
  void writeDocument(tabId, () => chrome.storage.session.remove(recordKey(tabId))).catch(() => {});
});

async function getDocument(tabId) {
  const frame = await chrome.webNavigation.getFrame({ tabId, frameId: 0 }).catch(() => null);
  const url = webUrl(frame?.url);
  return url && frame.documentId ? { tabId, documentId: frame.documentId, url } : null;
}

async function currentSite(expected) {
  let tab;
  if (expected) {
    tab = await chrome.tabs.get(expected.tabId).catch(() => null);
  } else {
    const window = await chrome.windows.getLastFocused({ windowTypes: ["normal"] }).catch(() => null);
    if (Number.isInteger(window?.id)) {
      [tab] = await chrome.tabs.query({ active: true, windowId: window.id });
    }
  }
  const site = tab?.active ? await getDocument(tab.id) : null;
  if (expected && (site?.tabId !== expected.tabId || site?.documentId !== expected.documentId)) {
    throw new Error("La página cambió. Actualiza el panel e inténtalo de nuevo.");
  }
  return site;
}

async function readDocument(site) {
  const key = recordKey(site.tabId);
  await documentWrites.get(site.tabId)?.catch(() => {});
  const record = (await chrome.storage.session.get(key))[key];
  return record?.documentId === site.documentId ? record : null;
}

async function reportContent(sender, message) {
  const tabId = sender.tab.id;
  const site = await getDocument(tabId);
  if (!site || site.documentId !== sender.documentId) return { ok: false };
  if (!pagePolicy(await readProtection(), site.url.hostname, site.tabId).enabled) return { ok: true };

  return writeDocument(tabId, async () => {
    const key = recordKey(tabId);
    const record = (await chrome.storage.session.get(key))[key];
    if (record && record.documentId !== site.documentId) return { ok: false };
    const current = record ?? { documentId: site.documentId, detections: [], hidden: 0 };
    const unique = new Map(current.detections.map((item) => [item.name, item]));
    const supplied = Array.isArray(message.detections) ? message.detections.slice(0, 100) : [];
    for (const item of supplied) {
      if (typeof item?.name !== "string" || typeof item?.category !== "string") continue;
      const name = item.name.trim().slice(0, 80);
      const category = item.category.trim().slice(0, 50);
      if (!name || !category || (!unique.has(name) && unique.size >= 100)) continue;
      const domains = Array.isArray(item.domains)
        ? item.domains.slice(0, 8).filter((domain) => typeof domain === "string" && /^[a-z0-9.-]{1,253}$/.test(domain))
        : [];
      const previous = unique.get(name)?.domains ?? [];
      unique.set(name, { name, category, domains: [...new Set([...previous, ...domains])].slice(0, 8) });
    }
    const hidden = Number.isSafeInteger(message.hidden) ? Math.max(0, Math.min(message.hidden, 10000)) : current.hidden;
    await chrome.storage.session.set({ [key]: { ...current, detections: [...unique.values()], hidden } });
    return { ok: true };
  });
}

async function countBlocks(tabId) {
  try {
    // Chromium associates matches for a tab ID with its current document.
    const { rulesMatchedInfo } = await chrome.declarativeNetRequest.getMatchedRules({ tabId });
    const sources = Object.fromEntries(NETWORK_FILTERS.map((id) => [id, 0]));
    for (const { rule } of rulesMatchedInfo) {
      if (Object.hasOwn(sources, rule.rulesetId) && rule.ruleId < 1000000) sources[rule.rulesetId]++;
    }
    return sources;
  } catch {
    return null;
  }
}

async function siteSummary(site, protection) {
  const record = await readDocument(site);
  const policy = pagePolicy(protection, site.url.hostname, site.tabId);
  const [blockSources, reputation, cookies] = await Promise.all([
    countBlocks(site.tabId),
    getReputation(site.url),
    getSiteCookies(site.tabId, site.url).catch(() => null)
  ]);
  const current = await getDocument(site.tabId);
  if (current?.documentId !== site.documentId) throw new Error("La página cambió. Actualiza el panel.");
  return {
    tabId: site.tabId, documentId: site.documentId, host: site.url.hostname,
    pause: policy.pause, visitPaused: policy.visitPaused, filtering: policy.enabled, blockSources,
    blocked: blockSources ? Object.values(blockSources).reduce((total, count) => total + count, 0) : null,
    detections: record?.detections ?? [],
    hidden: policy.enabled ? (record?.hidden ?? 0) : 0,
    reputation,
    cookies: cookies ? summarizeCookies(cookies, protection.classifyCookies) : null
  };
}

async function loadRegionalCosmetics() {
  const response = await fetch(chrome.runtime.getURL("rules/adguard-es-pt/cosmetic.json"));
  if (!response.ok) throw new Error("No se pudo leer el filtro visual regional.");
  return response.json();
}

async function contentPolicy(protection, host, tabId) {
  const { enabled } = pagePolicy(protection, host, tabId);
  if (!enabled || !protection.regionalEnabled) return { enabled };

  const data = await (regionalCosmetics ??= loadRegionalCosmetics()).catch(() => {
    regionalCosmetics = undefined;
    return null;
  });
  if (!data) return { enabled };
  const labels = host.replace(/\.$/, "").split(".");
  const scopes = labels.slice(0, Math.max(1, labels.length - 1)).map((_, index) => labels.slice(index).join("."));
  if (data.skipAll.includes("*") || scopes.some((scope) => data.skipAll.includes(scope))) return { enabled };
  const excluded = new Set(["*", ...scopes].flatMap((scope) =>
    Object.hasOwn(data.exceptions, scope) ? data.exceptions[scope] : []));
  const regionalSelectors = [...new Set(scopes.flatMap((scope) =>
    Object.hasOwn(data.domains, scope) ? data.domains[scope] : []))].filter((selector) => !excluded.has(selector));
  return { enabled, regionalSelectors };
}

async function updateContentPolicy() {
  const protection = await readProtection();
  const tabs = await chrome.tabs.query({ url: ["https://*/*", "http://*/*"] });
  await Promise.allSettled(tabs.map(async (tab) => {
    const site = await getDocument(tab.id);
    if (!site) return;
    const policy = await contentPolicy(protection, site.url.hostname, site.tabId);
    await chrome.tabs.sendMessage(tab.id, { action: "content:policy", ...policy }, { documentId: site.documentId });
  }));
}

function queuePolicyChange(apply) {
  policyChange = policyChange.catch(() => {}).then(apply);
  return policyChange;
}

function changePolicy(apply) {
  return queuePolicyChange(async () => {
    await apply();
    await updateContentPolicy();
  });
}

async function troubleshootSite(expected) {
  return queuePolicyChange(async () => {
    const site = await currentSite(expected);
    const protection = await readProtection();
    const policy = pagePolicy(protection, site.url.hostname, site.tabId);
    if (!protection.enabled || policy.pause) {
      throw new Error("El filtrado ya está en pausa para esta página.");
    }
    await changeVisitPause(site.tabId, site.url.hostname, !policy.visitPaused);
    try {
      await currentSite(expected);
      await chrome.tabs.reload(site.tabId);
    } catch (error) {
      await changeVisitPause(site.tabId, site.url.hostname, policy.visitPaused);
      throw error;
    }
    return { ok: true, paused: !policy.visitPaused };
  });
}

async function clearCookies(message) {
  const site = await currentSite(message.expected);
  const before = await getSiteCookies(site.tabId, site.url);
  if (message.id != null && !before.has(message.id)) {
    throw new Error("La cookie ya no está disponible. Actualiza el panel.");
  }
  const selected = message.id == null ? before : new Map([[message.id, before.get(message.id)]]);
  await currentSite(message.expected);
  await expireCookies([...selected.values()]);
  const after = await getSiteCookies(site.tabId, site.url);
  const remaining = [...selected.keys()].filter((id) => after.has(id)).length;
  return { ok: true, removed: selected.size - remaining, remaining };
}

function assertDocument(expected) {
  if (!Number.isInteger(expected?.tabId) || typeof expected?.documentId !== "string") {
    throw new Error("Abre una página web para usar esta acción.");
  }
  return expected;
}

async function handle(message, sender) {
  if (sender.id !== chrome.runtime.id || typeof message?.action !== "string") return { ok: false };

  if (message.action.startsWith("content:")) {
    const url = webUrl(sender.url);
    if (!url || !sender.tab || sender.frameId !== 0 || !sender.documentId) return { ok: false };
    if (message.action === "content:getPolicy") {
      return { ok: true, ...await contentPolicy(await readProtection(), url.hostname, sender.tab.id) };
    }
    if (message.action === "content:report") return reportContent(sender, message);
    return { ok: false };
  }

  if (sender.url !== POPUP && sender.url !== OPTIONS) return { ok: false };
  switch (message.action) {
    case "settings:get":
      return { ok: true, protection: await readProtection() };
    case "settings:global":
      if (typeof message.enabled !== "boolean") return { ok: false };
      await changePolicy(() => setGlobalProtection(message.enabled));
      return { ok: true, protection: await readProtection() };
    case "settings:regional":
      if (sender.url !== OPTIONS || typeof message.enabled !== "boolean") return { ok: false };
      await changePolicy(() => setRegionalProtection(message.enabled));
      return { ok: true, protection: await readProtection() };
    case "settings:classification":
      if (sender.url !== OPTIONS || typeof message.enabled !== "boolean") return { ok: false };
      await chrome.storage.local.set({ classifyCookies: message.enabled });
      return { ok: true };
    case "settings:resumeSite":
      if (sender.url !== OPTIONS || typeof message.domain !== "string") return { ok: false };
      await changePolicy(() => resumePausedSite(message.domain));
      return { ok: true, protection: await readProtection() };
    case "settings:resetPauses":
      if (sender.url !== OPTIONS) return { ok: false };
      await changePolicy(clearSitePauses);
      return { ok: true, protection: await readProtection() };
  }

  if (sender.url !== POPUP) return { ok: false };
  switch (message.action) {
    case "popup:get": {
      const [site, protection] = await Promise.all([currentSite(), readProtection()]);
      return { ok: true, protection, site: site ? await siteSummary(site, protection) : null };
    }
    case "popup:troubleshoot":
      return troubleshootSite(assertDocument(message.expected));
    case "popup:sitePause": {
      const site = await currentSite(assertDocument(message.expected));
      if (typeof message.paused !== "boolean") return { ok: false };
      await changePolicy(async () => {
        await currentSite(message.expected);
        await changeSitePause(site.url.hostname, message.paused);
      });
      return { ok: true };
    }
    case "popup:clearCookies":
      assertDocument(message.expected);
      if (message.id != null && typeof message.id !== "string") return { ok: false };
      return clearCookies(message);
    default:
      return { ok: false };
  }
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  handle(message, sender).then(reply, (error) => reply({
    ok: false,
    error: error instanceof Error && error.message
      ? error.message : "No se pudo completar la acción en Chrome."
  }));
  return true;
});
