import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import ownerActivationRoutes from "./routes/ownerActivationRoutes";
import { pool } from "./config/db";

import authRoutes from "./routes/authRoutes";
import passwordResetRoutes from "./routes/passwordResetRoutes";
import companyRoutes from "./routes/companyRoutes";
import productRoutes from "./routes/productRoutes";
import customerRoutes from "./routes/customerRoutes";
import vehicleRoutes from "./routes/vehicleRoutes";
import userRoutes from "./routes/userRoutes";
import stockRoutes from "./routes/stockRoutes";
import warehouseRoutes from "./routes/warehouseRoutes";
import superAdminRoutes from "./routes/superAdminRoutes";
import backupRoutes from "./routes/backupRoutes";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors());
app.use(express.json());

// API routes
app.use("/api/auth", ownerActivationRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/auth", passwordResetRoutes);

app.use("/api/products", productRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/warehouses", warehouseRoutes);
app.use("/api/users", userRoutes);

// Super Admin routes
app.use("/api/super-admin", superAdminRoutes);
app.use("/api/backup", backupRoutes);

// Health check
app.get("/api/health", async (_req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS time");

    res.json({
      success: true,
      message: "API and PostgreSQL are connected",
      databaseTime: result.rows[0].time,
    });
  } catch (error) {
    console.error("Health check error:", error);

    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

// Serve frontend static build if present
const candidatePaths = [
  path.resolve(__dirname, "../../frontend/dist"),
  path.resolve(__dirname, "../frontend/dist"),
  path.resolve(process.cwd(), "frontend/dist"),
  path.resolve(__dirname, "../public"),
  path.resolve(__dirname, "../../backend/public"),
  path.resolve(process.cwd(), "backend/public"),
  path.resolve(process.cwd(), "public"),
];
const frontendDist = candidatePaths.find((dir) => fs.existsSync(dir));

if (frontendDist) {
  app.use(express.static(frontendDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(frontendDist, "index.html"));
  });
} else {
  // Fallback API root
  app.get("/", (_req, res) => {
    res.json({
      success: true,
      message: "Stock Management System API is running",
    });
  });
}

// Start server
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;
