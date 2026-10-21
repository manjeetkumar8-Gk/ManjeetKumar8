import crypto from "crypto";
import { pool } from "../config/db";

export type BackupData = {
  version: string;
  exported_at: string;
  shop_id: number | "all";
  record_counts: Record<string, number>;
  tables: Record<string, any[]>;
};

export async function generateDatabaseBackup(shopId?: number): Promise<BackupData> {
  const tablesToExport = [
    "shops",
    "roles",
    "users",
    "companies",
    "products",
    "warehouses",
    "vehicles",
    "customers",
    "stock_records",
    "system_settings",
  ];

  const backupTables: Record<string, any[]> = {};
  const recordCounts: Record<string, number> = {};

  for (const tableName of tablesToExport) {
    try {
      let query = `SELECT * FROM ${tableName}`;
      const params: any[] = [];

      // Filter by shop_id if specified and table has shop_id column
      if (shopId && tableName !== "roles" && tableName !== "system_settings") {
        if (tableName === "shops") {
          query += " WHERE id = $1";
          params.push(shopId);
        } else {
          query += " WHERE shop_id = $1";
          params.push(shopId);
        }
      }

      const result = await pool.query(query, params);
      
      // Sanitize sensitive fields in user table
      if (tableName === "users") {
        backupTables[tableName] = result.rows.map((row: any) => {
          const { password, ...safeRow } = row;
          return safeRow;
        });
      } else {
        backupTables[tableName] = result.rows;
      }

      recordCounts[tableName] = result.rowCount || 0;
    } catch (err) {
      // Table might not exist or error occurred; keep table empty
      backupTables[tableName] = [];
      recordCounts[tableName] = 0;
    }
  }

  return {
    version: "1.0.0",
    exported_at: new Date().toISOString(),
    shop_id: shopId || "all",
    record_counts: recordCounts,
    tables: backupTables,
  };
}

export async function uploadToBackblazeB2(
  fileName: string,
  content: string
): Promise<{ success: boolean; message: string; fileId?: string; fileName?: string }> {
  const keyId = process.env.B2_KEY_ID || process.env.B2_APPLICATION_KEY_ID;
  const appKey = process.env.B2_APPLICATION_KEY;
  const bucketId = process.env.B2_BUCKET_ID;

  if (!keyId || !appKey || !bucketId) {
    return {
      success: false,
      message:
        "Backblaze B2 credentials (B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_ID) are not configured in backend/.env",
    };
  }

  try {
    // 1. Authorize Account
    const authCredentials = Buffer.from(`${keyId}:${appKey}`).toString("base64");
    const authRes = await fetch(
      "https://api.backblazeb2.com/b2api/v2/b2_authorize_account",
      {
        headers: {
          Authorization: `Basic ${authCredentials}`,
        },
      }
    );

    if (!authRes.ok) {
      const errJson = await authRes.json().catch(() => ({}));
      throw new Error(errJson.message || `B2 Authorization failed (${authRes.status})`);
    }

    const authData = (await authRes.json()) as {
      authorizationToken: string;
      apiUrl: string;
    };

    // 2. Get Upload URL
    const uploadUrlRes = await fetch(
      `${authData.apiUrl}/b2api/v2/b2_get_upload_url`,
      {
        method: "POST",
        headers: {
          Authorization: authData.authorizationToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bucketId }),
      }
    );

    if (!uploadUrlRes.ok) {
      const errJson = await uploadUrlRes.json().catch(() => ({}));
      throw new Error(errJson.message || `Failed to get B2 upload URL (${uploadUrlRes.status})`);
    }

    const uploadUrlData = (await uploadUrlRes.json()) as {
      uploadUrl: string;
      authorizationToken: string;
    };

    // 3. Upload File
    const contentBuffer = Buffer.from(content, "utf-8");
    const sha1 = crypto.createHash("sha1").update(contentBuffer).digest("hex");

    const uploadRes = await fetch(uploadUrlData.uploadUrl, {
      method: "POST",
      headers: {
        Authorization: uploadUrlData.authorizationToken,
        "X-Bz-File-Name": encodeURIComponent(fileName),
        "Content-Type": "application/json",
        "Content-Length": String(contentBuffer.length),
        "X-Bz-Content-Sha1": sha1,
      },
      body: contentBuffer,
    });

    if (!uploadRes.ok) {
      const errJson = await uploadRes.json().catch(() => ({}));
      throw new Error(errJson.message || `B2 File upload failed (${uploadRes.status})`);
    }

    const uploadResult = (await uploadRes.json()) as {
      fileId: string;
      fileName: string;
    };

    return {
      success: true,
      message: `Backup successfully uploaded to Backblaze B2 as ${uploadResult.fileName}`,
      fileId: uploadResult.fileId,
      fileName: uploadResult.fileName,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown Backblaze B2 upload error",
    };
  }
}
