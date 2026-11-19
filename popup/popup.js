const byId = (id) => document.getElementById(id);
const labels = {
  "insecure-http": "Conexión sin HTTPS",
  "internationalized-domain": "El dominio contiene caracteres internacionales",
  "lookalike-domain": "El dominio se parece al de una marca",
  "known-threat": "Coincidencia con la lista local"
};
const activityTab = byId("tabActivity");
const cookiesTab = byId("tabCookies");
const sitePause = byId("sitePause");
const bulk = byId("clearAllCookies");
const analyze = byId("analyze");
const refresh = byId("refresh");
const confirmCookies = byId("confirmCookies");
let snapshot;
let busy = false;

function status(element, text, tone = "") {
  element.textContent = text;
  element.dataset.tone = tone;
}

async function request(action, fields = {}) {
  const response = await chrome.runtime.sendMessage({ action, ...fields });
  if (!response?.ok) {
    throw new Error(response?.error || "Ghost Cookie no recibió una respuesta de Chrome.");
  }
  return response;
}

function updateButtons() {
  refresh.disabled = busy;
  sitePause.disabled = busy;
  analyze.disabled = busy;
  bulk.disabled = busy || !snapshot?.site?.cookies?.length;
  for (const button of byId("cookiesList").querySelectorAll("button")) button.disabled = busy;
}

function createRow(title, subtitle) {
  const item = document.createElement("li");
  const info = document.createElement("div");
  const name = document.createElement("span");
  name.textContent = title;
  const extra = document.createElement("span");
  extra.className = "subline";
  extra.textContent = subtitle;
  info.append(name, extra);
  item.append(info);
  return item;
}

function render(response) {
  const previous = snapshot?.site;
  snapshot = response;
  const { site, protection } = response;
  if (previous?.documentId !== site?.documentId) {
    byId("aiContent").hidden = true;
    byId("aiContent").textContent = "";
  }

  byId("currentSite").textContent = site?.host || "Sin página web activa";
  byId("siteDetails").hidden = !site;
  sitePause.hidden = !site || !protection.enabled;
  const protectionStatus = byId("protectionStatus");
  if (protection.partial) status(protectionStatus, "Estado de protección incompleto", "warn");
  else if (!protection.enabled) status(protectionStatus, "Protección global en pausa", "warn");
  else if (site?.pause) status(protectionStatus, "Anuncios y rastreo en pausa en este sitio", "warn");
  else status(protectionStatus, "Protección activa", "good");
  if (!site) return;

  sitePause.textContent = site.pause && site.pause !== site.host ? "Reanudar " + site.pause
    : site.pause ? "Reanudar en este sitio" : "Pausar en este sitio";
  byId("trackersBlocked").textContent = site.blocked ?? "—";
  byId("trackersBlocked").title = site.blocked === null ? "Chrome aún no ofrece datos de bloqueo para esta página." : "";
  byId("trackersDetected").textContent = site.detections.length;
  byId("elementsHidden").textContent = site.hidden;
  byId("cookiesCount").textContent = site.cookies?.length ?? "—";

  const { threat, indicators } = site.reputation;
  const risk = byId("riskStatus");
  if (threat === "known") status(risk, "Sitio reportado", "bad");
  else if (threat === "unavailable") status(risk, "Lista local no disponible", "warn");
  else if (indicators.length) status(risk, "Señales para revisar", "warn");
  else status(risk, "Sin amenazas conocidas");
  byId("riskIndicators").replaceChildren(...indicators.filter((key) => labels[key]).map((key) => {
    const item = document.createElement("li");
    item.textContent = labels[key];
    return item;
  }));

  byId("trackerEmpty").hidden = site.detections.length > 0;
  byId("trackerEmpty").textContent = site.filtering
    ? "Sin rastreadores detectados."
    : "La detección de rastreadores está en pausa.";
  byId("trackerList").replaceChildren(...site.detections.map(({ name, category }) => createRow(name, category)));

  byId("cookieEmpty").hidden = Boolean(site.cookies?.length);
  byId("cookieEmpty").textContent = site.cookies ? "Sin cookies de este sitio." : "Chrome no pudo consultar estas cookies.";
  byId("cookiesList").replaceChildren(...(site.cookies ?? []).map((cookie) => {
    const parts = [cookie.domain + cookie.path, cookie.category, cookie.partitioned && "Particionada"];
    const row = createRow(cookie.name, parts.filter(Boolean).join(" · "));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "button danger";
    remove.textContent = "Eliminar";
    remove.setAttribute("aria-label", "Eliminar cookie " + cookie.name);
    remove.addEventListener("click", () => void deleteCookies(cookie.id));
    row.append(remove);
    return row;
  }));
}

async function load() {
  render(await request("popup:get"));
}

async function operate(work) {
  if (busy) return;
  const focus = document.activeElement;
  busy = true;
  updateButtons();
  status(byId("notice"), "");
  try {
    await work();
  } catch (error) {
    status(byId("notice"), error.message, "warn");
  } finally {
    busy = false;
    updateButtons();
    if (focus instanceof HTMLButtonElement && document.activeElement === document.body) focus.focus();
  }
}

function currentDocument() {
  const { tabId, documentId } = snapshot.site;
  return { tabId, documentId };
}

async function deleteCookies(id) {
  return operate(async () => {
    const result = await request("popup:clearCookies", { expected: currentDocument(), id });
    await load();
    const detail = result.removed === 1 ? "Se eliminó 1 cookie." : "Cookies eliminadas: " + result.removed + ".";
    status(byId("notice"), result.remaining ? detail + " Aún quedan " + result.remaining + " de las seleccionadas." : detail,
      result.remaining ? "warn" : "good");
    cookiesTab.focus();
  });
}

function selectTab(tab) {
  for (const current of [activityTab, cookiesTab]) {
    const selected = current === tab;
    current.setAttribute("aria-selected", String(selected));
    current.tabIndex = selected ? 0 : -1;
    byId(current.getAttribute("aria-controls")).hidden = !selected;
  }
}

for (const tab of [activityTab, cookiesTab]) {
  tab.addEventListener("click", () => selectTab(tab));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const destination = event.key === "Home" ? activityTab
      : event.key === "End" ? cookiesTab : tab === activityTab ? cookiesTab : activityTab;
    selectTab(destination);
    destination.focus();
  });
}

byId("openSettings").addEventListener("click", () => void chrome.runtime.openOptionsPage());
refresh.addEventListener("click", () => void operate(load));
sitePause.addEventListener("click", () => void operate(async () => {
  await request("popup:sitePause", { paused: !snapshot.site.pause, expected: currentDocument() });
  await load();
}));
bulk.addEventListener("click", () => {
  confirmCookies.returnValue = "";
  confirmCookies.showModal();
});
confirmCookies.addEventListener("close", () => {
  if (confirmCookies.returnValue === "delete") void deleteCookies(null);
});
analyze.addEventListener("click", () => void operate(async () => {
  const content = byId("aiContent");
  content.hidden = false;
  content.textContent = "Consultando al asistente local…";
  try {
    const result = await request("popup:analyze", { expected: currentDocument() });
    content.textContent = result.text;
  } catch (error) {
    content.textContent = error.message;
  }
}));

void operate(load);
