
import { Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../types/auth";

function shopId(req: AuthRequest): number | null {
  const id = Number(req.user?.shop_id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function sendError(res: Response, error: unknown) {
  console.error(error);
  return res.status(500).json({
    success: false,
    message: "Server error while processing product.",
  });
}

export async function getProducts(req: AuthRequest, res: Response) {
  const shop = shopId(req);
  if (!shop) {
    return res.status(401).json({ success: false, message: "Invalid shop session." });
  }

  try {
    const search = String(req.query.search ?? "").trim();

    const result = await pool.query(
      `SELECT
         p.id,
         p.company_id,
         c.company_name,
         p.product_name,
         p.product_size,
         p.pack_size,
         p.size_unit,
         p.stock_unit,
         p.product_code,
         p.unit,
         p.minimum_stock,
         p.status,
         p.created_at,
         p.updated_at
       FROM products p
       JOIN companies c
         ON c.id = p.company_id
        AND c.shop_id = p.shop_id
       WHERE p.shop_id = $1
         AND (
           $2 = ''
           OR p.product_name ILIKE '%' || $2 || '%'
           OR COALESCE(p.product_size, '') ILIKE '%' || $2 || '%'
           OR COALESCE(p.pack_size::text, '') ILIKE '%' || $2 || '%'
           OR COALESCE(p.size_unit, '') ILIKE '%' || $2 || '%'
           OR COALESCE(p.product_code, '') ILIKE '%' || $2 || '%'
           OR c.company_name ILIKE '%' || $2 || '%'
         )
       ORDER BY p.product_name, p.pack_size, p.size_unit`,
      [shop, search]
    );

    return res.json({ success: true, data: result.rows, products: result.rows });
  } catch (error) {
    return sendError(res, error);
  }
}

export async function createProduct(req: AuthRequest, res: Response) {
  const shop = shopId(req);
  if (!shop) {
    return res.status(401).json({ success: false, message: "Invalid shop session." });
  }

  const {
    company_id,
    product_name,
    pack_size,
    size_unit,
    stock_unit,
    product_code,
    minimum_stock = 0,
  } = req.body;

  const companyId = Number(company_id);
  const packSize = Number(pack_size);
  const minimumStock = Number(minimum_stock);
  const name = String(product_name ?? "").trim();
  const sizeUnit = String(size_unit ?? "").trim();
  const stockUnit = String(stock_unit ?? "").trim();
  const code = String(product_code ?? "").trim() || null;

  if (
    !Number.isInteger(companyId) ||
    companyId <= 0 ||
    !name ||
    !Number.isFinite(packSize) ||
    packSize <= 0 ||
    !sizeUnit ||
    !stockUnit ||
    !Number.isFinite(minimumStock) ||
    minimumStock < 0
  ) {
    return res.status(400).json({
      success: false,
      message: "Company, product name, valid pack size, size unit and stock unit are required.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const company = await client.query(
      `SELECT id FROM companies
       WHERE id = $1 AND shop_id = $2 AND status = 'active'`,
      [companyId, shop]
    );

    if (company.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Select an active company from your shop.",
      });
    }

    const duplicate = await client.query(
      `SELECT id
       FROM products
       WHERE shop_id = $1
         AND company_id = $2
         AND LOWER(TRIM(product_name)) = LOWER(TRIM($3))
         AND pack_size = $4
         AND LOWER(TRIM(size_unit)) = LOWER(TRIM($5))
         AND LOWER(TRIM(stock_unit)) = LOWER(TRIM($6))
         AND status <> 'inactive'
       LIMIT 1`,
      [shop, companyId, name, packSize, sizeUnit, stockUnit]
    );

    if (duplicate.rowCount) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "This exact product package already exists.",
      });
    }

    const inserted = await client.query(
      `INSERT INTO products
         (shop_id, company_id, product_name, product_size,
          pack_size, size_unit, stock_unit, product_code, unit,
          minimum_stock, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $7, $9, 'active')
       RETURNING *`,
      [
        shop,
        companyId,
        name,
        String(packSize),
        packSize,
        sizeUnit,
        stockUnit,
        code,
        minimumStock,
      ]
    );

    await client.query("COMMIT");
    return res.status(201).json({
      success: true,
      message: "Product created successfully.",
      data: inserted.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return sendError(res, error);
  } finally {
    client.release();
  }
}

export async function updateProduct(req: AuthRequest, res: Response) {
  const shop = shopId(req);
  const id = Number(req.params.id);

  if (!shop) {
    return res.status(401).json({ success: false, message: "Invalid shop session." });
  }
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, message: "Invalid product ID." });
  }

  const {
    company_id,
    product_name,
    pack_size,
    size_unit,
    stock_unit,
    product_code,
    minimum_stock = 0,
    status,
  } = req.body;

  const companyId = Number(company_id);
  const packSize = Number(pack_size);
  const minimumStock = Number(minimum_stock);
  const name = String(product_name ?? "").trim();
  const sizeUnit = String(size_unit ?? "").trim();
  const stockUnit = String(stock_unit ?? "").trim();
  const code = String(product_code ?? "").trim() || null;
  const newStatus = status === "inactive" ? "inactive" : "active";

  if (
    !Number.isInteger(companyId) ||
    companyId <= 0 ||
    !name ||
    !Number.isFinite(packSize) ||
    packSize <= 0 ||
    !sizeUnit ||
    !stockUnit ||
    !Number.isFinite(minimumStock) ||
    minimumStock < 0
  ) {
    return res.status(400).json({
      success: false,
      message: "Company, product name, valid pack size, size unit and stock unit are required.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT id FROM products WHERE id = $1 AND shop_id = $2 FOR UPDATE`,
      [id, shop]
    );

    if (!existing.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    const company = await client.query(
      `SELECT id FROM companies
       WHERE id = $1 AND shop_id = $2 AND status = 'active'`,
      [companyId, shop]
    );

    if (!company.rowCount) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Select an active company from your shop.",
      });
    }

    const duplicate = await client.query(
      `SELECT id FROM products
       WHERE shop_id = $1
         AND company_id = $2
         AND LOWER(TRIM(product_name)) = LOWER(TRIM($3))
         AND pack_size = $4
         AND LOWER(TRIM(size_unit)) = LOWER(TRIM($5))
         AND LOWER(TRIM(stock_unit)) = LOWER(TRIM($6))
         AND id <> $7
         AND status <> 'inactive'
       LIMIT 1`,
      [shop, companyId, name, packSize, sizeUnit, stockUnit, id]
    );

    if (duplicate.rowCount) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "Another product already uses this exact package.",
      });
    }

    // Package identity must not change after stock transactions exist.
    const history = await client.query(
      `SELECT
         EXISTS(SELECT 1 FROM stock_in WHERE shop_id = $1 AND product_id = $2)
         OR
         EXISTS(SELECT 1 FROM stock_out WHERE shop_id = $1 AND product_id = $2)
         AS has_history`,
      [shop, id]
    );

    const current = await client.query(
      `SELECT company_id, product_name, pack_size, size_unit, stock_unit
       FROM products WHERE id = $1 AND shop_id = $2`,
      [id, shop]
    );

    const old = current.rows[0];
    const packageChanged =
      Number(old.company_id) !== companyId ||
      old.product_name !== name ||
      Number(old.pack_size) !== packSize ||
      String(old.size_unit ?? "").toLowerCase() !== sizeUnit.toLowerCase() ||
      String(old.stock_unit ?? "").toLowerCase() !== stockUnit.toLowerCase();

    if (history.rows[0].has_history && packageChanged) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "This product has stock history. Create a new product for a different package instead.",
      });
    }

    const updated = await client.query(
      `UPDATE products
       SET company_id = $1,
           product_name = $2,
           product_size = $3,
           pack_size = $4,
           size_unit = $5,
           stock_unit = $6,
           product_code = $7,
           unit = $6,
           minimum_stock = $8,
           status = $9,
           updated_at = NOW()
       WHERE id = $10 AND shop_id = $11
       RETURNING *`,
      [
        companyId,
        name,
        String(packSize),
        packSize,
        sizeUnit,
        stockUnit,
        code,
        minimumStock,
        newStatus,
        id,
        shop,
      ]
    );

    await client.query("COMMIT");
    return res.json({
      success: true,
      message: "Product updated successfully.",
      data: updated.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return sendError(res, error);
  } finally {
    client.release();
  }
}

export async function deleteProduct(req: AuthRequest, res: Response) {
  const shop = shopId(req);
  const id = Number(req.params.id);

  if (!shop) {
    return res.status(401).json({ success: false, message: "Invalid shop session." });
  }

  try {
    const result = await pool.query(
      `UPDATE products
       SET status = 'inactive', updated_at = NOW()
       WHERE id = $1 AND shop_id = $2
       RETURNING id`,
      [id, shop]
    );

    if (!result.rowCount) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }

    return res.json({
      success: true,
      message: "Product deactivated. Existing stock history was preserved.",
    });
  } catch (error) {
    return sendError(res, error);
  }
}
