// apps/studio/e2e/preview.config.mjs — scratch `vite preview` config for
// flow.mjs's own E2E server. Plain object (no `import ... from 'vite'`,
// which the prior F2b/F2c/F3/F4 scratch configs found can fail to resolve
// depending on the invoking cwd) that serves apps/studio's production
// `dist/` and proxies `/api` to the scratch studio-server (scratch-
// server.mjs). Ports must match flow.mjs's SERVER_PORT/PREVIEW_PORT
// constants (4109/5281) — Q1.md's assigned scratch ports.
export default {
  root: new URL('../', import.meta.url).pathname, // apps/studio
  preview: {
    port: 5281,
    host: '127.0.0.1',
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:4109', changeOrigin: true },
    },
  },
};
