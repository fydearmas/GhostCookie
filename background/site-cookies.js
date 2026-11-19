import { classifyCookie, getCategoryInfo } from "../utils/cookie-classifier.js";

function cookieIdentity(cookie) {
  return JSON.stringify([
    cookie.name, cookie.domain, cookie.path, cookie.hostOnly, cookie.storeId,
    cookie.partitionKey?.topLevelSite ?? null, cookie.partitionKey?.hasCrossSiteAncestor ?? null
  ]);
}

export async function getSiteCookies(tabId, url) {
  const host = url.hostname;
  const [stores, partitionResult] = await Promise.all([
    chrome.cookies.getAllCookieStores(),
    chrome.cookies.getPartitionKey({ tabId, frameId: 0 }).catch(() => null)
  ]);
  const storeId = stores.find((store) => store.tabIds.includes(tabId))?.id;
  if (storeId === undefined) throw new Error("Chrome no encontró el almacén de cookies de esta pestaña.");

  const partition = partitionResult?.partitionKey;
  // Use the browser's site boundary for parent-domain cookies, then keep only
  // cookies belonging to this host (or applicable to it from a parent).
  const partitionHost = partition?.topLevelSite ? new URL(partition.topLevelSite).hostname : host;
  const domain = host === partitionHost || host.endsWith("." + partitionHost) ? partitionHost : host;
  const list = [{ storeId, domain }];
  if (partition) list.push({ storeId, domain, partitionKey: partition });
  const batches = await Promise.all(list.map((query) => chrome.cookies.getAll(query)));
  const result = new Map();
  for (const cookie of batches.flat()) {
    const cookieHost = cookie.domain.replace(/^\./, "");
    if (host === cookieHost || (!cookie.hostOnly && host.endsWith("." + cookieHost))) {
      result.set(cookieIdentity(cookie), cookie);
    }
  }
  return result;
}

export function summarizeCookies(cookies, classify) {
  return [...cookies].map(([id, cookie]) => ({
    id,
    name: cookie.name,
    domain: cookie.domain,
    path: cookie.path,
    partitioned: Boolean(cookie.partitionKey),
    category: classify ? getCategoryInfo(classifyCookie(cookie.name)).label : null
  })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function expireCookies(cookies) {
  // Expiry targets the exact domain/path/partition tuple even when a different
  // cookie with the same name also matches a URL passed to cookies.remove.
  const batchSize = 32;
  for (let start = 0; start < cookies.length; start += batchSize) {
    await Promise.allSettled(cookies.slice(start, start + batchSize).map((cookie) => {
      const host = cookie.domain.replace(/^\./, "");
      return chrome.cookies.set({
        url: "https://" + host + "/",
        name: cookie.name,
        value: "",
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
        expirationDate: 1,
        storeId: cookie.storeId,
        ...(cookie.hostOnly ? {} : { domain: cookie.domain }),
        ...(cookie.partitionKey ? { partitionKey: cookie.partitionKey } : {})
      });
    }));
  }
}
