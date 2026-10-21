# 📦 Syncora Stock Management System

A multi-tenant, cloud-connected Windows Desktop Inventory & Stock Management application built with **React**, **Node.js / Express**, **PostgreSQL (Supabase)**, and **Electron**.

---

## 🔐 System Credentials & Login Details

### 1. Application User Accounts

All accounts below are pre-configured and live in your database:

| Role | Username | Password | Email | Purpose / Access Level |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | `admin` | `szabist100campus` | `admin@syncora.com` | **Full Platform Access**: Create & manage shops, subscriptions, system settings, global users, and backups. |
| **Super Admin** | `syncora` | `szabist100campus` | `syncora@syncora.com` | **Full Platform Access** (alternative primary admin account). |
| **Shop Admin** | `shopadmin` | `szabist100campus` | `shopadmin@syncora.com` | **Shop Management**: Manage products, companies, warehouses, vehicles, customers, stock movements, and reports. |
| **Stock Operator** | `operator` | `szabist100campus` | `operator@syncora.com` | **Inventory Operations**: Record Stock In shipments and Stock Out vouchers. |
| **Viewer** | `viewer` | `szabist100campus` | `viewer@syncora.com` | **Read-Only**: View stock balances, inventory levels, and reports without editing rights. |

---

## ☁️ Cloud Database Configuration (Supabase PostgreSQL)

Your application is directly connected to a high-speed managed PostgreSQL instance:

* **Provider:** [Supabase](https://supabase.com/)
* **Connection String:**
  ```text
  postgresql://postgres:szabist100campus@db.vohlumkaifarrspibkrk.supabase.co:5432/postgres
  ```
* **Host:** `db.vohlumkaifarrspibkrk.supabase.co`
* **Port:** `5432`
* **Database Name:** `postgres`
* **Database User:** `postgres`
* **Database Password:** `szabist100campus`
* **SSL:** `true` (Enabled)

---

## 🗄️ Cloud Offsite Backup Configuration (Backblaze B2)

Your application is integrated with Backblaze B2 cloud object storage (10 GB Free Storage):

* **Provider:** [Backblaze B2](https://www.backblaze.com/cloud-storage)
* **Account ID:** `c51569639703`
* **Bucket Name:** `syncora`
* **Bucket ID:** `cc8591d516c956e3a9170013`
* **Key Name:** `stock-key`
* **Key ID:** `005c515696397030000000001`
* **Application Key:** `K005qMg6lksQih/leSxNR1lTzV5Wz5A`
* **S3 Endpoint:** `s3.us-east-005.backblazeb2.com`

---

## 🚀 Client Handover & Installation Guide

### Deliverable File for Client:
The standalone Windows setup installer is located at:
```text
release\Syncora Stock Management Setup 1.0.0.exe
```

### Client Installation Steps:
1. Send `Syncora Stock Management Setup 1.0.0.exe` to the client (via USB, Google Drive, WeTransfer, etc.).
2. The client double-clicks the setup file and follows the on-screen installer prompts.
3. A desktop shortcut named **"Syncora Stock Management"** is created on their desktop.
4. The client launches the application and signs in with:
   * **Username:** `admin` (or `shopadmin`)
   * **Password:** `szabist100campus`
5. **No Technical Requirements for Client**:
   * No Node.js required.
   * No PostgreSQL installation required on client machine.
   * No VS Code or terminal commands required.
   * Multiple branch PCs can install this `.exe` and share the exact same live inventory in real time.

---

## 💾 Backup & Data Protection Features

The system includes three layers of automated backup protection:

1. **1-Click Local Snapshot:**
   * Go to **Super Admin Dashboard > Settings**.
   * Under **Database Backups & Cloud Storage**, click **"Download Backup (.json)"**.
   * Saves an immediate full JSON snapshot of all shops, stock records, products, companies, customers, and users directly to the PC.
2. **Backblaze B2 Offsite Cloud Sync:**
   * Click **"Sync Now to Backblaze"** to push a timestamped backup snapshot directly into your secure Backblaze B2 bucket.
3. **Automated Daily Backups:**
   * Handled automatically by Supabase cloud infrastructure daily.

---

## 🛠️ Developer Commands

If you need to make future changes to the code:

* **Run Backend Locally:**
  ```powershell
  npm --prefix backend run dev
  ```
* **Run Frontend Locally:**
  ```powershell
  npm --prefix frontend run dev
  ```
* **Build Final Windows Installer:**
  ```powershell
  npm run installer
  ```
  *(Packages the updated React frontend, Node backend, and live database credentials into `release/`)*

---

## 📱 Mobile App (Android APK & iOS)

The application has been converted into a cross-platform mobile suite using **Capacitor**:

### 1. Android App (.apk)
* **File Location:**
  * Project: `release\Syncora Stock Management.apk`
  * Desktop: `C:\Users\MANJEET KUMAR\OneDrive\Documents\Desktop\Syncora Stock Management.apk`
* **Size:** ~4.5 MB
* **Installation:** Send the `.apk` file to any Android phone (via WhatsApp, Google Drive, or USB) and tap "Install".
* **Rebuild Command:**
  ```powershell
  $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
  cd frontend\android
  .\gradlew.bat assembleDebug
  ```

### 2. iOS App (Xcode Project / iPhone)
* **Project Directory:** `frontend/ios/App`
* **Xcode Workspace:** `frontend/ios/App/App.xcodeproj`
* **How to run on iPhone / Mac:**
  1. Open `frontend/ios/App/App.xcodeproj` in **Xcode** on macOS.
  2. Select your connected iPhone or iOS Simulator.
  3. Click **Run** or **Archive** to export `.ipa`.

### 3. API Connection for Mobile Devices
On mobile devices, the app connects to the backend over the network:
* **Config File:** `frontend/src/config/api.ts`
* **Default:** `http://localhost:5000/api` (Desktop bundled mode)
* **Local Network (Wi-Fi):** Set `VITE_API_URL=http://<YOUR-LAPTOP-IP>:5000/api`
* **Cloud 24/7 Production:** Deploy `backend/` to Render.com or Railway.app and set `VITE_API_URL=https://<your-backend-app>.onrender.com/api`
