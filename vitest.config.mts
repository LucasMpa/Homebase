import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // Testes ficam ao lado do código: src/**/x.test.ts junto de x.ts.
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
