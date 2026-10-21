
import { Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../types/auth";

function getShopId(req: AuthRequest): number | null {
  const id = Number(req.user?.shop_id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function getWarehouseId(body: any): number | null {
  const id = Number(body.warehouse_id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function validateWarehouse(
  shopId: number,
  warehouseId: number,
  client: any
): Promise<boolean> {
  const result = await client.query(
    `SELECT id FROM warehouses
     WHERE id = $1 AND shop_id = $2`,
    [warehouseId, shopId]
  );
  return result.rowCount > 0;
}

function serverError(res: Response, error: unknown) {
  console.error("STOCK DATABASE ERROR:", error);

  return res.status(500).json({
    success: false,
    message: error instanceof Error ? error.message : String(error),
  });
}

export async function getCurrentStock(req: AuthRequest, res: Response) {
  const shop = getShopId(req);
  if (!shop) {
    return res.status(401).json({ success: false, message: "Invalid shop session." });
  }

  try {
    const warehouseId = req.query.warehouse_id
      ? Number(req.query.warehouse_id)
      : null;

    const result = await pool.query(
      `WITH movements AS (
         SELECT
           shop_id,
           product_id,
           warehouse_id,
           SUM(quantity) AS total_in,
           0::numeric AS total_out
         FROM stock_in
         WHERE shop_id = $1
           AND ($2::int IS NULL OR warehouse_id = $2)
         GROUP BY shop_id, product_id, warehouse_id

         UNION ALL

         SELECT
           shop_id,
           product_id,
           warehouse_id,
           0::numeric AS total_in,
           SUM(quantity) AS total_out
         FROM stock_out
         WHERE shop_id = $1
           AND ($2::int IS NULL OR warehouse_id = $2)
         GROUP BY shop_id, product_id, warehouse_id
       ),
       balances AS (
         SELECT
           shop_id,
           product_id,
           warehouse_id,
           SUM(total_in) AS total_in,
           SUM(total_out) AS total_out,
           SUM(total_in) - SUM(total_out) AS current_stock
         FROM movements
         GROUP BY shop_id, product_id, warehouse_id
       )
       SELECT
         b.product_id,
         b.warehouse_id,
         w.warehouse_name,
         p.company_id,
         c.company_name,
         p.product_name,
         p.pack_size,
         p.size_unit,
         p.stock_unit,
         p.product_size,
         p.unit,
         p.minimum_stock,
         b.total_in,
         b.total_out,
         b.current_stock
       FROM balances b
       JOIN products p
         ON p.id = b.product_id
        AND p.shop_id = b.shop_id
       JOIN companies c
         ON c.id = p.company_id
        AND c.shop_id = p.shop_id
       JOIN warehouses w
         ON w.id = b.warehouse_id
        AND w.shop_id = b.shop_id
       WHERE b.shop_id = $1
       ORDER BY w.warehouse_name, p.product_name, p.pack_size`,
      [shop, warehouseId]
    );

    return res.json({ success: true, data: result.rows });
  } catch (error) {
    return serverError(res, error);
  }
}

export async function getStockIn(req: AuthRequest, res: Response) {
  const shop = getShopId(req);
  if (!shop) {
    return res.status(401).json({ success: false, message: "Invalid shop session." });
  }

  try {
    const result = await pool.query(
      `SELECT
         si.*,
         p.product_name,
         p.pack_size,
         p.size_unit,
         p.stock_unit,
         p.product_size,
         c.company_name,
         w.warehouse_name
       FROM stock_in si
       JOIN products p
         ON p.id = si.product_id AND p.shop_id = si.shop_id
       JOIN companies c
         ON c.id = si.company_id AND c.shop_id = si.shop_id
       JOIN warehouses w
         ON w.id = si.warehouse_id AND w.shop_id = si.shop_id
       WHERE si.shop_id = $1
       ORDER BY si.stock_date DESC, si.id DESC`,
      [shop]
    );

    return res.json({ success: true, data: result.rows });
  } catch (error) {
    return serverError(res, error);
  }
}

export async function createStockIn(req: AuthRequest, res: Response) {
  const shop = getShopId(req);
  if (!shop) {
    return res.status(401).json({ success: false, message: "Invalid shop session." });
  }

  const {
    company_id,
    product_id,
    quantity,
    stock_date,
    vehicle_number,
    vehicle_type,
    challan_number,
    driver_name,
    driver_contact,
    remarks,
    unit: requestedUnit,
  } = req.body;

  const companyId = Number(company_id);
  const productId = Number(product_id);
  const qty = Number(quantity);
  const warehouseId = getWarehouseId(req.body);

  if (
    !Number.isInteger(companyId) ||
    !Number.isInteger(productId) ||
    !Number.isFinite(qty) ||
    qty <= 0 ||
    !warehouseId ||
    !stock_date
  ) {
    return res.status(400).json({
      success: false,
      message: "Company, product, warehouse, date and valid quantity are required.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const validWarehouse = await validateWarehouse(shop, warehouseId, client);
    if (!validWarehouse) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Invalid warehouse for this shop.",
      });
    }

    const product = await client.query(
      `SELECT id, company_id, stock_unit
       FROM products
       WHERE id = $1 AND company_id = $2
         AND shop_id = $3 AND status = 'active'
       FOR UPDATE`,
      [productId, companyId, shop]
    );

    if (!product.rowCount) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Product is inactive or does not belong to this company/shop.",
      });
    }

    const unit =
  typeof requestedUnit === "string" && requestedUnit.trim()
    ? requestedUnit.trim()
    : product.rows[0].stock_unit || "Piece";

    const inserted = await client.query(
      `INSERT INTO stock_in
       (shop_id, company_id, product_id, quantity, stock_date,
        vehicle_number, vehicle_type, challan_number, driver_name,
        driver_contact, warehouse, warehouse_id, unit, remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        shop,
        companyId,
        productId,
        qty,
        stock_date,
        vehicle_number || null,
        vehicle_type || null,
        challan_number || null,
        driver_name || null,
        driver_contact || null,
        String(warehouseId),
        warehouseId,
        unit,
        remarks || null,
      ]
    );

    await client.query(
      `INSERT INTO stock_movements
       (shop_id, product_id, warehouse_id, movement_type,
        reference_id, quantity, movement_date)
       VALUES ($1,$2,$3,'IN',$4,$5,$6)`,
      [shop, productId, warehouseId, inserted.rows[0].id, qty, stock_date]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: `Stock received in ${unit} units.`,
      data: inserted.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return serverError(res, error);
  } finally {
    client.release();
  }
}

export async function getStockOut(req: AuthRequest, res: Response) {
  const shop = getShopId(req);
  if (!shop) {
    return res.status(401).json({ success: false, message: "Invalid shop session." });
  }

  try {
    const result = await pool.query(
      `SELECT
         so.*,
         p.product_name,
         p.pack_size,
         p.size_unit,
         p.stock_unit,
         p.product_size,
         c.company_name,
         cu.customer_name,
         w.warehouse_name
       FROM stock_out so
       JOIN products p
         ON p.id = so.product_id AND p.shop_id = so.shop_id
       JOIN companies c
         ON c.id = so.company_id AND c.shop_id = so.shop_id
       JOIN warehouses w
         ON w.id = so.warehouse_id AND w.shop_id = so.shop_id
       LEFT JOIN customers cu
         ON cu.id = so.customer_id AND cu.shop_id = so.shop_id
       WHERE so.shop_id = $1
       ORDER BY so.stock_date DESC, so.id DESC`,
      [shop]
    );

    return res.json({ success: true, data: result.rows });
  } catch (error) {
    return serverError(res, error);
  }
}

export async function createStockOut(req: AuthRequest, res: Response) {
  const shop = getShopId(req);
  if (!shop) {
    return res.status(401).json({ success: false, message: "Invalid shop session." });
  }

  const {
    voucher_number,
    company_id,
    product_id,
    customer_id,
    quantity,
    stock_date,
    vehicle_number,
    vehicle_type,
    driver_name,
    remarks,
  } = req.body;

  const companyId = Number(company_id);
  const productId = Number(product_id);
  const qty = Number(quantity);
  const warehouseId = getWarehouseId(req.body);
  const customerId =
    customer_id === "" || customer_id === null || customer_id === undefined
      ? null
      : Number(customer_id);

  if (
    !Number.isInteger(companyId) ||
    !Number.isInteger(productId) ||
    !Number.isFinite(qty) ||
    qty <= 0 ||
    !warehouseId ||
    !stock_date ||
    !String(voucher_number ?? "").trim()
  ) {
    return res.status(400).json({
      success: false,
      message: "Voucher number, company, product, warehouse, date and valid quantity are required.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const validWarehouse = await validateWarehouse(shop, warehouseId, client);
    if (!validWarehouse) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Invalid warehouse for this shop.",
      });
    }

    const product = await client.query(
      `SELECT id, company_id, stock_unit
       FROM products
       WHERE id = $1 AND company_id = $2
         AND shop_id = $3 AND status = 'active'
       FOR UPDATE`,
      [productId, companyId, shop]
    );

    if (!product.rowCount) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Product is inactive or does not belong to this company/shop.",
      });
    }

    if (customerId !== null) {
      if (!Number.isInteger(customerId)) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "Invalid customer.",
        });
      }

      const customer = await client.query(
        `SELECT id FROM customers WHERE id = $1 AND shop_id = $2`,
        [customerId, shop]
      );

      if (!customer.rowCount) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "Customer does not belong to this shop.",
        });
      }
    }

    // Lock the product row before checking balance so concurrent issues
    // for the same product are serialized.
    const balance = await client.query(
      `SELECT
         COALESCE((
           SELECT SUM(quantity) FROM stock_in
           WHERE shop_id = $1 AND product_id = $2 AND warehouse_id = $3
         ), 0)
         -
         COALESCE((
           SELECT SUM(quantity) FROM stock_out
           WHERE shop_id = $1 AND product_id = $2 AND warehouse_id = $3
         ), 0) AS available`,
      [shop, productId, warehouseId]
    );

    const available = Number(balance.rows[0].available || 0);

    if (qty > available) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Available: ${available} ${product.rows[0].stock_unit || "units"}.`,
      });
    }

    const inserted = await client.query(
      `INSERT INTO stock_out
       (shop_id, voucher_number, company_id, product_id, customer_id,
        quantity, stock_date, vehicle_number, vehicle_type,
        driver_name, remarks, warehouse, warehouse_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        shop,
        String(voucher_number).trim(),
        companyId,
        productId,
        customerId,
        qty,
        stock_date,
        vehicle_number || null,
        vehicle_type || null,
        driver_name || null,
        remarks || null,
        String(warehouseId),
        warehouseId,
      ]
    );

    await client.query(
      `INSERT INTO stock_movements
       (shop_id, product_id, warehouse_id, movement_type,
        reference_id, quantity, movement_date)
       VALUES ($1,$2,$3,'OUT',$4,$5,$6)`,
      [shop, productId, warehouseId, inserted.rows[0].id, qty, stock_date]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Stock issued successfully.",
      data: inserted.rows[0],
    });
  } catch (error: any) {
    await client.query("ROLLBACK");

    if (error?.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "This voucher number already exists.",
      });
    }

    return serverError(res, error);
  } finally {
    client.release();
  }
}
