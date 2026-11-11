import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import * as path from "node:path";

export default defineConfig({
  plugins: [react()],
  root: "src/renderer",
  build: {
    outDir: "../../dist/renderer",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@studio-erp/shared": path.resolve(__dirname, "../shared/src/index.ts"),
      "@studio-erp/database": path.resolve(__dirname, "../database/src/index.ts"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});