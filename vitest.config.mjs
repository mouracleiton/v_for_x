import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

// Resolve the "@" path alias (configured in tsconfig.json) so that modules
// importing "@/..." (e.g. world_backbone.json) work under vitest.
// Uses .mjs to stay ESM-native (project package.json has no "type": "module").
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
