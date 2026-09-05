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
    // Bounds acquiring a connection only - NOT how long a query may then run.
    connectionTimeoutMillis: 10_000,
    // Without these a query that never returns hangs its caller forever, and
    // "forever" propagates: an awaited db call with no timeout is why the
    // onboarding poll used to be chainable behind provisioning at all. Every
    // query in this app is a small indexed read or a single-row write, so 15s
    // is far beyond any legitimate case.
    //
    // query_timeout is client-side (node-postgres gives up waiting);
    // statement_timeout is server-side (Postgres cancels the query), so the
    // work actually stops rather than running on unattended.
    query_timeout: 15_000,
    statement_timeout: 15_000,
  });
}

const pool =
  process.env.NODE_ENV === "production"
    ? createPool()
    : (globalForDb.__pgPool ??= createPool());

export const db = drizzle(pool, { schema });
