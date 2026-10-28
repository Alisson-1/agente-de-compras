import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// A web chama /api/* e o Vite repassa para a API (porta 3333).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3333", changeOrigin: true },
    },
  },
});
