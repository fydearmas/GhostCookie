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

// Ghost Cookie - YouTube Ad Blocker
// Blocks and skips YouTube advertisements

(function () {
  "use strict";

  const domain = window.location.hostname;
  const detectedAds = new Set();
  let adBlockCount = 0;

  // Ad selectors to remove from DOM
  const AD_SELECTORS = [
    ".video-ads",
    ".ytp-ad-module",
    ".ytp-ad-overlay-container",
    ".ytp-ad-text-overlay",
    ".ytp-ad-image-overlay",
    ".ytp-ad-player-overlay",
    "ytd-display-ad-renderer",
    "ytd-promoted-sparkles-web-renderer",
    "ytd-promoted-video-renderer",
    "ytd-compact-promoted-video-renderer",
    "ytd-banner-promo-renderer",
    "#masthead-ad",
    ".ytd-merch-shelf-renderer",
    "ytd-action-companion-ad-renderer",
    "ytd-watch-next-secondary-results-renderer.ytd-watch-flexy > #items > ytd-compact-promoted-video-renderer",
    "ytd-in-feed-ad-layout-renderer",
    "#player-ads",
    ".ytp-ad-persistent-progress-bar-container",
    ".ytp-ad-skip-button-container",
  ];

  // Banner and sidebar ad selectors
  const BANNER_SELECTORS = [
    "ytd-display-ad-renderer",
    "ytd-statement-banner-renderer",
    "ytd-in-feed-ad-layout-renderer",
    "#masthead-ad",
    "ytd-promoted-sparkles-web-renderer",
  ];

  /**
   * Remove ad elements from DOM
   */
  function removeAdElements() {
    let removed = false;

    AD_SELECTORS.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        if (el && el.parentNode) {
          el.parentNode.removeChild(el);
          removed = true;
        }
      });
    });

    if (removed && !detectedAds.has("DOM_ADS")) {
      detectedAds.add("DOM_ADS");
      reportAd("YouTube Display Ads", "Advertising", "DOM elements removed");
    }
  }

  /**
   * Skip video ads automatically
   */
  function skipVideoAd() {
    const video = document.querySelector("video.html5-main-video");
    if (!video) return;

    // Check if ad is playing
    const adContainer = document.querySelector(".video-ads.ytp-ad-module");
    const adPlaying = document.querySelector(".ad-showing");

    if (adContainer || adPlaying) {
      // Try to find and click skip button
      const skipButton = document.querySelector(
        ".ytp-ad-skip-button, .ytp-skip-ad-button"
      );
      if (skipButton && skipButton.offsetParent !== null) {
        skipButton.click();
        if (!detectedAds.has("SKIPPED_AD")) {
          detectedAds.add("SKIPPED_AD");
          reportAd(
            "YouTube Video Ad (Skipped)",
            "Advertising",
            "Auto-skipped video ad"
          );
        }
        return;
      }

      // If skip button not available, try to speed through the ad
      const adDuration = video.duration;
      if (adDuration && adDuration < 60) {
        // Only for short ads (less than 60 seconds)
        video.currentTime = video.duration;
        if (!detectedAds.has("FAST_FORWARD_AD")) {
          detectedAds.add("FAST_FORWARD_AD");
          reportAd(
            "YouTube Video Ad (Fast-forwarded)",
            "Advertising",
            "Fast-forwarded through ad"
          );
        }
      }
    }
  }

  /**
   * Remove overlay ads
   */
  function removeOverlays() {
    const overlays = document.querySelectorAll(
      ".ytp-ad-overlay-container, .ytp-ad-text-overlay, .ytp-ad-image-overlay"
    );

    overlays.forEach((overlay) => {
      if (overlay && overlay.style) {
        overlay.style.display = "none";
      }
    });

    if (overlays.length > 0 && !detectedAds.has("OVERLAY_ADS")) {
      detectedAds.add("OVERLAY_ADS");
      reportAd("YouTube Overlay Ads", "Advertising", "Overlay ads hidden");
    }
  }

  /**
   * Block sponsored content in feed
   */
  function blockSponsoredContent() {
    const sponsoredItems = document.querySelectorAll(
      'ytd-compact-promoted-video-renderer, ytd-promoted-sparkles-web-renderer, [is-promoted="true"]'
    );

    sponsoredItems.forEach((item) => {
      if (item && item.parentNode) {
        item.style.display = "none";
      }
    });

    if (sponsoredItems.length > 0 && !detectedAds.has("SPONSORED_CONTENT")) {
      detectedAds.add("SPONSORED_CONTENT");
      reportAd(
        "YouTube Sponsored Content",
        "Advertising",
        "Sponsored content hidden"
      );
    }
  }

  /**
   * Monitor player for ads
   */
  function monitorPlayer() {
    const player = document.querySelector(".html5-video-player");
    if (!player) return;

    // Check for ad-showing class
    if (
      player.classList.contains("ad-showing") ||
      player.classList.contains("ad-interrupting")
    ) {
      skipVideoAd();
      removeOverlays();
    }
  }

  /**
   * Report detected ad to background script
   */
  function reportAd(name, category, url) {
    adBlockCount++;
    try {
      chrome.runtime.sendMessage({
        action: "trackerDetected",
        domain: domain,
        tracker: {
          name: name,
          category: category,
          url: url,
        },
      });
    } catch (error) {
      console.debug("Ghost Cookie: Could not report ad", error);
    }
  }

  /**
   * Inject CSS to hide ad elements
   */
  function injectAdBlockCSS() {
    const style = document.createElement("style");
    style.id = "ghost-cookie-youtube-adblocker";
    style.textContent = `
      /* Hide video ads */
      .video-ads.ytp-ad-module,
      .ytp-ad-overlay-container,
      .ytp-ad-text-overlay,
      .ytp-ad-image-overlay,
      .ytp-ad-player-overlay,
      .ytp-ad-skip-button-container,
      .ytp-ad-persistent-progress-bar-container,
      #player-ads {
        display: none !important;
        visibility: hidden !important;
        height: 0 !important;
        width: 0 !important;
      }

      /* Hide display ads */
      ytd-display-ad-renderer,
      ytd-promoted-sparkles-web-renderer,
      ytd-promoted-video-renderer,
      ytd-compact-promoted-video-renderer,
      ytd-banner-promo-renderer,
      ytd-in-feed-ad-layout-renderer,
      ytd-statement-banner-renderer,
      ytd-action-companion-ad-renderer,
      #masthead-ad {
        display: none !important;
      }

      /* Hide merch and promotional content */
      .ytd-merch-shelf-renderer {
        display: none !important;
      }

      /* Ensure video player is visible */
      .html5-video-player {
        display: block !important;
      }
    `;

    // Only inject if not already present
    if (!document.getElementById("ghost-cookie-youtube-adblocker")) {
      (document.head || document.documentElement).appendChild(style);
    }
  }

  /**
   * Main scanning function
   */
  function scanForAds() {
    removeAdElements();
    skipVideoAd();
    removeOverlays();
    blockSponsoredContent();
    monitorPlayer();
  }

  /**
   * Observe DOM changes for dynamic ads
   */
  function observeDynamicAds() {
    const observer = new MutationObserver((mutations) => {
      let shouldScan = false;

      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            // Element node
            const nodeName = node.nodeName.toLowerCase();
            // Check if it's an ad-related element
            if (
              nodeName.includes("ad") ||
              node.className?.toString().includes("ad") ||
              node.id?.includes("ad")
            ) {
              shouldScan = true;
            }
          }
        });
      });

      if (shouldScan) {
        scanForAds();
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Monitor video events
   */
  function monitorVideoEvents() {
    const video = document.querySelector("video.html5-main-video");
    if (video) {
      video.addEventListener("timeupdate", () => {
        skipVideoAd();
      });

      video.addEventListener("play", () => {
        skipVideoAd();
      });
    }
  }

  /**
   * Initialize the ad blocker
   */
  function init() {
    // Inject CSS immediately
    injectAdBlockCSS();

    // Initial scan
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        scanForAds();
        monitorVideoEvents();
      });
    } else {
      scanForAds();
      monitorVideoEvents();
    }

    // Observe dynamic content
    observeDynamicAds();

    // Periodic scanning for ads
    setInterval(() => {
      scanForAds();
    }, 1000);

    // Additional scan after page load
    window.addEventListener("load", () => {
      setTimeout(() => {
        scanForAds();
        monitorVideoEvents();
      }, 2000);
    });

    // Monitor for navigation changes (YouTube is a SPA)
    let lastUrl = location.href;
    new MutationObserver(() => {
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        detectedAds.clear(); // Reset detection for new page
        setTimeout(() => {
          scanForAds();
          monitorVideoEvents();
        }, 1000);
      }
    }).observe(document, { subtree: true, childList: true });
  }

  // Start the ad blocker
  init();
})();

// Watermark: GC-mizdukir
// Build: mizdukir
