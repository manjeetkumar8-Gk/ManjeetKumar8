function resolveApiUrl(): string {
  if (typeof window !== "undefined") {
    // If running in packaged Electron desktop
    if (window.location.protocol === "file:") {
      return "http://localhost:5000/api";
    }

    // If running in browser on production domain
    if (
      window.location.hostname &&
      !window.location.hostname.includes("localhost") &&
      !window.location.hostname.includes("127.0.0.1") &&
      !window.location.hostname.endsWith(".local")
    ) {
      // If deployed on Vercel or custom domain, use relative /api
      return `${window.location.origin}/api`;
    }
  }

  return import.meta.env.VITE_API_URL || "https://syncora-syncora8.vercel.app/api";
}

export const API = resolveApiUrl();
export default API;
