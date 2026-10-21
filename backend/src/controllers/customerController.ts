import { Request, Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../types/auth";

export async function getCustomers(req: AuthRequest, res: Response) {
  try {
    const shopId = req.user?.shop_id;

    if (!shopId) {
      return res.status(403).json({
        success: false,
        message: "Shop access denied",
      });
    }

    const search = String(req.query.search || "").trim();

    const result = await pool.query(
      `
      SELECT
        id,
        customer_name,
        cnic,
        phone,
        address,
        remarks,
        created_at,
        updated_at
      FROM customers
      WHERE shop_id = $1
        AND (
          customer_name ILIKE $2
          OR cnic ILIKE $2
          OR phone ILIKE $2
        )
      ORDER BY id DESC
      `,
      [shopId, `%${search}%`]
    );

    return res.json({
      success: true,
      customers: result.rows,
    });
  } catch (error) {
    console.error("Get customers error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
    });
  }
}

export async function createCustomer(req: AuthRequest, res: Response) {
  try {
    const shopId = req.user?.shop_id;

    if (!shopId) {
      return res.status(403).json({
        success: false,
        message: "Shop access denied",
      });
    }

    const {
      customer_name,
      cnic,
      phone,
      address,
      remarks,
    } = req.body;

    if (!customer_name || !String(customer_name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Customer name is required",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO customers (
        shop_id,
        customer_name,
        cnic,
        phone,
        address,
        remarks
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        customer_name,
        cnic,
        phone,
        address,
        remarks,
        created_at,
        updated_at
      `,
      [
        shopId,
        String(customer_name).trim(),
        cnic || null,
        phone || null,
        address || null,
        remarks || null,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Customer created successfully",
      customer: result.rows[0],
    });
  } catch (error) {
    console.error("Create customer error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create customer",
    });
  }
}

export async function updateCustomer(req: AuthRequest, res: Response) {
  try {
    const shopId = req.user?.shop_id;
    const customerId = Number(req.params.id);

    if (!shopId) {
      return res.status(403).json({
        success: false,
        message: "Shop access denied",
      });
    }

    if (!Number.isInteger(customerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    const {
      customer_name,
      cnic,
      phone,
      address,
      remarks,
    } = req.body;

    if (!customer_name || !String(customer_name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Customer name is required",
      });
    }

    const result = await pool.query(
      `
      UPDATE customers
      SET
        customer_name = $1,
        cnic = $2,
        phone = $3,
        address = $4,
        remarks = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
        AND shop_id = $7
      RETURNING
        id,
        customer_name,
        cnic,
        phone,
        address,
        remarks,
        created_at,
        updated_at
      `,
      [
        String(customer_name).trim(),
        cnic || null,
        phone || null,
        address || null,
        remarks || null,
        customerId,
        shopId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    return res.json({
      success: true,
      message: "Customer updated successfully",
      customer: result.rows[0],
    });
  } catch (error) {
    console.error("Update customer error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update customer",
    });
  }
}

export async function deleteCustomer(req: AuthRequest, res: Response) {
  try {
    const shopId = req.user?.shop_id;
    const customerId = Number(req.params.id);

    if (!shopId) {
      return res.status(403).json({
        success: false,
        message: "Shop access denied",
      });
    }

    if (!Number.isInteger(customerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid customer ID",
      });
    }

    const result = await pool.query(
      `
      DELETE FROM customers
      WHERE id = $1
        AND shop_id = $2
      RETURNING id
      `,
      [customerId, shopId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    return res.json({
      success: true,
      message: "Customer deleted successfully",
    });
  } catch (error: any) {
    if (error?.code === "23503") {
      return res.status(409).json({
        success: false,
        message: "Cannot delete this customer because they have existing stock vouchers. Customer record must be preserved for audit history.",
      });
    }

    console.error("Delete customer error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete customer",
    });
  }
}
