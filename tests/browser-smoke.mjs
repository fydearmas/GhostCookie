import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const [browser, unpacked] = process.argv.slice(2);
if (!browser || !unpacked) {
  console.error('Uso: node tests/browser-smoke.mjs NAVEGADOR CARPETA_DESCOMPRIMIDA');
  process.exit(1);
}
const {version} = JSON.parse(await readFile(resolve(unpacked, 'manifest.json')));
const fixtureHost = 'ghostcookie-smoke.test';
const cosmeticSource = await readFile(resolve(unpacked, 'rules/cosmetic-selectors.js'), 'utf8');
const {domains} = JSON.parse(cosmeticSource.slice(cosmeticSource.indexOf(' = ') + 3).trim().slice(0, -1));
function scopedFixture(scopes) {
  for (const [host, selectors] of Object.entries(scopes)) {
    const match = selectors.map(selector => selector.match(/^\[class\*="([a-zA-Z0-9_-]+)"\]$/)).find(Boolean);
    if (match) return {host, className: `ghostcookie-qa-${match[1]}-scope`};
  }
  throw new Error('La lista debería contener selectores por atributo acotados por dominio');
}
const scopedCase = scopedFixture(domains);
const regionalCosmetic = JSON.parse(await readFile(resolve(unpacked, 'rules/adguard-es-pt/cosmetic.json')));
const regionalCase = scopedFixture(regionalCosmetic.domains);
const initialNetwork = (await Promise.all(['tracker_rules', 'easylist', 'easyprivacy'].map(name =>
  readFile(resolve(unpacked, `rules/${name}.json`), 'utf8').then(JSON.parse)))).flat();
const occupiedHosts = new Set(initialNetwork.flatMap(({condition}) => [
  ...(condition.requestDomains ?? []), condition.urlFilter?.match(/^\|\|([\w.-]+)/)?.[1],
]));
const regionalRules = JSON.parse(await readFile(resolve(unpacked, 'rules/adguard-es-pt/network.json')));
const regionalAsset = regionalRules.filter(({action, condition}) => action.type === 'block' &&
  condition.resourceTypes?.includes('script') && Object.keys(condition).every(key =>
    ['domainType', 'requestDomains', 'resourceTypes'].includes(key)) && condition.domainType !== 'firstParty')
  .flatMap(({condition}) => condition.requestDomains ?? []).find(host => {
    const labels = host.split('.');
    return /^[a-z0-9.-]+\.com$/.test(host) && host !== regionalCase.host &&
      !labels.some((_, index) => occupiedHosts.has(labels.slice(index).join('.')));
  });
assert.ok(regionalAsset, 'Hay un dominio de prueba exclusivo del filtro regional');
const rules = JSON.parse(await readFile(resolve(unpacked, 'rules/reputation.json')));
const phishingHost = rules.flatMap(rule => rule.condition.requestDomains)
  .find(host => /^[a-z]+[a-z0-9-]+\.(?:net|com)$/.test(host));
assert.ok(phishingHost, 'El paquete debe incluir un dominio de reputación para este caso');
const profile = await mkdtemp(join(tmpdir(), 'ghostcookie-smoke-'));
const cosmeticSelector = '.AdContainer';
const hits = new Map();
const fixture = createServer((request, response) => {
  const hostname = request.headers.host.split(':')[0];
  hits.set(hostname, (hits.get(hostname) ?? 0) + 1);
  response.setHeader('Cache-Control', 'no-store');
  if (hostname === 'localhost') {
    if (request.url === '/cookies') {
      response.setHeader('Set-Cookie', [
        'qa_same=root; Path=/; HttpOnly',
        'qa_same=subpath; Path=/cookies; HttpOnly',
        'qa_partitioned=fixture; Path=/; Secure; HttpOnly; SameSite=None; Partitioned',
      ]);
    }
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end('<!doctype html><title>Cookies de prueba</title><h1>Cookies de prueba</h1>');
    return;
  }
  if (request.url === '/regional' && hostname === regionalCase.host) {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(`<main id="content">Contenido</main><aside id="scoped" class="${regionalCase.className}">Anuncio regional</aside>`
      + `<script src="http://${regionalAsset}:${fixture.address().port}/regional-ad.js"></script>`);
    return;
  }
  if (hostname === regionalAsset) {
    response.setHeader('Content-Type', 'application/javascript');
    response.end('window.regionalAdLoaded = true;');
    return;
  }
  if (request.url === '/scoped' && [fixtureHost, scopedCase.host].includes(hostname)) {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(`<main id="content">Contenido</main><aside id="scoped" class="${scopedCase.className}">Anuncio acotado</aside>`);
    return;
  }
  if (hostname !== fixtureHost) {
    response.setHeader('Content-Type', 'application/javascript');
    response.end('window.fixtureScriptLoaded = (window.fixtureScriptLoaded ?? 0) + 1;');
    return;
  }
  response.setHeader('Content-Type', 'text/html');
  if (request.url.split('?')[0] !== '/') {
    response.end('<!doctype html><title>Página sin solicitudes externas</title><h1>Página de control</h1>');
    return;
  }
  response.setHeader('Set-Cookie', 'sample_session=fixture; Path=/; SameSite=Lax');
  const port = fixture.address().port;
  response.end('<!doctype html><title>Ghost Cookie fixture</title><main id="content">Contenido</main>'
    + '<aside id="test-ad" class="' + cosmeticSelector.slice(1) + '">Anuncio</aside>'
    + '<script src="http://doubleclick.net:' + port + '/advert.js"></script>'
    + '<script src="http://google-analytics.com:' + port + '/tracker.js"></script>');
});
await new Promise((resolve, reject) => {
  fixture.once('error', reject);
  fixture.listen(0, '127.0.0.1', resolve);
});
const port = fixture.address().port;
// DNS de las pruebas apunta a loopback, incluido el destino del caso de phishing.
const localHosts = [fixtureHost, 'localhost', scopedCase.host, regionalCase.host, regionalAsset, phishingHost, 'doubleclick.net', 'google-analytics.com'];
const resolver = [...new Set(localHosts)].map(host => 'MAP ' + host + ' 127.0.0.1').join(', ') + ', MAP * ~NOTFOUND';
const child = spawn(browser, [
  '--headless=new', '--disable-dev-shm-usage', '--no-first-run',
  '--no-default-browser-check', '--disable-background-networking', '--disable-component-update',
  '--no-proxy-server', '--host-resolver-rules=' + resolver,
  '--remote-debugging-pipe', '--enable-unsafe-extension-debugging',
  '--user-data-dir=' + profile, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
let errorLog = '';
child.stderr.on('data', data => { errorLog = (errorLog + data).slice(-3000); });
let serial = 0;
let incoming = '';
const handlers = new Map();
child.once('exit', (code, signal) => {
  for (const handler of handlers.values()) handler({error: {message: 'Browser exited: ' + (signal ?? code)}});
  handlers.clear();
});
for (const fd of [3, 4]) child.stdio[fd].on('error', () => {});
child.stdio[4].setEncoding('utf8');
child.stdio[4].on('data', chunk => {
  incoming += chunk;
  const messages = incoming.split('\0');
  incoming = messages.pop();
  for (const raw of messages) {
    const message = JSON.parse(raw);
    const handler = handlers.get(message.id);
    if (handler) {
      handlers.delete(message.id);
      handler(message);
    }
  }
});
function send(method, params = {}, sessionId) {
  const id = ++serial;
  return new Promise((accept, reject) => {
    // Cold browser starts on a hosted runner can take over 45 seconds.
    const timeout = method === 'Browser.getVersion' ? 90000 : 8000;
    const timer = setTimeout(() => {
      handlers.delete(id);
      reject(new Error('CDP timeout: ' + method));
    }, timeout);
    handlers.set(id, message => {
      clearTimeout(timer);
      if (message.error) reject(new Error(method + ': ' + JSON.stringify(message.error)));
      else accept(message.result);
    });
    child.stdio[3].write(JSON.stringify({id, method, params, sessionId}) + '\0');
  });
}

async function until(check, label) {
  const deadline = Date.now() + 8000;
  let last = '';
  do {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      last = error.message;
    }
    await sleep(100);
  } while (Date.now() < deadline);
  throw new Error('Condition timed out: ' + label + (last ? ' (' + last + ')' : ''));
}

async function attach(targetId) {
  const {sessionId} = await send('Target.attachToTarget', { targetId, flatten: true });
  return sessionId;
}

async function evaluate(session, expression) {
  const evaluated = await send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true, userGesture: true,
  }, session);
  if (evaluated.exceptionDetails) throw new Error(evaluated.exceptionDetails.exception?.description ?? evaluated.exceptionDetails.text);
  return evaluated.result.value;
}

async function openPopup(id, siteUrl) {
  const {targetInfos} = await send('Target.getTargets', {filter: [{type: 'tab'}, {exclude: true}]});
  const browserTab = targetInfos.find(target => target.url === siteUrl);
  assert.ok(browserTab, 'Pestaña del sitio de prueba');
  await send('Extensions.triggerAction', { id, targetId: browserTab.targetId });
  const target = await until(async () => {
    const {targetInfos} = await send('Target.getTargets');
    return targetInfos.find(entry => entry.url === 'chrome-extension://' + id + '/popup/popup.html');
  }, 'actual action popup');
  const session = await attach(target.targetId);
  await until(() => evaluate(session, 'document.querySelector("#currentSite")?.textContent === ' + JSON.stringify(new URL(siteUrl).hostname)), 'popup site name');
  return session;
}

try {
  const {product} = await send('Browser.getVersion');
  const {id} = await send('Extensions.loadUnpacked', {path: resolve(unpacked)});
  const {extensions} = await send('Extensions.getExtensions');
  assert.ok(extensions.some(ext => ext.id === id && ext.enabled && ext.version === version));
  const {targetInfos} = await send('Target.getTargets');
  const page = targetInfos.find(target => target.type === 'page' && target.url === 'about:blank');
  assert.ok(page, 'normal tab');
  const tab = await attach(page.targetId);
  const {targetId: settingsTarget} = await send('Target.createTarget', {url: 'chrome-extension://' + id + '/options/options.html'});
  const settings = await attach(settingsTarget);
  await until(() => evaluate(settings, 'document.querySelector("#version")?.textContent === ' + JSON.stringify(version)
    + ' && document.querySelector("#globalProtection")?.checked'), 'settings loaded');
  await send('Target.activateTarget', {targetId: page.targetId});
  const siteUrl = 'http://' + fixtureHost + ':' + port + '/';
  await send('Page.navigate', {url: siteUrl}, tab);
  await until(() => evaluate(tab, 'document.readyState === "complete" && !!document.querySelector("#content")'), 'test page loaded');
  const adDisplay = 'getComputedStyle(document.querySelector("#test-ad")).display';
  await until(() => evaluate(tab, adDisplay + ' === "none"'), 'cosmetic filtering');
  assert.notEqual(await evaluate(tab, 'getComputedStyle(document.querySelector("#content")).display'), 'none');
  for (const host of ['doubleclick.net', 'google-analytics.com']) assert.equal(hits.get(host), undefined, 'request blocked for ' + host);
  assert.match(await evaluate(tab, 'document.cookie'), /sample_session=/);
  console.log(product, version, 'bloquea anuncios y rastreo de red y oculta un anuncio visual');

  const popup = await openPopup(id, siteUrl);
  assert.equal(await evaluate(popup, 'document.querySelector("#protectionStatus").textContent'), 'Activa');
  assert.equal(await evaluate(popup, 'document.querySelector("#trackersBlocked").textContent'), '2');
  const activeSite = await evaluate(popup, 'chrome.runtime.sendMessage({action: "popup:get"}).then(result => result.site)');
  await evaluate(settings, 'chrome.storage.session.remove("document:' + activeSite.tabId + '")');
  await evaluate(popup, 'document.querySelector("#refresh").click()');
  await until(() => evaluate(popup, '!document.querySelector("#refresh").disabled'), 'popup updated without a navigation record');
  assert.equal(await evaluate(popup, 'document.querySelector("#trackersBlocked").textContent'), '2');
  await evaluate(settings, `(async () => {
    for (const enabled of [false, true]) {
      await chrome.tabs.sendMessage(${activeSite.tabId}, {action: "content:policy", enabled}, {documentId: "${activeSite.documentId}"});
    }
  })()`);
  await until(async () => {
    const detections = await evaluate(popup, 'Number(document.querySelector("#trackersDetected").textContent)');
    if (detections >= 2) return true;
    await evaluate(popup, 'document.querySelector("#refresh").click()');
    return false;
  }, 'popup detects known scripts');
  assert.equal(await evaluate(popup, 'document.querySelector("#trackersBlocked").textContent'), '2');
  assert.match(await evaluate(popup, 'document.querySelector("#riskStatus").textContent'), /Señales para revisar/);
  assert.match(await evaluate(popup, 'document.querySelector("#riskIndicators").textContent'), /HTTPS/i);
  assert.match(await evaluate(popup, 'document.querySelector("#riskExplanation").textContent'), /Verifica el dominio/i);
  assert.match(await evaluate(popup, 'document.querySelector("#blockSources").textContent'), /Bloqueos por lista/);
  assert.match(await evaluate(popup, 'document.querySelector("#trackerList").textContent'), /Analítica · google-analytics\.com/);
  await evaluate(popup, 'document.querySelector("#tabCookies").click()');
  await until(() => evaluate(popup, 'document.querySelector("#cookiesList").textContent.includes("sample_session")'), 'cookie shown in popup');
  await evaluate(popup, 'document.querySelector("#clearAllCookies").click(); document.querySelector(\'button[value="delete"]\').click(); true');
  await until(() => evaluate(popup, 'document.querySelector("#notice").textContent.includes("Se eliminó 1 cookie")'), 'delete cookie result');
  assert.equal(await evaluate(tab, 'document.cookie'), '');

  await evaluate(popup, 'document.querySelector("#sitePause").click()');
  await until(() => evaluate(tab, adDisplay + ' !== "none"'), 'pause immediately restores ad element');
  await evaluate(tab, '(() => { const script = document.createElement("script"); script.src = "http://doubleclick.net:' + port + '/paused.js"; document.head.append(script); return true; })()');
  await until(() => hits.get('doubleclick.net') === 1, 'paused site allows request');
  await until(() => evaluate(popup, '!document.querySelector("#sitePause").disabled'), 'pause command completed');
  await evaluate(popup, 'document.querySelector("#sitePause").click()');
  await until(() => evaluate(tab, adDisplay + ' === "none"'), 'resume hides ad again');
  console.log(product, 'muestra el recuento sin depender del registro visual, elimina cookies y pausa y reanuda sin recargar');

  await until(() => evaluate(popup, '!document.querySelector("#visitPause").disabled && !document.querySelector("#troubleshooting").hidden'), 'diagnóstico disponible');
  const adsBeforePause = hits.get('doubleclick.net');
  await evaluate(popup, 'document.querySelector("#troubleshooting").open = true; document.querySelector("#visitPause").click()');
  await until(async () => hits.get('doubleclick.net') > adsBeforePause &&
    await evaluate(tab, 'window.fixtureScriptLoaded >= 1'), 'la recarga de diagnóstico recupera la solicitud de prueba');
  assert.notEqual(await evaluate(tab, adDisplay), 'none');

  const sameSiteUrl = siteUrl + '?separate-tab';
  const {targetId: otherTabId} = await send('Target.createTarget', {url: sameSiteUrl});
  const otherTab = await attach(otherTabId);
  await until(() => evaluate(otherTab, 'document.readyState === "complete" && !!document.querySelector("#test-ad")'), 'segunda pestaña en el mismo dominio');
  await until(() => evaluate(otherTab, adDisplay + ' === "none"'), 'la otra pestaña conserva el filtro visual');
  assert.equal(await evaluate(otherTab, 'window.fixtureScriptLoaded ?? 0'), 0);
  await send('Target.closeTarget', {targetId: otherTabId});
  await send('Target.activateTarget', {targetId: page.targetId});

  const pausedVisit = await openPopup(id, siteUrl);
  assert.equal(await evaluate(pausedVisit, 'document.querySelector("#protectionStatus").textContent'), 'En pausa en esta pestaña');
  assert.ok(await evaluate(pausedVisit, '!document.querySelector("#phishingActive").hidden'));
  await evaluate(pausedVisit, 'document.querySelector("#visitResume").click()');
  await until(() => evaluate(tab, 'document.readyState === "complete" && document.querySelector("#test-ad") && ' + adDisplay + ' === "none"'), 'reanudar restaura el filtro visual tras la recarga');
  assert.equal(await evaluate(tab, 'window.fixtureScriptLoaded ?? 0'), 0);
  const restoredPopup = await openPopup(id, siteUrl);
  assert.equal(await evaluate(restoredPopup, 'document.querySelector("#protectionStatus").textContent'), 'Activa');
  const adsBeforeSecondPause = hits.get('doubleclick.net');
  await evaluate(restoredPopup, 'document.querySelector("#troubleshooting").open = true; document.querySelector("#visitPause").click()');
  await until(async () => hits.get('doubleclick.net') > adsBeforeSecondPause &&
    await evaluate(tab, 'window.fixtureScriptLoaded >= 1'), 'segunda pausa de diagnóstico');

  const warning = 'chrome-extension://' + id + '/reputation/warning.html';
  await send('Page.navigate', {url: 'http://' + phishingHost + ':' + port + '/'}, tab);
  await until(() => evaluate(tab, 'location.href === ' + JSON.stringify(warning) + ' && document.querySelector("h1")?.textContent.includes("Bloqueamos")'), 'aviso de phishing durante la pausa temporal');
  assert.equal(hits.get(phishingHost), undefined, 'phishing destination never contacted');
  await until(() => evaluate(settings, 'chrome.declarativeNetRequest.getSessionRules().then(rules => rules.length === 0)'), 'cambiar de sitio termina la pausa temporal');
  console.log(product, 'la pausa de diagnóstico aísla la pestaña, recarga, reanuda y conserva los avisos de phishing');

  const scopedDisplay = 'getComputedStyle(document.querySelector("#scoped")).display';
  await send('Page.navigate', {url: siteUrl + 'scoped'}, tab);
  await until(() => evaluate(tab, '!!document.querySelector("#scoped") && ' + scopedDisplay + ' !== "none"'), 'el selector nuevo queda fuera del sitio de prueba');
  await send('Page.navigate', {url: `http://${scopedCase.host}:${port}/scoped`}, tab);
  await until(() => evaluate(tab, '!!document.querySelector("#scoped") && ' + scopedDisplay + ' === "none"'), 'se oculta el anuncio por atributo en su dominio');
  assert.notEqual(await evaluate(tab, 'getComputedStyle(document.querySelector("#content")).display'), 'none');
  console.log(product, 'aplica el selector de atributo solo en su dominio');

  const cleanUrl = siteUrl + 'empty';
  await send('Page.navigate', {url: cleanUrl}, tab);
  await until(() => evaluate(tab, 'location.href === ' + JSON.stringify(cleanUrl)), 'documento de control');
  const cleanPopup = await openPopup(id, cleanUrl);
  assert.equal(await evaluate(cleanPopup, 'document.querySelector("#trackersBlocked").textContent'), '0');
  await evaluate(cleanPopup, 'document.querySelector("#sitePause").click()');
  await until(() => evaluate(cleanPopup, 'document.querySelector("#protectionStatus").textContent === "En pausa en este sitio" && !document.querySelector("#phishingActive").hidden'), 'pausa por sitio visible');

  const secondUrl = 'http://localhost:' + port + '/empty';
  await send('Page.navigate', {url: secondUrl}, tab);
  await until(() => evaluate(tab, 'location.href === ' + JSON.stringify(secondUrl)), 'segundo sitio de control');
  // A background tab can load the popup HTML without granting activeTab, unlike the toolbar action.
  const {targetId: ungrantedPopupTarget} = await send('Target.createTarget', {
    url: 'chrome-extension://' + id + '/popup/popup.html', background: true,
  });
  const ungrantedPopup = await attach(ungrantedPopupTarget);
  await until(() => evaluate(ungrantedPopup, 'document.querySelector("#currentSite")?.textContent === "localhost"'), 'popup sin permiso temporal');
  assert.equal(await evaluate(ungrantedPopup, 'document.querySelector("#trackersBlocked").textContent'), 'Sin datos');
  await send('Target.closeTarget', {targetId: ungrantedPopupTarget});
  const secondPopup = await openPopup(id, secondUrl);
  assert.equal(await evaluate(secondPopup, 'document.querySelector("#protectionStatus").textContent'), 'Activa');
  await evaluate(secondPopup, 'document.querySelector("#sitePause").click()');
  await until(() => evaluate(secondPopup, 'document.querySelector("#protectionStatus").textContent === "En pausa en este sitio"'), 'segunda pausa');

  await send('Page.reload', {}, settings);
  await until(() => evaluate(settings, 'document.querySelectorAll("#pausedSites button").length === 2'), 'ambos sitios en Ajustes');
  const dates = ["rules/easylist.lock.json", "reputation/source.json", "rules/adguard-es-pt/source.json"];
  const [easy, phish, regional] = await Promise.all(dates.map(path => readFile(resolve(unpacked, path), 'utf8').then(JSON.parse)));
  const date = new Intl.DateTimeFormat('es', {dateStyle: 'medium', timeZone: 'UTC'});
  for (const [id, value] of [['easyListDate', easy.revisionUtc], ['phishListDate', phish.snapshotDate], ['regionalListDate', regional.revisionUtc]]) {
    await until(() => evaluate(settings, 'document.getElementById(' + JSON.stringify(id) + ')?.textContent === ' + JSON.stringify(date.format(new Date(value)))), id + ' muestra la fecha empaquetada');
  }
  const firstResumeLabel = JSON.stringify('Reanudar ' + fixtureHost);
  await evaluate(settings, 'document.querySelector("#pauseDetails").open = true; [...document.querySelectorAll("#pausedSites button")].find(button => button.ariaLabel === ' + firstResumeLabel + ').click()');
  await until(() => evaluate(settings, 'document.querySelectorAll("#pausedSites button").length === 1 && document.querySelector("#pausedSites button").ariaLabel === "Reanudar localhost"'), 'reanudar conserva la otra pausa');
  console.log(product, 'distingue cero de sin datos, muestra las fechas instaladas y reanuda un dominio');

  await evaluate(settings, 'document.querySelector("#globalProtection").click()');
  await until(() => evaluate(settings, 'chrome.declarativeNetRequest.getEnabledRulesets().then(rules => rules.length === 0)'), 'global protection disables rules');
  await send('Page.navigate', {url: secondUrl}, tab);
  await until(() => evaluate(tab, 'location.href === ' + JSON.stringify(secondUrl)), 'sitio con pausa global');
  const disabledPopup = await openPopup(id, secondUrl);
  assert.equal(await evaluate(disabledPopup, 'document.querySelector("#protectionStatus").textContent'), 'En pausa global');
  assert.ok(await evaluate(disabledPopup, 'document.querySelector("#phishingActive").hidden'));
  await until(() => evaluate(settings, '!document.querySelector("#globalProtection").disabled'), 'global command completed');
  await evaluate(settings, 'document.querySelector("#globalProtection").click()');
  await until(() => evaluate(settings, 'chrome.declarativeNetRequest.getEnabledRulesets().then(rules => rules.length === 4)'), 'global protection restores four rulesets');
  console.log(product, 'cambia el estado de la protección global desde Ajustes');

  const regionalUrl = `http://${regionalCase.host}:${port}/regional`;
  const regionalDisplay = 'document.querySelector("#scoped") && getComputedStyle(document.querySelector("#scoped")).display';
  const regionalEnabled = 'chrome.declarativeNetRequest.getEnabledRulesets().then(rules => rules.includes("adguard_es_pt"))';
  const changeRegional = 'document.querySelector("#regionalProtection").click()';
  await send('Page.navigate', {url: regionalUrl}, tab);
  await until(() => evaluate(tab, 'location.href === ' + JSON.stringify(regionalUrl) + ' && !!document.querySelector("#scoped")'), 'página regional local');
  assert.equal(await evaluate(settings, 'document.querySelector("#regionalProtection").checked'), false);
  assert.equal(await evaluate(settings, regionalEnabled), false);
  await until(() => evaluate(tab, 'window.regionalAdLoaded === true'), 'la solicitud regional pasa con el filtro desactivado');
  assert.notEqual(await evaluate(tab, regionalDisplay), 'none');

  await evaluate(settings, changeRegional);
  await until(() => evaluate(settings, regionalEnabled), 'el filtro regional está activo');
  await until(() => evaluate(tab, regionalDisplay + ' === "none"'), 'el filtro visual regional se activa en la página abierta');
  const assetHits = hits.get(regionalAsset);
  await send('Page.reload', {}, tab);
  await until(() => evaluate(tab, 'document.readyState === "complete" && !window.regionalAdLoaded && ' + regionalDisplay + ' === "none"'), 'el filtro regional bloquea la solicitud y oculta el anuncio');
  assert.equal(hits.get(regionalAsset), assetHits);
  const regionalPopup = await openPopup(id, regionalUrl);
  assert.match(await evaluate(regionalPopup, 'document.querySelector("#blockSources").textContent'), /AdGuard Español\/Portugués 1/);

  const globalControl = 'document.querySelector("#globalProtection")';
  await until(() => evaluate(settings, '!' + globalControl + '.disabled'), 'ajustes listos');
  await evaluate(settings, globalControl + '.click()');
  await until(() => evaluate(settings, '!' + globalControl + '.disabled && !' + globalControl + '.checked'), 'pausa global con filtro regional');
  assert.equal(await evaluate(settings, regionalEnabled), false);
  assert.equal(await evaluate(settings, 'document.querySelector("#regionalProtection").checked'), true);
  await evaluate(settings, globalControl + '.click()');
  await until(() => evaluate(settings, '!' + globalControl + '.disabled && ' + globalControl + '.checked'), 'la reanudación conserva la preferencia regional');
  assert.equal(await evaluate(settings, regionalEnabled), true);
  await evaluate(settings, changeRegional);
  await until(() => evaluate(tab, regionalDisplay + ' !== "none"'), 'desactivar restaura el elemento regional en la página abierta');
  assert.equal(await evaluate(settings, regionalEnabled), false);
  console.log(product, 'filtro regional opcional de red y visual, contador por lista y preferencia conservada');

  const otherPartition = {topLevelSite: 'https://localhost', hasCrossSiteAncestor: false};
  const otherCookie = {
    url: 'https://localhost/', name: 'qa_partitioned', value: 'other-partition', path: '/',
    secure: true, httpOnly: true, sameSite: 'no_restriction', partitionKey: otherPartition,
  };
  const seededCookie = await evaluate(settings, 'chrome.cookies.set(' + JSON.stringify(otherCookie) + ')');
  assert.deepEqual(seededCookie.partitionKey, otherPartition, 'cookie de control en la partición HTTPS');

  const cookieUrl = 'http://localhost:' + port + '/cookies';
  await send('Target.activateTarget', {targetId: page.targetId});
  await send('Page.navigate', {url: cookieUrl}, tab);
  await until(() => evaluate(tab, 'location.href === ' + JSON.stringify(cookieUrl)
    + ' && document.readyState === "complete"'), 'página de cookies');
  const cookiePopup = await openPopup(id, cookieUrl);
  await evaluate(cookiePopup, 'document.querySelector("#tabCookies").click()');
  await until(() => evaluate(cookiePopup, 'document.querySelectorAll("#cookiesList li").length === 3'), 'lista de cookies de prueba');
  assert.match(await evaluate(cookiePopup, 'document.querySelector("#cookiesList").textContent'), /qa_partitioned.*Particionada/i);
  await evaluate(cookiePopup, '[...document.querySelectorAll("#cookiesList li")].find(row => row.textContent.includes("/cookies")).querySelector("button").click()');
  await until(() => evaluate(cookiePopup, 'document.querySelectorAll("#cookiesList li").length === 2'), 'borrado de una sola ruta');
  assert.doesNotMatch(await evaluate(cookiePopup, 'document.querySelector("#cookiesList").textContent'), /localhost\/cookies/);
  assert.match(await evaluate(cookiePopup, 'document.querySelector("#cookiesList").textContent'), /qa_same/);
  await evaluate(cookiePopup, 'document.querySelector("#clearAllCookies").click(); document.querySelector(\'button[value="delete"]\').click(); true');
  await until(() => evaluate(cookiePopup, 'document.querySelector("#notice").textContent.includes("Cookies eliminadas") || document.querySelector("#notice").textContent.includes("Se eliminó")'), 'respuesta de borrado total');
  const cookieReport = await evaluate(cookiePopup, '({remaining: document.querySelector("#cookiesList").textContent, notice: document.querySelector("#notice").textContent})');
  assert.deepEqual(cookieReport, {remaining: '', notice: 'Cookies eliminadas: 2.'}, 'borrado total con cookie particionada');
  const remainingCookie = await evaluate(settings, 'chrome.cookies.get(' + JSON.stringify({
    url: otherCookie.url, name: otherCookie.name, partitionKey: otherPartition,
  }) + ')');
  assert.equal(remainingCookie?.value, otherCookie.value, 'misma cookie en la otra partición');
  console.log(product, 'borra cookies HttpOnly, distingue rutas y conserva la cookie de la otra partición');
} catch (error) {
  console.error(error.stack, '\n' + errorLog);
  process.exitCode = 1;
} finally {
  child.kill();
  fixture.closeAllConnections();
  await new Promise(resolve => fixture.close(resolve));
  await rm(profile, {recursive: true, force: true, maxRetries: 3});
}
