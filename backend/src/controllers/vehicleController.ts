
import { Response } from "express";
import { pool } from "../config/db";
import { AuthRequest } from "../types/auth";

export async function getVehicles(
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
      `SELECT id, vehicle_number, vehicle_type,
              driver_name, driver_contact, created_at, updated_at
       FROM vehicles
       WHERE shop_id = $1
       ORDER BY id DESC`,
      [req.user.shop_id]
    );

    res.status(200).json({
      success: true,
      vehicles: result.rows,
    });
  } catch (error) {
    console.error("Get vehicles error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to fetch vehicles",
    });
  }
}

export async function createVehicle(
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

    const {
      vehicle_number,
      vehicle_type,
      driver_name,
      driver_contact,
    } = req.body;

    if (
      typeof vehicle_number !== "string" ||
      !vehicle_number.trim()
    ) {
      res.status(400).json({
        success: false,
        message: "Vehicle number is required",
      });
      return;
    }

    const number = vehicle_number.trim().toUpperCase();

    const duplicate = await pool.query(
      `SELECT id FROM vehicles
       WHERE shop_id = $1 AND UPPER(vehicle_number) = $2`,
      [req.user.shop_id, number]
    );

    if (duplicate.rows.length > 0) {
      res.status(409).json({
        success: false,
        message: "This vehicle is already registered",
      });
      return;
    }

    const result = await pool.query(
      `INSERT INTO vehicles
         (shop_id, vehicle_number, vehicle_type, driver_name, driver_contact)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, vehicle_number, vehicle_type,
                 driver_name, driver_contact, created_at, updated_at`,
      [
        req.user.shop_id,
        number,
        vehicle_type?.trim() || null,
        driver_name?.trim() || null,
        driver_contact?.trim() || null,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Vehicle registered successfully",
      vehicle: result.rows[0],
    });
  } catch (error) {
    console.error("Create vehicle error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to register vehicle",
    });
  }
}

export async function updateVehicle(
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

    const vehicleId = Number(req.params.id);

    if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
      res.status(400).json({
        success: false,
        message: "Invalid vehicle ID",
      });
      return;
    }

    const {
      vehicle_number,
      vehicle_type,
      driver_name,
      driver_contact,
    } = req.body;

    if (
      typeof vehicle_number !== "string" ||
      !vehicle_number.trim()
    ) {
      res.status(400).json({
        success: false,
        message: "Vehicle number is required",
      });
      return;
    }

    const number = vehicle_number.trim().toUpperCase();

    const duplicate = await pool.query(
      `SELECT id FROM vehicles
       WHERE shop_id = $1
         AND UPPER(vehicle_number) = $2
         AND id <> $3`,
      [req.user.shop_id, number, vehicleId]
    );

    if (duplicate.rows.length > 0) {
      res.status(409).json({
        success: false,
        message: "Another vehicle already uses this number",
      });
      return;
    }

    const result = await pool.query(
      `UPDATE vehicles
       SET vehicle_number = $1,
           vehicle_type = $2,
           driver_name = $3,
           driver_contact = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND shop_id = $6
       RETURNING id, vehicle_number, vehicle_type,
                 driver_name, driver_contact, created_at, updated_at`,
      [
        number,
        vehicle_type?.trim() || null,
        driver_name?.trim() || null,
        driver_contact?.trim() || null,
        vehicleId,
        req.user.shop_id,
      ]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Vehicle updated successfully",
      vehicle: result.rows[0],
    });
  } catch (error) {
    console.error("Update vehicle error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to update vehicle",
    });
  }
}

export async function deleteVehicle(
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

    const vehicleId = Number(req.params.id);

    if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
      res.status(400).json({
        success: false,
        message: "Invalid vehicle ID",
      });
      return;
    }

    const result = await pool.query(
      `DELETE FROM vehicles
       WHERE id = $1 AND shop_id = $2
       RETURNING id`,
      [vehicleId, req.user.shop_id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Vehicle deleted successfully",
    });
  } catch (error) {
    console.error("Delete vehicle error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to delete vehicle",
    });
  }
}
