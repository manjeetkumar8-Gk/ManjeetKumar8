
import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { pool } from "../config/db";

type UserAuth = {
  id?: number;
  shop_id?: number | null;
  role_id?: number;
  role_name?: string;
};

type AuthRequest = Request & {
  user?: UserAuth;
};

const getAuthUser = (req: Request): UserAuth =>
  (req as AuthRequest).user ?? {};

const isSuperAdmin = (user: UserAuth) =>
  user.role_name === "Super Admin";

const sendError = (
  res: Response,
  status: number,
  message: string
): void => {
  res.status(status).json({ success: false, message });
};

const USER_COLUMNS = `
  u.id,
  u.name,
  u.username,
  u.email,
  u.role_id,
  r.role_name,
  u.shop_id,
  u.status,
  u.created_at
`;

const ALLOWED_ROLES = [
  "Super Admin",
  "Shop Admin",
  "Stock Operator",
  "Viewer",
];

async function findRoleId(roleName: string): Promise<number | null> {
  const result = await pool.query(
    `SELECT id FROM roles WHERE role_name = $1 LIMIT 1`,
    [roleName]
  );

  return result.rows.length ? Number(result.rows[0].id) : null;
}

async function userBelongsToShop(
  userId: number,
  shopId: number
): Promise<boolean> {
  const result = await pool.query(
    `SELECT id FROM users WHERE id = $1 AND shop_id = $2`,
    [userId, shopId]
  );

  return result.rows.length > 0;
}

/**
 * GET /api/users
 */
export const getUsers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authUser = getAuthUser(req);

    if (!authUser.role_name) {
      sendError(res, 401, "Authentication required");
      return;
    }

    let result;

    if (isSuperAdmin(authUser)) {
      result = await pool.query(
        `SELECT ${USER_COLUMNS}
         FROM users u
         INNER JOIN roles r ON r.id = u.role_id
         ORDER BY u.id DESC`
      );
    } else {
      if (!authUser.shop_id) {
        sendError(res, 403, "Your account is not assigned to a shop");
        return;
      }

      result = await pool.query(
        `SELECT ${USER_COLUMNS}
         FROM users u
         INNER JOIN roles r ON r.id = u.role_id
         WHERE u.shop_id = $1
         ORDER BY u.id DESC`,
        [authUser.shop_id]
      );
    }

    res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("getUsers error:", error);
    sendError(res, 500, "Failed to fetch users");
  }
};

/**
 * POST /api/users
 */
export const createUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authUser = getAuthUser(req);

    if (!["Super Admin", "Shop Admin"].includes(authUser.role_name ?? "")) {
      sendError(res, 403, "You do not have permission to create users");
      return;
    }

    const { name, username, email, password, role, shop_id } = req.body;

    if (
      typeof name !== "string" ||
      typeof username !== "string" ||
      typeof password !== "string" ||
      typeof role !== "string" ||
      !name.trim() ||
      !username.trim() ||
      !password
    ) {
      sendError(res, 400, "Name, username, password and role are required");
      return;
    }

    if (name.trim().length > 100 || username.trim().length > 50) {
      sendError(res, 400, "Name or username is too long");
      return;
    }

    if (password.length < 8 || password.length > 72) {
      sendError(res, 400, "Password must be between 8 and 72 characters");
      return;
    }

    const cleanEmail =
      typeof email === "string" && email.trim()
        ? email.trim()
        : null;

    if (
      cleanEmail &&
      (cleanEmail.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))
    ) {
      sendError(res, 400, "Please provide a valid email address");
      return;
    }

    if (!ALLOWED_ROLES.includes(role)) {
      sendError(res, 400, "Invalid role");
      return;
    }

    if (role === "Super Admin" && !isSuperAdmin(authUser)) {
      sendError(res, 403, "Only Super Admin can assign this role");
      return;
    }

    let targetShopId: number | null;

    if (isSuperAdmin(authUser)) {
      targetShopId =
        shop_id === undefined || shop_id === null || shop_id === ""
          ? null
          : Number(shop_id);

      if (
        targetShopId !== null &&
        (!Number.isSafeInteger(targetShopId) || targetShopId <= 0)
      ) {
        sendError(res, 400, "Invalid shop ID");
        return;
      }
    } else {
      if (!authUser.shop_id) {
        sendError(res, 403, "Your account is not assigned to a shop");
        return;
      }

      targetShopId = authUser.shop_id;
    }

    if (targetShopId !== null) {
      const shop = await pool.query(
        `SELECT id FROM shops WHERE id = $1`,
        [targetShopId]
      );

      if (shop.rows.length === 0) {
        sendError(res, 400, "Shop not found");
        return;
      }
    }

    if (role !== "Super Admin" && targetShopId === null) {
      sendError(res, 400, "A shop must be selected for this role");
      return;
    }

    const duplicate = await pool.query(
      `SELECT id FROM users
       WHERE LOWER(username) = LOWER($1)
       LIMIT 1`,
      [username.trim()]
    );

    if (duplicate.rows.length > 0) {
      sendError(res, 409, "Username already exists");
      return;
    }

    const roleId = await findRoleId(role);

    if (roleId === null) {
      sendError(res, 400, "Selected role does not exist in the database");
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users
         (name, username, email, password_hash, role_id, shop_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active')
       RETURNING id, name, username, email, role_id, shop_id, status, created_at`,
      [
        name.trim(),
        username.trim(),
        cleanEmail,
        passwordHash,
        roleId,
        targetShopId,
      ]
    );

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: { ...result.rows[0], role_name: role },
    });
  } catch (error) {
    console.error("createUser error:", error);

    const dbError = error as { code?: string };

    if (dbError.code === "23505") {
      sendError(res, 409, "Username or email already exists");
      return;
    }

    if (dbError.code === "23503") {
      sendError(res, 400, "Invalid shop or role");
      return;
    }

    sendError(res, 500, "Failed to create user");
  }
};

/**
 * PUT /api/users/:id
 */
export const updateUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authUser = getAuthUser(req);

    if (!["Super Admin", "Shop Admin"].includes(authUser.role_name ?? "")) {
      sendError(res, 403, "You do not have permission to update users");
      return;
    }

    const userId = Number(req.params.id);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      sendError(res, 400, "Invalid user ID");
      return;
    }

    const targetResult = await pool.query(
      `SELECT u.id, u.name, u.username, u.email, u.role_id,
              u.shop_id, u.status, r.role_name
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [userId]
    );

    if (targetResult.rows.length === 0) {
      sendError(res, 404, "User not found");
      return;
    }

    const target = targetResult.rows[0];

    if (!isSuperAdmin(authUser)) {
      if (
        !authUser.shop_id ||
        Number(target.shop_id) !== Number(authUser.shop_id)
      ) {
        sendError(res, 404, "User not found");
        return;
      }

      if (target.role_name === "Super Admin") {
        sendError(res, 403, "You cannot update a Super Admin");
        return;
      }
    }

    const name =
      typeof req.body.name === "string"
        ? req.body.name.trim()
        : target.name;

    const username =
      typeof req.body.username === "string"
        ? req.body.username.trim()
        : target.username;

    const email =
      req.body.email === undefined
        ? target.email
        : typeof req.body.email === "string" && req.body.email.trim()
          ? req.body.email.trim()
          : null;

    const role =
      typeof req.body.role === "string" && req.body.role.trim()
        ? req.body.role.trim()
        : target.role_name;

    if (!name || !username) {
      sendError(res, 400, "Name and username are required");
      return;
    }

    if (name.length > 100 || username.length > 50) {
      sendError(res, 400, "Name or username is too long");
      return;
    }

    if (
      email &&
      (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    ) {
      sendError(res, 400, "Please provide a valid email address");
      return;
    }

    if (!ALLOWED_ROLES.includes(role)) {
      sendError(res, 400, "Invalid role");
      return;
    }

    if (role === "Super Admin" && !isSuperAdmin(authUser)) {
      sendError(res, 403, "Only Super Admin can assign this role");
      return;
    }

    if (
      !isSuperAdmin(authUser) &&
      role === "Shop Admin" &&
      authUser.role_name !== "Shop Admin"
    ) {
      sendError(res, 403, "You cannot assign this role");
      return;
    }

    const duplicate = await pool.query(
      `SELECT id FROM users
       WHERE LOWER(username) = LOWER($1) AND id <> $2
       LIMIT 1`,
      [username, userId]
    );

    if (duplicate.rows.length > 0) {
      sendError(res, 409, "Username already exists");
      return;
    }

    const roleId = await findRoleId(role);

    if (roleId === null) {
      sendError(res, 400, "Selected role does not exist in the database");
      return;
    }

    const result = await pool.query(
      `UPDATE users
       SET name = $1,
           username = $2,
           email = $3,
           role_id = $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING id, name, username, email, role_id, shop_id, status, created_at`,
      [name, username, email, roleId, userId]
    );

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: { ...result.rows[0], role_name: role },
    });
  } catch (error) {
    console.error("updateUser error:", error);

    const dbError = error as { code?: string };

    if (dbError.code === "23505") {
      sendError(res, 409, "Username or email already exists");
      return;
    }

    sendError(res, 500, "Failed to update user");
  }
};

/**
 * PATCH /api/users/:id/status
 * Request body: { "is_active": true } or { "is_active": false }
 */
export const updateUserStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authUser = getAuthUser(req);

    if (!["Super Admin", "Shop Admin"].includes(authUser.role_name ?? "")) {
      sendError(res, 403, "You do not have permission to change user status");
      return;
    }

    const userId = Number(req.params.id);
    const { is_active } = req.body;

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      sendError(res, 400, "Invalid user ID");
      return;
    }

    if (typeof is_active !== "boolean") {
      sendError(res, 400, "is_active must be true or false");
      return;
    }

    if (Number(authUser.id) === userId && !is_active) {
      sendError(res, 400, "You cannot deactivate your own account");
      return;
    }

    const targetResult = await pool.query(
      `SELECT u.id, u.shop_id, r.role_name
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [userId]
    );

    if (targetResult.rows.length === 0) {
      sendError(res, 404, "User not found");
      return;
    }

    const target = targetResult.rows[0];

    if (!isSuperAdmin(authUser)) {
      if (
        !authUser.shop_id ||
        Number(target.shop_id) !== Number(authUser.shop_id)
      ) {
        sendError(res, 404, "User not found");
        return;
      }

      if (target.role_name === "Super Admin") {
        sendError(res, 403, "You cannot change a Super Admin status");
        return;
      }
    }

    const status = is_active ? "active" : "inactive";

    const result = await pool.query(
      `UPDATE users
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, status`,
      [status, userId]
    );

    res.status(200).json({
      success: true,
      message: "User status updated successfully",
      data: {
        ...result.rows[0],
        is_active: result.rows[0].status === "active",
      },
    });
  } catch (error) {
    console.error("updateUserStatus error:", error);
    sendError(res, 500, "Failed to update user status");
  }
};

/**
 * PATCH /api/users/:id/password
 * Request body: { "password": "NewPassword123" }
 */
export const updateUserPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const authUser = getAuthUser(req);

    if (!["Super Admin", "Shop Admin"].includes(authUser.role_name ?? "")) {
      sendError(res, 403, "You do not have permission to change passwords");
      return;
    }

    const userId = Number(req.params.id);
    const { password } = req.body;

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      sendError(res, 400, "Invalid user ID");
      return;
    }

    if (
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 72
    ) {
      sendError(res, 400, "Password must be between 8 and 72 characters");
      return;
    }

    const targetResult = await pool.query(
      `SELECT u.id, u.shop_id, r.role_name
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [userId]
    );

    if (targetResult.rows.length === 0) {
      sendError(res, 404, "User not found");
      return;
    }

    const target = targetResult.rows[0];

    if (!isSuperAdmin(authUser)) {
      if (
        !authUser.shop_id ||
        Number(target.shop_id) !== Number(authUser.shop_id)
      ) {
        sendError(res, 404, "User not found");
        return;
      }

      if (target.role_name === "Super Admin") {
        sendError(res, 403, "You cannot change a Super Admin password");
        return;
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(
      `UPDATE users
       SET password_hash = $1, updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, userId]
    );

    res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("updateUserPassword error:", error);
    sendError(res, 500, "Failed to update password");
  }
};
