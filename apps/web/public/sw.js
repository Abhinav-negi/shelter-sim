// apps/web/public/sw.js
//
// T-66 (log/AREA-J/T-66.md) -- the PWA offline-install path. plan.md Part 4 /
// CONTRACTS.md's architecture diagram: "a PWA requires an initial online
// load to install its service worker" -- this file IS that install. Once it
// has run once while online, a second load with the network off still
// renders the app shell and every bundled TMY file the local worker
// (apps/web/workers/sim.worker.ts, T-43) needs to run a full simulation
// with zero network.
//
// Deliberately NOT Workbox or any other SW toolkit: nothing in this file
// needs one, and no such package is on the approved dependency list
// (CONTRACTS.md sec 7.13). Plain Cache Storage API + fetch event, both
// native platform features -- rung 4 of the ladder.
//
// CACHE-BUSTING (acceptance test 12): bump CACHE_VERSION any time the set of
// precached URLs below changes. `activate` deletes every cache whose name
// does not match the current version, and `self.skipWaiting()` /
// `clients.claim()` make a newly-installed worker take over immediately
// instead of waiting for every open tab to close. Just as important: the
// one document this worker ever caches ('/') is served NETWORK-FIRST (see
// the fetch handler), so an online reload always gets the live HTML -- and
// therefore the live, newly content-hashed `/_next/static/...` script URLs
// a fresh deploy produces -- and only falls back to the cached snapshot when
// the network genuinely fails. A stale build can never be served while a
// server is reachable; it is only ever the deliberate offline fallback.
const CACHE_VERSION = 'shelter-sim-v1';

// The app shell itself (network-first, see below) plus every file that must
// be byte-present for a fully offline second load: the manifest, the icon,
// and T-27's five bundled TMY files (packages/data/tmy/*.json, copied to
// apps/web/public/tmy/*.json so a plain fetch can reach them -- see this
// task's Evidence block for why the copy, not a symlink).
const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/icon.svg',
  '/tmy/leh.json',
  '/tmy/kargil.json',
  '/tmy/drass.json',
  '/tmy/nubra.json',
  '/tmy/jaisalmer.json',
];

// The compiled `/_next/static/...` chunk URLs are content-hashed by Next's
// build and unknown ahead of time (this file ships from source control, not
// generated post-build -- apps/web/package.json's build script is outside
// this task's allow-list to hook a manifest-generation step into). Runtime
// caching handles them instead: the FIRST time a hashed asset is fetched
// (i.e. during the one online visit that installs this worker) it is
// written into the cache; every later request for that exact URL is served
// cache-first. Because the hash changes whenever the content does, "cached
// forever" is always safe for these URLs specifically -- the same
// justification Workbox's own default runtime-caching strategy for
// build-hashed assets uses, just without the dependency.
function isImmutableAsset(url) {
  return url.pathname.startsWith('/_next/static/');
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_VERSION).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // never intercept a mutating request

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never cache cross-origin (e.g. a future live-weather fetch)

  if (isImmutableAsset(url)) {
    event.respondWith(cacheFirst(req));
    return;
  }

  if (req.mode === 'navigate' || PRECACHE_URLS.includes(url.pathname)) {
    event.respondWith(networkFirst(req));
    return;
  }
  // Anything else (e.g. a same-origin API call): network-first, no
  // fallback write -- an API response is never something this worker
  // should serve stale.
  event.respondWith(fetch(req).catch(() => caches.match(req)));
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) {
    const cache = await caches.open(CACHE_VERSION);
    cache.put(req, res.clone());
  }
  return res;
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    throw new Error('offline and no cached response for ' + req.url);
  }
}
