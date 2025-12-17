/**
 * Ghost Cookie v1.0.0
 * Copyright (c) 2025 Franky Solutions
 * Developed by: Franky Solutions
 * Build: mj9e32q8
 * Watermark: GC-mj9e32q8
 * 
 * This code is protected by copyright.
 * Unauthorized use is prohibited.
 */

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

// Ghost Cookie - Options Page Script

document.addEventListener("DOMContentLoaded", () => {
  loadSettings();
  initEventListeners();
});

// Load saved settings
function loadSettings() {
  chrome.storage.local.get(
    ["showPrivacyScore", "classifyCookies", "enableAI", "geminiApiKey"],
    (result) => {
      document.getElementById("showPrivacyScore").checked =
        result.showPrivacyScore !== false;
      document.getElementById("classifyCookies").checked =
        result.classifyCookies !== false;
      document.getElementById("enableAI").checked = result.enableAI || false;

      document.getElementById("geminiApiKey").value = result.geminiApiKey || "";

      toggleApiKeySection(result.enableAI || false);
    }
  );
}

// Initialize event listeners
function initEventListeners() {
  // AI toggle
  document.getElementById("enableAI").addEventListener("change", (e) => {
    toggleApiKeySection(e.target.checked);
  });

  // Toggle API key visibility
  document
    .getElementById("toggleKeyVisibility")
    .addEventListener("click", () => {
      const input = document.getElementById("geminiApiKey");
      input.type = input.type === "password" ? "text" : "password";
    });

  // Test API key
  document
    .getElementById("testApiKey")
    .addEventListener("click", testApiConnection);

  // Save settings
  document
    .getElementById("saveSettings")
    .addEventListener("click", saveSettings);

  // Clear all data
  document
    .getElementById("clearAllData")
    .addEventListener("click", clearAllData);
}

// Toggle API key section visibility
function toggleApiKeySection(show) {
  document.getElementById("apiKeySection").style.display = show
    ? "block"
    : "none";
}

// Test API connection
async function testApiConnection() {
  const apiKey = document.getElementById("geminiApiKey").value.trim();
  const statusEl = document.getElementById("apiStatus");

  if (!apiKey) {
    showStatus(statusEl, "Por favor ingresa una API key", "error");
    return;
  }

  statusEl.textContent = "Probando conexión...";
  statusEl.className = "status-message";

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: "Hello" }],
            },
          ],
        }),
      }
    );

    const data = await response.json();

    if (response.ok) {
      showStatus(statusEl, "✅ Conexión exitosa!", "success");
    } else {
      console.error("Gemini API Error:", data);
      const errorMessage = data.error?.message || "Error desconocido";
      // Traducir algunos errores comunes
      let friendlyError = errorMessage;
      if (errorMessage.includes("API key not valid"))
        friendlyError = "API key no válida";
      if (errorMessage.includes("quota")) friendlyError = "Cuota excedida";

      showStatus(statusEl, `❌ Error: ${friendlyError}`, "error");
    }
  } catch (error) {
    console.error("Network Error:", error);
    showStatus(statusEl, `❌ Error de red: ${error.message}`, "error");
  }
}

// Save settings
function saveSettings() {
  const settings = {
    showPrivacyScore: document.getElementById("showPrivacyScore").checked,
    classifyCookies: document.getElementById("classifyCookies").checked,
    enableAI: document.getElementById("enableAI").checked,
    geminiApiKey: document.getElementById("geminiApiKey").value.trim(),
  };

  chrome.storage.local.set(settings, () => {
    const statusEl = document.getElementById("saveStatus");
    showStatus(statusEl, "✅ Configuración guardada", "success");
    setTimeout(() => {
      statusEl.textContent = "";
      statusEl.className = "";
    }, 3000);
  });
}

// Clear all data
function clearAllData() {
  if (
    confirm(
      "¿Estás seguro? Esto eliminará todas las estadísticas y configuraciones."
    )
  ) {
    chrome.storage.local.clear(() => {
      alert("Todos los datos han sido eliminados.");
      loadSettings();
    });
  }
}

// Show status message
function showStatus(element, message, type) {
  element.textContent = message;
  element.className = `status-message ${type}`;
}

// Watermark: GC-mizcrpng
// Build: mizcrpng

// Watermark: GC-mizdukir
// Build: mizdukir

// Watermark: GC-mj9cmgyy
// Build: mj9cmgyy

// Watermark: GC-mj9e32q8
// Build: mj9e32q8
