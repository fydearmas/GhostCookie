import {
  changeSitePause, clearSitePauses, pagePolicy, protectionReady, readProtection, setGlobalProtection
} from "./protection.js";
import { getReputation } from "./reputation.js";
import { expireCookies, getSiteCookies, summarizeCookies } from "./site-cookies.js";

const POPUP = chrome.runtime.getURL("popup/popup.html");
const OPTIONS = chrome.runtime.getURL("options/options.html");
const NATIVE_HOST = "com.ghostcookie.assistant";
const NETWORK_FILTERS = new Set(["tracker_rules", "easylist", "easyprivacy"]);
const documentWrites = new Map();
let analysisPending = false;
let policyChange = Promise.resolve();

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

chrome.webNavigation.onCommitted.addListener(({ tabId, frameId, documentId, timeStamp, url }) => {
  if (frameId !== 0) return;
  const key = recordKey(tabId);
  void writeDocument(tabId, () => webUrl(url)
    ? chrome.storage.session.set({ [key]: { documentId, since: timeStamp, detections: [], hidden: 0 } })
    : chrome.storage.session.remove(key)).catch(() => {});
});

chrome.tabs.onRemoved.addListener((tabId) => {
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
  if (!pagePolicy(await readProtection(), site.url.hostname).enabled) return { ok: true };

  return writeDocument(tabId, async () => {
    const key = recordKey(tabId);
    const record = (await chrome.storage.session.get(key))[key];
    if (record && record.documentId !== site.documentId) return { ok: false };
    const current = record ?? { documentId: site.documentId, since: Date.now(), detections: [], hidden: 0 };
    const unique = new Map(current.detections.map((item) => [item.name, item]));
    const supplied = Array.isArray(message.detections) ? message.detections.slice(0, 100) : [];
    for (const item of supplied) {
      if (typeof item?.name !== "string" || typeof item?.category !== "string") continue;
      const name = item.name.trim().slice(0, 80);
      const category = item.category.trim().slice(0, 50);
      if (name && category && unique.size < 100) unique.set(name, { name, category });
    }
    const hidden = Number.isSafeInteger(message.hidden) ? Math.max(0, Math.min(message.hidden, 10000)) : current.hidden;
    await chrome.storage.session.set({ [key]: { ...current, detections: [...unique.values()], hidden } });
    return { ok: true };
  });
}

async function countBlocks(site, since) {
  if (typeof since !== "number") return null;
  try {
    const { rulesMatchedInfo } = await chrome.declarativeNetRequest.getMatchedRules({
      tabId: site.tabId, minTimeStamp: since
    });
    return rulesMatchedInfo.filter(({ rule }) => NETWORK_FILTERS.has(rule.rulesetId) && rule.ruleId < 1000000).length;
  } catch {
    return null;
  }
}

async function siteSummary(site, protection) {
  const record = await readDocument(site);
  const policy = pagePolicy(protection, site.url.hostname);
  const [blocked, reputation, cookies] = await Promise.all([
    countBlocks(site, record?.since),
    getReputation(site.url),
    getSiteCookies(site.tabId, site.url).catch(() => null)
  ]);
  const current = await getDocument(site.tabId);
  if (current?.documentId !== site.documentId) throw new Error("La página cambió. Actualiza el panel.");
  return {
    tabId: site.tabId, documentId: site.documentId, host: site.url.hostname,
    pause: policy.pause, filtering: policy.enabled, blocked,
    detections: record?.detections ?? [],
    hidden: policy.enabled ? (record?.hidden ?? 0) : 0,
    reputation,
    cookies: cookies ? summarizeCookies(cookies, protection.classifyCookies) : null
  };
}

async function updateContentPolicy() {
  const protection = await readProtection();
  const tabs = await chrome.tabs.query({ url: ["https://*/*", "http://*/*"] });
  await Promise.allSettled(tabs.map(async (tab) => {
    const site = await getDocument(tab.id);
    if (!site) return;
    const { enabled } = pagePolicy(protection, site.url.hostname);
    await chrome.tabs.sendMessage(tab.id, { action: "content:policy", enabled }, { documentId: site.documentId });
  }));
}

function changePolicy(apply) {
  policyChange = policyChange.catch(() => {}).then(async () => {
    await apply();
    await updateContentPolicy();
  });
  return policyChange;
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

async function nativeRequest(request) {
  if (!await chrome.permissions.contains({ permissions: ["nativeMessaging"] })) {
    return { ok: false, error: "Autoriza el acceso al asistente local desde Ajustes.", code: "permission" };
  }
  try {
    const reply = await chrome.runtime.sendNativeMessage(NATIVE_HOST, request);
    if (reply?.ok === true) {
      if (request.action === "status") return { ok: true, configured: reply.configured === true };
      if (typeof reply.text === "string" && reply.text.trim()) return { ok: true, text: reply.text.slice(0, 4000) };
    }
    return {
      ok: false,
      code: typeof reply?.code === "string" ? reply.code.slice(0, 60) : "native-response",
      error: typeof reply?.error === "string" ? reply.error.slice(0, 300) : "El asistente devolvió una respuesta inválida."
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    if (/forbidden|not allowed/i.test(detail)) {
      return { ok: false, code: "native-origin", error: "Este navegador no tiene acceso al asistente. Abre Ghost Cookie Assistant y registra la conexión." };
    }
    if (/not found|not registered/i.test(detail)) {
      return { ok: false, code: "native-missing", error: "El navegador no encontró el asistente. Instálalo y vuelve a comprobar la conexión." };
    }
    return { ok: false, code: "native-unavailable", error: "El navegador no pudo iniciar el asistente local. Comprueba su instalación." };
  }
}

async function analyzeSite(expected) {
  if (analysisPending) return { ok: false, error: "Ya hay un análisis en curso." };
  analysisPending = true;
  try {
    const site = await currentSite(expected);
    const result = await siteSummary(site, await readProtection());
    if (!result.cookies) return { ok: false, error: "No se pudieron leer las señales de cookies. Actualiza el panel." };
    await currentSite(expected);
    return await nativeRequest({ action: "analyze", signals: {
      blocked: result.blocked === null ? null : Math.min(result.blocked, 1000000),
      detected: result.detections.length,
      cookies: Math.min(result.cookies.length, 1000000),
      threat: result.reputation.threat,
      indicators: result.reputation.indicators
    } });
  } finally {
    analysisPending = false;
  }
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
      return { ok: true, enabled: pagePolicy(await readProtection(), url.hostname).enabled };
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
    case "settings:classification":
      if (sender.url !== OPTIONS || typeof message.enabled !== "boolean") return { ok: false };
      await chrome.storage.local.set({ classifyCookies: message.enabled });
      return { ok: true };
    case "settings:resetPauses":
      if (sender.url !== OPTIONS) return { ok: false };
      await changePolicy(clearSitePauses);
      return { ok: true, protection: await readProtection() };
    case "ai:status":
      return nativeRequest({ action: "status" });
  }

  if (sender.url !== POPUP) return { ok: false };
  switch (message.action) {
    case "popup:get": {
      const [site, protection] = await Promise.all([currentSite(), readProtection()]);
      return { ok: true, protection, site: site ? await siteSummary(site, protection) : null };
    }
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
    case "popup:analyze":
      return analyzeSite(assertDocument(message.expected));
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
