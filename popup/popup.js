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

// Ghost Cookie - Popup Script with AI Integration
// Manages tracker display, cookie management, and smart classification

import {
  classifyCookie,
  getCategoryInfo,
  calculatePrivacyScore,
} from "../utils/cookie-classifier.js";

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initToggle();
  initCookieManager();
  loadCurrentSite();
  loadSettings();
  loadStats();
  loadTrackers();
  loadCookies();

  // Auto-refresh stats every 2 seconds
  setInterval(() => {
    loadStats();
    loadTrackers();
  }, 2000);

  // Settings button
  document.getElementById("openSettings").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
});

// Load settings
async function loadSettings() {
  chrome.storage.local.get(
    ["showPrivacyScore", "classifyCookies"],
    (result) => {
      window.ghostCookieSettings = {
        showPrivacyScore: result.showPrivacyScore !== false,
        classifyCookies: result.classifyCookies !== false,
      };
    }
  );
}

// ===== Tab Navigation =====
function initTabs() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabPanels = document.querySelectorAll(".tab-panel");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.dataset.tab;
      tabBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      tabPanels.forEach((p) => p.classList.remove("active"));
      document.getElementById(`${tabId}-panel`).classList.add("active");
    });
  });
}

// ===== Protection Toggle =====
function initToggle() {
  const toggle = document.getElementById("protectionToggle");
  const statusEl = document.getElementById("protectionStatus");

  chrome.storage.local.get(["protectionEnabled"], (result) => {
    const enabled = result.protectionEnabled !== false;
    toggle.checked = enabled;
    updateProtectionStatus(enabled);
  });

  toggle.addEventListener("change", () => {
    const enabled = toggle.checked;
    chrome.storage.local.set({ protectionEnabled: enabled });
    updateProtectionStatus(enabled);
    chrome.runtime.sendMessage({
      action: "toggleProtection",
      enabled: enabled,
    });
  });

  function updateProtectionStatus(enabled) {
    if (enabled) {
      statusEl.innerHTML =
        '<span class="status-dot active"></span> Protección activa';
    } else {
      statusEl.innerHTML =
        '<span class="status-dot inactive"></span> Protección desactivada';
    }
  }
}

// ===== Cookie Manager =====
function initCookieManager() {
  const clearAllBtn = document.getElementById("clearAllCookies");

  clearAllBtn.addEventListener("click", async () => {
    const tab = await getCurrentTab();
    if (!tab?.url) return;

    const url = new URL(tab.url);
    const domain = url.hostname;

    try {
      const cookies = await chrome.cookies.getAll({ domain });
      for (const cookie of cookies) {
        const cookieUrl = `http${cookie.secure ? "s" : ""}://${cookie.domain}${
          cookie.path
        }`;
        await chrome.cookies.remove({ url: cookieUrl, name: cookie.name });
      }
      loadCookies();
      updateCookieCount(0);
      clearAllBtn.innerHTML = "<span>✅</span> Eliminadas!";
      setTimeout(() => {
        clearAllBtn.innerHTML = "<span>🗑️</span> Eliminar Todas";
      }, 2000);
    } catch (error) {
      console.error("Error clearing cookies:", error);
    }
  });
}

// ===== Load Current Site =====
async function loadCurrentSite() {
  const siteUrlEl = document.getElementById("currentSite");
  const tab = await getCurrentTab();

  if (tab?.url) {
    try {
      const url = new URL(tab.url);
      siteUrlEl.textContent = url.hostname;
    } catch {
      siteUrlEl.textContent = "Nueva pestaña";
    }
  } else {
    siteUrlEl.textContent = "Nueva pestaña";
  }
}

// ===== Load Stats =====
async function loadStats() {
  const tab = await getCurrentTab();
  if (!tab?.url) return;

  try {
    const url = new URL(tab.url);
    const domain = url.hostname;

    // Get stats from service worker
    chrome.runtime.sendMessage(
      { action: "getStats", domain },
      async (response) => {
        if (chrome.runtime.lastError) return;

        const trackers = response?.trackers || [];
        const blockedCount = trackers.length;

        document.getElementById("trackersBlocked").textContent = blockedCount;
        document.getElementById("trackersBadge").textContent = blockedCount;

        // Calculate privacy score
        const cookies = await chrome.cookies.getAll({ domain });
        const cookieCategories = {};

        if (window.ghostCookieSettings?.classifyCookies) {
          cookies.forEach((cookie) => {
            const category = classifyCookie(cookie.name);
            cookieCategories[category] = (cookieCategories[category] || 0) + 1;
          });
        }

        const privacyScore = calculatePrivacyScore(
          blockedCount,
          cookies.length,
          cookieCategories
        );
        updatePrivacyScore(privacyScore);
      }
    );

    const cookies = await chrome.cookies.getAll({ domain });
    updateCookieCount(cookies.length);
  } catch (error) {
    console.error("Error loading stats:", error);
  }
}

function updateCookieCount(count) {
  document.getElementById("cookiesCount").textContent = count;
}

function updatePrivacyScore(scoreData) {
  if (!window.ghostCookieSettings?.showPrivacyScore) {
    document.getElementById("privacyScore").style.display = "none";
    return;
  }

  const scoreEl = document.getElementById("privacyScore");
  const emojiEl = document.getElementById("scoreEmoji");
  const ratingEl = document.getElementById("scoreRating");
  const fillEl = document.getElementById("scoreFill");
  const valueEl = document.getElementById("scoreValue");

  scoreEl.style.display = "block";
  emojiEl.textContent = scoreData.emoji;
  ratingEl.textContent = scoreData.rating;
  ratingEl.style.color = scoreData.color;
  fillEl.style.width = scoreData.score + "%";
  fillEl.style.background = `linear-gradient(90deg, ${scoreData.color}, ${scoreData.color}dd)`;
  valueEl.textContent = scoreData.score;
  valueEl.style.background = `linear-gradient(90deg, ${scoreData.color}, ${scoreData.color}dd)`;
  valueEl.style.webkitBackgroundClip = "text";
  valueEl.style.backgroundClip = "text";
}

// ===== Load Trackers =====
async function loadTrackers() {
  const trackerList = document.getElementById("trackerList");
  const tab = await getCurrentTab();

  if (!tab?.url) {
    showEmptyState(trackerList, "🔒", "No hay datos disponibles");
    return;
  }

  try {
    const url = new URL(tab.url);
    const domain = url.hostname;

    chrome.runtime.sendMessage(
      { action: "getTrackers", domain },
      (response) => {
        if (chrome.runtime.lastError) {
          showEmptyState(trackerList, "⚠️", "Error de conexión");
          return;
        }

        const trackers = response?.trackers || [];

        if (trackers.length === 0) {
          showEmptyState(trackerList, "✨", "No se detectaron trackers");
          return;
        }

        const sortedTrackers = [...trackers].sort(
          (a, b) => (b.blockedAt || 0) - (a.blockedAt || 0)
        );

        trackerList.innerHTML = sortedTrackers
          .map(
            (tracker) => `
        <div class="tracker-item">
          <div class="tracker-info">
            <span class="tracker-name">${escapeHtml(tracker.name)}</span>
            <span class="tracker-category">${escapeHtml(
              tracker.category
            )}</span>
          </div>
          <span class="tracker-status blocked">BLOQUEADO</span>
        </div>
      `
          )
          .join("");

        document.getElementById("trackersBadge").textContent =
          sortedTrackers.length;
      }
    );
  } catch {
    showEmptyState(trackerList, "❌", "Error al cargar datos");
  }
}

// ===== Load Cookies =====
async function loadCookies() {
  const cookiesList = document.getElementById("cookiesList");
  const tab = await getCurrentTab();

  if (!tab?.url) {
    showEmptyState(cookiesList, "🍪", "No hay cookies");
    return;
  }

  try {
    const url = new URL(tab.url);
    const domain = url.hostname;
    const cookies = await chrome.cookies.getAll({ domain });

    if (cookies.length === 0) {
      showEmptyState(cookiesList, "🍪", "No hay cookies");
      return;
    }

    const classifyCookiesEnabled = window.ghostCookieSettings?.classifyCookies;

    cookiesList.innerHTML = cookies
      .map((cookie, index) => {
        let categoryBadge = "";
        if (classifyCookiesEnabled) {
          const category = classifyCookie(cookie.name);
          const categoryInfo = getCategoryInfo(category);
          categoryBadge = `<span class="cookie-category ${category}" title="${categoryInfo.label}">${categoryInfo.icon}</span>`;
        }

        return `
        <div class="cookie-item" data-index="${index}">
          <div class="cookie-info">
            <span class="cookie-name" title="${escapeHtml(
              cookie.name
            )}">${escapeHtml(cookie.name)}${categoryBadge}</span>
            <span class="cookie-domain">${escapeHtml(cookie.domain)}</span>
          </div>
          <button class="btn-delete" data-cookie='${JSON.stringify({
            name: cookie.name,
            domain: cookie.domain,
            path: cookie.path,
            secure: cookie.secure,
          })}' title="Eliminar cookie">🗑️</button>
        </div>
      `;
      })
      .join("");

    cookiesList.querySelectorAll(".btn-delete").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const cookieData = JSON.parse(btn.dataset.cookie);
        const cookieUrl = `http${cookieData.secure ? "s" : ""}://${
          cookieData.domain
        }${cookieData.path}`;
        await chrome.cookies.remove({ url: cookieUrl, name: cookieData.name });
        const item = btn.closest(".cookie-item");
        item.style.opacity = "0";
        item.style.transform = "translateX(20px)";
        setTimeout(() => {
          item.remove();
          const remaining = cookiesList.querySelectorAll(".cookie-item").length;
          updateCookieCount(remaining);
          if (remaining === 0) {
            showEmptyState(cookiesList, "🍪", "No hay cookies");
          }
        }, 300);
      });
    });

    updateCookieCount(cookies.length);
  } catch (error) {
    console.error("Error loading cookies:", error);
    showEmptyState(cookiesList, "❌", "Error al cargar cookies");
  }
}

// ===== Utility Functions =====
async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function showEmptyState(container, icon, message) {
  container.innerHTML = `
    <div class="empty-state">
      <span class="empty-icon">${icon}</span>
      <p>${message}</p>
    </div>
  `;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML;
}

// Watermark: GC-mizcrpng
// Build: mizcrpng

// Watermark: GC-mizdukir
// Build: mizdukir
