const byId = (id) => document.getElementById(id);
const globalProtection = byId("globalProtection");
const classification = byId("classifyCookies");
const regional = byId("regionalProtection");
const resetPauses = byId("resetPauses");
const pausedSites = byId("pausedSites");
const pausedSummary = byId("pausedSummary");
const listDateFormat = new Intl.DateTimeFormat("es", { dateStyle: "medium", timeZone: "UTC" });
function status(element, text, tone = "") {
  element.textContent = text;
  element.dataset.tone = tone;
}

async function request(action, fields = {}) {
  const response = await chrome.runtime.sendMessage({ action, ...fields });
  if (!response?.ok) throw new Error(response?.error || "Ghost Cookie no recibió una respuesta de Chrome.");
  return response;
}

async function loadProtection() {
  const { protection } = await request("settings:get");
  renderProtection(protection);
}

function renderProtection(protection) {
  globalProtection.checked = protection.enabled;
  globalProtection.indeterminate = protection.partial;
  classification.checked = protection.classifyCookies;
  regional.checked = protection.regionalPreferred;
  globalProtection.disabled = false;
  classification.disabled = false;
  regional.disabled = false;
  resetPauses.disabled = protection.pausedSites.length === 0;
  pausedSummary.textContent = "Sitios en pausa (" + protection.pausedSites.length + ")";
  byId("pausedEmpty").hidden = protection.pausedSites.length !== 0;
  pausedSites.replaceChildren(...protection.pausedSites.map((site, index) => {
    const item = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = site;
    const resume = document.createElement("button");
    resume.type = "button";
    resume.className = "button quiet";
    resume.textContent = "Reanudar";
    resume.setAttribute("aria-label", "Reanudar " + site);
    resume.addEventListener("click", async () => {
      await changeProtection("settings:resumeSite", { domain: site }, "Se quitó la pausa de " + site + ".");
      const remaining = pausedSites.querySelectorAll("button");
      (remaining[index] ?? remaining[index - 1] ?? pausedSummary).focus();
    });
    item.append(name, resume);
    return item;
  }));
}

async function changeProtection(action, fields, confirmation) {
  globalProtection.disabled = true;
  classification.disabled = true;
  regional.disabled = true;
  resetPauses.disabled = true;
  for (const button of pausedSites.querySelectorAll("button")) button.disabled = true;
  const target = byId("protectionStatus");
  try {
    const { protection } = await request(action, fields);
    if (protection) renderProtection(protection);
    else await loadProtection();
    status(target, confirmation, "good");
  } catch (error) {
    await loadProtection().catch(() => {});
    status(target, error.message, "warn");
  }
}

async function showListDate(id, path, key) {
  const element = byId(id);
  try {
    const response = await fetch(chrome.runtime.getURL(path));
    if (!response.ok) throw new Error("Lista no disponible.");
    const metadata = await response.json();
    element.textContent = listDateFormat.format(new Date(metadata[key]));
  } catch {
    element.textContent = "Fecha no disponible";
  }
}

byId("version").textContent = chrome.runtime.getManifest().version;
globalProtection.addEventListener("change", () => void changeProtection("settings:global", {
  enabled: globalProtection.checked
}, globalProtection.checked ? "Protección activada." : "Protección en pausa."));
regional.addEventListener("change", () => void changeProtection("settings:regional", {
  enabled: regional.checked
}, regional.checked ? "Preferencia activada. Se aplica cuando la protección global está activa." : "Filtro regional desactivado."));
classification.addEventListener("change", () => void changeProtection("settings:classification", {
  enabled: classification.checked
}, "Preferencia guardada."));
resetPauses.addEventListener("click", () => void changeProtection("settings:resetPauses", {}, "Se reanudaron todos los sitios."));
void showListDate("easyListDate", "rules/easylist.lock.json", "revisionUtc");
void showListDate("regionalListDate", "rules/adguard-es-pt/source.json", "revisionUtc");
void showListDate("phishListDate", "reputation/source.json", "snapshotDate");
void loadProtection().catch((error) => status(byId("protectionStatus"), error.message, "warn"));
