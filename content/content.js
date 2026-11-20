(() => {
  "use strict";

  const SCRIPT_TYPES = /^(?:(?:text|application)\/(?:javascript|ecmascript)|module)?$/i;
  const INLINE_SIGNATURES = [
    [/\bgtag\s*\(/i, "Google Analytics", "Analytics"],
    [/\bga\s*\(\s*["']create/i, "Google Analytics", "Analytics"],
    [/\bfbq\s*\(/i, "Facebook Pixel", "Social Media"],
    [/\b_hj\s*\(/i, "Hotjar", "Analytics"],
    [/\bmixpanel\.track\s*\(/i, "Mixpanel", "Analytics"],
    [/\bamplitude\.getInstance\s*\(/i, "Amplitude", "Analytics"],
    [/\bheap\.track\s*\(/i, "Heap Analytics", "Analytics"],
    [/\banalytics\.track\s*\(/i, "Segment", "Analytics"],
    [/\bintercomSettings\b/i, "Intercom", "Marketing"],
    [/\bclarity\s*\(/i, "Microsoft Clarity", "Analytics"],
    [/\btwq\s*\(/i, "Twitter Pixel", "Social Media"],
    [/\blintrk\s*\(/i, "LinkedIn Insight", "Social Media"],
    [/\b_hsq\.push\s*\(/i, "HubSpot", "Marketing"],
  ];
  const NETWORK_SIGNATURES = new Map([
    ["google-analytics.com", ["Google Analytics", "Analytics"]],
    ["googletagmanager.com", ["Google Tag Manager", "Analytics"]],
    ["connect.facebook.net", ["Facebook Pixel", "Social Media"]],
    ["pixel.facebook.com", ["Facebook Pixel", "Social Media"]],
    ["hotjar.com", ["Hotjar", "Analytics"]],
    ["mixpanel.com", ["Mixpanel", "Analytics"]],
    ["amplitude.com", ["Amplitude", "Analytics"]],
    ["heapanalytics.com", ["Heap Analytics", "Analytics"]],
    ["segment.com", ["Segment", "Analytics"]],
    ["segment.io", ["Segment", "Analytics"]],
    ["clarity.ms", ["Microsoft Clarity", "Analytics"]],
    ["fullstory.com", ["FullStory", "Analytics"]],
    ["intercom.io", ["Intercom", "Marketing"]],
    ["hs-analytics.net", ["HubSpot", "Marketing"]],
    ["hs-scripts.com", ["HubSpot", "Marketing"]],
    ["doubleclick.net", ["DoubleClick", "Advertising"]],
    ["googlesyndication.com", ["Google Ads", "Advertising"]],
    ["criteo.com", ["Criteo", "Advertising"]],
    ["taboola.com", ["Taboola", "Advertising"]],
    ["outbrain.com", ["Outbrain", "Advertising"]],
  ]);
  const SOURCE_ELEMENTS = "script,img[src],iframe[src]";
  const MAX_PENDING_ROOTS = 50;
  const MAX_FILTERED_ELEMENTS = 5000;
  const SCAN_DELAY_MS = 120;

  const youtube = globalThis.ghostCookieYouTube;
  const pendingRoots = new Set();
  const filteredElements = new Set();
  const detections = new Map();
  const observer = new MutationObserver(queueMutations);
  let enabled = false;
  let cosmeticSheet;
  let regionalSelectors = [];
  let cosmeticSelector = "";
  let scanTimer;
  let policyRevision = 0;
  let lastReport;
  let detectionRevision = 0;

  function domainsFor(hostname) {
    const labels = hostname.toLowerCase().replace(/\.$/, "").split(".");
    return labels.slice(0, Math.max(1, labels.length - 1)).map(
      (_, index) => labels.slice(index).join(".")
    );
  }

  function createCosmeticSheet() {
    const {
      generic = [], domains = {}, exceptions = {}, skipGeneric = [], skipAll = [],
    } = globalThis.ghostCookieCosmeticRules ?? {};
    const hosts = domainsFor(location.hostname);
    const excluded = new Set(
      ["*", ...hosts].flatMap((host) => Object.hasOwn(exceptions, host) ? exceptions[host] : [])
    );
    const skipAllCosmetics = skipAll.includes("*") || hosts.some((host) => skipAll.includes(host));
    const skipGenericCosmetics = skipGeneric.includes("*") ||
      hosts.some((host) => skipGeneric.includes(host));
    const selectors = skipAllCosmetics ? [] : [
      ...(skipGenericCosmetics ? [] : generic),
      ...hosts.flatMap((host) => Object.hasOwn(domains, host) ? domains[host] : []),
      ...regionalSelectors,
      ...(youtube?.selectors ?? []),
    ];
    const usableSelectors = [...new Set(selectors)].filter(
      (selector) => !excluded.has(selector) && CSS.supports(`selector(${selector})`)
    );
    cosmeticSelector = usableSelectors.join(",");
    cosmeticSheet = new CSSStyleSheet();
    cosmeticSheet.replaceSync(
      usableSelectors.map((selector) => `${selector} { display: none !important; }`).join("\n")
    );
  }

  function start() {
    if (!cosmeticSheet) createCosmeticSheet();
    if (cosmeticSelector) {
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, cosmeticSheet];
    }
    observer.observe(document, {
      attributes: true,
      attributeFilter: ["aria-disabled", "class", "disabled", "hidden", "href", "id", "src", "style"],
      childList: true,
      subtree: true,
    });
    queueRoot(document);
    scheduleScan();
  }

  function stop() {
    observer.disconnect();
    clearTimeout(scanTimer);
    scanTimer = undefined;
    pendingRoots.clear();
    filteredElements.clear();
    lastReport = undefined;
    if (cosmeticSheet) {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
        (sheet) => sheet !== cosmeticSheet
      );
    }
  }

  function setPolicy(nextEnabled, nextSelectors = []) {
    const changed = nextSelectors.length !== regionalSelectors.length ||
      nextSelectors.some((selector, index) => selector !== regionalSelectors[index]);
    if (enabled === nextEnabled && !changed) return;
    if (enabled) stop();
    if (changed) cosmeticSheet = undefined;
    regionalSelectors = nextSelectors;
    enabled = nextEnabled;
    if (enabled) start();
  }

  function queueRoot(root) {
    if (pendingRoots.has(document)) return;
    if (root === document || pendingRoots.size >= MAX_PENDING_ROOTS) {
      pendingRoots.clear();
      pendingRoots.add(document);
    } else if (root instanceof Element) {
      pendingRoots.add(root);
    }
  }

  function queueMutations(mutations) {
    for (const mutation of mutations) {
      if (mutation.type === "attributes" || mutation.target instanceof HTMLScriptElement) {
        queueRoot(mutation.target);
      }
      for (const node of mutation.addedNodes) queueRoot(node);
    }
    scheduleScan();
  }

  function scheduleScan() {
    if (scanTimer === undefined) scanTimer = setTimeout(scan, SCAN_DELAY_MS);
  }

  function eachMatch(root, selector, inspect) {
    if (root instanceof Element && root.matches(selector)) inspect(root);
    for (const match of root.querySelectorAll(selector)) inspect(match);
  }

  function recordDetection(name, category, host) {
    if (!detections.has(name)) {
      detections.set(name, { name, category, domains: [] });
      detectionRevision += 1;
    }
    const { domains } = detections.get(name);
    if (host && domains.length < 8 && !domains.includes(host)) {
      domains.push(host);
      detectionRevision += 1;
    }
  }

  function inspectSource(element) {
    const src = element.getAttribute("src");
    if (src !== null) {
      try {
        const url = new URL(src, document.baseURI);
        if (url.protocol !== "https:" && url.protocol !== "http:") return;
        for (const domain of domainsFor(url.hostname)) {
          const signature = NETWORK_SIGNATURES.get(domain);
          if (signature) {
            recordDetection(...signature, url.hostname);
            return;
          }
        }
        if (
          (url.hostname === "facebook.com" || url.hostname.endsWith(".facebook.com")) &&
          (url.pathname === "/tr" || url.pathname === "/tr/")
        ) {
          recordDetection("Facebook Pixel", "Social Media", url.hostname);
        }
      } catch {
        // Ignore malformed attributes.
      }
    } else if (element instanceof HTMLScriptElement && SCRIPT_TYPES.test(element.type.trim())) {
      const script = element.textContent.slice(0, 32_768);
      for (const [pattern, name, category] of INLINE_SIGNATURES) {
        if (!detections.has(name) && pattern.test(script)) recordDetection(name, category);
      }
    }
  }

  function inspectCosmetic(element) {
    if (filteredElements.size >= MAX_FILTERED_ELEMENTS || filteredElements.has(element)) return;
    if (getComputedStyle(element).display === "none") filteredElements.add(element);
  }

  function scan() {
    scanTimer = undefined;
    if (!enabled) return;
    const roots = [...pendingRoots].filter((root) => root.isConnected);
    pendingRoots.clear();
    const scanRoots = roots.filter(
      (root) => !roots.some((other) => other !== root && other.contains(root))
    );
    for (const element of filteredElements) {
      if (!element.isConnected || scanRoots.some((root) => root.contains(element))) {
        filteredElements.delete(element);
      }
    }
    for (const root of scanRoots) {
      eachMatch(root, SOURCE_ELEMENTS, inspectSource);
      if (cosmeticSelector) eachMatch(root, cosmeticSelector, inspectCosmetic);
    }
    youtube?.skipAdIfAvailable();
    const hidden = filteredElements.size;
    if (lastReport?.hidden === hidden && lastReport.detectionRevision === detectionRevision) return;
    const report = {
      action: "content:report",
      detections: [...detections.values()],
      hidden,
    };
    lastReport = { hidden, detectionRevision };
    chrome.runtime.sendMessage(report).catch(() => {});
  }

  function refreshPolicy() {
    const revision = policyRevision;
    chrome.runtime.sendMessage({ action: "content:getPolicy" }).then((policy) => {
      if (revision !== policyRevision || !policy?.ok || typeof policy.enabled !== "boolean") return;
      setPolicy(policy.enabled, policy.regionalSelectors);
      if (enabled) {
        lastReport = undefined;
        queueRoot(document);
        scheduleScan();
      }
    }).catch(() => {});
  }

  chrome.runtime.onMessage.addListener((message, sender) => {
    if (sender.id !== chrome.runtime.id || message?.action !== "content:policy" ||
        typeof message.enabled !== "boolean") return;
    policyRevision += 1;
    setPolicy(message.enabled, message.regionalSelectors);
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) refreshPolicy();
  });
  refreshPolicy();
})();
