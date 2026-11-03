import { defineConfig } from "vite";

export default defineConfig({
  root: "apps/poc-web",
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/auth": { target: "http://127.0.0.1:8787", changeOrigin: false },
      "/api": { target: "http://127.0.0.1:8787", changeOrigin: false },
      "/health": { target: "http://127.0.0.1:8787", changeOrigin: false },
    },
  },
  build: { outDir: "../../dist/poc-web", emptyOutDir: true },
});
