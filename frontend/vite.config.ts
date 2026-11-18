import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    // The browser only ever talks to /api on this origin; the backend's port and secrets stay server-side.
    // 3001 is the backend's API_PORT default (backend/src/config.ts); change both together.
    proxy: { "/api": "http://localhost:3001" },
  },
});
