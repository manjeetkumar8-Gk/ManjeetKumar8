
require("dotenv").config();
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const readline = require("readline");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  try {
    const username = (await ask("Super Admin username: ")).trim();
    const name = (await ask("Full name: ")).trim();
    const email = (await ask("Email (optional): ")).trim();
    const password = await ask("Choose a strong password: ");

    if (!username || !name || password.length < 8 || password.length > 72) {
      throw new Error("Username/name required; password must be 8–72 characters.");
    }

    const duplicate = await pool.query(
      "SELECT id FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1",
      [username]
    );

    if (duplicate.rows.length) {
      throw new Error("This username already exists. Choose another username.");
    }

    const role = await pool.query(
      "SELECT id FROM roles WHERE role_name = 'Super Admin' LIMIT 1"
    );

    if (!role.rows.length) {
      throw new Error("Super Admin role not found.");
    }

    const hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users
        (shop_id, role_id, name, username, email, password_hash, status, created_at, updated_at)
       VALUES (1, $1, $2, $3, $4, $5, 'active', NOW(), NOW())
       RETURNING id, username, role_id, shop_id, status`,
      [
        role.rows[0].id,
        name,
        username,
        email || null,
        hash,
      ]
    );

    console.log("Super Admin created:");
    console.table(result.rows);
  } catch (error) {
    console.error("Could not create Super Admin:", error.message);
  } finally {
    rl.close();
    await pool.end();
  }
}

main();

