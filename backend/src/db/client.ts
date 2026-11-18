import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/** Opens the connection pool and the Drizzle client. Create one per process. */
export function createDatabase(databaseUrl: string) {
  const pool = new Pool({ connectionString: databaseUrl, max: 10, connectionTimeoutMillis: 3_000 });
  // An idle connection can drop (for example when the container restarts). Log it instead of crashing.
  pool.on("error", (error) => console.error(`Postgres pool error: ${error.message}`));
  const db = drizzle({ client: pool, schema });
  return { pool, db };
}

export type Database = ReturnType<typeof createDatabase>["db"];

/** Either the database or an open transaction: services accept both. */
export type DbExecutor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

/** True when the database answers a trivial query. */
export async function pingDatabase(pool: Pool): Promise<boolean> {
  try {
    await pool.query("select 1");
    return true;
  } catch {
    return false;
  }
}
