import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Integration suite: real database, real model. Opt-in only.
 * Needs DATABASE_URL, GEMINI_API_KEY and SEED_USER_ID in the environment
 * (`--env-file=.env` is applied below via `test.env` loading of process.env).
 */
export default defineConfig({
  resolve: {
    alias: {
      "server-only": fileURLToPath(
        new URL("./test/server-only-stub.ts", import.meta.url),
      ),
    },
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["**/*.integration.test.ts"],
    exclude: ["node_modules/**", ".next/**", "e2e/**"],
    // One at a time: these share a database and burn provider quota.
    fileParallelism: false,
    testTimeout: 180_000,
  },
});
