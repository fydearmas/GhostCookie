// YouTube-specific rules share the content script's protection lifecycle.
(() => {
  const host = location.hostname.toLowerCase().replace(/\.$/, "");
  if (host !== "youtube.com" && !host.endsWith(".youtube.com")) return;

  let clickedSkipButtons = new WeakSet();
  const skipButtonSelector = [
    "button.ytp-ad-skip-button",
    "button.ytp-skip-ad-button",
    "button.ytp-skip-ad-button-modern",
  ].join(",");

  globalThis.ghostCookieYouTube = {
    selectors: [
      "#player-ads",
      "#masthead-ad",
      ".ytp-ad-overlay-container",
      ".ytp-ad-text-overlay",
      ".ytp-ad-image-overlay",
      "ytd-display-ad-renderer",
      "ytd-promoted-sparkles-web-renderer",
      "ytd-promoted-video-renderer",
      "ytd-compact-promoted-video-renderer",
      "ytd-banner-promo-renderer",
      "ytd-action-companion-ad-renderer",
      "ytd-in-feed-ad-layout-renderer",
    ],
    skipAdIfAvailable() {
      const player = document.getElementById("movie_player");
      if (!player?.classList.contains("ad-showing")) {
        clickedSkipButtons = new WeakSet();
        return;
      }

      for (const button of player.querySelectorAll(skipButtonSelector)) {
        if (
          button.disabled ||
          button.getAttribute("aria-disabled") === "true" ||
          clickedSkipButtons.has(button) ||
          !button.checkVisibility({ opacityProperty: true, visibilityProperty: true })
        ) continue;
        clickedSkipButtons.add(button);
        button.click();
        break;
      }
    },
  };
})();
