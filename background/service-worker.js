/**
 * Ghost Cookie v1.0.0
 * Copyright (c) 2025 Franky Solutions
 * Developed by: Franky Solutions
 * Build: mizdukir
 * Watermark: GC-mizdukir
 * 
 * This code is protected by copyright.
 * Unauthorized use is prohibited.
 */

// Ghost Cookie - Service Worker
// Background script for tracker detection and blocking

import { TRACKER_LIST, getTrackerInfo } from "./tracker-list.js";

// ===== Tracker Patterns for Network Detection =====
const TRACKER_PATTERNS = [
  {
    pattern: "google-analytics.com",
    name: "Google Analytics",
    category: "Analytics",
  },
  {
    pattern: "googletagmanager.com",
    name: "Google Tag Manager",
    category: "Analytics",
  },
  { pattern: "doubleclick.net", name: "DoubleClick", category: "Advertising" },
  {
    pattern: "googlesyndication.com",
    name: "Google Ads",
    category: "Advertising",
  },
  {
    pattern: "googleadservices.com",
    name: "Google Ads",
    category: "Advertising",
  },
  { pattern: "facebook.net", name: "Facebook Pixel", category: "Social Media" },
  {
    pattern: "facebook.com/tr",
    name: "Facebook Pixel",
    category: "Social Media",
  },
  {
    pattern: "connect.facebook",
    name: "Facebook Pixel",
    category: "Social Media",
  },
  { pattern: "hotjar.com", name: "Hotjar", category: "Analytics" },
  { pattern: "mixpanel.com", name: "Mixpanel", category: "Analytics" },
  { pattern: "amplitude.com", name: "Amplitude", category: "Analytics" },
  { pattern: "segment.com", name: "Segment", category: "Analytics" },
  { pattern: "segment.io", name: "Segment", category: "Analytics" },
  { pattern: "clarity.ms", name: "Microsoft Clarity", category: "Analytics" },
  { pattern: "fullstory.com", name: "FullStory", category: "Analytics" },
  {
    pattern: "heapanalytics.com",
    name: "Heap Analytics",
    category: "Analytics",
  },
  { pattern: "hubspot.com", name: "HubSpot", category: "Marketing" },
  { pattern: "hs-scripts.com", name: "HubSpot", category: "Marketing" },
  { pattern: "hs-analytics.net", name: "HubSpot", category: "Marketing" },
  { pattern: "intercom.io", name: "Intercom", category: "Marketing" },
  { pattern: "crisp.chat", name: "Crisp", category: "Marketing" },
  { pattern: "drift.com", name: "Drift", category: "Marketing" },
  { pattern: "optimizely.com", name: "Optimizely", category: "A/B Testing" },
  { pattern: "crazyegg.com", name: "Crazy Egg", category: "Heatmaps" },
  { pattern: "luckyorange.com", name: "Lucky Orange", category: "Heatmaps" },
  { pattern: "newrelic.com", name: "New Relic", category: "Analytics" },
  { pattern: "nr-data.net", name: "New Relic", category: "Analytics" },
  { pattern: "ads.twitter.com", name: "Twitter Ads", category: "Social Media" },
  {
    pattern: "analytics.twitter.com",
    name: "Twitter Analytics",
    category: "Social Media",
  },
  {
    pattern: "linkedin.com/px",
    name: "LinkedIn Insight",
    category: "Social Media",
  },
  {
    pattern: "snap.licdn.com",
    name: "LinkedIn Insight",
    category: "Social Media",
  },
  { pattern: "tiktok.com", name: "TikTok Pixel", category: "Social Media" },
  { pattern: "pinterest.com", name: "Pinterest", category: "Social Media" },
  { pattern: "criteo.com", name: "Criteo", category: "Advertising" },
  { pattern: "criteo.net", name: "Criteo", category: "Advertising" },
  { pattern: "taboola.com", name: "Taboola", category: "Advertising" },
  { pattern: "outbrain.com", name: "Outbrain", category: "Advertising" },
  { pattern: "adroll.com", name: "AdRoll", category: "Advertising" },
  { pattern: "pubmatic.com", name: "PubMatic", category: "Advertising" },
  { pattern: "rubiconproject.com", name: "Rubicon", category: "Advertising" },
  { pattern: "adsrvr.org", name: "The Trade Desk", category: "Advertising" },
  { pattern: "adnxs.com", name: "AppNexus", category: "Advertising" },
  {
    pattern: "amazon-adsystem.com",
    name: "Amazon Ads",
    category: "Advertising",
  },
  { pattern: "quantserve.com", name: "Quantcast", category: "Analytics" },
  { pattern: "scorecardresearch.com", name: "Comscore", category: "Analytics" },
  { pattern: "krxd.net", name: "Krux/Salesforce DMP", category: "Analytics" },
  { pattern: "bluekai.com", name: "BlueKai/Oracle", category: "Analytics" },
  {
    pattern: "demdex.net",
    name: "Adobe Audience Manager",
    category: "Analytics",
  },
  { pattern: "omtrdc.net", name: "Adobe Analytics", category: "Analytics" },
  { pattern: "chartbeat.com", name: "Chartbeat", category: "Analytics" },
  { pattern: "parsely.com", name: "Parse.ly", category: "Analytics" },
];

// ===== State Management =====
const state = {
  protectionEnabled: true,
  blockedTrackers: {}, // { domain: count }
  detectedTrackers: {}, // { domain: [{ name, category, url, blockedAt }] }
  networkBlocks: {}, // { domain: count } - real network blocks
};

// Initialize state from storage
chrome.storage.local.get(
  ["protectionEnabled", "blockedTrackers", "detectedTrackers", "networkBlocks"],
  (result) => {
    state.protectionEnabled = result.protectionEnabled !== false;
    state.blockedTrackers = result.blockedTrackers || {};
    state.detectedTrackers = result.detectedTrackers || {};
    state.networkBlocks = result.networkBlocks || {};
  }
);

// ===== Detect Tracker from URL =====
function detectTrackerFromUrl(url) {
  const urlLower = url.toLowerCase();
  for (const tracker of TRACKER_PATTERNS) {
    if (urlLower.includes(tracker.pattern)) {
      return { name: tracker.name, category: tracker.category, url: url };
    }
  }
  // Also check the imported tracker list
  return getTrackerInfo(url);
}

// ===== Monitor Network Requests =====
// Using webRequest to detect when our rules block requests
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!state.protectionEnabled) return;
    if (details.tabId < 0) return; // Ignore non-tab requests

    const trackerInfo = detectTrackerFromUrl(details.url);
    if (trackerInfo) {
      // Get the tab's domain
      chrome.tabs.get(details.tabId, (tab) => {
        if (chrome.runtime.lastError || !tab?.url) return;

        const domain = getDomainFromUrl(tab.url);
        if (!domain) return;

        // Add to detected trackers
        if (!state.detectedTrackers[domain]) {
          state.detectedTrackers[domain] = [];
        }

        // Check if already detected
        const exists = state.detectedTrackers[domain].some(
          (t) => t.name === trackerInfo.name
        );
        if (!exists) {
          state.detectedTrackers[domain].push({
            name: trackerInfo.name,
            category: trackerInfo.category,
            url: details.url,
            blockedAt: Date.now(),
          });
        }

        // Increment block count
        state.blockedTrackers[domain] =
          (state.blockedTrackers[domain] || 0) + 1;
        state.networkBlocks[domain] = (state.networkBlocks[domain] || 0) + 1;

        // Save to storage
        chrome.storage.local.set({
          blockedTrackers: state.blockedTrackers,
          detectedTrackers: state.detectedTrackers,
          networkBlocks: state.networkBlocks,
        });

        // Update badge
        updateBadge(domain);
      });
    }
  },
  { urls: ["<all_urls>"] },
  []
);

// ===== Message Handlers =====
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case "toggleProtection":
      handleToggleProtection(message.enabled);
      sendResponse({ success: true });
      break;
    case "getTrackers":
      const trackers = state.detectedTrackers[message.domain] || [];
      const blockCount = state.blockedTrackers[message.domain] || 0;
      sendResponse({ trackers, blockCount });
      break;
    case "getStats":
      sendResponse({
        blockedCount: state.blockedTrackers[message.domain] || 0,
        trackers: state.detectedTrackers[message.domain] || [],
        networkBlocks: state.networkBlocks[message.domain] || 0,
      });
      break;
    case "trackerDetected":
      handleTrackerDetected(message.domain, message.tracker);
      sendResponse({ success: true });
      break;
    case "clearStats":
      // Clear stats for a specific domain
      if (message.domain) {
        delete state.blockedTrackers[message.domain];
        delete state.detectedTrackers[message.domain];
        delete state.networkBlocks[message.domain];
        chrome.storage.local.set({
          blockedTrackers: state.blockedTrackers,
          detectedTrackers: state.detectedTrackers,
          networkBlocks: state.networkBlocks,
        });
      }
      sendResponse({ success: true });
      break;
    default:
      sendResponse({ error: "Unknown action" });
  }
  return true;
});

// ===== Protection Toggle =====
async function handleToggleProtection(enabled) {
  state.protectionEnabled = enabled;
  chrome.storage.local.set({ protectionEnabled: enabled });

  try {
    if (enabled) {
      await chrome.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: ["tracker_rules"],
      });
    } else {
      await chrome.declarativeNetRequest.updateEnabledRulesets({
        disableRulesetIds: ["tracker_rules"],
      });
    }
  } catch (e) {
    console.error("Ghost Cookie: Error toggling rules", e);
  }

  updateBadge();
}

// ===== Tracker Detection from Content Script =====
function handleTrackerDetected(domain, tracker) {
  if (!state.detectedTrackers[domain]) {
    state.detectedTrackers[domain] = [];
  }

  const exists = state.detectedTrackers[domain].some(
    (t) => t.name === tracker.name
  );
  if (!exists) {
    state.detectedTrackers[domain].push({
      ...tracker,
      blockedAt: Date.now(),
    });
  }

  state.blockedTrackers[domain] = (state.blockedTrackers[domain] || 0) + 1;

  chrome.storage.local.set({
    blockedTrackers: state.blockedTrackers,
    detectedTrackers: state.detectedTrackers,
  });

  updateBadge(domain);
}

// ===== Badge Management =====
function updateBadge(domain) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;

    const tabDomain = domain || getDomainFromUrl(tabs[0].url);
    const trackerList = state.detectedTrackers[tabDomain] || [];
    const count = trackerList.length; // Show unique trackers count

    if (state.protectionEnabled && count > 0) {
      chrome.action.setBadgeText({ text: count.toString(), tabId: tabs[0].id });
      chrome.action.setBadgeBackgroundColor({
        color: "#ef4444",
        tabId: tabs[0].id,
      });
    } else if (!state.protectionEnabled) {
      chrome.action.setBadgeText({ text: "OFF", tabId: tabs[0].id });
      chrome.action.setBadgeBackgroundColor({
        color: "#6b7280",
        tabId: tabs[0].id,
      });
    } else {
      chrome.action.setBadgeText({ text: "", tabId: tabs[0].id });
    }
  });
}

// Tab events
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab?.url) {
      updateBadge(getDomainFromUrl(tab.url));
    }
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading" && changeInfo.url) {
    // Clear stats for new navigation
    const domain = getDomainFromUrl(changeInfo.url);
    if (domain && !domain.startsWith("chrome")) {
      delete state.detectedTrackers[domain];
      delete state.blockedTrackers[domain];
      delete state.networkBlocks[domain];
    }
  }
  if (changeInfo.status === "complete") {
    updateBadge();
  }
});

// ===== Utility Functions =====
function getDomainFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

// ===== Initialization =====
console.log(
  "Ghost Cookie - Service Worker initialized with enhanced detection"
);
updateBadge();

// Watermark: GC-mizcrpng
// Build: mizcrpng

// Watermark: GC-mizdukir
// Build: mizdukir
