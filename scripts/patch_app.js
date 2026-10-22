const fs = require('fs');
const path = require('path');

const filePath = path.resolve('frontend/src/App.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add imports
const importTarget = 'import SyncoraLogo from "./components/SyncoraLogo";';
const importAddition = `import SyncoraLogo from "./components/SyncoraLogo";
import SyncStatusBadge from "./components/SyncStatusBadge";
import { initSyncEngine, triggerAutoSync } from "./offline/syncEngine";
import { seedOfflineDbIfEmpty } from "./offline/seedDb";
import { offlineDb } from "./offline/db";`;

if (code.includes(importTarget)) {
  code = code.replace(importTarget, importAddition);
}

// 2. Add startup effect inside App component
const appStart = 'function App() {';
const effectAddition = `function App() {
  useEffect(() => {
    seedOfflineDbIfEmpty();
    initSyncEngine();
    const savedToken = localStorage.getItem("token");
    if (savedToken) {
      triggerAutoSync(savedToken).catch(() => {});
    }
  }, []);`;

if (code.includes(appStart)) {
  code = code.replace(appStart, effectAddition);
}

// 3. Patch login cache & offline login
const loginSuccessTarget = `if (!saveSession(data.token, savedUser)) {`;
const loginSuccessAddition = `// Cache user into local offline database
      offlineDb.users.put({
        id: savedUser.id || 1,
        shop_id: savedUser.shop_id || 1,
        username: cleanUsername,
        name: savedUser.name || cleanUsername,
        email: savedUser.email || "",
        role_name: savedUser.role_name || "Shop Admin",
        token: data.token,
      }).catch(() => {});
      triggerAutoSync(data.token).catch(() => {});

      if (!saveSession(data.token, savedUser)) {`;

if (code.includes(loginSuccessTarget)) {
  code = code.replace(loginSuccessTarget, loginSuccessAddition);
}

// 4. Patch login catch block
const catchTarget = `    } catch {
      setError(
        "Cannot connect to the server. Make sure the backend is running at localhost:5000."
      );
    }`;

const catchAddition = `    } catch (networkErr) {
      // Offline fallback: check local offline database
      try {
        const offlineUser = await offlineDb.users
          .where("username")
          .equalsIgnoreCase(cleanUsername)
          .first();

        if (offlineUser) {
          const userObj: UserInfo = {
            id: offlineUser.id,
            username: offlineUser.username,
            name: offlineUser.name || offlineUser.username,
            email: offlineUser.email,
            role_name: offlineUser.role_name,
            shop_id: offlineUser.shop_id,
          };
          const localToken = offlineUser.token || "offline-session-token";
          saveSession(localToken, userObj);
          setToken(localToken);
          setUser(userObj);
          setPassword("");
          setUsername("");
          setPage("dashboard");
          setShowForgot(false);
          setMobileSidebarOpen(false);
          setNotice("Logged in in Offline Mode. All actions will be saved to this device.");
          return;
        }
      } catch (offlineErr) {
        console.warn("Offline login check failed:", offlineErr);
      }

      setError(
        "Unable to connect to the server, and no cached offline session was found. Please check your network or try default accounts (admin / szabist100campus)."
      );
    }`;

if (code.includes(catchTarget)) {
  code = code.replace(catchTarget, catchAddition);
}

// 5. Add SyncStatusBadge to header
const headerTarget = `<div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">\n            {themeToggle}`;
const headerTargetCRLF = `<div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">\r\n            {themeToggle}`;
const headerAddition = `<div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">\n            <SyncStatusBadge darkMode={dark} />\n            {themeToggle}`;

if (code.includes(headerTargetCRLF)) {
  code = code.replace(headerTargetCRLF, `<div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">\r\n            <SyncStatusBadge darkMode={dark} />\r\n            {themeToggle}`);
} else if (code.includes(headerTarget)) {
  code = code.replace(headerTarget, headerAddition);
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully patched App.tsx');
