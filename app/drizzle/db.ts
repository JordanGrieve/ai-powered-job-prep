import { env } from "../data/env/server";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../drizzle/schema";

// `next dev` re-evaluates this module on every HMR pass. Without a global
// cache each pass leaks a fresh 10-connection pool, and Postgres runs out of
// connections after roughly ten server-side edits.
const globalForDb = globalThis as unknown as { __pgPool?: Pool };

function createPool() {
  return new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

const pool =
  process.env.NODE_ENV === "production"
    ? createPool()
    : (globalForDb.__pgPool ??= createPool());

export const db = drizzle(pool, { schema });
