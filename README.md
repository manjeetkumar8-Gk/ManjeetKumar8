# 📦 Syncora Stock Management System (Offline-First Multi-Platform Suite)

An enterprise-grade, **100% Offline-First** Stock & Inventory Management suite with **Automatic Cloud Synchronization** across **Windows Desktop, Android Mobile, iPhone (iOS), MacBook (macOS), and Web**.

---

## 🌟 Key Architecture & Capabilities

1. **100% Offline Execution (Zero Internet Required):**
   * Operates completely without internet on any device (Windows, Android, iPhone, Mac).
   * Products, Companies, Customers, Warehouses, Vehicles, and Stock Movements (Stock In / Stock Out) are stored directly on the local device via **IndexedDB (Dexie)**.
   * Instant UI response (0ms load time) with zero server lag.
   * Generates reports and ledgers completely offline.

2. **Automatic Background Cloud Synchronization:**
   * Whenever *any* device connects to Wi-Fi or mobile data, local changes are pushed to the central cloud database (Supabase PostgreSQL).
   * Fresh updates made by other branch devices are automatically pulled down.
   * Real-time visual status indicator in the top navigation bar:
     * `🟢 Synced` - Connected and all local changes synced with cloud.
     * `🔄 Syncing (X)` - Pushing offline changes to the cloud.
     * `🟡 Offline` - Device is offline; all data is safely saved locally. Click `↻` anytime to manual sync.

3. **Universal Report Generation (PDF & CSV):**
   * **Android & iPhone:** Direct native download and system share sheet integration (`@capacitor/filesystem` & `@capacitor/share`). Save directly to Downloads, open in Excel/PDF viewer, or send instantly via WhatsApp, AirDrop, Google Drive, or Print.
   * **Windows & Mac:** 1-click PDF/CSV direct export with formatted transaction ledgers.

---

## 🔐 Credentials & Login Details

All accounts below work **both Online and 100% Offline**:

| Role | Username | Password | Purpose / Access Level |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin` | `szabist100campus` | **Full Platform Access**: Shop management, subscriptions, global users, backups. |
| **Super Admin** | `syncora` | `szabist100campus` | **Full Platform Access** (alternative primary admin account). |
| **Shop Admin** | `shopadmin` | `szabist100campus` | **Full Shop Management**: Products, companies, warehouses, vehicles, stock, reports. |
| **Stock Operator** | `operator` | `szabist100campus` | **Inventory Operations**: Record Stock In shipments and Stock Out vouchers. |
| **Viewer** | `viewer` | `szabist100campus` | **Read-Only**: View stock balances and reports. |

---

## 📱 Platform Delivery & Handover Instructions

### 1. Windows PC / Desktop (.exe)
* **Deliverable File:**
  * `release\Syncora Stock Management Setup 1.0.0.exe`
  * Also copied directly to: `Desktop\Syncora Stock Management Setup 1.0.0.exe`
* **Installation:** Double-click the `.exe`, follow setup wizard, and launch from the desktop shortcut.
* **Offline:** Works 100% offline. Automatically syncs when PC connects to internet.

### 2. Android Phone (.apk)
* **Deliverable File:**
  * `release\Syncora Stock Management.apk`
  * Also copied directly to: `Desktop\Syncora Stock Management.apk`
* **Installation:** Send the `.apk` file to any Android phone via WhatsApp, USB, or Google Drive, and tap "Install".
* **Offline & Reports:** Full offline operation. Tapping "Export PDF" or "Export CSV" opens the native share sheet to save to Downloads or send via WhatsApp/Drive.

### 3. iPhone / iPad (iOS)
* **Zero-Friction 1-Click Install (PWA):**
  1. Open the live website link in **Safari** on the iPhone.
  2. Tap the **Share** button (box with an arrow pointing up).
  3. Scroll down and tap **"Add to Home Screen"**.
  4. Tap **"Add"**.
  5. The **Syncora Stock** app icon appears on the iPhone home screen.
* **Behavior:** Launches full-screen like a native App Store app without the Safari browser bar, works **100% offline** via Service Worker + IndexedDB, and auto-syncs when online.
* **Native Xcode Workspace (For App Store / TestFlight):**
  * Located at: `frontend/ios/App/App.xcodeproj`

### 4. MacBook (macOS)
* **Option A (Dock App):**
  * Open the live site in Safari on MacBook → Click **File → Add to Dock**.
  * Or on Chrome on Mac → Click **Install Syncora Stock Management**.
  * Creates a standalone Mac app in Launchpad and Dock that works 100% offline.
* **Option B (Native Mac .dmg):**
  * Run `npx electron-builder --mac dmg` on macOS to generate a `.dmg` installer.

### 5. Live Web Dashboard
* Access URL: `https://syncora-syncora8.vercel.app`
* Both frontend dashboard and `/api` backend are live and configured.

---

## 🛠️ Build Commands

* **Rebuild Frontend:**
  ```powershell
  npm --prefix frontend run build
  ```
* **Rebuild Backend:**
  ```powershell
  npm --prefix backend run build
  ```
* **Sync Mobile (Android & iOS):**
  ```powershell
  cd frontend
  npx cap sync
  ```
* **Rebuild Android APK:**
  ```powershell
  $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
  cd frontend\android
  .\gradlew.bat assembleDebug
  ```
* **Rebuild Windows Desktop Setup (.exe):**
  ```powershell
  npm run installer
  ```
