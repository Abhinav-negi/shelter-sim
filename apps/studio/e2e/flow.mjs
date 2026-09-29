#!/usr/bin/env node
// apps/studio/e2e/flow.mjs — Q1 (ledger/tasks/Q1.md condition 1) + Q2
// (ledger/tasks/Q2.md condition 1) end-to-end flow: register -> new design
// -> change width (viewer bounding box grows) -> type South window 10%
// (field/model update, preview reruns) -> switch to cylinder -> set 2
// storeys -> click a window in 3D (Openings field highlights, no preview
// refire) -> preview completes -> save -> reload (shape/storeys persist) ->
// run saved -> second design -> compare shows both -> a design saved
// without shape/storeys, inserted via the API, opens as a box -> logout ->
// /app redirects to login. Records console errors; only the pre-existing
// `THREE.Clock` deprecation warning is allowed, anything else fails the run.
//
// Run (playwright-core is NOT an installed dependency of this repo -- point
// PLAYWRIGHT_CORE at any local playwright-core package, e.g. the one this
// task used):
//
//   timeout 180 env PLAYWRIGHT_CORE=/path/to/playwright-core node apps/studio/e2e/flow.mjs
//
// By default this starts its own scratch studio-server
// (MongoMemoryServer + buildApp({jwtSecret:'scratch'}), scratch-server.mjs)
// on port 4109 and a production `vite preview` (preview.config.mjs) on port
// 5281 proxying /api -> 4109, and tears both down in `finally`. Pass
// BASE_URL to point at an already-running server+preview instead (skips the
// build/spawn steps entirely). Chrome: /usr/bin/google-chrome by default
// (override via CHROME_PATH).
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, edgeBBox } from './png.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const SERVER_PORT = 4109;
const PREVIEW_PORT = 5281;
const MANAGE_SERVERS = !process.env.BASE_URL;
const BASE_URL = process.env.BASE_URL ?? `http://127.0.0.1:${PREVIEW_PORT}`;
const CHROME_PATH = process.env.CHROME_PATH ?? '/usr/bin/google-chrome';

const playwrightCoreDir = process.env.PLAYWRIGHT_CORE;
if (!playwrightCoreDir) {
  console.error(
    '[flow] PLAYWRIGHT_CORE env var is required: point it at a local playwright-core package ' +
      '(not an installed dependency of this repo). Example:\n' +
      '  PLAYWRIGHT_CORE=/path/to/playwright-core node apps/studio/e2e/flow.mjs',
  );
  process.exit(1);
}
const { chromium } = await import(path.join(playwrightCoreDir, 'index.mjs'));

const children = [];
function spawnTracked(cmd, args, opts = {}) {
  const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
  children.push(child);
  const tag = path.basename(cmd);
  child.stdout.on('data', (d) => process.stdout.write(`[${tag}] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[${tag}] ${d}`));
  return child;
}

function killAll() {
  for (const child of children) if (!child.killed) child.kill('SIGTERM');
}

async function waitForHttpOk(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    await sleep(200);
  }
  throw new Error(`timed out waiting for ${url}: ${lastErr}`);
}

async function startScratchServer() {
  const tsx = path.join(REPO_ROOT, 'node_modules/.bin/tsx');
  spawnTracked(tsx, [path.join(__dirname, 'scratch-server.mjs'), String(SERVER_PORT)], { cwd: REPO_ROOT });
  await waitForHttpOk(`http://127.0.0.1:${SERVER_PORT}/api/health`, 30000);
  console.log(`[flow] scratch studio-server up on ${SERVER_PORT}`);
}

async function buildStudio() {
  const vite = path.join(REPO_ROOT, 'apps/studio/node_modules/.bin/vite');
  await new Promise((resolve, reject) => {
    const build = spawnTracked(vite, ['build'], { cwd: path.join(REPO_ROOT, 'apps/studio') });
    build.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`vite build exited ${code}`))));
  });
}

async function startPreview() {
  const vite = path.join(REPO_ROOT, 'apps/studio/node_modules/.bin/vite');
  spawnTracked(vite, ['preview', '--config', path.join(__dirname, 'preview.config.mjs')], { cwd: REPO_ROOT });
  await waitForHttpOk(BASE_URL, 30000);
  console.log(`[flow] preview up on ${PREVIEW_PORT}`);
}

// Q2: sum of per-channel abs differences between two same-sized decoded PNGs
// within a small square patch centred on (x, y) -- used to detect a window
// pane appearing/disappearing at a known 3D-projected screen position. A
// whole-canvas silhouette bbox (edgeBBox, above) can't see this: a window is
// an interior surface detail, not a change to the building's outer extent.
function patchDiffScore(imgA, imgB, x, y, half = 24) {
  const x0 = Math.max(0, Math.round(x - half));
  const x1 = Math.min(imgA.width, Math.round(x + half));
  const y0 = Math.max(0, Math.round(y - half));
  const y1 = Math.min(imgA.height, Math.round(y + half));
  let diff = 0;
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * imgA.width + xx) * 4;
      diff += Math.abs(imgA.data[i] - imgB.data[i]) + Math.abs(imgA.data[i + 1] - imgB.data[i + 1]) + Math.abs(imgA.data[i + 2] - imgB.data[i + 2]);
    }
  }
  return diff;
}

async function setSliderValue(locator, value) {
  await locator.evaluate((el, v) => {
    const proto = Object.getPrototypeOf(el);
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, String(v));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

// Two categories of console noise are pre-existing/mechanical, not product
// bugs, and are excluded from the "0 console errors" count -- both already
// established and documented by earlier tasks' own Evidence (F2/F3/F4):
// 1. `THREE.Clock` deprecation warning (an upstream @react-three/fiber
//    internal, present in every render, pinned dependency version).
// 2. `Failed to load resource: ... 401/400` for `/api/auth/me` -- Chromium
//    logs any non-2xx `fetch()` response to the console automatically
//    regardless of whether app code handles it (it does, gracefully, here:
//    RequireAuth's own `getMe()` catches it and renders <Navigate>). Step 10
//    below deliberately visits a guarded route while logged out specifically
//    to prove that redirect, so triggering this exact, well-understood
//    browser-logged network entry is unavoidable short of not exercising the
//    guard at all (F4.md's Evidence documents the identical tradeoff for its
//    own deliberately-provoked 400/401 auth errors).
const ALLOWED_WARNING = /THREE\.Clock/;
const ALLOWED_NETWORK_ERROR = /Failed to load resource.*40[01]/;
const consoleErrors = [];
const results = [];
function check(name, cond) {
  results.push({ name, pass: !!cond });
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`);
  if (!cond) throw new Error(`condition failed: ${name}`);
}

async function runFlow() {
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        const url = msg.location()?.url ?? '';
        const isAllowedAuthCheck = ALLOWED_NETWORK_ERROR.test(text) && url.includes('/api/auth/me');
        if (!ALLOWED_WARNING.test(text) && !isAllowedAuthCheck) consoleErrors.push(`${text} (${url})`);
      }
    });
    page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

    // Q2: counts every completed preview call across the whole flow, so the
    // shape/storeys/typed-value checks below can assert "reruns the preview"
    // (or, for a 3D selection click, "does NOT") as a request-count delta
    // rather than guessing at timing.
    let previewRequestCount = 0;
    page.on('requestfinished', (req) => {
      if (req.method() === 'POST' && req.url().includes('/api/simulate/preview')) previewRequestCount++;
    });

    const email = `q1-e2e-${Date.now()}@example.com`;
    const password = 'q1-flow-password';

    // 1. Register.
    await page.goto(`${BASE_URL}/register`);
    await page.fill('#name', 'Q1 E2E');
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('button[type=submit]');
    await page.waitForURL(`${BASE_URL}/app`);
    check('register redirects to /app', page.url() === `${BASE_URL}/app`);

    // 2. New design.
    await page.click('text=New shelter');
    await page.waitForURL(/\/app\/design\/new/);
    // Q2: reload with G4's dev/test-only screen-position hook armed for this
    // whole design/new session (`?g4e2e=1` -- Studio.tsx always passes
    // `interactive` to ShelterViewer, so the query param alone gates it).
    // Used below to click a window in 3D with a real `page.mouse.click`.
    await page.goto(`${BASE_URL}/app/design/new?g4e2e=1`);
    await page.waitForSelector('canvas', { timeout: 15000 });
    await page.waitForTimeout(500); // let the first demand-frameloop render settle

    // S1: only the side panels scroll, never the page itself (Segmented's
    // sr-only radios once escaped the panel and stretched <html>).
    const pageScroll = await page.evaluate(() => [document.documentElement.scrollHeight, innerHeight]);
    check(`Studio page itself does not scroll (${pageScroll[0]} <= ${pageScroll[1]})`, pageScroll[0] <= pageScroll[1] + 1);

    // 3. Change width -- the viewer bounding box grows. Length is pinned
    // large first: F2c's camera auto-frames to `max(lengthM, widthM)`, so if
    // Width were varied alone across that max it would also pull the camera
    // back to compensate, which can leave the on-screen extent roughly
    // constant (F2c's own intended behaviour, not a bug -- see Evidence).
    // Keeping Width below the fixed Length the whole time means the
    // "camera anchor" axis never moves, so growing Width really does grow
    // the rendered extent, which is what this condition is actually asking
    // to be proven.
    // G1 added a typed NumberInput alongside every slider, sharing the same
    // aria-label -- getByLabel is ambiguous since then (G4.md's Evidence
    // documents the identical gotcha for its own verification script).
    // getByRole('slider', ...) picks the range input specifically.
    const lengthSlider = page.getByRole('slider', { name: 'Length' });
    const widthSlider = page.getByRole('slider', { name: 'Width' });
    await setSliderValue(lengthSlider, 25);
    await page.waitForTimeout(500);
    await setSliderValue(widthSlider, 3);
    await page.waitForTimeout(500);

    const canvas = page.locator('canvas').first();
    const beforeImg = decodePng(await canvas.screenshot());
    const beforeBBox = edgeBBox(beforeImg);

    await setSliderValue(widthSlider, 20);
    await page.waitForTimeout(500);
    const afterImg = decodePng(await canvas.screenshot());
    const afterBBox = edgeBBox(afterImg);

    console.log('[flow] canvas bbox before', beforeBBox, 'after', afterBBox);
    check('viewer bbox found (before)', beforeBBox !== null);
    check('viewer bbox found (after)', afterBBox !== null);
    const beforeArea = beforeBBox.width * beforeBBox.height;
    const afterArea = afterBBox.width * afterBBox.height;
    check(
      `viewer bounding box grows when width increases (before=${beforeArea}px^2, after=${afterArea}px^2)`,
      afterArea > beforeArea,
    );

    // 3b. (Q2) Type a value: South window 10% -> field commits, the 3D model
    // changes, and the preview reruns after the 400ms debounce (Studio.tsx).
    // "Model changes" is checked as a local pixel-patch diff at window:S's
    // own projected screen position (G4's `?g4e2e=1` hook, armed since step
    // 2's navigation) -- a whole-canvas silhouette bbox (used above for the
    // width check) can't see a window appear: it's an interior surface
    // detail, not a change to the building's outer extent.
    await page.waitForFunction(() => typeof window.__g4PartScreenPosition === 'function');
    const southWindowPos = await page.evaluate(() => window.__g4PartScreenPosition('window:S'));
    const southWindowInput = page.getByRole('spinbutton', { name: 'South window' });
    const beforeTypeCount = previewRequestCount;
    const beforeTypeImg = decodePng(await canvas.screenshot());
    await southWindowInput.fill('10');
    await southWindowInput.press('Enter');
    check('typed South window value committed', (await southWindowInput.inputValue()) === '10');
    await page.waitForTimeout(700);
    const afterTypeImg = decodePng(await canvas.screenshot());
    const modelDiff = patchDiffScore(beforeTypeImg, afterTypeImg, southWindowPos.x, southWindowPos.y);
    console.log('[flow] South window patch diff score', modelDiff);
    check('typing South window updates the 3D model', modelDiff > 500);
    check('typing South window reruns the preview', previewRequestCount > beforeTypeCount);

    // 3c. (Q2) Switch to cylinder -- preview still OK (reruns, no error).
    // Segmented (components/ui/Segmented.tsx) renders each option as a
    // visible <label> wrapping a visually-hidden (`sr-only`) native radio --
    // clicking the label is what a real user does; clicking the hidden input
    // node directly (what `getByRole('radio').click()` targets) fails
    // actionability checks. `getByRole` still works fine for read-only
    // `isChecked()` assertions below.
    const beforeShapeCount = previewRequestCount;
    await page.locator('label:has(input[value="cylinder"])').click();
    await page.waitForTimeout(700);
    check('cylinder shape selected', await page.getByRole('radio', { name: 'Cylinder' }).isChecked());
    check('switching to cylinder reruns the preview', previewRequestCount > beforeShapeCount);
    await page.waitForSelector('text=Indoor vs outdoor', { timeout: 15000 });
    check('preview OK after switching to cylinder', true);

    // 3d. (Q2) Set 2 storeys.
    const beforeStoreysCount = previewRequestCount;
    await page.locator('label:has(input[value="2"])').click();
    await page.waitForTimeout(700);
    check('2 storeys selected', await page.getByRole('radio', { name: '2' }).isChecked());
    check('setting 2 storeys reruns the preview', previewRequestCount > beforeStoreysCount);

    // 3e. (Q2) Click a window in 3D -> the Openings/South window field
    // highlights (G4.md condition 3), via a REAL page.mouse.click (never a
    // synthetic DOM event) at the screen position G4's `?g4e2e=1` hook
    // reports for `window:S` -- still a real mesh here since South's WWR is
    // 10% from step 3b. Selecting must NOT rerun the preview (G4.md).
    const beforeClickCount = previewRequestCount;
    await page.waitForFunction(() => typeof window.__g4PartScreenPosition === 'function');
    const canvasBox = await canvas.boundingBox();
    const partPos = await page.evaluate(() => window.__g4PartScreenPosition('window:S'));
    await page.mouse.click(canvasBox.x + partPos.x, canvasBox.y + partPos.y);
    await page.waitForTimeout(200);
    const selection = await page.evaluate(() => window.__g4GetSelection());
    check('clicking the South window in 3D selects window:S', selection.selectedPart === 'window:S');
    const southWindowRow = page.locator('label:text-is("South window")').locator('xpath=..');
    const rowClass = (await southWindowRow.getAttribute('class')) ?? '';
    check('Openings/South window field is highlighted', /outline-accent/.test(rowClass));
    await page.waitForTimeout(400);
    check('selecting a part in 3D does not rerun the preview', previewRequestCount === beforeClickCount);

    // 4. Preview completes.
    await page.waitForSelector('text=Indoor vs outdoor', { timeout: 15000 });
    check('preview completed (results panel rendered)', true);

    // 5. Save (design).
    await page.fill('[aria-label="Design name"]', 'Q1 Flow Design One');
    await page.click('text=Save design');
    await page.waitForURL(/\/app\/design\/(?!new)[a-zA-Z0-9]+/, { timeout: 10000 });
    check('save design navigated to a real id', true);

    // 5b. (Q2) Save + reload -> shape and storeys persist.
    await page.reload();
    await page.waitForSelector('canvas', { timeout: 15000 });
    check('reloaded design keeps cylinder shape', await page.getByRole('radio', { name: 'Cylinder' }).isChecked());
    check('reloaded design keeps 2 storeys', await page.getByRole('radio', { name: '2' }).isChecked());

    // 6. Run saved.
    await page.click('text=Save run');
    await page.waitForSelector('text=Run saved.', { timeout: 15000 });
    check('run saved', true);

    // 7. Second design.
    await page.goto(`${BASE_URL}/app/design/new`);
    await page.waitForSelector('canvas', { timeout: 15000 });
    await page.fill('[aria-label="Design name"]', 'Q1 Flow Design Two');
    await setSliderValue(page.getByRole('slider', { name: 'Length' }), 12);
    await page.waitForTimeout(700);
    await page.waitForSelector('text=Indoor vs outdoor', { timeout: 15000 });
    await page.click('text=Save design');
    await page.waitForURL(/\/app\/design\/(?!new)[a-zA-Z0-9]+/, { timeout: 10000 });
    await page.click('text=Save run');
    await page.waitForSelector('text=Run saved.', { timeout: 15000 });
    check('second design saved with a run', true);

    // 8. Compare shows both.
    await page.goto(`${BASE_URL}/app/compare`);
    await page.waitForSelector('input[type=checkbox]');
    const checkboxes = page.locator('input[type=checkbox]');
    const count = await checkboxes.count();
    check('compare lists at least 2 designs', count >= 2);
    for (let i = 0; i < count; i++) await checkboxes.nth(i).check();
    await page.waitForSelector('text=Key figures', { timeout: 15000 });
    const compareBody = await page.textContent('body');
    check(
      'compare shows both designs by name',
      compareBody.includes('Q1 Flow Design One') && compareBody.includes('Q1 Flow Design Two'),
    );

    // 8b. (Q2) A design saved WITHOUT shape/storeys (inserted directly via
    // the API, simulating a design saved before G2) still opens as a box, 1
    // storey -- the server/client default. `page.request` shares this
    // context's auth cookie, so no separate login is needed.
    const optionsRes = await page.request.get(`${BASE_URL}/api/options`);
    const { defaults } = await optionsRes.json();
    const oldShapeDesign = { ...defaults };
    delete oldShapeDesign.shape;
    delete oldShapeDesign.storeys;
    const insertRes = await page.request.post(`${BASE_URL}/api/designs`, {
      data: { name: 'Q2 Old-Shape Design', design: oldShapeDesign },
    });
    check('old-shape design (no shape/storeys keys) inserted via the API', insertRes.ok());
    const { id: oldShapeId } = await insertRes.json();
    await page.goto(`${BASE_URL}/app/design/${oldShapeId}`);
    await page.waitForSelector('canvas', { timeout: 15000 });
    check('design with no shape/storeys keys opens as Box', await page.getByRole('radio', { name: 'Box' }).isChecked());
    check('design with no shape/storeys keys opens at 1 storey', await page.getByRole('radio', { name: '1' }).isChecked());

    // 9. Logout -- A2.md condition 5: AppShell's own Log out (now next to
    // "Studio" in the header, replacing Dashboard's) navigates to `/`, not
    // `/login`.
    await page.goto(`${BASE_URL}/app`);
    await page.click('text=Log out');
    await page.waitForURL(`${BASE_URL}/`);
    check('logout redirects to /', true);

    // 10. /app redirects to login when logged out.
    await page.goto(`${BASE_URL}/app`);
    await page.waitForURL(`${BASE_URL}/login`, { timeout: 10000 });
    check('/app redirects to /login when logged out', true);

    if (consoleErrors.length > 0) console.error('[flow] console errors:', consoleErrors);
    check(`0 unexpected console errors (${consoleErrors.length} found)`, consoleErrors.length === 0);

    await context.close();
  } finally {
    await browser.close();
  }
}

async function main() {
  if (MANAGE_SERVERS) {
    await startScratchServer();
    await buildStudio();
    await startPreview();
  } else {
    console.log(`[flow] using existing BASE_URL=${BASE_URL}`);
  }
  await runFlow();
}

main()
  .then(() => {
    console.log(`\n[flow] ALL PASS (${results.length} checks)`);
    killAll();
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n[flow] FAILED:', err);
    killAll();
    process.exit(1);
  });
