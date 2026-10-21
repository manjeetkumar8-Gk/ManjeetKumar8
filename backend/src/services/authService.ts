import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../config/db";
import { AuthUser } from "../types/auth";

export async function loginUser(
  usernameOrEmail: string,
  password: string
) {
  const identifier = usernameOrEmail.trim();

  const result = await pool.query(
    `
    SELECT
      u.id,
      u.shop_id,
      u.role_id,
      r.role_name,
      u.username,
      u.name,
      u.email,
      u.password_hash,
      u.status
    FROM users u
    INNER JOIN roles r ON r.id = u.role_id
    WHERE LOWER(TRIM(u.username)) = LOWER($1)
       OR LOWER(TRIM(u.email)) = LOWER($1)
    LIMIT 1
    `,
    [identifier]
  );

  if (result.rows.length === 0) {
    throw new Error("Invalid username or password");
  }

  const user = result.rows[0];

  if (user.status !== "active") {
    throw new Error("User account is inactive. Please contact your administrator.");
  }

  const passwordValid = await bcrypt.compare(
    password,
    user.password_hash
  );

  if (!passwordValid) {
    throw new Error("Invalid username or password");
  }

  const authUser: AuthUser = {
    id: user.id,
    shop_id: user.shop_id,
    role_id: user.role_id,
    role_name: user.role_name,
    username: user.username,
    name: user.name,
    email: user.email,
  };

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is missing");
  }

  const token = jwt.sign(authUser, secret, {
    expiresIn: "8h",
  });

  return {
    token,
    user: authUser,
  };
}
