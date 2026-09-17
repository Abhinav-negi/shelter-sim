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

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@shelter/data'],
  webpack: (config, { isServer, webpack }) => {
    config.resolve.symlinks = false;
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
      const existing = Array.isArray(config.externals) ? config.externals : config.externals ? [config.externals] : [];
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
