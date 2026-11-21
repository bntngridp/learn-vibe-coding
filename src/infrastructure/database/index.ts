import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

export type Database = MySql2Database<typeof schema>;

export interface DatabaseConnection {
  readonly db: Database;
  readonly pool: mysql.Pool;
  checkConnection(): Promise<boolean>;
  close(): Promise<void>;
}

export function createDatabase(databaseUrl: string): DatabaseConnection {
  const pool = mysql.createPool({
    uri: databaseUrl,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  const db = drizzle(pool, { schema, mode: "default" });

  return {
    db,
    pool,
    async checkConnection(): Promise<boolean> {
      try {
        const connection = await pool.getConnection();
        try {
          await connection.ping();
          return true;
        } finally {
          connection.release();
        }
      } catch {
        return false;
      }
    },
    async close(): Promise<void> {
      await pool.end();
    },
  };
}
