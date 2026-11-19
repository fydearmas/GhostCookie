const byId = (id) => document.getElementById(id);
const globalProtection = byId("globalProtection");
const classification = byId("classifyCookies");
const resetPauses = byId("resetPauses");
const nativePermission = { permissions: ["nativeMessaging"] };
const connect = byId("connectNative");
const check = byId("checkNative");
const disconnect = byId("disconnectNative");
const nativeStatus = byId("nativeStatus");

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
  globalProtection.checked = protection.enabled;
  globalProtection.indeterminate = protection.partial;
  classification.checked = protection.classifyCookies;
  globalProtection.disabled = false;
  classification.disabled = false;
  resetPauses.disabled = protection.pausedSites.length === 0;
  byId("pausedSummary").textContent = "Sitios en pausa (" + protection.pausedSites.length + ")";
  byId("pausedSites").replaceChildren(...protection.pausedSites.map((site) => {
    const item = document.createElement("li");
    item.textContent = site;
    return item;
  }));
}

async function changeProtection(action, fields, confirmation) {
  globalProtection.disabled = true;
  classification.disabled = true;
  resetPauses.disabled = true;
  const target = byId("protectionStatus");
  try {
    await request(action, fields);
    await loadProtection();
    status(target, confirmation, "good");
  } catch (error) {
    await loadProtection().catch(() => {});
    status(target, error.message, "warn");
  }
}

async function loadPermission() {
  const granted = await chrome.permissions.contains(nativePermission);
  connect.hidden = granted;
  disconnect.hidden = !granted;
  check.disabled = !granted;
}

async function checkConnection() {
  check.disabled = true;
  status(nativeStatus, "Buscando el asistente local…");
  try {
    const reply = await request("ai:status");
    status(nativeStatus, reply.configured
      ? "Asistente conectado. La clave está configurada en este equipo."
      : "Asistente conectado. Guarda tu clave en Ghost Cookie Assistant.",
    reply.configured ? "good" : "warn");
  } catch (error) {
    status(nativeStatus, error.message, "warn");
  } finally {
    await loadPermission();
  }
}

byId("version").textContent = chrome.runtime.getManifest().version;
byId("extensionId").textContent = chrome.runtime.id;
byId("copyId").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(chrome.runtime.id);
    status(nativeStatus, "ID copiado.", "good");
  } catch {
    status(nativeStatus, "Selecciona y copia el ID que aparece arriba.", "warn");
  }
});
globalProtection.addEventListener("change", () => void changeProtection("settings:global", {
  enabled: globalProtection.checked
}, globalProtection.checked ? "Protección activada." : "Protección en pausa."));
classification.addEventListener("change", () => void changeProtection("settings:classification", {
  enabled: classification.checked
}, "Preferencia guardada."));
resetPauses.addEventListener("click", () => void changeProtection("settings:resetPauses", {}, "Se reanudaron todos los sitios."));
connect.addEventListener("click", async () => {
  try {
    const granted = await chrome.permissions.request(nativePermission);
    if (granted) await checkConnection();
    else status(nativeStatus, "Permiso sin conceder.", "warn");
  } catch (error) {
    status(nativeStatus, error.message, "warn");
  }
});
check.addEventListener("click", () => void checkConnection());
disconnect.addEventListener("click", async () => {
  try {
    await chrome.permissions.remove(nativePermission);
    await loadPermission();
    status(nativeStatus, "Permiso del navegador retirado. Puedes quitar la clave desde Ghost Cookie Assistant.");
  } catch (error) {
    status(nativeStatus, error.message, "warn");
  }
});

void loadProtection().catch((error) => status(byId("protectionStatus"), error.message, "warn"));
void loadPermission().catch((error) => status(nativeStatus, error.message, "warn"));
