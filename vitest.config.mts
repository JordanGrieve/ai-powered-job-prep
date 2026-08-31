import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // The real `server-only` package throws when resolved outside a server
      // bundler context. See test/server-only-stub.ts.
      // fileURLToPath (not URL.pathname) - on Windows the latter yields
      // "/C:/..." which Vite cannot resolve.
      "server-only": fileURLToPath(
        new URL("./test/server-only-stub.ts", import.meta.url),
      ),
    },
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
