import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Resolves the @/* -> ./* alias from tsconfig.json natively; no plugin.
    tsconfigPaths: true,
  },
  test: {
    // node, not jsdom: the modules worth testing import @/app/drizzle/db and
    // @clerk/nextjs/server at module scope, so they need vi.mock in a node
    // environment. A jsdom-only setup would never reach them.
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "e2e/**"],
  },
});
