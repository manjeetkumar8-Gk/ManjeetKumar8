import { Pool, PoolConfig } from "pg";
import dotenv from "dotenv";

dotenv.config();

const isRemoteHost =
  process.env.DB_HOST &&
  process.env.DB_HOST !== "localhost" &&
  process.env.DB_HOST !== "127.0.0.1";

const useSsl =
  process.env.DB_SSL === "true" ||
  Boolean(isRemoteHost) ||
  Boolean(process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("localhost"));

const config: PoolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    }
  : {
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || "postgres",
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    };

export const pool = new Pool(config);

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL error:", error);
});
