const byId = (id) => document.getElementById(id);
const labels = {
  "insecure-http": "Conexión sin HTTPS",
  "internationalized-domain": "El dominio contiene caracteres internacionales",
  "lookalike-domain": "El dominio se parece al de una marca",
  "known-threat": "Coincidencia con la lista local"
};
const riskExplanation = {
  known: "El dominio coincide con la lista local de PhishDestroy. Abre el sitio oficial antes de introducir datos.",
  unavailable: "No se pudo consultar la lista local de PhishDestroy.",
  review: "Son señales observadas en la dirección de la página. Verifica el dominio antes de iniciar sesión o pagar.",
  none: "El dominio no coincide con sitios reportados en la lista instalada de PhishDestroy."
};
const listNames = { easylist: "EasyList", easyprivacy: "EasyPrivacy", tracker_rules: "Ghost Cookie", adguard_es_pt: "AdGuard Español/Portugués" };
const categories = { Analytics: "Analítica", "Social Media": "Redes sociales", Advertising: "Publicidad" };
const activityTab = byId("tabActivity");
const cookiesTab = byId("tabCookies");
const sitePause = byId("sitePause");
const visitPause = byId("visitPause");
const visitResume = byId("visitResume");
const bulk = byId("clearAllCookies");
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
  visitPause.disabled = busy;
  visitResume.disabled = busy;
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
  snapshot = response;
  const { site, protection } = response;
  byId("currentSite").textContent = site?.host || "Sin página web activa";
  byId("siteDetails").hidden = !site;
  sitePause.hidden = !site || !protection.enabled || site.visitPaused;
  visitResume.hidden = !protection.enabled || !site?.visitPaused || Boolean(site.pause);
  byId("troubleshooting").hidden = !site?.filtering;
  const protectionStatus = byId("protectionStatus");
  if (protection.partial) status(protectionStatus, "Estado de protección incompleto", "warn");
  else if (!protection.enabled) status(protectionStatus, "En pausa global", "warn");
  else if (site?.pause) status(protectionStatus, "En pausa en este sitio", "warn");
  else if (site?.visitPaused) status(protectionStatus, "En pausa en esta pestaña", "warn");
  else status(protectionStatus, "Activa", "good");
  byId("phishingActive").hidden = !protection.enabled || !(site?.pause || site?.visitPaused);
  if (!site) return;

  sitePause.textContent = site.pause && site.pause !== site.host ? "Reanudar " + site.pause
    : site.pause ? "Reanudar en este sitio" : "Pausar en este sitio";
  const blocked = byId("trackersBlocked");
  blocked.textContent = site.blocked ?? "Sin datos";
  blocked.toggleAttribute("data-unavailable", site.blocked === null);
  blocked.title = site.blocked === null ? "El navegador aún no ofrece datos de bloqueo para esta página." : "";
  byId("trackersDetected").textContent = site.detections.length;
  byId("elementsHidden").textContent = site.hidden;
  byId("cookiesCount").textContent = site.cookies?.length ?? "—";

  byId("activityExplanation").textContent = site.filtering
    ? "Los bloqueos cuentan solicitudes de red. Las detecciones señalan rastreadores vistos en la página y el filtro visual oculta elementos."
    : "El filtrado de anuncios y rastreadores está en pausa para esta página.";
  const sources = Object.entries(listNames)
    .filter(([id]) => site.blockSources?.[id] > 0)
    .map(([id, name]) => `${name} ${site.blockSources[id]}`);
  const blockSources = byId("blockSources");
  blockSources.textContent = sources.length ? `Bloqueos por lista · ${sources.join(" · ")}` : "";
  blockSources.hidden = !sources.length;

  const { threat, indicators } = site.reputation;
  const risk = byId("riskStatus");
  if (threat === "known") status(risk, "Sitio reportado", "bad");
  else if (threat === "unavailable") status(risk, "Lista local no disponible", "warn");
  else if (indicators.length) status(risk, "Señales para revisar", "warn");
  else status(risk, "Sin amenazas conocidas");
  const riskKey = threat === "none" && indicators.length ? "review" : threat;
  byId("riskExplanation").textContent = riskExplanation[riskKey];
  byId("riskIndicators").replaceChildren(...indicators.filter((key) => labels[key]).map((key) => {
    const item = document.createElement("li");
    item.textContent = labels[key];
    return item;
  }));

  byId("trackerEmpty").hidden = site.detections.length > 0;
  byId("trackerEmpty").textContent = site.filtering
    ? "Sin rastreadores detectados."
    : "La detección de rastreadores está en pausa.";
  byId("trackerList").replaceChildren(...site.detections.map(({ name, category, domains }) => {
    const source = domains?.length ? domains.join(", ") : "Código en la página";
    return createRow(name, `${categories[category] ?? category} · ${source}`);
  }));

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
for (const button of [visitPause, visitResume]) {
  button.addEventListener("click", () => void operate(async () => {
    await request("popup:troubleshoot", { expected: currentDocument() });
    window.close();
  }));
}
bulk.addEventListener("click", () => {
  confirmCookies.returnValue = "";
  confirmCookies.showModal();
});
confirmCookies.addEventListener("close", () => {
  if (confirmCookies.returnValue === "delete") void deleteCookies(null);
});
void operate(load);
