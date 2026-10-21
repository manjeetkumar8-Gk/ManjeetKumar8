
import { Request, Response } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { pool } from "../config/db";
import {
  createActivationLink,
  sendOwnerActivationEmail,
} from "../services/emailService";

export async function getDashboardStats(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const [shops, activeShops, users, activeUsers] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS total FROM shops"),
      pool.query(
        "SELECT COUNT(*)::int AS total FROM shops WHERE status = 'active'"
      ),
      pool.query("SELECT COUNT(*)::int AS total FROM users"),
      pool.query(
        "SELECT COUNT(*)::int AS total FROM users WHERE status = 'active'"
      ),
    ]);

    res.json({
      success: true,
      stats: {
        totalShops: shops.rows[0].total,
        activeShops: activeShops.rows[0].total,
        inactiveShops:
          shops.rows[0].total - activeShops.rows[0].total,
        totalUsers: users.rows[0].total,
        activeUsers: activeUsers.rows[0].total,
      },
    });
  } catch (error) {
    console.error("Super Admin stats error:", error);
    res.status(500).json({
      success: false,
      message: "Could not load dashboard statistics",
    });
  }
}
export async function deleteShop(
  req: Request,
  res: Response
): Promise<void> {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({
      success: false,
      message: "Invalid shop ID",
    });
    return;
  }

  try {
    const result = await pool.query(
      `DELETE FROM shops
       WHERE id = $1
       RETURNING id, shop_name, shop_code`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: "Shop not found",
      });
      return;
    }

    res.json({
      success: true,
      message: "Shop deleted successfully",
      shop: result.rows[0],
    });
  } catch (error) {
    const dbError = error as { code?: string };

    if (dbError.code === "23503") {
      res.status(409).json({
        success: false,
        message: "Shop has linked records. Deactivate it instead.",
      });
      return;
    }

    console.error("Delete shop error:", error);

    res.status(500).json({
      success: false,
      message: "Could not delete shop",
    });
  }
}

export async function getShops(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const result = await pool.query(`
      SELECT
        s.id,
        s.shop_name,
        s.shop_code,
        s.address,
        s.phone,
        s.email,
        s.status,
        s.subscription_start,
        s.subscription_end,
        s.created_at,
        u.id AS owner_id,
        u.name AS owner_name,
        u.username AS owner_username,
        u.email AS owner_email,
        u.status AS owner_status
      FROM shops s
      LEFT JOIN users u
        ON u.shop_id = s.id
       AND u.role_id = (
         SELECT id
         FROM roles
         WHERE role_name = 'Shop Admin'
         LIMIT 1
       )
      ORDER BY s.id DESC
    `);

    res.json({
      success: true,
      shops: result.rows,
    });
  } catch (error) {
    console.error("Get shops error:", error);
    res.status(500).json({
      success: false,
      message: "Could not load shops",
    });
  }
}

export async function createShop(
  req: Request,
  res: Response
): Promise<void> {
  const {
    shop_name,
    shop_code,
    address,
    phone,
    email,
    owner_name,
    owner_username,
    owner_email,
    owner_password,
    subscription_start,
    subscription_end,
  } = req.body;

  const shopName =
    typeof shop_name === "string" ? shop_name.trim() : "";

  const shopCode =
    typeof shop_code === "string" ? shop_code.trim() : "";

  const ownerName =
    typeof owner_name === "string" ? owner_name.trim() : "";

  const ownerUsername =
    typeof owner_username === "string"
      ? owner_username.trim()
      : "";

  const ownerEmail =
    typeof owner_email === "string"
      ? owner_email.trim().toLowerCase()
      : "";

  if (
    !shopName ||
    !shopCode ||
    !ownerName ||
    !ownerUsername ||
    !ownerEmail
  ) {
    res.status(400).json({
      success: false,
      message:
        "Shop name, shop code, owner name, owner username and owner email are required",
    });
    return;
  }

  if (
    typeof owner_password !== "string" ||
    owner_password.length < 8
  ) {
    res.status(400).json({
      success: false,
      message: "Owner password must be at least 8 characters long",
    });
    return;
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailPattern.test(ownerEmail)) {
    res.status(400).json({
      success: false,
      message: "Enter a valid owner email address",
    });
    return;
  }

  if (
    subscription_start &&
    subscription_end &&
    (
      Number.isNaN(Date.parse(subscription_start)) ||
      Number.isNaN(Date.parse(subscription_end)) ||
      new Date(subscription_end) < new Date(subscription_start)
    )
  ) {
    res.status(400).json({
      success: false,
      message: "Enter valid subscription dates; end date cannot be before start date",
    });
    return;
  }

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const duplicate = await client.query(
      `SELECT id
       FROM users
       WHERE LOWER(username) = LOWER($1)
          OR LOWER(email) = LOWER($2)
       LIMIT 1`,
      [ownerUsername, ownerEmail]
    );

    if (duplicate.rows.length > 0) {
      await client.query("ROLLBACK");

      res.status(409).json({
        success: false,
        message: "Owner username or email is already registered",
      });
      return;
    }

    const roleResult = await client.query(
      `SELECT id
       FROM roles
       WHERE role_name = 'Shop Admin'
       LIMIT 1`
    );

    if (!roleResult.rows.length) {
      throw new Error("Shop Admin role was not found in the roles table");
    }

    const shopResult = await client.query(
      `INSERT INTO shops (
        shop_name,
        shop_code,
        address,
        phone,
        email,
        status,
        subscription_start,
        subscription_end,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, NOW(), NOW())
      RETURNING
        id,
        shop_name,
        shop_code,
        address,
        phone,
        email,
        status,
        subscription_start,
        subscription_end`,
      [
        shopName,
        shopCode,
        address || null,
        phone || null,
        typeof email === "string" && email.trim()
          ? email.trim().toLowerCase()
          : ownerEmail,
        subscription_start || null,
        subscription_end || null,
      ]
    );

    const shopId = Number(shopResult.rows[0].id);
    const passwordHash = await bcrypt.hash(owner_password, 10);

    const userResult = await client.query(
      `INSERT INTO users (
        shop_id,
        role_id,
        name,
        username,
        email,
        password_hash,
        status,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'pending', NOW(), NOW())
      RETURNING id, name, username, email, status`,
      [
        shopId,
        roleResult.rows[0].id,
        ownerName,
        ownerUsername,
        ownerEmail,
        passwordHash,
      ]
    );

    const ownerId = Number(userResult.rows[0].id);

    const activationToken = crypto.randomBytes(32).toString("hex");

    const tokenHash = crypto
      .createHash("sha256")
      .update(activationToken)
      .digest("hex");

    await client.query(
      `INSERT INTO password_reset_tokens (
        user_id,
        token_hash,
        expires_at,
        used_at,
        created_at
      )
      VALUES ($1, $2, NOW() + INTERVAL '15 minutes', NULL, NOW())`,
      [ownerId, tokenHash]
    );

    await client.query("COMMIT");

    let emailSent = false;

    try {
      await sendOwnerActivationEmail(
        ownerEmail,
        createActivationLink(activationToken),
        shopName
      );

      emailSent = true;
    } catch (emailError) {
      console.error(
        `Owner activation email failed for user ${ownerId}:`,
        emailError
      );
    }

    res.status(201).json({
      success: true,
      message: emailSent
        ? "Shop and owner account created. Activation email sent."
        : "Shop and owner account created, but activation email could not be sent. Check email configuration.",
      shop: shopResult.rows[0],
      owner: {
        id: ownerId,
        name: ownerName,
        username: ownerUsername,
        email: ownerEmail,
        status: "pending",
      },
      emailSent,
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Transaction may already have ended.
      }
    }

    const dbError = error as { code?: string };

    if (dbError.code === "23505") {
      res.status(409).json({
        success: false,
        message: "Shop code, owner username, or owner email already exists",
      });
      return;
    }

    console.error("Create shop error:", error);

    res.status(500).json({
      success: false,
      message: "Could not create shop and owner account",
    });
  } finally {
    client?.release();
  }
}

export async function updateShop(
  req: Request,
  res: Response
): Promise<void> {
  let client;

  try {
    const id = Number(req.params.id);

    const {
      shop_name,
      shop_code,
      address,
      phone,
      email,
      subscription_start,
      subscription_end,
      owner_password,
    } = req.body;

    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({
        success: false,
        message: "Invalid shop ID",
      });
      return;
    }

    if (
      typeof shop_name !== "string" ||
      !shop_name.trim() ||
      typeof shop_code !== "string" ||
      !shop_code.trim()
    ) {
      res.status(400).json({
        success: false,
        message: "Shop name and shop code are required",
      });
      return;
    }

    if (
      subscription_start &&
      subscription_end &&
      (
        Number.isNaN(Date.parse(subscription_start)) ||
        Number.isNaN(Date.parse(subscription_end)) ||
        new Date(subscription_end) < new Date(subscription_start)
      )
    ) {
      res.status(400).json({
        success: false,
        message: "Enter valid subscription dates; end date cannot be before start date",
      });
      return;
    }

    const newPassword =
      typeof owner_password === "string" ? owner_password : "";

    if (newPassword.length > 0 && newPassword.length < 8) {
      res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters long",
      });
      return;
    }

    client = await pool.connect();
    await client.query("BEGIN");

    const shopResult = await client.query(
      `UPDATE shops
       SET shop_name = $1,
           shop_code = $2,
           address = $3,
           phone = $4,
           email = $5,
           subscription_start = $6,
           subscription_end = $7,
           updated_at = NOW()
       WHERE id = $8
       RETURNING
         id,
         shop_name,
         shop_code,
         address,
         phone,
         email,
         status,
         subscription_start,
         subscription_end`,
      [
        shop_name.trim(),
        shop_code.trim(),
        address || null,
        phone || null,
        typeof email === "string" && email.trim()
          ? email.trim().toLowerCase()
          : null,
        subscription_start || null,
        subscription_end || null,
        id,
      ]
    );

    if (!shopResult.rows.length) {
      await client.query("ROLLBACK");

      res.status(404).json({
        success: false,
        message: "Shop not found",
      });
      return;
    }

    if (newPassword.length > 0) {
      const ownerResult = await client.query(
        `SELECT id
         FROM users
         WHERE shop_id = $1
           AND role_id = (
             SELECT id
             FROM roles
             WHERE role_name = 'Shop Admin'
             LIMIT 1
           )
         LIMIT 1`,
        [id]
      );

      if (!ownerResult.rows.length) {
        await client.query("ROLLBACK");

        res.status(404).json({
          success: false,
          message: "Shop owner account not found",
        });
        return;
      }

      const ownerId = ownerResult.rows[0].id;
      const passwordHash = await bcrypt.hash(newPassword, 10);

      await client.query(
        `UPDATE users
         SET password_hash = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [passwordHash, ownerId]
      );

      await client.query(
        `DELETE FROM password_reset_tokens
         WHERE user_id = $1`,
        [ownerId]
      );
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      message:
        newPassword.length > 0
          ? "Shop and owner password updated successfully"
          : "Shop updated successfully",
      shop: shopResult.rows[0],
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Transaction may already have ended.
      }
    }

    const dbError = error as { code?: string };

    if (dbError.code === "23505") {
      res.status(409).json({
        success: false,
        message: "Shop code already exists",
      });
      return;
    }

    console.error("Update shop error:", error);

    res.status(500).json({
      success: false,
      message: "Could not update shop",
    });
  } finally {
    client?.release();
  }
}

export async function updateShopStatus(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({
        success: false,
        message: "Invalid shop ID",
      });
      return;
    }

    if (status !== "active" && status !== "inactive") {
      res.status(400).json({
        success: false,
        message: "Status must be active or inactive",
      });
      return;
    }

    const result = await pool.query(
      `UPDATE shops
       SET status = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, shop_name, shop_code, status`,
      [status, id]
    );

    if (!result.rows.length) {
      res.status(404).json({
        success: false,
        message: "Shop not found",
      });
      return;
    }

    res.json({
      success: true,
      message: `Shop ${
        status === "active" ? "activated" : "deactivated"
      } successfully`,
      shop: result.rows[0],
    });
  } catch (error) {
    console.error("Update shop status error:", error);

    res.status(500).json({
      success: false,
      message: "Could not update shop status",
    });
  }
}
export async function getSubscriptions(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    const result = await pool.query(`
      SELECT
        id,
        shop_name,
        shop_code,
        status AS shop_status,
        subscription_start,
        subscription_end,
        CASE
          WHEN subscription_start IS NULL
            OR subscription_end IS NULL
            THEN 'not_set'
          WHEN subscription_start > CURRENT_DATE
            THEN 'upcoming'
          WHEN subscription_end < CURRENT_DATE
            THEN 'expired'
          WHEN subscription_end <= CURRENT_DATE + 30
            THEN 'expiring_soon'
          ELSE 'active'
        END AS subscription_status
      FROM shops
      ORDER BY subscription_end ASC NULLS FIRST, shop_name ASC
    `);

    res.json({
      success: true,
      subscriptions: result.rows,
    });
  } catch (error) {
    console.error("Get subscriptions error:", error);

    res.status(500).json({
      success: false,
      message: "Could not load subscriptions",
    });
  }
}

export async function updateShopSubscription(
  req: Request,
  res: Response
): Promise<void> {
  const id = Number(req.params.id);
  const { subscription_start, subscription_end } = req.body;

  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({
      success: false,
      message: "Invalid shop ID",
    });
    return;
  }

  // Both dates can be null/empty, but invalid dates are not permitted.
  const parseDate = (value: unknown): string | null | undefined => {
    if (value === null || value === "") return null;
    if (typeof value !== "string") return undefined;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;

    const date = new Date(`${value}T00:00:00.000Z`);

    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    ) {
      return undefined;
    }

    return value;
  };

  const start = parseDate(subscription_start);
  const end = parseDate(subscription_end);

  if (start === undefined || end === undefined) {
    res.status(400).json({
      success: false,
      message: "Use valid dates in YYYY-MM-DD format",
    });
    return;
  }

  if (start && end && end < start) {
    res.status(400).json({
      success: false,
      message: "Subscription end date cannot be before start date",
    });
    return;
  }

  try {
    const result = await pool.query(
      `UPDATE shops
       SET subscription_start = $1,
           subscription_end = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING
         id,
         shop_name,
         shop_code,
         subscription_start,
         subscription_end`,
      [start, end, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: "Shop not found",
      });
      return;
    }

    res.json({
      success: true,
      message: "Subscription updated successfully",
      subscription: result.rows[0],
    });
  } catch (error) {
    console.error("Update subscription error:", error);

    res.status(500).json({
      success: false,
      message: "Could not update subscription",
    });
  }
}


