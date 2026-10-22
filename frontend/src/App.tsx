
import { useEffect, useState, type FormEvent } from "react";
import ActivateAccount from "./components/ActivateAccount";
import Products from "./components/Products";
import Companies from "./components/Companies";
import StockIn from "./components/StockIn";
import StockOut from "./components/StockOut";
import CurrentStock from "./components/CurrentStock";
import Reports from "./components/Reports";
import Customer from "./components/Customer";
import Warehouses from "./components/Warehouses";
import Vehicles from "./components/Vehicles";
import SuperAdminDashboard from "./components/SuperAdminDashboard";
import SyncoraLogo from "./components/SyncoraLogo";
import SyncStatusBadge from "./components/SyncStatusBadge";
import { initSyncEngine, triggerAutoSync } from "./offline/syncEngine";
import { seedOfflineDbIfEmpty } from "./offline/seedDb";
import { offlineDb } from "./offline/db";

type Page =
  | "dashboard"
  | "companies"
  | "products"
  | "customers"
  | "warehouses"
  | "vehicles"
  | "stock-in"
  | "stock-out"
  | "current-stock"
  | "reports"
  | "settings";

type MenuItem = {
  id: Page;
  name: string;
  icon: string;
  section: string;
};

type UserInfo = {
  id?: number;
  name?: string;
  username?: string;
  email?: string;
  role_name?: string;
  shop_id?: number | null;
};

type LoginResponse = {
  token?: string;
  user?: UserInfo;
  message?: string;
};

type ApiResponse = {
  message?: string;
};

import { API } from "./config/api";

const menuItems: MenuItem[] = [
  { id: "dashboard", name: "Dashboard", icon: "⌂", section: "Overview" },
  { id: "companies", name: "Companies", icon: "▦", section: "Management" },
  { id: "products", name: "Products", icon: "▤", section: "Management" },
  { id: "customers", name: "Customers", icon: "♙", section: "Management" },
  { id: "warehouses", name: "Warehouses", icon: "⌂", section: "Management" },
  { id: "vehicles", name: "Vehicles", icon: "🚗", section: "Management" },
  { id: "stock-in", name: "Stock In", icon: "↓", section: "Inventory" },
  { id: "stock-out", name: "Stock Out", icon: "↑", section: "Inventory" },
  { id: "current-stock", name: "Current Stock", icon: "▥", section: "Inventory" },
  { id: "reports", name: "Reports", icon: "▧", section: "Workspace" },
  { id: "settings", name: "Settings", icon: "⚙", section: "Workspace" },
];

function readSavedUser(): UserInfo | null {
  try {
    const saved = localStorage.getItem("user");
    if (!saved) return null;

    const parsed: unknown = JSON.parse(saved);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    return parsed as UserInfo;
  } catch {
    return null;
  }
}

function readSavedToken(): string {
  try {
    return localStorage.getItem("token") || "";
  } catch {
    return "";
  }
}

function readSavedTheme(): boolean {
  try {
    return localStorage.getItem("theme") === "dark";
  } catch {
    return false;
  }
}

function isValidEmail(value: string): boolean {
  const email = value.trim();

  if (!email || email.length > 254) return false;

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function readApiResponse<T>(
  response: Response
): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function getApiMessage(
  data: { message?: unknown } | null,
  fallback: string
): string {
  return typeof data?.message === "string" && data.message.trim()
    ? data.message
    : fallback;
}

function saveSession(token: string, user: UserInfo): boolean {
  try {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    return true;
  } catch {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    } catch {
      // Browser storage is unavailable.
    }

    return false;
  }
}

function App() {
  useEffect(() => {
    seedOfflineDbIfEmpty();
    initSyncEngine();
    const savedToken = localStorage.getItem("token");
    if (savedToken) {
      triggerAutoSync(savedToken).catch(() => {});
    }
  }, []);
  const [page, setPage] = useState<Page>("dashboard");
  const [showForgot, setShowForgot] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const isActivationPage =
    window.location.pathname === "/activate-account";

  const [darkMode, setDarkMode] = useState(readSavedTheme);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [token, setToken] = useState<string>(readSavedToken);
  const [user, setUser] = useState<UserInfo | null>(readSavedUser);

  // Change password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem("theme", darkMode ? "dark" : "light");
    } catch {
      // Continue if browser storage is unavailable.
    }

    document.documentElement.classList.toggle("dark", darkMode);
    document.documentElement.style.colorScheme = darkMode ? "dark" : "light";
    document.documentElement.style.backgroundColor = darkMode
      ? "#0f172a"
      : "#f8fafc";
    document.documentElement.style.color = darkMode ? "#f8fafc" : "#0f172a";
  }, [darkMode]);

  const dark = darkMode;

  const appBg = dark
    ? "bg-slate-900 text-slate-100"
    : "bg-slate-50 text-slate-800";

  const panelBg = dark
    ? "border-slate-800 bg-slate-800/80 shadow-sm"
    : "border-slate-200 bg-white shadow-sm";

  const headerBg = dark
    ? "border-slate-800 bg-slate-800/80 shadow-sm"
    : "border-slate-200 bg-white shadow-sm";

  const mainText = dark ? "text-slate-100" : "text-slate-900";
  const mutedText = dark ? "text-slate-400" : "text-slate-500";
  const borderColor = dark ? "border-slate-800" : "border-slate-200";

  const inputStyle = dark
    ? "border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20"
    : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/10";

  const secondaryButton = dark
    ? "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50";

  const currentPage = menuItems.find((item) => item.id === page);

  const changePage = (nextPage: Page) => {
    setPage(nextPage);
    setMobileSidebarOpen(false);
    setError("");
    setNotice("");

    if (nextPage === "settings") {
      setPasswordError("");
      setPasswordMessage("");
    }
  };

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setError("");
    setNotice("");

    const cleanUsername = username.trim();

    if (!cleanUsername) {
      setError("Please enter your username or email.");
      return;
    }

    if (cleanUsername.length > 254) {
      setError("Username or email is too long.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          username: cleanUsername,
          password,
        }),
      });

      const data = await readApiResponse<LoginResponse>(response);

      if (!response.ok || !data?.token) {
        setError(
          getApiMessage(
            data,
            "Login failed. Please check your credentials."
          )
        );
        return;
      }

      if (typeof data.token !== "string" || !data.token.trim()) {
        setError("The server returned an invalid login session.");
        return;
      }

      const savedUser: UserInfo =
        data.user &&
        typeof data.user === "object" &&
        !Array.isArray(data.user)
          ? data.user
          : {};

      // Cache user into local offline database
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

      if (!saveSession(data.token, savedUser)) {
        setError(
          "Your browser could not save the login session. Check browser storage settings and try again."
        );
        return;
      }

      setToken(data.token);
      setUser(savedUser);
      setPassword("");
      setUsername("");
      setPage("dashboard");
      setShowForgot(false);
      setMobileSidebarOpen(false);
    } catch {
      setError(
        "Cannot connect to the server. Make sure the backend is running at localhost:5000."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    setError("");
    setNotice("");

    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setError("Please enter your registered email address.");
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API}/auth/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await readApiResponse<ApiResponse>(response);

      if (!response.ok) {
        setError(
          getApiMessage(
            data,
            "Unable to process the password reset request."
          )
        );
        return;
      }

      setNotice(
        getApiMessage(
          data,
          "If the email is registered, reset instructions will be sent."
        )
      );

      setEmail("");
    } catch {
      setError("Cannot connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Change password API handler
  const handleChangePassword = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    setPasswordMessage("");
    setPasswordError("");

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordError("Please fill in all password fields.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError(
        "Your new password must be different from your current password."
      );
      return;
    }

    if (!token) {
      setPasswordError("Your session has expired. Please log in again.");
      return;
    }

    setPasswordLoading(true);

    try {
      const response = await fetch(`${API}/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword: confirmNewPassword,
        }),
      });

      const data = await readApiResponse<ApiResponse>(response);

      if (!response.ok) {
        throw new Error(
          getApiMessage(data, "Password could not be updated.")
        );
      }

      setPasswordMessage(
        getApiMessage(data, "Password updated successfully.")
      );

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err) {
      setPasswordError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  const logout = () => {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    } catch {
      // Continue clearing the in-memory session.
    }

    setToken("");
    setUser(null);
    setUsername("");
    setPassword("");
    setEmail("");
    setShowForgot(false);
    setPage("dashboard");
    setMobileSidebarOpen(false);
    setError("");
    setNotice("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setPasswordMessage("");
    setPasswordError("");
  };

  const themeToggle = (
    <button
      type="button"
      onClick={() => setDarkMode((value) => !value)}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${secondaryButton}`}
    >
      <span aria-hidden="true">{dark ? "☀" : "☾"}</span>
      <span>{dark ? "Light mode" : "Dark mode"}</span>
    </button>
  );

  if (isActivationPage) {
    return <ActivateAccount />;
  }

  // LOGIN SCREEN
  if (!token) {
    return (
      <div
        className={`flex min-h-screen items-center justify-center px-4 py-8 transition-colors duration-200 ${
          dark ? "bg-[#171b21]" : "bg-[#f1f5f7]"
        }`}
      >
        <div
          className={`grid w-full max-w-5xl overflow-hidden rounded-2xl border shadow-xl shadow-slate-900/5 md:grid-cols-2 ${
            dark
              ? "border-slate-800 bg-slate-800/80 shadow-sm"
              : "border-[#dfe6eb] bg-white"
          }`}
        >
          <section className="relative hidden min-h-[570px] flex-col justify-between overflow-hidden bg-[#1e3444] p-10 md:flex">
            <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full border border-white/10" />
            <div className="absolute -right-10 -top-10 h-52 w-52 rounded-full border border-white/10" />
            <div className="absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-teal-500/10 blur-2xl" />

            <div className="relative z-10">
              <SyncoraLogo />

              <div className="mt-24">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-300">
                  Inventory intelligence
                </p>

                <h1 className="mt-5 max-w-sm text-4xl font-bold leading-tight tracking-tight text-white">
                  Manage your stock with confidence.
                </h1>

                <p className="mt-5 max-w-sm text-sm leading-7 text-slate-300">
                  A central workspace for products, companies, stock movements
                  and inventory reporting.
                </p>
              </div>
            </div>

            <div className="relative z-10 border-t border-white/15 pt-5">
              <p className="text-xs leading-6 text-slate-300">
                Syncora Stock Management System
              </p>
            </div>
          </section>

          <section
            className={`flex min-w-0 flex-col justify-center p-5 sm:p-9 lg:p-12 ${
              dark
                ? "bg-[#222831] text-[#e5e9ef]"
                : "bg-white text-[#273444]"
            }`}
          >
            <div className="mb-8 flex items-center justify-between gap-3">
              <div className="md:hidden">
                <SyncoraLogo />
              </div>
              <div className="hidden md:block" />
              {themeToggle}
            </div>

            <div className="mb-7">
              <p
                className={`text-xs font-bold uppercase tracking-[0.16em] ${
                  dark ? "text-teal-300" : "text-teal-700"
                }`}
              >
                Account access
              </p>

              <h2 className={`mt-3 text-3xl font-bold tracking-tight ${mainText}`}>
                {showForgot ? "Reset password" : "Welcome back"}
              </h2>

              <p className={`mt-2 text-sm leading-6 ${mutedText}`}>
                {showForgot
                  ? "Enter the email address associated with your account."
                  : "Sign in to access your inventory workspace."}
              </p>
            </div>

            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className={`mb-4 rounded-lg border px-4 py-3 text-sm leading-5 ${
                  dark
                    ? "border-red-800 bg-red-950/40 text-red-200"
                    : "border-red-300 bg-red-50 text-red-800"
                }`}
              >
                {error}
              </div>
            )}

            {notice && (
              <div
                role="status"
                aria-live="polite"
                className={`mb-4 rounded-lg border px-4 py-3 text-sm leading-5 ${
                  dark
                    ? "border-emerald-800 bg-emerald-950/40 text-emerald-200"
                    : "border-emerald-300 bg-emerald-50 text-emerald-800"
                }`}
              >
                {notice}
              </div>
            )}

            {!showForgot ? (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label
                    htmlFor="username"
                    className={`mb-2 block text-sm font-semibold ${mainText}`}
                  >
                    Username or email
                  </label>

                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    maxLength={254}
                    className={`min-h-12 w-full rounded-lg border px-3.5 py-3 text-sm outline-none transition ${inputStyle}`}
                    placeholder="Enter your username"
                    aria-invalid={Boolean(error)}
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className={`mb-2 block text-sm font-semibold ${mainText}`}
                  >
                    Password
                  </label>

                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`min-h-12 w-full rounded-lg border px-3.5 pr-11 py-3 text-sm outline-none transition ${inputStyle}`}
                      placeholder="Enter your password"
                      aria-invalid={Boolean(error)}
                      required
                      disabled={loading}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      title={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex min-h-12 w-full items-center justify-center rounded-lg bg-teal-600 hover:bg-teal-700 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#125a57] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Signing in..." : "Sign in to workspace"}
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setError("");
                    setNotice("");
                    setEmail("");
                    setShowForgot(true);
                  }}
                  className={`w-full py-2 text-sm font-semibold disabled:opacity-50 ${
                    dark
                      ? "text-teal-300 hover:text-teal-200"
                      : "text-teal-700 hover:text-teal-900"
                  }`}
                >
                  Forgot your password?
                </button>
              </form>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div>
                  <label
                    htmlFor="email"
                    className={`mb-2 block text-sm font-semibold ${mainText}`}
                  >
                    Registered email
                  </label>

                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={254}
                    className={`min-h-12 w-full rounded-lg border px-3.5 py-3 text-sm outline-none transition ${inputStyle}`}
                    placeholder="admin@shop.com"
                    aria-invalid={Boolean(error)}
                    required
                    disabled={loading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex min-h-12 w-full items-center justify-center rounded-lg bg-teal-600 hover:bg-teal-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-[#125a57] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Processing..." : "Request password reset"}
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setError("");
                    setNotice("");
                    setEmail("");
                    setShowForgot(false);
                  }}
                  className={`w-full py-2 text-sm font-semibold disabled:opacity-50 ${
                    dark
                      ? "text-teal-300 hover:text-teal-200"
                      : "text-teal-700 hover:text-teal-900"
                  }`}
                >
                  Back to sign in
                </button>
              </form>
            )}
          </section>
        </div>
      </div>
    );
  }

  // SUPER ADMIN DASHBOARD
  const normalizedRole = (user?.role_name || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (
    normalizedRole === "super admin" ||
    normalizedRole === "superadmin"
  ) {
    return (
      <SuperAdminDashboard
        token={token}
        onLogout={logout}
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode((value) => !value)}
      />
    );
  }

  const sections = ["Overview", "Management", "Inventory", "Workspace"];

  const dashboardCards = [
    {
      title: "Products",
      description: "Manage your product catalogue",
      icon: "▤",
      page: "products" as Page,
      tone: dark
        ? "bg-blue-950/50 text-blue-300"
        : "bg-[#e7effb] text-[#315d96]",
    },
    {
      title: "Companies",
      description: "Manage suppliers and companies",
      icon: "▦",
      page: "companies" as Page,
      tone: dark
        ? "bg-emerald-950/50 text-emerald-300"
        : "bg-[#e5f3ef] text-[#286d5d]",
    },
    {
      title: "Current stock",
      description: "Review inventory balances",
      icon: "▥",
      page: "current-stock" as Page,
      tone: dark
        ? "bg-amber-950/50 text-amber-300"
        : "bg-[#f6eddf] text-[#8c6125]",
    },
    {
      title: "Reports",
      description: "Review inventory reports",
      icon: "▧",
      page: "reports" as Page,
      tone: dark
        ? "bg-purple-950/50 text-purple-300"
        : "bg-[#eee8f8] text-[#6b4d94]",
    },
  ];

  const dailyActions = [
    {
      title: "Stock In",
      description: "Record received goods, quantity and vehicle details.",
      icon: "↓",
      page: "stock-in" as Page,
      tone: dark
        ? "border-emerald-800 bg-emerald-950/40 text-emerald-300"
        : "border-emerald-100 bg-emerald-50 text-emerald-800",
    },
    {
      title: "Stock Out",
      description: "Record dispatched goods and voucher details.",
      icon: "↑",
      page: "stock-out" as Page,
      tone: dark
        ? "border-amber-800 bg-amber-950/40 text-amber-300"
        : "border-amber-100 bg-amber-50 text-amber-800",
    },
    {
      title: "Customers",
      description: "Open customer records and related details.",
      icon: "♙",
      page: "customers" as Page,
      tone: dark
        ? "border-sky-800 bg-sky-950/40 text-sky-300"
        : "border-sky-100 bg-sky-50 text-sky-800",
    },
  ];

  return (
    <div className={`min-h-screen w-full transition-colors duration-200 ${appBg}`}>
      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-[#354653] bg-[#203441] text-[#e9f0f4] transition-transform duration-200 ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex min-h-[82px] items-center justify-between border-b border-white/10 px-5">
          <SyncoraLogo />

          <button
            type="button"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close sidebar"
            className="rounded-lg px-3 py-2 text-lg text-slate-200 hover:bg-white/10 lg:hidden"
          >
            ×
          </button>
        </div>

        <div className="border-b border-white/10 px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">
            Inventory workspace
          </p>

          <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.045] p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-500/15 text-lg font-bold text-teal-200">
              {(user?.name || user?.username || "U").charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                {user?.name || user?.username || "User"}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-300">
                {user?.role_name || "Account"}
              </p>
            </div>

            <span
              className="h-2 w-2 shrink-0 rounded-full bg-emerald-400"
              title="Signed in"
            />
          </div>
        </div>

        <nav
          aria-label="Main navigation"
          className="min-h-0 flex-1 overflow-y-auto px-3 py-5"
        >
          {sections.map((section) => {
            const items = menuItems.filter(
              (item) => item.section === section
            );

            return (
              <div key={section} className="mb-6">
                <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-300">
                  {section}
                </p>

                <div className="space-y-1">
                  {items.map((item) => {
                    const active = page === item.id;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => changePage(item.id)}
                        aria-current={active ? "page" : undefined}
                        className={`relative flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                          active
                            ? "bg-[#31545d] font-semibold text-white shadow-sm"
                            : "text-[#d5dfe5] hover:bg-white/[0.075] hover:text-white"
                        }`}
                      >
                        {active && (
                          <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full bg-[#5bd0b6]" />
                        )}

                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-base ${
                            active
                              ? "bg-teal-400/15 text-[#a0f0dd]"
                              : "text-slate-200"
                          }`}
                          aria-hidden="true"
                        >
                          {item.icon}
                        </span>

                        <span className="min-w-0 flex-1 truncate">
                          {item.name}
                        </span>

                        {active && (
                          <span
                            className="text-xs text-[#a0f0dd]"
                            aria-hidden="true"
                          >
                            ●
                          </span>
                        )}
                      </button>


                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-white/[0.045] px-3 py-2.5">
            <span className="text-sm text-teal-200" aria-hidden="true">
              ◈
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-100">
                Syncora Workspace
              </p>
              <p className="mt-0.5 text-[10px] text-slate-300">
                Inventory management
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-red-300/20 bg-red-400/[0.07] px-3 py-2.5 text-sm font-semibold text-red-100 transition hover:bg-red-400/[0.15]"
          >
            <span aria-hidden="true">↪</span> Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0 lg:pl-[264px]">
        <header
          className={`sticky top-0 z-30 flex min-h-[82px] flex-wrap items-center justify-between gap-3 border-b px-4 py-3 shadow-sm transition-colors sm:px-6 lg:px-8 ${headerBg}`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open navigation"
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-xl lg:hidden ${secondaryButton}`}
            >
              ☰
            </button>

            <div className="min-w-0">
              <div
                className={`flex items-center gap-2 text-xs ${
                  dark ? "text-gray-300" : "text-gray-600"
                }`}
              >
                <span>Workspace</span>
                <span aria-hidden="true">/</span>
                <span
                  className={`truncate font-semibold ${
                    dark ? "text-teal-300" : "text-teal-700"
                  }`}
                >
                  {currentPage?.name || "Dashboard"}
                </span>
              </div>

              <h1
                className={`mt-1 truncate text-xl font-bold leading-7 sm:text-2xl ${mainText}`}
              >
                {currentPage?.name || "Dashboard"}
              </h1>
            </div>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <SyncStatusBadge darkMode={dark} />
            {themeToggle}

            <div
              className={`hidden items-center gap-3 rounded-xl border px-3 py-2 sm:flex ${borderColor} ${
                dark ? "bg-[#292f38]" : "bg-[#f8fafb]"
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                  dark
                    ? "bg-teal-900/50 text-teal-200"
                    : "bg-[#dcefe9] text-[#286d5d]"
                }`}
              >
                {(user?.name || user?.username || "U").charAt(0).toUpperCase()}
              </div>

              <div className="max-w-[150px] min-w-0">
                <p className={`truncate text-sm font-semibold ${mainText}`}>
                  {user?.name || user?.username || "User"}
                </p>
                <p className={`mt-0.5 truncate text-xs ${mutedText}`}>
                  {user?.role_name || "Account"}
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="min-w-0 p-4 sm:p-6 lg:p-8">
          {page === "dashboard" && (
            <div className="mx-auto max-w-[1600px]">
              <section className="relative mb-7 overflow-hidden rounded-2xl bg-[#25444f] px-5 py-7 text-white shadow-sm sm:px-8 sm:py-9">
                <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border border-white/10" />
                <div className="pointer-events-none absolute -right-2 -top-10 h-44 w-44 rounded-full border border-white/10" />
                <div className="pointer-events-none absolute -bottom-24 right-40 h-48 w-48 rounded-full bg-teal-400/10 blur-2xl" />

                <div className="relative z-10 max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5 text-xs font-medium text-teal-100">
                    <span className="h-2 w-2 rounded-full bg-teal-300" />
                    Inventory workspace
                  </div>

                  <h2 className="mt-4 text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl">
                    Welcome back,{" "}
                    {(user?.name || user?.username || "User").split(" ")[0]}.
                  </h2>

                  <p className="mt-3 max-w-xl text-sm leading-7 text-slate-100">
                    Manage inventory, record incoming and outgoing stock, and
                    access your business records from one organized workspace.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => changePage("stock-in")}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#5bd0b6] px-4 py-2.5 text-sm font-bold text-[#173c3a] transition hover:bg-[#7bdfca]"
                    >
                      <span aria-hidden="true">↓</span> Record Stock In
                    </button>



                    <button
                      type="button"
                      onClick={() => changePage("current-stock")}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/25 bg-white/[0.07] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.13]"
                    >
                      View Inventory <span aria-hidden="true">→</span>
                    </button>


                  </div>
                </div>
              </section>

              <section className="mb-8">
                <div className="mb-4">
                  <h2 className={`text-lg font-bold ${mainText}`}>
                    Your workspace
                  </h2>
                  <p className={`mt-1 text-sm leading-6 ${mutedText}`}>
                    Open a module to manage the corresponding records.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {dashboardCards.map((card) => (
                    <button
                      key={card.title}
                      type="button"
                      onClick={() => changePage(card.page)}
                      className={`group min-w-0 rounded-xl border p-5 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${panelBg}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl font-bold ${card.tone}`}
                        >
                          {card.icon}
                        </span>
                        <span
                          className={`text-lg transition group-hover:translate-x-1 ${mutedText}`}
                          aria-hidden="true"
                        >
                          →
                        </span>
                      </div>

                      <h3 className={`mt-5 text-base font-bold ${mainText}`}>
                        {card.title}
                      </h3>
                      <p className={`mt-1 text-sm leading-6 ${mutedText}`}>
                        {card.description}
                      </p>
                    </button>


                  ))}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => changePage("warehouses")}
                    className={`flex w-full items-center gap-4 rounded-xl border p-5 text-left transition hover:shadow-md ${panelBg}`}
                  >
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${
                        dark
                          ? "bg-teal-950/50 text-teal-300"
                          : "bg-teal-50 text-teal-800"
                      }`}
                    >
                      ⌂
                    </span>
                    <span>
                      <span className={`block text-sm font-bold ${mainText}`}>
                        Warehouses
                      </span>
                      <span className={`mt-1 block text-sm ${mutedText}`}>
                        Manage warehouse locations and details.
                      </span>
                    </span>

                  </button>

                  <button
                    type="button"
                    onClick={() => changePage("vehicles")}
                    className={`flex w-full items-center gap-4 rounded-xl border p-5 text-left transition hover:shadow-md ${panelBg}`}
                  >
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl ${
                        dark
                          ? "bg-teal-950/50 text-teal-300"
                          : "bg-teal-50 text-teal-800"
                      }`}
                    >
                      🚗
                    </span>
                    <span>
                      <span className={`block text-sm font-bold ${mainText}`}>
                        Vehicles
                      </span>
                      <span className={`mt-1 block text-sm ${mutedText}`}>
                        Manage logistics vehicles, drivers, and license plates.

                      </span>
                    </span>
                  </button>


                </div>
              </section>

              <section className="mb-8">
                <div className="mb-4">
                  <h2 className={`text-lg font-bold ${mainText}`}>
                    Daily operations
                  </h2>
                  <p className={`mt-1 text-sm leading-6 ${mutedText}`}>
                    Shortcuts for your most common inventory tasks.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                  {dailyActions.map((action) => (
                    <button
                      key={action.title}
                      type="button"
                      onClick={() => changePage(action.page)}
                      className={`flex min-w-0 items-start gap-4 rounded-xl border p-5 text-left transition hover:shadow-md ${panelBg}`}
                    >
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-xl font-bold ${action.tone}`}
                      >
                        {action.icon}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm font-bold ${mainText}`}>
                          {action.title}
                        </span>
                        <span className={`mt-1 block text-sm leading-6 ${mutedText}`}>
                          {action.description}
                        </span>
                        <span
                          className={`mt-3 inline-flex items-center gap-2 text-xs font-bold ${
                            dark ? "text-teal-300" : "text-teal-700"
                          }`}
                        >
                          Open module <span aria-hidden="true">→</span>
                        </span>
                      </span>
                    </button>


                  ))}
                </div>
              </section>

              <section className={`rounded-xl border p-5 sm:p-6 ${panelBg}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className={`text-base font-bold ${mainText}`}>
                      System access
                    </h2>
                    <p className={`mt-1 text-sm leading-6 ${mutedText}`}>
                      Your account and workspace information.
                    </p>
                  </div>

                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
                      dark
                        ? "bg-emerald-900/40 text-emerald-200"
                        : "bg-emerald-50 text-emerald-800"
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Signed in
                  </span>
                </div>

                <div className={`mt-5 grid grid-cols-1 gap-4 border-t pt-5 sm:grid-cols-2 ${borderColor}`}>
                  <div>
                    <p className={`text-xs ${mutedText}`}>Account</p>
                    <p className={`mt-1 break-words text-sm font-semibold ${mainText}`}>
                      {user?.name || user?.username || "User"}
                    </p>
                  </div>

                  <div>
                    <p className={`text-xs ${mutedText}`}>Assigned role</p>
                    <p className={`mt-1 break-words text-sm font-semibold ${mainText}`}>
                      {user?.role_name || "Not specified"}
                    </p>
                  </div>
                </div>
              </section>
            </div>
          )}

          {page === "products" && <Products />}
          {page === "companies" && <Companies />}
          {page === "customers" && <Customer />}
          {page === "warehouses" && <Warehouses />}
          {page === "vehicles" && <Vehicles />}
          {page === "stock-in" && <StockIn />}
          {page === "stock-out" && <StockOut />}
          {page === "current-stock" && <CurrentStock />}
          {page === "reports" && <Reports />}

          {page === "settings" && (
            <section className={`mx-auto max-w-3xl rounded-xl border p-5 shadow-sm sm:p-8 ${panelBg}`}>
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl ${
                    dark
                      ? "bg-teal-900/40 text-teal-200"
                      : "bg-teal-50 text-teal-800"
                  }`}
                >
                  ⚙
                </div>

                <div className="min-w-0">
                  <h2 className={`text-lg font-bold ${mainText}`}>
                    Appearance settings
                  </h2>
                  <p className={`mt-1 text-sm leading-6 ${mutedText}`}>
                    Customize the interface to suit your working environment.
                  </p>
                </div>
              </div>

              <div className={`mt-6 flex flex-wrap items-center justify-between gap-4 border-t pt-5 ${borderColor}`}>
                <div>
                  <p className={`text-sm font-semibold ${mainText}`}>
                    Color theme
                  </p>
                  <p className={`mt-1 text-sm leading-6 ${mutedText}`}>
                    Choose a softer light or dark interface.
                  </p>
                </div>

                {themeToggle}
              </div>

              {/* CHANGE PASSWORD */}
              <div className={`mt-6 rounded-lg border p-4 sm:p-5 ${borderColor}`}>
                <h3 className={`text-base font-bold ${mainText}`}>
                  Change Password
                </h3>

                <p className={`mt-1 text-sm ${mutedText}`}>
                  Update your account password securely.
                </p>

                <form
                  onSubmit={handleChangePassword}
                  className="mt-5 space-y-4"
                >
                  <div>
                    <label
                      htmlFor="currentPassword"
                      className={`mb-1 block text-sm font-medium ${mainText}`}
                    >
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        id="currentPassword"
                        type={showCurrentPw ? "text" : "password"}
                        autoComplete="current-password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        disabled={passwordLoading}
                        className={`w-full rounded-lg border px-3 pr-10 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-500 ${
                          dark
                            ? "border-slate-600 bg-slate-800 text-white"
                            : "border-slate-300 bg-white text-slate-900"
                        }`}
                        placeholder="Enter current password"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowCurrentPw((prev) => !prev)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition"
                        title={showCurrentPw ? "Hide password" : "Show password"}
                      >
                        {showCurrentPw ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="newPassword"
                      className={`mb-1 block text-sm font-medium ${mainText}`}
                    >
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        id="newPassword"
                        type={showNewPw ? "text" : "password"}
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        minLength={8}
                        maxLength={128}
                        required
                        disabled={passwordLoading}
                        className={`w-full rounded-lg border px-3 pr-10 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-500 ${
                          dark
                            ? "border-slate-600 bg-slate-800 text-white"
                            : "border-slate-300 bg-white text-slate-900"
                        }`}
                        placeholder="At least 8 characters"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowNewPw((prev) => !prev)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition"
                        title={showNewPw ? "Hide password" : "Show password"}
                      >
                        {showNewPw ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="confirmNewPassword"
                      className={`mb-1 block text-sm font-medium ${mainText}`}
                    >
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        id="confirmNewPassword"
                        type={showConfirmPw ? "text" : "password"}
                        autoComplete="new-password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        minLength={8}
                        maxLength={128}
                        required
                        disabled={passwordLoading}
                        className={`w-full rounded-lg border px-3 pr-10 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-500 ${
                          dark
                            ? "border-slate-600 bg-slate-800 text-white"
                            : "border-slate-300 bg-white text-slate-900"
                        }`}
                        placeholder="Enter new password again"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowConfirmPw((prev) => !prev)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 transition"
                        title={showConfirmPw ? "Hide password" : "Show password"}
                      >
                        {showConfirmPw ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {passwordError && (
                    <p role="alert" className="text-sm text-red-500">
                      {passwordError}
                    </p>
                  )}

                  {passwordMessage && (
                    <p role="status" className="text-sm text-teal-600">
                      {passwordMessage}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {passwordLoading ? "Updating..." : "Update Password"}
                  </button>


                </form>
              </div>

              {/* ACCOUNT DETAILS */}
              <div className={`mt-6 rounded-lg border p-4 ${borderColor}`}>
                <p className={`text-sm font-semibold ${mainText}`}>Account</p>
                <p className={`mt-2 break-words text-sm leading-6 ${mutedText}`}>
                  Signed in as {user?.name || user?.username || "User"}.
                </p>
                <p className={`mt-1 text-sm leading-6 ${mutedText}`}>
                  Role: {user?.role_name || "Not specified"}.
                </p>
              </div>
            </section>
          )}
        </main>

        <footer className={`border-t px-4 py-4 sm:px-6 lg:px-8 ${borderColor}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={`text-xs ${mutedText}`}>
              Syncora Stock Management System
            </p>
            <p className={`text-xs ${mutedText}`}>Inventory workspace</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
