// apps/web/next.config.mjs
//
// Minimal. No design system, no CSS framework (this task's prompt). T-67
// (deployment) and T-66 (the offline static build) may extend this later --
// nothing here anticipates their needs.
//
// TWO REAL TOOLCHAIN GOTCHAS live here, found while getting `next build`
// green for the first time in this repo. Both are about the exact same root
// cause: `@shelter/data`'s TMY loader (`packages/data/src/tmy.ts`) resolves
// a sibling directory at runtime with `new URL('../tmy/', import.meta.url)`
// -- a normal Node pattern -- and Next's bundler statically intercepts that
// exact syntax for asset resolution, failing the build the moment it tries
// to bundle that file at all ("Module not found: Can't resolve '../tmy/'").
// `packages/**` is off this task's allow-list, so the fix has to live here,
// keeping the package OUT of the bundle entirely (never parsed, so the
// static analysis never runs) rather than changing its source:
//
// 1. `serverExternalPackages` is Next's documented way to do exactly that --
//    but it is only implemented in the webpack build path
//    (`node_modules/next/dist/build/webpack-config.js`), not in Turbopack,
//    which is this Next version's DEFAULT bundler for both `next dev` and
//    `next build`. That is why `package.json`'s `dev`/`build` scripts pass
//    `--webpack` explicitly -- without it, this config option is silently a
//    no-op and the build fails the same way. Re-check this the moment Next
//    ships Turbopack support for `serverExternalPackages` (or drops webpack)
//    and this whole workaround can be deleted.
// 2. Even under webpack, `serverExternalPackages` matches by looking for
//    `/node_modules/@shelter/data/` in the resolved file path
//    (`isResourceInPackages`-style regex). npm workspaces symlink
//    `node_modules/@shelter/data -> ../../packages/data`, and webpack's
//    default resolver (`resolve.symlinks: true`) follows that symlink to
//    its REAL path before matching, which never contains `node_modules` --
//    so the regex never matches and the package silently gets bundled
//    anyway. Setting `resolve.symlinks = false` makes webpack match on the
//    symlinked path instead, which is what `serverExternalPackages` expects
//    in an npm-workspaces monorepo.
//
// A THIRD, UNRELATED GOTCHA, found by T-37: `apps/web/lib/db.ts`, `lib/log.ts`
// and `lib/repo/*.ts` (T-29/T-30/T-31, Area D, already closed tasks) write
// NodeNext-style relative imports with an explicit `.js` suffix on a `.ts`
// file (`import { logError } from './log.js'`) -- required by the repo's
// root `tsconfig.base.json` (`moduleResolution: "NodeNext"`), which those
// files were written under before T-36 gave `apps/web` its own Next-specific
// `tsconfig.json` (`moduleResolution: "bundler"`). TypeScript's `bundler`
// mode tolerates the `.js` specifier pointing at a `.ts` file at type-check
// time, but webpack's actual module resolution does not, and fails with
// "Module not found: Can't resolve './log.js'" the moment any route pulls
// `lib/db.ts`/`lib/repo/*` into the real bundle (T-37 is the first task to
// do so). Fixing this in Area D's already-closed files is out of scope here;
// `resolve.extensionAlias` is webpack 5's own documented answer to exactly
// this NodeNext/bundler mismatch, so the fix lives here instead.

// T-66 (log/AREA-J/T-66.md) -- the static-export build. Gated behind an env
// var so `next dev`/`next start`/the ordinary `next build` (used by every
// other task and by the PWA path) are completely unaffected -- this line
// only takes effect when `apps/web/scripts/build-static.mjs` sets
// SHELTER_STATIC_EXPORT=1 for its own private, throw-away build in
// `.export-scratch/`. See that script's header comment for why a *copy* of
// the app is built rather than the real `app/page.tsx` in place: page.tsx's
// own `dynamic = 'force-dynamic'` (needed for the reason its own comment
// gives) is unconditionally incompatible with `output: 'export'` --
// verified directly: Next refuses with "Page with `dynamic = 'force-dynamic'`
// ... cannot be used with output: export" -- and `app/page.tsx` is outside
// this task's allow-list to change.
const STATIC_EXPORT = process.env.SHELTER_STATIC_EXPORT === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(STATIC_EXPORT ? { output: 'export' } : {}),
  serverExternalPackages: ['@shelter/data'],
  webpack: (config, { isServer, webpack }) => {
    config.resolve.symlinks = false;
    config.resolve.extensionAlias = { '.js': ['.ts', '.tsx', '.js'] };
    if (isServer) {
      // `serverExternalPackages` alone was not enough to keep this out of
      // the compiled bundle in this Next version (see the header comment) --
      // a direct webpack `externals` entry does, because webpack never even
      // opens the file for an externals match, so the `new URL(...)` asset
      // transform never runs on it.
      // `@shelter/data` is a native ESM package ("type": "module") whose
      // graph includes top-level await (`@shelter/engine`'s serialise.ts).
      // Node refuses to `require()` that, so the external has to be the
      // `import` externalsType (an awaited dynamic `import()`), not
      // `commonjs`.
      const existing = Array.isArray(config.externals)
        ? config.externals
        : config.externals
          ? [config.externals]
          : [];
      config.externals = [...existing, { '@shelter/data': 'import @shelter/data' }];
    } else {
      // `@shelter/engine`'s barrel re-exports `serialise.ts`, which uses
      // `node:crypto` for `canonicalRequestHash` -- unused by anything this
      // task calls client-side, but still part of the module graph webpack
      // resolves when `lib/store.ts` imports `simulate`/`EngineError` from
      // the same barrel. Stubbing the Node builtin (rather than pulling in a
      // browser crypto polyfill for code that never runs) is correct here;
      // revisit if a later task actually calls a hashing function client-side.
      // webpack5's browser target has no handler for the `node:` URI scheme
      // at all (that is registered only for the Node target) -- `resolve
      // .alias`/`.fallback` never get a chance to run, since the request
      // never reaches normal resolution. Strip the `node:` prefix first, so
      // the bare `crypto` specifier below hits the normal fallback path.
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
          resource.request = resource.request.replace(/^node:/, '');
        }),
      );
      config.resolve.fallback = { ...config.resolve.fallback, crypto: false };
    }
    return config;
  },
};

export default nextConfig;
