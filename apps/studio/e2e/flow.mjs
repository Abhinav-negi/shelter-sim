#!/usr/bin/env node
// apps/studio/e2e/flow.mjs — Q1 end-to-end flow (ledger/tasks/Q1.md
// condition 1): register -> new design -> change width (viewer bounding box
// grows) -> preview completes -> save -> run saved -> second design ->
// compare shows both -> logout -> /app redirects to login. Records console
// errors; only the pre-existing `THREE.Clock` deprecation warning is
// allowed, anything else fails the run.
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
    await page.waitForSelector('canvas', { timeout: 15000 });
    await page.waitForTimeout(500); // let the first demand-frameloop render settle

    // 3. Change width -- the viewer bounding box grows. Length is pinned
    // large first: F2c's camera auto-frames to `max(lengthM, widthM)`, so if
    // Width were varied alone across that max it would also pull the camera
    // back to compensate, which can leave the on-screen extent roughly
    // constant (F2c's own intended behaviour, not a bug -- see Evidence).
    // Keeping Width below the fixed Length the whole time means the
    // "camera anchor" axis never moves, so growing Width really does grow
    // the rendered extent, which is what this condition is actually asking
    // to be proven.
    const lengthSlider = page.getByLabel('Length');
    const widthSlider = page.getByLabel('Width');
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

    // 4. Preview completes.
    await page.waitForSelector('text=Indoor vs outdoor', { timeout: 15000 });
    check('preview completed (results panel rendered)', true);

    // 5. Save (design).
    await page.fill('[aria-label="Design name"]', 'Q1 Flow Design One');
    await page.click('text=Save design');
    await page.waitForURL(/\/app\/design\/(?!new)[a-zA-Z0-9]+/, { timeout: 10000 });
    check('save design navigated to a real id', true);

    // 6. Run saved.
    await page.click('text=Save run');
    await page.waitForSelector('text=Run saved.', { timeout: 15000 });
    check('run saved', true);

    // 7. Second design.
    await page.goto(`${BASE_URL}/app/design/new`);
    await page.waitForSelector('canvas', { timeout: 15000 });
    await page.fill('[aria-label="Design name"]', 'Q1 Flow Design Two');
    await setSliderValue(page.getByLabel('Length'), 12);
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

    // 9. Logout.
    await page.goto(`${BASE_URL}/app`);
    await page.click('text=Log out');
    await page.waitForURL(`${BASE_URL}/login`);
    check('logout redirects to /login', true);

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
