import { defineConfig } from "tsup";

// Empacota a API num único dist/server.js. O pacote compartilhado exporta
// código-fonte TypeScript, então ele entra no bundle (noExternal).
export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  outDir: "dist",
  clean: true,
  noExternal: ["@copiloto/shared"],
});
