const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5433,
  database: process.env.DB_NAME || "stock_management",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

(async () => {
  try {
    const result = await pool.query(`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('users', 'shops', 'roles', 'password_reset_tokens')
      ORDER BY table_name, ordinal_position
    `);
    console.table(result.rows);
  } catch (error) {
    console.log("Error:", error.message);
  } finally {
    await pool.end();
  }
})();
