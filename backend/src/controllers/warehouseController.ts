import { Request, Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../types/auth";

function getShopId(req: Request): number | null {
  const shopId = Number((req as AuthRequest).user?.shop_id);

  return Number.isInteger(shopId) && shopId > 0
    ? shopId
    : null;
}

export async function getWarehouses(req: Request, res: Response) {
  const shopId = getShopId(req);

  if (!shopId) {
    return res.status(401).json({
      success: false,
      message: "Invalid shop authentication",
    });
  }

  try {
    const search = String(req.query.search ?? "").trim();

    const result = await pool.query(
      `SELECT id, warehouse_name, address, description, status, created_at
       FROM warehouses
       WHERE shop_id = $1
         AND (
           $2 = ''
           OR warehouse_name ILIKE '%' || $2 || '%'
           OR COALESCE(address, '') ILIKE '%' || $2 || '%'
         )
       ORDER BY warehouse_name ASC`,
      [shopId, search]
    );

    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Get warehouses error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load warehouses",
    });
  }
}

export async function createWarehouse(req: Request, res: Response) {
  const shopId = getShopId(req);

  if (!shopId) {
    return res.status(401).json({
      success: false,
      message: "Invalid shop authentication",
    });
  }

  const warehouseName = String(req.body.warehouse_name ?? "").trim();
  const address = String(req.body.address ?? "").trim();
  const description = String(req.body.description ?? "").trim();

  if (!warehouseName) {
    return res.status(400).json({
      success: false,
      message: "Warehouse name is required",
    });
  }

  if (warehouseName.length > 150 || address.length > 255) {
    return res.status(400).json({
      success: false,
      message: "Warehouse name or address is too long",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO warehouses
       (shop_id, warehouse_name, address, description)
       VALUES ($1, $2, $3, $4)
       RETURNING id, warehouse_name, address, description, status, created_at`,
      [
        shopId,
        warehouseName,
        address || null,
        description || null,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Warehouse created successfully",
      data: result.rows[0],
    });
  } catch (error: any) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "A warehouse with this name already exists",
      });
    }

    console.error("Create warehouse error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create warehouse",
    });
  }
}

export async function updateWarehouse(req: Request, res: Response) {
  const shopId = getShopId(req);
  const warehouseId = Number(req.params.id);

  if (!shopId) {
    return res.status(401).json({
      success: false,
      message: "Invalid shop authentication",
    });
  }

  if (!Number.isInteger(warehouseId) || warehouseId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid warehouse ID",
    });
  }

  const warehouseName = String(req.body.warehouse_name ?? "").trim();
  const address = String(req.body.address ?? "").trim();
  const description = String(req.body.description ?? "").trim();
  const status = String(req.body.status ?? "active");

  if (!warehouseName || warehouseName.length > 150 || address.length > 255) {
    return res.status(400).json({
      success: false,
      message: "A valid warehouse name and address are required",
    });
  }

  if (!["active", "inactive"].includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Status must be active or inactive",
    });
  }

  try {
    const result = await pool.query(
      `UPDATE warehouses
       SET warehouse_name = $1,
           address = $2,
           description = $3,
           status = $4
       WHERE id = $5 AND shop_id = $6
       RETURNING id, warehouse_name, address, description, status, created_at`,
      [
        warehouseName,
        address || null,
        description || null,
        status,
        warehouseId,
        shopId,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Warehouse not found",
      });
    }

    return res.json({
      success: true,
      message: "Warehouse updated successfully",
      data: result.rows[0],
    });
  } catch (error: any) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "A warehouse with this name already exists",
      });
    }

    console.error("Update warehouse error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update warehouse",
    });
  }
}

export async function deleteWarehouse(req: Request, res: Response) {
  const shopId = getShopId(req);
  const warehouseId = Number(req.params.id);

  if (!shopId) {
    return res.status(401).json({
      success: false,
      message: "Invalid shop authentication",
    });
  }

  if (!Number.isInteger(warehouseId) || warehouseId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid warehouse ID",
    });
  }

  try {
    const result = await pool.query(
      `DELETE FROM warehouses
       WHERE id = $1 AND shop_id = $2
       RETURNING id`,
      [warehouseId, shopId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Warehouse not found",
      });
    }

    return res.json({
      success: true,
      message: "Warehouse deleted successfully",
    });
  } catch (error: any) {
    if (error?.code === "23503") {
      return res.status(409).json({
        success: false,
        message: "Cannot delete this warehouse because it has linked stock records. Please set its status to inactive instead.",
      });
    }

    console.error("Delete warehouse error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not delete warehouse",
    });
  }
}
