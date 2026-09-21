#!/usr/bin/env node
// apps/web/scripts/build-static.mjs
//
// T-66 (log/AREA-J/T-66.md) -- mechanism (b), the demo-day story: a
// self-contained static directory that runs from `npx serve` or any plain
// file server, no install, no build step and no network, shipped on a USB
// stick. This is the mechanism that survives an unfamiliar machine, as
// distinct from the PWA (mechanism (a), apps/web/public/sw.js +
// manifest.webmanifest), which requires one prior online visit.
//
// WHY THIS SCRIPT BUILDS A *COPY* OF THE APP INSTEAD OF RUNNING
// `next build` IN PLACE (read this before changing anything):
//
// Next's own static-export feature (`output: 'export'`, gated in
// next.config.mjs behind SHELTER_STATIC_EXPORT=1 so the ordinary
// `next dev`/`next build` path is untouched) refuses to build ANY route
// that is `dynamic = 'force-dynamic'` -- verified directly, in this
// session, by actually running it:
//
//   Error: Page with `dynamic = "force-dynamic"` couldn't be exported.
//   `output: "export"` requires all pages be renderable statically because
//   there is no runtime server to dynamically render routes in this
//   output format.
//
// `apps/web/app/page.tsx` sets exactly that (its own comment explains why:
// `@shelter/data`'s TMY loader is a dynamic `import()` that hangs Next's
// static-generation sandbox if the page is prerendered directly -- also
// reverified directly in this session: removing `force-dynamic` in a
// scratch copy reproduces the exact hang the comment describes). `page.tsx`
// is on this task's "may not touch" list, so it cannot be edited to fix
// this, and every `app/api/*` route is force-dynamic for the same class of
// reason (server-only DB access) and cannot ship in a build with no server
// either way.
//
// So: this script assembles its OWN throwaway copy of the app under
// `.export-scratch/`, swapping in a replacement `app/page.tsx` (generated
// below, PAGE_TSX_SOURCE) that gets the same initial preset/result data a
// completely different way -- precomputed by *this* plain Node script
// (outside Next's build sandbox entirely, so the dynamic-import hang never
// triggers) and written to a static `initial-data.json` the replacement
// page just imports. Nothing under `app/`, `lib/store.ts`,
// `components/**` or `app/api/**` is ever edited in place; the real
// `apps/web/app/page.tsx` is simply never copied into the scratch tree.
//
// Usage: node apps/web/scripts/build-static.mjs
// Exits 0 with the export written to apps/web/static-export/, or exits 1
// with the failing step's output. Prints the evidence this task's Evidence
// block needs (file list, byte sizes, localhost grep, TMY-file check).

import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(here, '..'); // apps/web
const repoRoot = path.resolve(webDir, '..', '..');
const scratchDir = path.join(webDir, '.export-scratch');
const outDir = path.join(webDir, 'static-export');

function log(...args) {
  console.log('[build-static]', ...args);
}

function fail(message) {
  console.error('[build-static] FAIL:', message);
  process.exit(1);
}

// ============================== 1. PRECOMPUTE THE INITIAL RESULT ==============================
// Mirrors apps/web/app/page.tsx's own resolvePreset()/defaultPreset() exactly
// (same PRESETS lookup, same materials/glazings resolution, same simulate()
// call) -- just run here, in plain Node, at build time, instead of inside
// Next's request-time (or, for export, build-time-sandboxed) rendering.
async function generateInitialData() {
  const dataDist = path.join(repoRoot, 'packages', 'data', 'dist', 'index.js');
  const engineDist = path.join(repoRoot, 'packages', 'engine', 'dist', 'index.js');
  if (!existsSync(dataDist) || !existsSync(engineDist)) {
    fail(
      `@shelter/data / @shelter/engine are not built. Run:\n` +
        `  npm run build --workspace @shelter/engine\n  npm run build --workspace @shelter/data\nfirst.`,
    );
  }
  const { glazingById, materialById, PRESETS, tmyById } = await import(pathToFileUrl(dataDist));
  const { simulate, requestToJson, resultToJson } = await import(pathToFileUrl(engineDist));

  const DEFAULT_LOCATION = process.env.NEXT_PUBLIC_DEFAULT_LOCATION ?? 'leh'; // CONTRACTS.md sec 7.16

  function resolvePreset(preset) {
    const materials = {};
    for (const surface of preset.request.building.surfaces) {
      for (const layer of surface.construction)
        materials[layer.materialId] = materialById(layer.materialId);
    }
    const glazings = {};
    for (const win of preset.request.building.windows)
      glazings[win.glazingId] = glazingById(win.glazingId);
    return { ...preset.request, weather: tmyById(preset.locationId), materials, glazings };
  }

  const preset = PRESETS.find((p) => p.locationId === DEFAULT_LOCATION) ?? PRESETS[0];
  const request = resolvePreset(preset);
  const result = simulate(request);
  return {
    presetId: preset.id,
    request: requestToJson(request),
    result: resultToJson(result),
    tempAt0600K: result.kpis.tempAt0600, // for this script's own evidence printout only
  };
}

function pathToFileUrl(p) {
  return 'file://' + p;
}

// ============================== 2. ASSEMBLE THE SCRATCH COPY ==============================

/** Copy a directory, dropping every `*.test.ts`/`*.test.tsx` file. A
 * production static export needs no test file, and one of them
 * (components/inputs/inputs.test.ts) does `await import('../../app/api/...')`
 * -- which would fail to type-check the moment app/api/ is absent, for
 * reasons entirely unrelated to this task (see this task's Evidence block,
 * "acceptance test 5" -- the same defect independently blocks the ORDINARY
 * `npm run build --workspace apps/web` once app/api/ is deleted, reported
 * there, not fixed here: components/** is outside this task's allow-list).
 * Excluding test files from a throwaway export-only copy sidesteps it
 * without touching that file at all. */
function copyProductionTree(src, dest) {
  cpSync(src, dest, {
    recursive: true,
    filter: (srcPath) => !/\.test\.tsx?$/.test(path.basename(srcPath)),
  });
}

// WHY 'use client' + next/dynamic(..., { ssr: false }) (read before changing):
// verified directly, in this session: even with @shelter/data entirely out
// of the picture, statically prerendering a page that renders `<AppShell>`
// still hangs Next's build-time static-generation worker ("Failed to build
// /page: / (attempt 1 of 3) because it took more than 60 seconds... after 3
// attempts"). Root cause, traced via the exact same import trace Next itself
// prints: app-shell.tsx -> lib/units.ts -> @shelter/engine's barrel ->
// serialise.ts, which uses genuine top-level await (needed for
// `canonicalRequestHash`'s use of node:crypto) -- Next's static-generation
// sandbox does not reliably resolve a module graph with top-level await
// either (the *same class* of hang apps/web/next.config.mjs's own header
// comment already documents for @shelter/data's dynamic import -- just a
// second, independent trigger). `lib/units.ts`, `app-shell.tsx` and
// `packages/engine/src/serialise.ts` are all outside this task's allow-list,
// so the fix has to be "never ask Next to server-render AppShell at all" --
// `next/dynamic(..., { ssr: false })` is the framework's own, native
// mechanism for exactly that (App Router requires the `ssr:false` call site
// itself be a Client Component, hence 'use client' at the top here): Next's
// static-generation step now renders only a trivial placeholder for '/',
// and the real AppShell -- with the real precomputed props -- mounts
// entirely in the browser once the JS loads. Correct fit for a static
// export anyway: there is never a server to have prerendered anything for.
const PAGE_TSX_SOURCE = `'use client';
// GENERATED by apps/web/scripts/build-static.mjs (T-66). Do not hand-edit --
// edit the generator instead. This is NOT apps/web/app/page.tsx: that file
// is untouched in the real app. See build-static.mjs's header comment for
// why the static-export build needs its own replacement entry point, and
// why this one is a client component using next/dynamic(ssr:false).
import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import initialData from './initial-data.json';
import { requestFromJson, resultFromJson } from '@shelter/engine';
import { actions } from '../lib/store';

const AppShell = dynamic(() => import('./app-shell').then((m) => m.AppShell), { ssr: false });

export default function Page() {
  // This build never has a server, by construction (a plain static file
  // tree for a USB stick / npx serve) -- the offline banner should say so
  // from the first client-side effect, not only after some future network
  // probe fails. actions.setOnline is lib/store.ts's OWN exported public
  // action (the same seam apps/web/lib/workerClient.ts already calls from
  // outside that file) -- this calls it, it does not edit store.ts.
  useEffect(() => {
    actions.setOnline(false);
  }, []);
  const request = requestFromJson(initialData.request);
  const result = resultFromJson(initialData.result);
  return <AppShell initialRequest={request} initialResult={result} initialPresetId={initialData.presetId} />;
}
`;

function buildScratch(initialData) {
  rmSync(scratchDir, { recursive: true, force: true });
  mkdirSync(path.join(scratchDir, 'app'), { recursive: true });

  for (const f of ['layout.tsx', 'globals.css', 'app-shell.tsx']) {
    cpSync(path.join(webDir, 'app', f), path.join(scratchDir, 'app', f));
  }
  writeFileSync(
    path.join(scratchDir, 'app', 'initial-data.json'),
    JSON.stringify({
      presetId: initialData.presetId,
      request: initialData.request,
      result: initialData.result,
    }),
  );
  writeFileSync(path.join(scratchDir, 'app', 'page.tsx'), PAGE_TSX_SOURCE);

  copyProductionTree(path.join(webDir, 'components'), path.join(scratchDir, 'components'));
  copyProductionTree(path.join(webDir, 'lib'), path.join(scratchDir, 'lib'));
  copyProductionTree(path.join(webDir, 'workers'), path.join(scratchDir, 'workers'));
  cpSync(path.join(webDir, 'public'), path.join(scratchDir, 'public'), { recursive: true });
  cpSync(path.join(webDir, 'next.config.mjs'), path.join(scratchDir, 'next.config.mjs'));
  cpSync(path.join(webDir, 'package.json'), path.join(scratchDir, 'package.json'));

  // tsconfig.json's `extends` is relative ("../../tsconfig.base.json");
  // the scratch dir sits one level deeper than the real apps/web, so
  // rewrite it to an absolute path rather than duplicating tsconfig.base.json.
  const rawTsconfig = readFileSync(path.join(webDir, 'tsconfig.json'), 'utf8').replace(
    /\/\/.*$/gm,
    '',
  );
  const tsconfig = JSON.parse(rawTsconfig);
  tsconfig.extends = path.join(repoRoot, 'tsconfig.base.json');
  writeFileSync(path.join(scratchDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));

  // Symlink, don't copy: npm workspaces already hoist every real dependency
  // (next, react, @shelter/engine, @shelter/data, ...) to the repo root;
  // Node's own upward module resolution finds them from here exactly as it
  // would from any other nested project directory.
  symlinkSync(path.join(repoRoot, 'node_modules'), path.join(scratchDir, 'node_modules'), 'dir');
}

// ============================== 3. RUN THE EXPORT BUILD ==============================

function runExportBuild() {
  const env = { ...process.env, SHELTER_STATIC_EXPORT: '1' };
  delete env.DATABASE_URL; // the export path never touches a database (D-1: cache/share layer only)
  const result = spawnSync('npx', ['next', 'build', '--webpack'], {
    cwd: scratchDir,
    env,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    fail(`next build --webpack (SHELTER_STATIC_EXPORT=1) exited ${result.status}`);
  }
}

// ============================== 4. VERIFY THE OUTPUT ==============================

function listFilesRecursive(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFilesRecursive(full));
    else out.push(full);
  }
  return out;
}

function verifyOutput() {
  const exportedOut = path.join(scratchDir, 'out');
  if (!existsSync(exportedOut))
    fail(`expected ${exportedOut} to exist after a successful export build`);

  rmSync(outDir, { recursive: true, force: true });
  cpSync(exportedOut, outDir, { recursive: true });

  const files = listFilesRecursive(outDir);
  const totalBytes = files.reduce((sum, f) => sum + statSync(f).size, 0);

  const tmyIds = ['leh', 'kargil', 'drass', 'nubra', 'jaisalmer'];
  const missingTmy = tmyIds.filter((id) => !existsSync(path.join(outDir, 'tmy', `${id}.json`)));

  // A dev-server URL reference looks like `http://localhost:3000/...` or
  // `http://127.0.0.1:PORT/...` -- an absolute URL with a scheme. The bare
  // word "localhost" alone is not evidence of one: it also appears inside
  // legitimate vendored code (verified directly in this session --
  // Next's own core-js URL polyfill chunk contains the WHATWG URL spec's
  // own `"localhost"===host&&(host="")` special-casing, nothing to do with
  // any dev server), so grepping for it bare over-counts.
  let localhostHits = 0;
  for (const f of files) {
    if (!/\.(html|js|css|json|txt|webmanifest)$/.test(f)) continue;
    const text = readFileSync(f, 'utf8');
    localhostHits += (text.match(/https?:\/\/(localhost|127\.0\.0\.1)/g) ?? []).length;
  }

  log('file count:', files.length);
  log('total size (bytes):', totalBytes, `(${(totalBytes / 1024 / 1024).toFixed(3)} MB)`);
  log('TMY files present:', tmyIds.filter((id) => !missingTmy.includes(id)).join(', ') || 'NONE');
  if (missingTmy.length) fail(`missing TMY files in export: ${missingTmy.join(', ')}`);
  log('localhost/127.0.0.1 occurrences:', localhostHits);
  if (localhostHits !== 0)
    fail(`found ${localhostHits} localhost/127.0.0.1 reference(s) in the static export`);

  const indexHtml = path.join(outDir, 'index.html');
  if (!existsSync(indexHtml)) fail('index.html missing from export');

  return { files, totalBytes, indexHtml };
}

// ============================== 5. SELF-CHECK sw.js (ponytail: the one runnable check) ==============================
// No jsdom/Playwright in this repo (CONTRACTS.md sec 7.13's approved list
// has neither) -- this is the closest honest proxy: evaluate the real
// public/sw.js source against a minimal hand-built Cache/fetch/self fake,
// the same "bridge the real file into a fake platform surface" technique
// apps/web/test/worker.test.ts already uses for sim.worker.ts.
async function selfCheckServiceWorker() {
  const src = readFileSync(path.join(webDir, 'public', 'sw.js'), 'utf8');
  const listeners = {};
  const stores = new Map(); // cacheName -> Map(url -> fake response)
  const fakeCache = (name) => ({
    async addAll(urls) {
      const store = stores.get(name) ?? new Map();
      for (const u of urls) store.set(u, { ok: true, url: u, clone: () => ({ ok: true, url: u }) });
      stores.set(name, store);
    },
    async match(req) {
      const url = typeof req === 'string' ? req : req.url;
      for (const store of stores.values()) if (store.has(url)) return store.get(url);
      return undefined;
    },
    async put(req, res) {
      const store = stores.get(name) ?? new Map();
      store.set(typeof req === 'string' ? req : req.url, res);
      stores.set(name, store);
    },
  });
  const fakeSelf = {
    location: { origin: 'https://example.invalid' },
    addEventListener(type, cb) {
      listeners[type] = cb;
    },
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  };
  const fakeCaches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      return fakeCache(name);
    },
    async keys() {
      return [...stores.keys()];
    },
    async delete(name) {
      stores.delete(name);
    },
    async match(req) {
      const url = typeof req === 'string' ? req : req.url;
      for (const store of stores.values()) if (store.has(url)) return store.get(url);
      return undefined;
    },
  };
  let networkUp = true;
  const fakeFetch = async (req) => {
    if (!networkUp) throw new Error('network down');
    const url = typeof req === 'string' ? req : req.url;
    return { ok: true, url, clone: () => ({ ok: true, url }) };
  };
  // Run the REAL, unmodified public/sw.js source (own file, not external
  // input) in an isolated vm context standing in for the service-worker
  // global scope -- node:vm is the built-in, correct tool for "execute this
  // trusted script against a fake platform surface", the same job
  // apps/web/test/worker.test.ts does for sim.worker.ts via a real Worker.
  const sandbox = { self: fakeSelf, caches: fakeCaches, fetch: fakeFetch, URL };
  vm.createContext(sandbox);
  // vm.runInContext returns the value of the script's last expression --
  // top-level `const`/`let` bindings are NOT exposed on the context object
  // (a real node:vm gotcha), so the appended bare reference is how this
  // pulls PRECACHE_URLS back out, in the same lexical scope the file itself
  // declared it in.
  const PRECACHE_URLS = vm.runInContext(src + '\nPRECACHE_URLS;', sandbox, {
    filename: 'public/sw.js',
  });

  await listeners.install({ waitUntil: (p) => p });
  const cacheNames = [...stores.keys()];
  const cachedUrls = [...(stores.get(cacheNames[0])?.keys() ?? [])];
  const missing = PRECACHE_URLS.filter((u) => !cachedUrls.includes(u));
  if (missing.length) fail(`sw.js self-check: install() did not precache: ${missing.join(', ')}`);
  const tmyPrecached = PRECACHE_URLS.filter((u) => u.startsWith('/tmy/')).length;
  if (tmyPrecached !== 5)
    fail(`sw.js self-check: expected 5 precached TMY files, found ${tmyPrecached}`);

  // Cache-busting: an old-named cache must be purged on activate().
  stores.set('shelter-sim-vOLD', new Map([['/stale', { ok: true }]]));
  await listeners.activate({ waitUntil: (p) => p });
  if (stores.has('shelter-sim-vOLD'))
    fail('sw.js self-check: activate() did not purge the old-versioned cache');
  if (!stores.has(cacheNames[0])) fail('sw.js self-check: activate() purged the CURRENT cache too');

  // navigation: network-first, falls back to cache when offline.
  const navReq = { method: 'GET', url: 'https://example.invalid/', mode: 'navigate' };
  let respondWithArg;
  await listeners.fetch({ request: navReq, respondWith: (p) => (respondWithArg = p) });
  const onlineNavResult = await respondWithArg;
  if (onlineNavResult.url !== navReq.url)
    fail('sw.js self-check: online navigation did not hit the network');
  networkUp = false;
  await listeners.fetch({ request: navReq, respondWith: (p) => (respondWithArg = p) });
  const offlineNavResult = await respondWithArg;
  if (!offlineNavResult || offlineNavResult.url !== navReq.url) {
    fail('sw.js self-check: offline navigation did not fall back to the precached copy');
  }
  networkUp = true;

  log(
    'sw.js self-check: PASS (install precaches',
    PRECACHE_URLS.length,
    'urls incl. 5 TMY files;',
    'activate purges old cache only; navigation is network-first with offline cache fallback)',
  );
}

// ============================== MAIN ==============================

async function main() {
  log('1/5 precomputing the initial preset + result (plain Node, outside any Next sandbox)...');
  const initialData = await generateInitialData();
  log(
    `    preset=${initialData.presetId} tempAt0600=${(initialData.tempAt0600K - 273.15).toFixed(2)} degC`,
  );

  log(
    '2/5 assembling .export-scratch/ (production source only, no app/api, no app/page.tsx, no *.test.*)...',
  );
  buildScratch(initialData);

  log('3/5 running next build --webpack (SHELTER_STATIC_EXPORT=1) in .export-scratch/...');
  runExportBuild();

  log('4/5 verifying static-export/...');
  const { files, totalBytes } = verifyOutput();

  log('5/5 self-checking public/sw.js against a fake Cache/fetch/self...');
  await selfCheckServiceWorker();

  rmSync(scratchDir, { recursive: true, force: true });

  log('DONE. Static export written to', outDir);
  log(`     ${files.length} files, ${(totalBytes / 1024 / 1024).toFixed(3)} MB total.`);
  log('     Serve it with: npx serve ' + path.relative(process.cwd(), outDir));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
