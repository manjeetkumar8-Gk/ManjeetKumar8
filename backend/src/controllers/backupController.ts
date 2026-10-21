import { Response } from "express";
import { AuthRequest } from "../types/auth";
import {
  generateDatabaseBackup,
  uploadToBackblazeB2,
} from "../services/backupService";

export async function getBackupStatus(req: AuthRequest, res: Response) {
  try {
    const isSuperAdmin =
      req.user?.role_name?.toLowerCase().includes("super") ||
      req.user?.role_id === 1;

    const b2Configured = Boolean(
      (process.env.B2_KEY_ID || process.env.B2_APPLICATION_KEY_ID) &&
        process.env.B2_APPLICATION_KEY &&
        process.env.B2_BUCKET_ID
    );

    return res.json({
      success: true,
      data: {
        b2_configured: b2Configured,
        bucket_name: process.env.B2_BUCKET_NAME || "Not set",
        can_backup_all: isSuperAdmin,
        shop_id: req.user?.shop_id ?? null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve backup status",
    });
  }
}

export async function downloadBackup(req: AuthRequest, res: Response) {
  try {
    const isSuperAdmin =
      req.user?.role_name?.toLowerCase().includes("super") ||
      req.user?.role_id === 1;

    // Super Admin gets everything; Shop Admin gets their shop data
    const shopId = isSuperAdmin ? undefined : req.user?.shop_id ? Number(req.user.shop_id) : undefined;

    const backup = await generateDatabaseBackup(shopId);
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `stock-backup-${shopId ? `shop-${shopId}` : "full"}-${dateStr}.json`;

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    return res.json(backup);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to generate backup",
    });
  }
}

export async function syncToBackblaze(req: AuthRequest, res: Response) {
  try {
    const isSuperAdmin =
      req.user?.role_name?.toLowerCase().includes("super") ||
      req.user?.role_id === 1;

    const shopId = isSuperAdmin ? undefined : req.user?.shop_id ? Number(req.user.shop_id) : undefined;
    const backup = await generateDatabaseBackup(shopId);

    const dateStr = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `backup-${shopId ? `shop-${shopId}` : "full"}-${dateStr}.json`;
    const jsonContent = JSON.stringify(backup, null, 2);

    const result = await uploadToBackblazeB2(fileName, jsonContent);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json({
      success: true,
      message: result.message,
      fileId: result.fileId,
      fileName: result.fileName,
      record_counts: backup.record_counts,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Backblaze B2 sync failed",
    });
  }
}
