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

// Ghost Cookie - Tracker Database
// Known trackers with categories and detection patterns

export const TRACKER_LIST = [
  {
    name: "Google Analytics",
    category: "Analytics",
    patterns: [
      "google-analytics.com",
      "googleanalytics.com",
      "ga.js",
      "analytics.js",
      "gtag/js",
    ],
  },
  {
    name: "Google Tag Manager",
    category: "Analytics",
    patterns: ["googletagmanager.com", "gtm.js"],
  },
  {
    name: "Hotjar",
    category: "Analytics",
    patterns: ["hotjar.com", "static.hotjar.com"],
  },
  {
    name: "Mixpanel",
    category: "Analytics",
    patterns: ["mixpanel.com", "cdn.mxpnl.com"],
  },
  {
    name: "Amplitude",
    category: "Analytics",
    patterns: ["amplitude.com", "cdn.amplitude.com"],
  },
  {
    name: "Heap Analytics",
    category: "Analytics",
    patterns: ["heapanalytics.com", "heap-analytics.com"],
  },
  {
    name: "Microsoft Clarity",
    category: "Analytics",
    patterns: ["clarity.ms"],
  },
  {
    name: "FullStory",
    category: "Analytics",
    patterns: ["fullstory.com", "rs.fullstory.com"],
  },
  {
    name: "Segment",
    category: "Analytics",
    patterns: ["segment.com", "segment.io", "cdn.segment.com"],
  },
  {
    name: "New Relic",
    category: "Analytics",
    patterns: ["newrelic.com", "nr-data.net"],
  },
  {
    name: "Facebook Pixel",
    category: "Social Media",
    patterns: [
      "connect.facebook.net",
      "facebook.net/en_US/fbevents.js",
      "pixel.facebook.com",
    ],
  },
  {
    name: "Twitter Ads",
    category: "Social Media",
    patterns: [
      "ads.twitter.com",
      "analytics.twitter.com",
      "static.ads-twitter.com",
    ],
  },
  {
    name: "LinkedIn Insight",
    category: "Social Media",
    patterns: ["linkedin.com/px", "snap.licdn.com", "dc.ads.linkedin.com"],
  },
  {
    name: "TikTok Pixel",
    category: "Social Media",
    patterns: ["analytics.tiktok.com", "tiktokcdn.com/tiktok/falcon"],
  },
  {
    name: "Pinterest Tag",
    category: "Social Media",
    patterns: ["pintrk", "ct.pinterest.com"],
  },
  {
    name: "Google Ads",
    category: "Advertising",
    patterns: [
      "googleads.g.doubleclick.net",
      "googlesyndication.com",
      "googleadservices.com",
    ],
  },
  {
    name: "DoubleClick",
    category: "Advertising",
    patterns: ["doubleclick.net", "ad.doubleclick.net"],
  },
  {
    name: "Criteo",
    category: "Advertising",
    patterns: ["criteo.com", "criteo.net", "static.criteo.net"],
  },
  {
    name: "AdRoll",
    category: "Advertising",
    patterns: ["adroll.com", "d.adroll.com"],
  },
  {
    name: "Taboola",
    category: "Advertising",
    patterns: ["taboola.com", "cdn.taboola.com"],
  },
  {
    name: "Outbrain",
    category: "Advertising",
    patterns: ["outbrain.com", "widgets.outbrain.com"],
  },
  {
    name: "AppNexus",
    category: "Advertising",
    patterns: ["adnxs.com", "ib.adnxs.com"],
  },
  {
    name: "The Trade Desk",
    category: "Advertising",
    patterns: ["adsrvr.org", "thetradedesk.com"],
  },
  {
    name: "HubSpot",
    category: "Marketing",
    patterns: [
      "hubspot.com",
      "hs-analytics.net",
      "hs-scripts.com",
      "js.hs-analytics.net",
    ],
  },
  {
    name: "Intercom",
    category: "Marketing",
    patterns: ["intercom.io", "widget.intercom.io", "api.intercom.io"],
  },
  {
    name: "Mailchimp",
    category: "Marketing",
    patterns: ["mailchimp.com", "list-manage.com", "chimpstatic.com"],
  },
  {
    name: "Salesforce",
    category: "Marketing",
    patterns: ["salesforce.com/beacon", "force.com", "exacttarget.com"],
  },
  {
    name: "Drift",
    category: "Marketing",
    patterns: ["drift.com", "js.driftt.com"],
  },
  {
    name: "Optimizely",
    category: "A/B Testing",
    patterns: ["optimizely.com", "cdn.optimizely.com"],
  },
  {
    name: "VWO",
    category: "A/B Testing",
    patterns: ["visualwebsiteoptimizer.com", "vwo.com"],
  },
  {
    name: "Crazy Egg",
    category: "Heatmaps",
    patterns: ["crazyegg.com", "script.crazyegg.com"],
  },
  {
    name: "Lucky Orange",
    category: "Heatmaps",
    patterns: ["luckyorange.com", "luckyorange.net"],
  },
];

export function getTrackerInfo(url) {
  const urlLower = url.toLowerCase();
  for (const tracker of TRACKER_LIST) {
    for (const pattern of tracker.patterns) {
      if (urlLower.includes(pattern.toLowerCase())) {
        return { name: tracker.name, category: tracker.category, url: url };
      }
    }
  }
  return null;
}

export function isTracker(url) {
  return getTrackerInfo(url) !== null;
}

export function getTrackersByCategory() {
  const grouped = {};
  for (const tracker of TRACKER_LIST) {
    if (!grouped[tracker.category]) {
      grouped[tracker.category] = [];
    }
    grouped[tracker.category].push(tracker);
  }
  return grouped;
}

// Watermark: GC-mizcrpng
// Build: mizcrpng

// Watermark: GC-mizdukir
// Build: mizdukir
