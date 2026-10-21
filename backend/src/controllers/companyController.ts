
import { Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../types/auth";

export async function getCompanies(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user?.shop_id) {
      res.status(403).json({
        success: false,
        message: "Shop access is required",
      });
      return;
    }

    const result = await pool.query(
      `
      SELECT
        id, company_name, contact_person, phone, email,
        address, status, created_at, updated_at
      FROM companies
      WHERE shop_id = $1
      ORDER BY LOWER(TRIM(company_name)), id
      `,
      [req.user.shop_id]
    );

    res.status(200).json({
      success: true,
      companies: result.rows,
    });
  } catch (error) {
    console.error("Get companies error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to fetch companies",
    });
  }
}

export async function createCompany(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const shopId = req.user?.shop_id;

    if (!shopId) {
      res.status(403).json({
        success: false,
        message: "Shop access is required",
      });
      return;
    }

    const {
      company_name,
      contact_person,
      phone,
      email,
      address,
    } = req.body;

    if (
      typeof company_name !== "string" ||
      !company_name.trim()
    ) {
      res.status(400).json({
        success: false,
        message: "Company name is required",
      });
      return;
    }

    const normalizedName = company_name.trim();

    const existing = await pool.query(
      `
      SELECT id, company_name
      FROM companies
      WHERE shop_id = $1
        AND LOWER(TRIM(company_name)) = LOWER(TRIM($2))
      LIMIT 1
      `,
      [shopId, normalizedName]
    );

    if (existing.rows.length > 0) {
      res.status(409).json({
        success: false,
        message: "Company already exists",
        company: existing.rows[0],
      });
      return;
    }

    const result = await pool.query(
      `
      INSERT INTO companies (
        shop_id,
        company_name,
        contact_person,
        phone,
        email,
        address
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id, company_name, contact_person, phone, email,
        address, status, created_at, updated_at
      `,
      [
        shopId,
        normalizedName,
        contact_person || null,
        phone || null,
        email || null,
        address || null,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Company created successfully",
      company: result.rows[0],
    });
  } catch (error: any) {
    console.error("Create company error:", error);

    if (error.code === "23505") {
      res.status(409).json({
        success: false,
        message: "Company already exists",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Unable to create company",
    });
  }
}

export async function updateCompany(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const shopId = req.user?.shop_id;

    if (!shopId) {
      res.status(403).json({
        success: false,
        message: "Shop access is required",
      });
      return;
    }

    const companyId = Number(req.params.id);

    if (!Number.isInteger(companyId) || companyId <= 0) {
      res.status(400).json({
        success: false,
        message: "Invalid company ID",
      });
      return;
    }

    const {
      company_name,
      contact_person,
      phone,
      email,
      address,
      status,
    } = req.body;

    if (
      typeof company_name !== "string" ||
      !company_name.trim()
    ) {
      res.status(400).json({
        success: false,
        message: "Company name is required",
      });
      return;
    }

    const normalizedName = company_name.trim();

    const existing = await pool.query(
      `
      SELECT id
      FROM companies
      WHERE shop_id = $1
        AND LOWER(TRIM(company_name)) = LOWER(TRIM($2))
        AND id <> $3
      LIMIT 1
      `,
      [shopId, normalizedName, companyId]
    );

    if (existing.rows.length > 0) {
      res.status(409).json({
        success: false,
        message: "Another company with this name already exists",
      });
      return;
    }

    const result = await pool.query(
      `
      UPDATE companies
      SET
        company_name = $1,
        contact_person = $2,
        phone = $3,
        email = $4,
        address = $5,
        status = COALESCE($6, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 AND shop_id = $8
      RETURNING
        id, company_name, contact_person, phone, email,
        address, status, created_at, updated_at
      `,
      [
        normalizedName,
        contact_person || null,
        phone || null,
        email || null,
        address || null,
        status || null,
        companyId,
        shopId,
      ]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: "Company not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Company updated successfully",
      company: result.rows[0],
    });
  } catch (error: any) {
    console.error("Update company error:", error);

    if (error.code === "23505") {
      res.status(409).json({
        success: false,
        message: "Another company with this name already exists",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Unable to update company",
    });
  }
}

export async function deleteCompany(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const shopId = req.user?.shop_id;

    if (!shopId) {
      res.status(403).json({
        success: false,
        message: "Shop access is required",
      });
      return;
    }

    const companyId = Number(req.params.id);

    if (!Number.isInteger(companyId) || companyId <= 0) {
      res.status(400).json({
        success: false,
        message: "Invalid company ID",
      });
      return;
    }

    const result = await pool.query(
      `
      UPDATE companies
      SET status = 'inactive',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND shop_id = $2
      RETURNING id
      `,
      [companyId, shopId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: "Company not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Company deactivated successfully",
    });
  } catch (error) {
    console.error("Delete company error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to deactivate company",
    });
  }
}
