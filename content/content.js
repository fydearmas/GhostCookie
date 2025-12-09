// Ghost Cookie - Content Script
// Injected into web pages for inline tracker detection

(function () {
  "use strict";

  const INLINE_PATTERNS = [
    { pattern: /gtag\s*\(/gi, name: "Google Analytics", category: "Analytics" },
    {
      pattern: /ga\s*\(\s*['"]create/gi,
      name: "Google Analytics (Legacy)",
      category: "Analytics",
    },
    { pattern: /fbq\s*\(/gi, name: "Facebook Pixel", category: "Social Media" },
    { pattern: /_hj\(/gi, name: "Hotjar", category: "Analytics" },
    { pattern: /mixpanel\.track/gi, name: "Mixpanel", category: "Analytics" },
    {
      pattern: /amplitude\.getInstance/gi,
      name: "Amplitude",
      category: "Analytics",
    },
    { pattern: /heap\.track/gi, name: "Heap Analytics", category: "Analytics" },
    { pattern: /analytics\.track/gi, name: "Segment", category: "Analytics" },
    { pattern: /intercomSettings/gi, name: "Intercom", category: "Marketing" },
    {
      pattern: /clarity\s*\(/gi,
      name: "Microsoft Clarity",
      category: "Analytics",
    },
    { pattern: /twq\s*\(/gi, name: "Twitter Pixel", category: "Social Media" },
    {
      pattern: /lintrk\s*\(/gi,
      name: "LinkedIn Insight",
      category: "Social Media",
    },
    { pattern: /_hsq\.push/gi, name: "HubSpot", category: "Marketing" },
  ];

  const domain = window.location.hostname;
  const detectedTrackers = new Set();

  function scanInlineScripts() {
    const scripts = document.querySelectorAll("script:not([src])");
    scripts.forEach((script) => {
      const content = script.textContent;
      if (!content) return;
      INLINE_PATTERNS.forEach(({ pattern, name, category }) => {
        if (pattern.test(content) && !detectedTrackers.has(name)) {
          detectedTrackers.add(name);
          reportTracker(name, category, "Inline script: " + name);
        }
      });
    });
  }

  function scanExternalScripts() {
    const scripts = document.querySelectorAll("script[src]");
    scripts.forEach((script) => {
      const src = script.src.toLowerCase();
      const trackerMappings = [
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
        {
          pattern: "facebook.net",
          name: "Facebook Pixel",
          category: "Social Media",
        },
        { pattern: "hotjar.com", name: "Hotjar", category: "Analytics" },
        { pattern: "mixpanel.com", name: "Mixpanel", category: "Analytics" },
        { pattern: "segment.com", name: "Segment", category: "Analytics" },
        { pattern: "amplitude.com", name: "Amplitude", category: "Analytics" },
        {
          pattern: "clarity.ms",
          name: "Microsoft Clarity",
          category: "Analytics",
        },
        { pattern: "fullstory.com", name: "FullStory", category: "Analytics" },
        { pattern: "intercom.io", name: "Intercom", category: "Marketing" },
        { pattern: "hubspot.com", name: "HubSpot", category: "Marketing" },
        { pattern: "hs-scripts.com", name: "HubSpot", category: "Marketing" },
        {
          pattern: "doubleclick.net",
          name: "DoubleClick",
          category: "Advertising",
        },
        { pattern: "criteo.com", name: "Criteo", category: "Advertising" },
        { pattern: "taboola.com", name: "Taboola", category: "Advertising" },
        { pattern: "outbrain.com", name: "Outbrain", category: "Advertising" },
      ];
      trackerMappings.forEach(({ pattern, name, category }) => {
        if (src.includes(pattern) && !detectedTrackers.has(name)) {
          detectedTrackers.add(name);
          reportTracker(name, category, src);
        }
      });
    });
  }

  function scanTrackingPixels() {
    const images = document.querySelectorAll(
      'img[width="1"], img[height="1"], img[style*="display:none"], img[style*="display: none"]'
    );
    images.forEach((img) => {
      const src = img.src ? img.src.toLowerCase() : "";
      if (src.includes("facebook.com") || src.includes("pixel")) {
        if (!detectedTrackers.has("Facebook Pixel (Image)")) {
          detectedTrackers.add("Facebook Pixel (Image)");
          reportTracker("Facebook Pixel", "Social Media", src);
        }
      }
      if (src.includes("google-analytics.com") || src.includes("collect?")) {
        if (!detectedTrackers.has("Google Analytics (Image)")) {
          detectedTrackers.add("Google Analytics (Image)");
          reportTracker("Google Analytics", "Analytics", src);
        }
      }
    });
  }

  function reportTracker(name, category, url) {
    try {
      chrome.runtime.sendMessage({
        action: "trackerDetected",
        domain: domain,
        tracker: { name: name, category: category, url: url },
      });
    } catch (error) {
      console.debug("Ghost Cookie: Could not report tracker", error);
    }
  }

  function observeDynamicContent() {
    const observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.tagName === "SCRIPT" || node.tagName === "IMG") {
            shouldScan = true;
          }
        });
      });
      if (shouldScan) {
        scanExternalScripts();
        scanTrackingPixels();
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  function init() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        scanInlineScripts();
        scanExternalScripts();
        scanTrackingPixels();
      });
    } else {
      scanInlineScripts();
      scanExternalScripts();
      scanTrackingPixels();
    }
    observeDynamicContent();
    window.addEventListener("load", () => {
      setTimeout(() => {
        scanInlineScripts();
        scanExternalScripts();
        scanTrackingPixels();
      }, 2000);
    });
  }

  init();
})();
