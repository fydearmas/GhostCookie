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
  if (hostname !== fixtureHost) {
    response.setHeader('Content-Type', 'application/javascript');
    response.end('window.fixtureScriptLoaded = (window.fixtureScriptLoaded ?? 0) + 1;');
    return;
  }
  if (request.url === '/') response.setHeader('Set-Cookie', 'sample_session=fixture; Path=/; SameSite=Lax');
  const port = fixture.address().port;
  response.setHeader('Content-Type', 'text/html');
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
const localHosts = [fixtureHost, 'localhost', phishingHost, 'doubleclick.net', 'google-analytics.com'];
const resolver = localHosts.map(host => 'MAP ' + host + ' 127.0.0.1').join(', ') + ', MAP * ~NOTFOUND';
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
    const timer = setTimeout(() => reject(new Error('CDP timeout: ' + method)), 8000);
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
  await until(async () => {
    const detections = await evaluate(popup, 'Number(document.querySelector("#trackersDetected").textContent)');
    if (detections >= 2) return true;
    await evaluate(popup, 'document.querySelector("#refresh").click()');
    return false;
  }, 'popup detects known scripts');
  assert.match(await evaluate(popup, 'document.querySelector("#riskStatus").textContent'), /Señales para revisar/);
  assert.match(await evaluate(popup, 'document.querySelector("#riskIndicators").textContent'), /HTTPS/i);
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
  console.log(product, 'muestra detecciones y reputación, elimina cookies y pausa y reanuda sin recargar');

  const warning = 'chrome-extension://' + id + '/reputation/warning.html';
  await send('Page.navigate', {url: 'http://' + phishingHost + ':' + port + '/'}, tab);
  await until(() => evaluate(tab, 'location.href === ' + JSON.stringify(warning) + ' && document.querySelector("h1")?.textContent.includes("Bloqueamos")'), 'local phishing warning');
  assert.equal(hits.get(phishingHost), undefined, 'phishing destination never contacted');

  const {targetId: settingsTarget} = await send('Target.createTarget', {url: 'chrome-extension://' + id + '/options/options.html'});
  const settings = await attach(settingsTarget);
  await until(() => evaluate(settings, 'document.querySelector("#version")?.textContent === ' + JSON.stringify(version)
    + ' && document.querySelector("#globalProtection")?.checked'), 'settings loaded');
  assert.ok(await evaluate(settings, 'document.querySelector("#connectNative").textContent.includes("Autorizar") && document.querySelector("#checkNative").disabled'));
  await evaluate(settings, 'document.querySelector("#globalProtection").click()');
  await until(() => evaluate(settings, 'chrome.declarativeNetRequest.getEnabledRulesets().then(rules => rules.length === 0)'), 'global protection disables rules');
  await until(() => evaluate(settings, '!document.querySelector("#globalProtection").disabled'), 'global command completed');
  await evaluate(settings, 'document.querySelector("#globalProtection").click()');
  await until(() => evaluate(settings, 'chrome.declarativeNetRequest.getEnabledRulesets().then(rules => rules.length === 4)'), 'global protection restores four rulesets');
  console.log(product, 'intercepta phishing y carga Ajustes con Gemini opcional y control global');

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
  console.log(product, 'borra cookies HttpOnly, distingue rutas y elimina la cookie particionada');
} catch (error) {
  console.error(error.stack, '\n' + errorLog);
  process.exitCode = 1;
} finally {
  child.kill();
  fixture.closeAllConnections();
  await new Promise(resolve => fixture.close(resolve));
  await rm(profile, {recursive: true, force: true, maxRetries: 3});
}
