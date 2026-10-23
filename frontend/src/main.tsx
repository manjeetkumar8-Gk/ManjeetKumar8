import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// On web domains (e.g. Vercel), unregister service workers to prevent stale cache / white screen
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  if (window.location.hostname.includes("vercel.app") || window.location.hostname === "localhost") {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.unregister().catch(() => {});
      }
    });
    if ("caches" in window) {
      caches.keys().then((keys) => {
        for (const k of keys) {
          caches.delete(k).catch(() => {});
        }
      });
    }
  } else {
    // Register Service Worker for offline capability on native/installed devices
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .catch(() => {});
    });
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
