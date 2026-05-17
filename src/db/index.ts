import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set in environment variables");
}

// Create the connection pool
export const poolConnection = mysql.createPool({
  uri: databaseUrl,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Create the Drizzle ORM instance
export const db = drizzle(poolConnection, { schema, mode: "default" });
