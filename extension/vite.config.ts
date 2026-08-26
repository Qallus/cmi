import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./src/manifest";

// MV3 build via @crxjs. The side panel (index.html) is the extension UI; the
// service worker and manifest are wired from src/.
export default defineConfig({
  plugins: [react(), crx({ manifest })],
  server: { port: 5173, strictPort: true, hmr: { port: 5173 } },
  build: { target: "es2022", sourcemap: true },
});
