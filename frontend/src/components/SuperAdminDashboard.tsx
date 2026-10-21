
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { API } from "../config/api";

type Stats = {
  totalShops: number;
  activeShops: number;
  inactiveShops: number;
  totalUsers: number;
};

type Shop = {
  id: number;
  shop_name: string;
  shop_code: string;
  address?: string;
  email?: string;
  phone?: string;
  status: string;
  subscription_start?: string;
  subscription_end?: string;
  owner_name?: string;
  owner_username?: string;
  owner_email?: string;
};
type Subscription = {
  id: number;
  shop_name: string;
  shop_code: string;
  shop_status: string;
  subscription_start: string | null;
  subscription_end: string | null;
  subscription_status: "active" | "expired" | "not_started" | "not_set" | string;
};

type PlatformSettings = {
  platform_name: string;
  support_email: string;
  support_phone: string;
  currency: string;
  timezone: string;
  default_subscription_days: string;
  maintenance_mode: boolean;
  allow_new_shops: boolean;
};

const defaultPlatformSettings: PlatformSettings = {
  platform_name: "Syncora Technologies",
  support_email: "",
  support_phone: "",
  currency: "PKR",
  timezone: "Asia/Karachi",
  default_subscription_days: "365",
  maintenance_mode: false,
  allow_new_shops: true,
};

type User = {
  id: number;
  name: string;
  username: string;
  email: string | null;
  role_id: number;
  role_name: string;
  shop_id: number | null;
  status: string;
  created_at?: string;
};

type UserForm = {
  name: string;
  username: string;
  email: string;
  password: string;
  role: string;
  shop_id: string;
};

type EditUserForm = {
  name: string;
  username: string;
  email: string;
  role: string;
  status: string;
  newPassword: string;
};

type ShopForm = {
  owner_password: string;
  shop_name: string;
  shop_code: string;
  address: string;
  phone: string;
  email: string;
  owner_name: string;
  owner_username: string;
  owner_email: string;
  subscription_start: string;
  subscription_end: string;
};

type Props = {
  token: string;
  onLogout: () => void;
  darkMode: boolean;
  onToggleTheme: () => void;
};

const emptyStats: Stats = {
  totalShops: 0,
  activeShops: 0,
  inactiveShops: 0,
  totalUsers: 0,
};

const emptyUserForm: UserForm = {
  name: "",
  username: "",
  email: "",
  password: "",
  role: "Shop Admin",
  shop_id: "",
};

const emptyEditUserForm: EditUserForm = {
  name: "",
  username: "",
  email: "",
  role: "Shop Admin",
  status: "active",
  newPassword: "",
};

const emptyShopForm: ShopForm = {
  owner_password: "",
  shop_name: "",
  shop_code: "",
  address: "",
  phone: "",
  email: "",
  owner_name: "",
  owner_username: "",
  owner_email: "",
  subscription_start: "",
  subscription_end: "",
};

// Validation helpers

function validateEmail(value: string): boolean {
  if (!value.trim()) return true;

  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

function validateUsername(value: string): boolean {
  return /^[a-zA-Z0-9._-]{3,30}$/.test(value.trim());
}

function validatePassword(value: string): boolean {
  return value.length >= 8;
}

function normalizePhone(value: string): string {
  return value.replace(/[\s()-]/g, "");
}

function validatePakistaniPhone(value: string): boolean {
  if (!value.trim()) return true;

  const phone = normalizePhone(value);

  return /^(?:03\d{9}|\+923\d{9})$/.test(phone);
}

function validateSubscriptionDates(
  start: string,
  end: string
): boolean {
  if (!start || !end) return true;

  return end >= start;
}

function SyncoraLogo() {
  return (
    <div className="text-xl font-bold tracking-tight text-white">
      Syncora<span className="text-teal-400">.</span>
    </div>
  );
}

export default function SuperAdminDashboard({
  token,
  onLogout,
  darkMode,
  onToggleTheme,
}: Props) {
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [shops, setShops] = useState<Shop[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [settings, setSettings] = useState<PlatformSettings>(defaultPlatformSettings);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [savingEditUser, setSavingEditUser] = useState(false);
  const [savingResetPassword, setSavingResetPassword] = useState(false);
  const [savingShop, setSavingShop] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activePage, setActivePage] = useState("Dashboard");
  const [search, setSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");

  const [showUserForm, setShowUserForm] = useState(false);
  const [userForm, setUserForm] = useState<UserForm>(emptyUserForm);

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserForm, setEditUserForm] =
    useState<EditUserForm>(emptyEditUserForm);
  const [showEditPassword, setShowEditPassword] = useState(false);

  const [resettingUser, setResettingUser] = useState<User | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);

  const [showShopForm, setShowShopForm] = useState(false);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [shopForm, setShopForm] = useState<ShopForm>(emptyShopForm);

  const [backupLoading, setBackupLoading] = useState(false);
  const [b2Loading, setB2Loading] = useState(false);
  const [b2Status, setB2Status] = useState<{ b2_configured: boolean; bucket_name: string } | null>(null);

  const dark = darkMode;
  const pageBg = dark
    ? "bg-slate-900 text-slate-100"
    : "bg-slate-50 text-slate-800";
  const panel = dark
    ? "border-slate-800 bg-slate-800/80 shadow-sm"
    : "border-slate-200 bg-white shadow-sm";
  const mainText = dark ? "text-slate-100" : "text-slate-900";
  const mutedText = dark ? "text-slate-400" : "text-slate-500";
  const borderColor = dark ? "border-slate-800" : "border-slate-200";
  const inputStyle = dark
    ? "border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500"
    : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400";

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const loadSubscriptions = useCallback(async () => {
    if (!token) return;

    setSubscriptionsLoading(true);
    setError("");

    try {
      const response = await fetch(`${API}/super-admin/subscriptions`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to load subscriptions.");
      }

      setSubscriptions(data.subscriptions || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error loading subscriptions."
      );
    } finally {
      setSubscriptionsLoading(false);
    }
  }, [token]);

  const loadSettings = useCallback(async () => {
    if (!token) return;

    setSettingsLoading(true);
    setError("");

    try {
      const response = await fetch(`${API}/super-admin/settings`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();

      if (!response.ok || result.success === false) {
        throw new Error(
          result.message ||
            "Failed to load settings. Please verify backend settings API."
        );
      }

      const saved = result.settings ?? result.data ?? result;
      setSettings({
        platform_name: String(saved.platform_name ?? defaultPlatformSettings.platform_name),
        support_email: String(saved.support_email ?? ""),
        support_phone: String(saved.support_phone ?? ""),
        currency: String(saved.currency ?? "PKR"),
        timezone: String(saved.timezone ?? "Asia/Karachi"),
        default_subscription_days: String(saved.default_subscription_days ?? "365"),
        maintenance_mode: Boolean(saved.maintenance_mode ?? false),
        allow_new_shops: Boolean(saved.allow_new_shops ?? true),
      });

      fetch(`${API}/backup/status`, { headers })
        .then((r) => r.json())
        .then((d) => {
          if (d.success) setB2Status(d.data);
        })
        .catch(() => {});
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Connection error while loading settings."
      );
    } finally {
      setSettingsLoading(false);
    }
  }, [token]);

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");

    const days = Number(settings.default_subscription_days);
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      setError("Default subscription days 1 se 3650 ke darmiyan whole number hon.");
      return;
    }
    if (!validateEmail(settings.support_email)) {
      setError("Invalid support email format.");
      return;
    }
    if (!validatePakistaniPhone(settings.support_phone)) {
      setError("Enter support phone in format 03001234567 or +923001234567.");
      return;
    }

    setSettingsSaving(true);
    try {
      const payload = {
        ...settings,
        default_subscription_days: days,
        support_email: settings.support_email.trim(),
        support_phone: normalizePhone(settings.support_phone),
      };
      const response = await fetch(`${API}/super-admin/settings`, {
        method: "PUT",
        headers,
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok || result.success === false) {
        throw new Error(
          result.message ||
            "Failed to save settings. Please verify backend settings endpoint."
        );
      }

      const saved = result.settings ?? result.data;
      if (saved && typeof saved === "object") {
        setSettings((old) => ({
          ...old,
          ...saved,
          default_subscription_days: String(
            saved.default_subscription_days ?? old.default_subscription_days
          ),
        }));
      }
      setNotice(result.message || "Platform settings saved successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Connection error while saving settings."
      );
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      setBackupLoading(true);
      setError("");
      const res = await fetch(`${API}/backup/download`, { headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to download backup");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `stock-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNotice("Database backup downloaded successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backup download failed.");
    } finally {
      setBackupLoading(false);
    }
  };

  const handleSyncBackblaze = async () => {
    try {
      setB2Loading(true);
      setError("");
      const res = await fetch(`${API}/backup/b2-sync`, {
        method: "POST",
        headers,
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || "Backblaze B2 backup failed");
      }
      setNotice(result.message || "Backup successfully synced to Backblaze B2.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backblaze B2 sync failed.");
    } finally {
      setB2Loading(false);
    }
  };

  const loadDashboard = useCallback(async () => {
    if (!token) {
      setError("Authentication token missing. Please log in again.");
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [statsResponse, shopsResponse] = await Promise.all([
        fetch(`${API}/super-admin/dashboard`, { headers }),
        fetch(`${API}/super-admin/shops`, { headers }),
      ]);

      const statsData = await statsResponse.json();
      const shopsData = await shopsResponse.json();

      if (!statsResponse.ok) {
        throw new Error(statsData.message || "Failed to load dashboard data.");
      }

      if (!shopsResponse.ok) {
        throw new Error(shopsData.message || "Failed to load shops.");
      }

      const raw = statsData.stats ?? statsData.data ?? statsData;
      const shopRows = Array.isArray(shopsData)
        ? shopsData
        : shopsData.shops ?? shopsData.data ?? [];

      const totalShops = Number(raw.totalShops ?? raw.total_shops ?? 0);
      const activeShops = Number(raw.activeShops ?? raw.active_shops ?? 0);

      setStats({
        totalShops,
        activeShops,
        inactiveShops: Number(
          raw.inactiveShops ??
            raw.inactive_shops ??
            Math.max(0, totalShops - activeShops)
        ),
        totalUsers: Number(raw.totalUsers ?? raw.total_users ?? 0),
      });

      setShops(Array.isArray(shopRows) ? shopRows : []);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Backend connection error."
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadUsers = useCallback(async () => {
    if (!token) return;

    setUsersLoading(true);

    try {
      const response = await fetch(`${API}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to load users.");
      }

      const rows = Array.isArray(result)
        ? result
        : result.data ?? result.users ?? [];

      setUsers(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users.");
    } finally {
      setUsersLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (activePage === "Users") void loadUsers();
  }, [activePage, loadUsers]);

  useEffect(() => {
    if (activePage === "Settings") void loadSettings();
  }, [activePage, loadSettings]);

  const filteredShops = shops.filter((shop) => {
    const q = search.toLowerCase().trim();

    return (
      shop.shop_name?.toLowerCase().includes(q) ||
      shop.shop_code?.toLowerCase().includes(q) ||
      shop.email?.toLowerCase().includes(q) ||
      shop.owner_email?.toLowerCase().includes(q) ||
      shop.phone?.toLowerCase().includes(q)
    );
  });

  const filteredUsers = users.filter((user) => {
    const q = userSearch.toLowerCase().trim();

    return (
      user.name?.toLowerCase().includes(q) ||
      user.username?.toLowerCase().includes(q) ||
      user.email?.toLowerCase().includes(q) ||
      user.role_name?.toLowerCase().includes(q) ||
      String(user.shop_id ?? "").includes(q)
    );
  });

  // Create user

  const saveUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");

    const name = userForm.name.trim();
    const username = userForm.username.trim();
    const email = userForm.email.trim();

    if (!name || !username) {
      setError("Full name and username are required.");
      return;
    }

    if (!validateUsername(username)) {
      setError(
        "Username must be 3-30 characters (letters, numbers, dot, underscore, and hyphen allowed)."
      );
      return;
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!validatePassword(userForm.password)) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    let shopId: number | null = null;

    if (userForm.role !== "Super Admin") {
      if (!userForm.shop_id.trim()) {
        setError("Shop ID is required for this role.");
        return;
      }

      shopId = Number(userForm.shop_id);

      if (!Number.isInteger(shopId) || shopId <= 0) {
        setError("Shop ID must be a positive whole number.");
        return;
      }

      if (!shops.some((shop) => shop.id === shopId)) {
        setError("The specified Shop ID does not exist.");
        return;
      }
    }

    setSavingUser(true);

    try {
      const response = await fetch(`${API}/users`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name,
          username,
          email: email || null,
          password: userForm.password,
          role: userForm.role,
          shop_id: shopId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to create user.");
      }

      setNotice(result.message || "User created successfully.");
      setUserForm(emptyUserForm);
      setShowUserForm(false);

      await loadUsers();
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user.");
    } finally {
      setSavingUser(false);
    }
  };

  // Edit user

  const editUser = (user: User) => {
    setEditingUser(user);

    setEditUserForm({
      name: user.name || "",
      username: user.username || "",
      email: user.email || "",
      role: user.role_name || "Shop Admin",
      status: user.status || "active",
      newPassword: "",
    });

    setShowEditPassword(false);
    setError("");
    setNotice("");
  };

  const closeEditUser = () => {
    if (savingEditUser) return;

    setEditingUser(null);
    setEditUserForm(emptyEditUserForm);
    setShowEditPassword(false);
  };

  const saveEditedUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingUser) return;

    setError("");
    setNotice("");

    const name = editUserForm.name.trim();
    const username = editUserForm.username.trim();
    const email = editUserForm.email.trim();

    if (!name || !username) {
      setError("Full name and username are required.");
      return;
    }

    if (!validateUsername(username)) {
      setError(
        "Username must be 3-30 characters (letters, numbers, dot, underscore, and hyphen allowed)."
      );
      return;
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (
      editUserForm.newPassword &&
      !validatePassword(editUserForm.newPassword)
    ) {
      setError("New password must be at least 8 characters long.");
      return;
    }

    setSavingEditUser(true);

    try {
      const response = await fetch(`${API}/users/${editingUser.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          name,
          username,
          email: email || null,
          role: editUserForm.role,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to update user details.");
      }

      if (
        editUserForm.status.toLowerCase() !==
        editingUser.status.toLowerCase()
      ) {
        const statusResponse = await fetch(
          `${API}/users/${editingUser.id}/status`,
          {
            method: "PATCH",
            headers,
            body: JSON.stringify({
              is_active: editUserForm.status.toLowerCase() === "active",
            }),
          }
        );

        const statusResult = await statusResponse.json();

        if (!statusResponse.ok) {
          throw new Error(
            statusResult.message || "Failed to update user status."
          );
        }
      }

      if (editUserForm.newPassword) {
        const passwordResponse = await fetch(
          `${API}/users/${editingUser.id}/password`,
          {
            method: "PATCH",
            headers,
            body: JSON.stringify({
              password: editUserForm.newPassword,
            }),
          }
        );

        const passwordResult = await passwordResponse.json();

        if (!passwordResponse.ok) {
          throw new Error(
            passwordResult.message || "Failed to update password."
          );
        }
      }

      setNotice("User details updated successfully.");

      // Saving flag true hone ke dauran close function return kar deta,
      // directly clear modal state on success
      setEditingUser(null);
      setEditUserForm(emptyEditUserForm);
      setShowEditPassword(false);

      await loadUsers();
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user.");
    } finally {
      setSavingEditUser(false);
    }
  };

  const changeUserStatus = async (user: User) => {
    const active = user.status?.toLowerCase() === "active";

    if (
      !window.confirm(
        `Are you sure you want to ${active ? "deactivate" : "activate"} ${user.name}'s account?`
      )
    ) {
      return;
    }

    setError("");
    setNotice("");

    try {
      const response = await fetch(`${API}/users/${user.id}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ is_active: !active }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to update status.");
      }

      setNotice(result.message || "User status updated successfully.");

      await loadUsers();
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status.");
    }
  };

  // Reset user password

  const resetUserPassword = (user: User) => {
    setResettingUser(user);
    setResetPassword("");
    setShowResetPassword(false);
    setError("");
    setNotice("");
  };

  const closeResetPassword = () => {
    if (savingResetPassword) return;

    setResettingUser(null);
    setResetPassword("");
    setShowResetPassword(false);
  };

  const saveResetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resettingUser) return;

    if (!validatePassword(resetPassword)) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setError("");
    setNotice("");
    setSavingResetPassword(true);

    try {
      const response = await fetch(
        `${API}/users/${resettingUser.id}/password`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({ password: resetPassword }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to update password.");
      }

      setNotice(result.message || "Password updated successfully.");

      // Do not call closeResetPassword while saving is in progress
      setResettingUser(null);
      setResetPassword("");
      setShowResetPassword(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password.");
    } finally {
      setSavingResetPassword(false);
    }
  };

  // Shops

  const openAddShop = () => {
    setEditingShop(null);
    setShopForm(emptyShopForm);
    setError("");
    setNotice("");
    setShowShopForm(true);
  };

  const openEditShop = (shop: Shop) => {
    setEditingShop(shop);

    setShopForm({
      ...emptyShopForm,
      shop_name: shop.shop_name || "",
      shop_code: shop.shop_code || "",
      address: shop.address || "",
      phone: shop.phone || "",
      email: shop.email || "",
      subscription_start: shop.subscription_start?.slice(0, 10) || "",
      subscription_end: shop.subscription_end?.slice(0, 10) || "",
    });

    setError("");
    setNotice("");
    setShowShopForm(true);
  };

  const closeShopForm = () => {
    if (savingShop) return;

    setShowShopForm(false);
    setEditingShop(null);
    setShopForm(emptyShopForm);
  };

  const saveShop = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");

    const shopName = shopForm.shop_name.trim();
    const shopCode = shopForm.shop_code.trim();
    const phone = shopForm.phone.trim();
    const email = shopForm.email.trim();
    const ownerName = shopForm.owner_name.trim();
    const ownerUsername = shopForm.owner_username.trim();
    const ownerEmail = shopForm.owner_email.trim();

    // Required shop fields
    if (!shopName || !shopCode) {
      setError("Shop Name and Shop Code are required.");
      return;
    }

    if (shopName.length < 2) {
      setError("Shop Name must be at least 2 characters long.");
      return;
    }

    if (shopCode.length < 2) {
      setError("Shop Code must be at least 2 characters long.");
      return;
    }

    // Optional Pakistani phone number
    if (!validatePakistaniPhone(phone)) {
      setError(
        "Please enter a valid phone number: 03001234567 or +923001234567."
      );
      return;
    }

    // Optional email fields
    if (!validateEmail(email)) {
      setError("Please enter a valid shop email address.");
      return;
    }

    // Subscription dates
    if (
      !validateSubscriptionDates(
        shopForm.subscription_start,
        shopForm.subscription_end
      )
    ) {
      setError("Subscription end date cannot be earlier than start date.");
      return;
    }

    // Owner validation only when creating a new shop
    if (!editingShop) {
      if (!ownerName || !ownerUsername) {
        setError("Owner Name and Owner Username are required.");
        return;
      }

      if (!validateUsername(ownerUsername)) {
        setError(
          "Owner Username must be 3-30 characters (letters, numbers, dot, underscore, and hyphen allowed)."
        );
        return;
      }

      if (!validateEmail(ownerEmail)) {
        setError("Please enter a valid owner email address.");
        return;
      }

      if (!validatePassword(shopForm.owner_password)) {
        setError("Owner password must be at least 8 characters long.");
        return;
      }
    } else if (
      shopForm.owner_password &&
      !validatePassword(shopForm.owner_password)
    ) {
      setError("New owner password must be at least 8 characters long.");
      return;
    }

    setSavingShop(true);

    try {
      const isEditing = Boolean(editingShop);

      const payload = isEditing
        ? {
            shop_name: shopName,
            shop_code: shopCode,
            address: shopForm.address.trim(),
            phone: normalizePhone(phone),
            email,
            subscription_start: shopForm.subscription_start || null,
            subscription_end: shopForm.subscription_end || null,
            ...(shopForm.owner_password
              ? { owner_password: shopForm.owner_password }
              : {}),
          }
        : {
            shop_name: shopName,
            shop_code: shopCode,
            address: shopForm.address.trim(),
            phone: normalizePhone(phone),
            email,
            owner_name: ownerName,
            owner_username: ownerUsername,
            owner_email: ownerEmail,
            owner_password: shopForm.owner_password,
            subscription_start: shopForm.subscription_start || null,
            subscription_end: shopForm.subscription_end || null,
          };

      const response = await fetch(
        isEditing
          ? `${API}/super-admin/shops/${editingShop!.id}`
          : `${API}/super-admin/shops`,
        {
          method: isEditing ? "PUT" : "POST",
          headers,
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to save shop.");
      }

      setNotice(result.message || "Shop saved successfully.");

      // Saving flag true hone par closeShopForm() return kar deta.
      setShowShopForm(false);
      setEditingShop(null);
      setShopForm(emptyShopForm);

      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save shop.");
    } finally {
      setSavingShop(false);
    }
  };

  const updateShopStatus = async (shop: Shop) => {
    const active = shop.status?.toLowerCase() === "active";

    if (
      !window.confirm(
        `Are you sure you want to ${active ? "deactivate" : "activate"} "${shop.shop_name}"?`
      )
    ) {
      return;
    }

    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `${API}/super-admin/shops/${shop.id}/status`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            status: active ? "inactive" : "active",
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to update shop status.");
      }

      setNotice(result.message || "Shop status updated successfully.");
      await loadDashboard();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update shop status."
      );
    }
  };

  const deleteShop = async (shop: Shop) => {
    if (
      !window.confirm(
        `Are you sure you want to permanently delete "${shop.shop_name}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    setError("");
    setNotice("");

    try {
      const response = await fetch(`${API}/super-admin/shops/${shop.id}`, {
        method: "DELETE",
        headers,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to delete shop.");
      }

      setNotice(result.message || "Shop deleted successfully.");
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete shop.");
    }
  };

  const menu = [
    { name: "Dashboard", icon: "⌂" },
    { name: "Shops", icon: "▦" },
    { name: "Subscriptions", icon: "◷" },
    { name: "Users", icon: "♙" },
    { name: "Settings", icon: "⚙" },
  ];

  return (
    <div className={`min-h-screen md:flex ${pageBg}`}>
      <aside className="w-full shrink-0 bg-[#203441] p-4 text-white md:min-h-screen md:w-64">
        <div className="mb-7 border-b border-white/10 pb-5">
          <SyncoraLogo />
        </div>

        <div className="mb-5 rounded-xl border border-white/10 p-3">
          <p className="text-xs text-slate-300">ADMINISTRATION</p>
          <p className="mt-2 font-semibold">Super Admin</p>
          <p className="text-xs text-slate-300">Platform management</p>
        </div>

        <nav className="flex gap-2 overflow-x-auto md:flex-col">
          {menu.map((item) => (
            <button
              key={item.name}
              type="button"
              onClick={() => {
                setActivePage(item.name);
                if (item.name === "Subscriptions") void loadSubscriptions();
                if (item.name === "Settings") void loadSettings();
              }}
              className={`shrink-0 rounded-lg px-3 py-3 text-left text-sm ${
                activePage === item.name
                  ? "bg-[#31545d] font-bold text-white"
                  : "text-slate-200 hover:bg-white/10"
              }`}
            >
              {item.icon} {item.name}
            </button>
          ))}
        </nav>

        <div className="mt-6 space-y-2 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={onToggleTheme}
            className="w-full rounded-lg border border-white/20 px-3 py-3 text-left text-sm"
          >
            {dark ? "☀ Light mode" : "☾ Dark mode"}
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="w-full rounded-lg bg-red-500/15 px-3 py-3 text-left text-sm text-red-100"
          >
            ↪ Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <header
          className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-5 ${panel}`}
        >
          <div>
            <p className={`text-xs ${mutedText}`}>
              Syncora Technologies / Administration
            </p>
            <h1 className={`mt-2 text-2xl font-bold ${mainText}`}>
              {activePage}
            </h1>
            <p className={`mt-1 text-sm ${mutedText}`}>
              Manage shops, users and platform accounts.
            </p>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() => void loadDashboard()}
            className="rounded-lg bg-teal-600 hover:bg-teal-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "↻ Refresh data"}
          </button>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800"
          >
            <div className="flex justify-between gap-3">
              <p>{error}</p>
              <button type="button" onClick={() => setError("")}>
                ✕
              </button>
            </div>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mb-4 rounded-lg border border-teal-300 bg-teal-50 p-4 text-sm text-teal-800"
          >
            <div className="flex justify-between gap-3">
              <p>{notice}</p>
              <button type="button" onClick={() => setNotice("")}>
                ✕
              </button>
            </div>
          </div>
        )}

        {activePage === "Dashboard" && (
          <>
            <section className="mb-6 rounded-2xl bg-[#25444f] p-6 text-white">
              <p className="text-sm text-teal-100">Inventory workspace</p>
              <h2 className="mt-3 text-2xl font-bold">
                Welcome to Syncora Administration.
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-100">
                Manage registered shops, user accounts and platform activity.
              </p>
            </section>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Total Shops", value: stats.totalShops },
                { label: "Active Shops", value: stats.activeShops },
                { label: "Inactive Shops", value: stats.inactiveShops },
                { label: "Total Users", value: stats.totalUsers },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`rounded-xl border p-5 ${panel}`}
                >
                  <p className={`text-sm ${mutedText}`}>{item.label}</p>
                  <p className={`mt-4 text-3xl font-bold ${mainText}`}>
                    {loading ? "—" : item.value}
                  </p>
                </div>
              ))}
            </div>

            <section className={`mt-6 rounded-xl border p-5 ${panel}`}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className={`font-bold ${mainText}`}>Recent Shops</h2>
                <button
                  type="button"
                  onClick={() => setActivePage("Shops")}
                  className="rounded-lg bg-teal-600 hover:bg-teal-700 px-4 py-2 text-sm font-bold text-white"
                >
                  Manage Shops
                </button>
              </div>

              {shops.length === 0 ? (
                <p className={`py-5 text-sm ${mutedText}`}>
                  No shop records found.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px] text-left text-sm">
                    <thead>
                      <tr className={`border-b ${borderColor}`}>
                        <th className="p-3">Shop</th>
                        <th className="p-3">Code</th>
                        <th className="p-3">Owner</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shops.slice(0, 5).map((shop) => (
                        <tr
                          key={shop.id}
                          className={`border-b ${borderColor}`}
                        >
                          <td className="p-3">{shop.shop_name}</td>
                          <td className="p-3">{shop.shop_code}</td>
                          <td className="p-3">
                            {shop.owner_name || shop.owner_email || "—"}
                          </td>
                          <td className="p-3">
                            <StatusBadge status={shop.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        {activePage === "Shops" && (
          <section className={`rounded-xl border p-5 ${panel}`}>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className={`text-lg font-bold ${mainText}`}>
                  Shop Management
                </h2>
                <p className={`text-sm ${mutedText}`}>
                  Create, edit and manage shops.
                </p>
              </div>

              <button
                type="button"
                onClick={openAddShop}
                className="rounded-lg bg-teal-600 hover:bg-teal-700 px-4 py-2.5 text-sm font-bold text-white"
              >
                + Add Shop
              </button>
            </div>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search shop, code, email or phone..."
              className={`mb-5 w-full rounded-lg border px-3 py-2.5 sm:max-w-md ${inputStyle}`}
            />

            {loading ? (
              <p className={`py-6 ${mutedText}`}>Loading shops...</p>
            ) : filteredShops.length === 0 ? (
              <p className={`py-6 ${mutedText}`}>
                No matching shops found.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead>
                    <tr className={`border-b ${borderColor}`}>
                      {[
                        "Shop Name",
                        "Code",
                        "Email",
                        "Phone",
                        "Status",
                        "Actions",
                      ].map((heading) => (
                        <th key={heading} className="p-3">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredShops.map((shop) => (
                      <tr
                        key={shop.id}
                        className={`border-b ${borderColor}`}
                      >
                        <td className="p-3 font-semibold">
                          {shop.shop_name}
                        </td>
                        <td className="p-3">{shop.shop_code}</td>
                        <td className="p-3">
                          {shop.owner_email || shop.email || "—"}
                        </td>
                        <td className="p-3">{shop.phone || "—"}</td>
                        <td className="p-3">
                          <StatusBadge status={shop.status} />
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => openEditShop(shop)}
                              className="rounded border px-3 py-2"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void updateShopStatus(shop)}
                              className="rounded bg-amber-100 px-3 py-2 text-amber-800"
                            >
                              {shop.status?.toLowerCase() === "active"
                                ? "Deactivate"
                                : "Activate"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteShop(shop)}
                              className="rounded bg-red-600 px-3 py-2 text-white"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activePage === "Users" && (
          <section className={`rounded-xl border p-5 ${panel}`}>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className={`text-lg font-bold ${mainText}`}>
                  User Management
                </h2>
                <p className={`text-sm ${mutedText}`}>
                  Manage users, roles, shop access and passwords.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={usersLoading}
                  onClick={() => void loadUsers()}
                  className={`rounded-lg border px-4 py-2 ${borderColor}`}
                >
                  {usersLoading ? "Loading..." : "↻ Refresh"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowUserForm((old) => !old);
                    setUserForm(emptyUserForm);
                    setError("");
                    setNotice("");
                  }}
                  className="rounded-lg bg-teal-600 hover:bg-teal-700 px-4 py-2 text-white"
                >
                  {showUserForm ? "Cancel" : "+ Add User"}
                </button>
              </div>
            </div>

            {showUserForm && (
              <form
                onSubmit={saveUser}
                className={`mb-6 rounded-xl border p-4 ${borderColor}`}
              >
                <h3 className={`mb-4 font-bold ${mainText}`}>
                  Create New User
                </h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    label="Full Name *"
                    value={userForm.name}
                    required
                    inputStyle={inputStyle}
                    onChange={(value) =>
                      setUserForm((old) => ({ ...old, name: value }))
                    }
                  />

                  <FormField
                    label="Username *"
                    value={userForm.username}
                    required
                    inputStyle={inputStyle}
                    onChange={(value) =>
                      setUserForm((old) => ({ ...old, username: value }))
                    }
                  />

                  <FormField
                    label="Email"
                    type="email"
                    value={userForm.email}
                    inputStyle={inputStyle}
                    onChange={(value) =>
                      setUserForm((old) => ({ ...old, email: value }))
                    }
                  />

                  <FormField
                    label="Password * (minimum 8 characters)"
                    type="password"
                    value={userForm.password}
                    required
                    inputStyle={inputStyle}
                    onChange={(value) =>
                      setUserForm((old) => ({ ...old, password: value }))
                    }
                  />

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium">
                      Role *
                    </span>
                    <select
                      value={userForm.role}
                      onChange={(event) =>
                        setUserForm((old) => ({
                          ...old,
                          role: event.target.value,
                        }))
                      }
                      className={`w-full rounded-lg border px-3 py-2.5 ${inputStyle}`}
                    >
                      <option>Shop Admin</option>
                      <option>Stock Operator</option>
                      <option>Viewer</option>
                      <option>Super Admin</option>
                    </select>
                  </label>

                  <FormField
                    label="Shop ID"
                    value={userForm.shop_id}
                    inputStyle={inputStyle}
                    onChange={(value) =>
                      setUserForm((old) => ({ ...old, shop_id: value }))
                    }
                  />
                </div>

                <p className={`mt-3 text-xs ${mutedText}`}>
                  Shop ID is required for all roles except Super Admin.
                </p>

                <button
                  type="submit"
                  disabled={savingUser}
                  className="mt-4 rounded-lg bg-teal-600 hover:bg-teal-700 px-5 py-2.5 font-bold text-white disabled:opacity-50"
                >
                  {savingUser ? "Creating..." : "Create User"}
                </button>
              </form>
            )}

            <input
              value={userSearch}
              onChange={(event) => setUserSearch(event.target.value)}
              placeholder="Search name, username, email, role or Shop ID..."
              className={`mb-4 w-full rounded-lg border px-3 py-2.5 sm:max-w-lg ${inputStyle}`}
            />

            <p className={`mb-4 text-sm ${mutedText}`}>
              {users.length} user account(s)
            </p>

            {usersLoading ? (
              <p className={`py-6 ${mutedText}`}>Loading users...</p>
            ) : filteredUsers.length === 0 ? (
              <p className={`py-6 ${mutedText}`}>
                No matching users found.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] text-left text-sm">
                  <thead>
                    <tr className={`border-b ${borderColor}`}>
                      {[
                        "Name",
                        "Username",
                        "Email",
                        "Role",
                        "Shop ID",
                        "Status",
                        "Actions",
                      ].map((heading) => (
                        <th key={heading} className="p-3">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr
                        key={user.id}
                        className={`border-b ${borderColor}`}
                      >
                        <td className="p-3 font-semibold">{user.name}</td>
                        <td className="p-3">{user.username}</td>
                        <td className="p-3">{user.email || "—"}</td>
                        <td className="p-3">{user.role_name}</td>
                        <td className="p-3">{user.shop_id ?? "—"}</td>
                        <td className="p-3">
                          <StatusBadge status={user.status} />
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => editUser(user)}
                              className="rounded border px-3 py-2"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => void changeUserStatus(user)}
                              className="rounded bg-amber-100 px-3 py-2 text-amber-800"
                            >
                              {user.status?.toLowerCase() === "active"
                                ? "Deactivate"
                                : "Activate"}
                            </button>

                            <button
                              type="button"
                              onClick={() => resetUserPassword(user)}
                              className="rounded bg-amber-100 px-3 py-2 text-amber-900"
                            >
                              Reset Password
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activePage === "Subscriptions" && (
          <section className={`rounded-xl border p-5 ${panel}`}>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className={`text-lg font-bold ${mainText}`}>
                  Subscription Management
                </h2>
                <p className={`text-sm ${mutedText}`}>
                  Har shop ki subscription dates aur status dekho.
                </p>
              </div>

              <button
                type="button"
                disabled={subscriptionsLoading}
                onClick={() => void loadSubscriptions()}
                className="rounded-lg bg-teal-600 hover:bg-teal-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {subscriptionsLoading ? "Loading..." : "↻ Refresh"}
              </button>
            </div>

            <p className={`mb-4 text-sm ${mutedText}`}>
              {subscriptions.length} subscription record(s)
            </p>

            {subscriptionsLoading ? (
              <p className={`py-6 ${mutedText}`}>
                Loading subscriptions...
              </p>
            ) : subscriptions.length === 0 ? (
              <p className={`py-6 ${mutedText}`}>
                No subscription records found.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[750px] text-left text-sm">
                  <thead>
                    <tr className={`border-b ${borderColor}`}>
                      {[
                        "Shop Name",
                        "Shop Code",
                        "Shop Status",
                        "Start Date",
                        "End Date",
                        "Subscription Status",
                      ].map((heading) => (
                        <th key={heading} className="p-3">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {subscriptions.map((subscription) => (
                      <tr
                        key={subscription.id}
                        className={`border-b ${borderColor}`}
                      >
                        <td className="p-3 font-semibold">
                          {subscription.shop_name}
                        </td>

                        <td className="p-3">
                          {subscription.shop_code}
                        </td>

                        <td className="p-3">
                          <StatusBadge status={subscription.shop_status} />
                        </td>

                        <td className="p-3">
                          {subscription.subscription_start
                            ? subscription.subscription_start.slice(0, 10)
                            : "Not set"}
                        </td>

                        <td className="p-3">
                          {subscription.subscription_end
                            ? subscription.subscription_end.slice(0, 10)
                            : "Not set"}
                        </td>

                        <td className="p-3">
                          <StatusBadge
                            status={subscription.subscription_status.replace(
                              "_",
                              " "
                            )}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {activePage === "Settings" && (
          <section className={`rounded-xl border p-5 sm:p-6 ${panel}`}>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className={`text-xl font-bold ${mainText}`}>Platform Settings</h2>
                <p className={`mt-1 text-sm ${mutedText}`}>
                  Manage basic platform information and system defaults.
                </p>
              </div>
              <button
                type="button"
                disabled={settingsLoading}
                onClick={() => void loadSettings()}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50 ${borderColor}`}
              >
                {settingsLoading ? "Loading..." : "↻ Reload settings"}
              </button>
            </div>

            {settingsLoading ? (
              <p className={`py-5 text-sm ${mutedText}`}>Loading platform settings...</p>
            ) : (
              <form onSubmit={saveSettings} className="space-y-6">
                <div>
                  <h3 className={`mb-3 font-bold ${mainText}`}>Platform information</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      label="Platform Name *"
                      value={settings.platform_name}
                      required
                      inputStyle={inputStyle}
                      onChange={(value) => setSettings((old) => ({ ...old, platform_name: value }))}
                    />
                    <FormField
                      label="Support Email"
                      type="email"
                      value={settings.support_email}
                      inputStyle={inputStyle}
                      onChange={(value) => setSettings((old) => ({ ...old, support_email: value }))}
                    />
                    <FormField
                      label="Support Phone"
                      type="tel"
                      value={settings.support_phone}
                      inputStyle={inputStyle}
                      onChange={(value) => setSettings((old) => ({ ...old, support_phone: value }))}
                    />
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium">Default Currency</span>
                      <select
                        value={settings.currency}
                        onChange={(event) => setSettings((old) => ({ ...old, currency: event.target.value }))}
                        className={`w-full rounded-lg border px-3 py-2.5 text-sm ${inputStyle}`}
                      >
                        <option value="PKR">PKR — Pakistani Rupee</option>
                        <option value="USD">USD — US Dollar</option>
                        <option value="AED">AED — UAE Dirham</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium">Timezone</span>
                      <select
                        value={settings.timezone}
                        onChange={(event) => setSettings((old) => ({ ...old, timezone: event.target.value }))}
                        className={`w-full rounded-lg border px-3 py-2.5 text-sm ${inputStyle}`}
                      >
                        <option value="Asia/Karachi">Asia/Karachi (Pakistan)</option>
                        <option value="UTC">UTC</option>
                        <option value="Asia/Dubai">Asia/Dubai (UAE)</option>
                      </select>
                    </label>
                    <FormField
                      label="Default Subscription Duration (days) *"
                      type="number"
                      value={settings.default_subscription_days}
                      required
                      inputStyle={inputStyle}
                      onChange={(value) => setSettings((old) => ({ ...old, default_subscription_days: value }))}
                    />
                  </div>
                </div>

                <div className={`border-t pt-5 ${borderColor}`}>
                  <h3 className={`mb-3 font-bold ${mainText}`}>Platform controls</h3>
                  <div className="space-y-3">
                    <label className={`flex items-start gap-3 rounded-lg border p-4 ${borderColor}`}>
                      <input
                        type="checkbox"
                        checked={settings.allow_new_shops}
                        onChange={(event) => setSettings((old) => ({ ...old, allow_new_shops: event.target.checked }))}
                        className="mt-1"
                      />
                      <span>
                        <span className={`block text-sm font-semibold ${mainText}`}>Allow new shops</span>
                        <span className={`mt-1 block text-xs ${mutedText}`}>Super Admin can create new shop accounts on the platform.</span>
                      </span>
                    </label>
                    <label className={`flex items-start gap-3 rounded-lg border p-4 ${borderColor}`}>
                      <input
                        type="checkbox"
                        checked={settings.maintenance_mode}
                        onChange={(event) => setSettings((old) => ({ ...old, maintenance_mode: event.target.checked }))}
                        className="mt-1"
                      />
                      <span>
                        <span className={`block text-sm font-semibold ${mainText}`}>Maintenance mode</span>
                        <span className={`mt-1 block text-xs ${mutedText}`}>This setting blocks platform access when enforced by the backend.</span>
                      </span>
                    </label>
                  </div>
                </div>

                <div className={`border-t pt-5 ${borderColor}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className={`font-bold ${mainText}`}>Database Backups & Cloud Storage</h3>
                      <p className={`mt-1 text-xs ${mutedText}`}>
                        Download complete local snapshots or sync backups to Backblaze B2 cloud storage.
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                      b2Status?.b2_configured
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
                        : "bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900"
                    }`}>
                      <span className={`h-2 w-2 rounded-full ${b2Status?.b2_configured ? "bg-emerald-500" : "bg-amber-500"}`} />
                      {b2Status?.b2_configured ? "Backblaze B2 Ready" : "Backblaze B2 Not Configured"}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className={`rounded-xl border p-4 ${borderColor}`}>
                      <h4 className={`text-sm font-semibold ${mainText}`}>1-Click Local Snapshot</h4>
                      <p className={`mt-1 text-xs ${mutedText}`}>
                        Download a complete JSON database snapshot of all shops, stock records, companies, products, and customers.
                      </p>
                      <button
                        type="button"
                        disabled={backupLoading}
                        onClick={() => void handleDownloadBackup()}
                        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-teal-600 hover:bg-teal-700 px-4 py-2 text-xs font-semibold text-white shadow-sm transition disabled:opacity-50"
                      >
                        {backupLoading ? "Generating..." : "Download Backup (.json)"}
                      </button>
                    </div>

                    <div className={`rounded-xl border p-4 ${borderColor}`}>
                      <h4 className={`text-sm font-semibold ${mainText}`}>Backblaze B2 Offsite Sync</h4>
                      <p className={`mt-1 text-xs ${mutedText}`}>
                        {b2Status?.b2_configured
                          ? `Syncs directly to your Backblaze B2 bucket (${b2Status.bucket_name || "B2"}).`
                          : "Configure B2_KEY_ID, B2_APPLICATION_KEY, and B2_BUCKET_ID in backend/.env to enable automated offsite backup."}
                      </p>
                      <button
                        type="button"
                        disabled={b2Loading || !b2Status?.b2_configured}
                        onClick={() => void handleSyncBackblaze()}
                        className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-sm transition disabled:opacity-50"
                      >
                        {b2Loading ? "Syncing..." : "Sync Now to Backblaze"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-3 border-t pt-5">
                  <button
                    type="button"
                    disabled={settingsLoading || settingsSaving}
                    onClick={() => void loadSettings()}
                    className={`rounded-lg border px-5 py-2.5 text-sm font-semibold disabled:opacity-50 ${borderColor}`}
                  >
                    Discard changes
                  </button>
                  <button
                    type="submit"
                    disabled={settingsSaving || settingsLoading}
                    className="rounded-lg bg-teal-600 hover:bg-teal-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {settingsSaving ? "Saving..." : "Save Settings"}
                  </button>
                </div>
              </form>
            )}
          </section>
        )}

        <footer className={`mt-8 border-t pt-4 ${borderColor}`}>
          <p className={`text-xs ${mutedText}`}>
            Syncora Stock Management System · © {new Date().getFullYear()}
          </p>
        </footer>
      </main>

      {/* Add/Edit Shop modal */}

      {showShopForm && (
        <Modal
          onClose={closeShopForm}
          title={editingShop ? "Edit Shop" : "Add New Shop"}
          panel={panel}
        >
          <form onSubmit={saveShop} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Shop Name *"
                value={shopForm.shop_name}
                required
                inputStyle={inputStyle}
                onChange={(value) =>
                  setShopForm((old) => ({ ...old, shop_name: value }))
                }
              />

              <FormField
                label="Shop Code *"
                value={shopForm.shop_code}
                required
                inputStyle={inputStyle}
                onChange={(value) =>
                  setShopForm((old) => ({ ...old, shop_code: value }))
                }
              />

              <FormField
                label="Shop Email"
                type="email"
                value={shopForm.email}
                inputStyle={inputStyle}
                onChange={(value) =>
                  setShopForm((old) => ({ ...old, email: value }))
                }
              />

              <FormField
                label="Phone (03001234567 or +923001234567)"
                type="tel"
                value={shopForm.phone}
                inputStyle={inputStyle}
                onChange={(value) =>
                  setShopForm((old) => ({ ...old, phone: value }))
                }
              />

              <div className="sm:col-span-2">
                <FormField
                  label="Address"
                  value={shopForm.address}
                  inputStyle={inputStyle}
                  onChange={(value) =>
                    setShopForm((old) => ({ ...old, address: value }))
                  }
                />
              </div>
            </div>

            {!editingShop && (
              <>
                <h3 className={`font-bold ${mainText}`}>
                  Shop Owner Information
                </h3>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    label="Owner Name *"
                    value={shopForm.owner_name}
                    required
                    inputStyle={inputStyle}
                    onChange={(value) =>
                      setShopForm((old) => ({ ...old, owner_name: value }))
                    }
                  />

                  <FormField
                    label="Owner Username *"
                    value={shopForm.owner_username}
                    required
                    inputStyle={inputStyle}
                    onChange={(value) =>
                      setShopForm((old) => ({
                        ...old,
                        owner_username: value,
                      }))
                    }
                  />

                  <FormField
                    label="Owner Email"
                    type="email"
                    value={shopForm.owner_email}
                    inputStyle={inputStyle}
                    onChange={(value) =>
                      setShopForm((old) => ({ ...old, owner_email: value }))
                    }
                  />

                  <FormField
                    label="Owner Password * (minimum 8 characters)"
                    type="password"
                    value={shopForm.owner_password}
                    required
                    inputStyle={inputStyle}
                    onChange={(value) =>
                      setShopForm((old) => ({
                        ...old,
                        owner_password: value,
                      }))
                    }
                  />
                </div>
              </>
            )}

            {editingShop && (
              <div>
                <h3 className={`mb-2 font-bold ${mainText}`}>
                  Reset Shop Owner Password
                </h3>
                <p className={`mb-3 text-sm ${mutedText}`}>
                  Owner username: {editingShop.owner_username || "Not available"}
                </p>

                <FormField
                  label="New Password (leave blank to keep unchanged)"
                  type="password"
                  value={shopForm.owner_password}
                  inputStyle={inputStyle}
                  onChange={(value) =>
                    setShopForm((old) => ({
                      ...old,
                      owner_password: value,
                    }))
                  }
                />
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Subscription Start"
                type="date"
                value={shopForm.subscription_start}
                inputStyle={inputStyle}
                onChange={(value) =>
                  setShopForm((old) => ({
                    ...old,
                    subscription_start: value,
                  }))
                }
              />

              <FormField
                label="Subscription End"
                type="date"
                value={shopForm.subscription_end}
                inputStyle={inputStyle}
                onChange={(value) =>
                  setShopForm((old) => ({
                    ...old,
                    subscription_end: value,
                  }))
                }
              />
            </div>

            <ModalActions
              onCancel={closeShopForm}
              saving={savingShop}
              saveText={editingShop ? "Save Changes" : "Create Shop"}
            />
          </form>
        </Modal>
      )}

      {/* Edit User modal */}

      {editingUser && (
        <Modal
          onClose={closeEditUser}
          title="Edit User"
          panel={panel}
        >
          <form onSubmit={saveEditedUser} className="space-y-4">
            <FormField
              label="Full Name *"
              value={editUserForm.name}
              required
              inputStyle={inputStyle}
              onChange={(value) =>
                setEditUserForm((old) => ({ ...old, name: value }))
              }
            />

            <FormField
              label="Username *"
              value={editUserForm.username}
              required
              inputStyle={inputStyle}
              onChange={(value) =>
                setEditUserForm((old) => ({ ...old, username: value }))
              }
            />

            <FormField
              label="Email"
              type="email"
              value={editUserForm.email}
              inputStyle={inputStyle}
              onChange={(value) =>
                setEditUserForm((old) => ({ ...old, email: value }))
              }
            />

            <label className="block">
              <span className="mb-1 block text-sm font-medium">Role</span>
              <select
                value={editUserForm.role}
                onChange={(event) =>
                  setEditUserForm((old) => ({
                    ...old,
                    role: event.target.value,
                  }))
                }
                className={`w-full rounded-lg border px-3 py-2.5 ${inputStyle}`}
              >
                <option>Shop Admin</option>
                <option>Stock Operator</option>
                <option>Viewer</option>
                <option>Super Admin</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">
                Account Status
              </span>
              <select
                value={editUserForm.status}
                onChange={(event) =>
                  setEditUserForm((old) => ({
                    ...old,
                    status: event.target.value,
                  }))
                }
                className={`w-full rounded-lg border px-3 py-2.5 ${inputStyle}`}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>

            <p className={`text-xs ${mutedText}`}>
              Shop ID: {editingUser.shop_id ?? "—"} (read-only)
            </p>

            <div>
              <FormField
                label="New Password (optional, minimum 8 characters)"
                type={showEditPassword ? "text" : "password"}
                value={editUserForm.newPassword}
                inputStyle={inputStyle}
                onChange={(value) =>
                  setEditUserForm((old) => ({
                    ...old,
                    newPassword: value,
                  }))
                }
              />

              <label
                className={`mt-2 flex items-center gap-2 text-sm ${mutedText}`}
              >
                <input
                  type="checkbox"
                  checked={showEditPassword}
                  onChange={(event) =>
                    setShowEditPassword(event.target.checked)
                  }
                />
                Show password
              </label>
            </div>

            <ModalActions
              onCancel={closeEditUser}
              saving={savingEditUser}
              saveText="Save Changes"
            />
          </form>
        </Modal>
      )}

      {/* Reset User Password modal */}

      {resettingUser && (
        <Modal
          onClose={closeResetPassword}
          title="Reset User Password"
          panel={panel}
        >
          <form onSubmit={saveResetPassword} className="space-y-4">
            <p className={`text-sm ${mutedText}`}>
              User: <strong>{resettingUser.username}</strong>
            </p>

            <FormField
              label="New Password * (minimum 8 characters)"
              type={showResetPassword ? "text" : "password"}
              value={resetPassword}
              required
              inputStyle={inputStyle}
              onChange={setResetPassword}
            />

            <label
              className={`flex items-center gap-2 text-sm ${mutedText}`}
            >
              <input
                type="checkbox"
                checked={showResetPassword}
                onChange={(event) =>
                  setShowResetPassword(event.target.checked)
                }
              />
              Show password
            </label>

            <ModalActions
              onCancel={closeResetPassword}
              saving={savingResetPassword}
              saveText="Reset Password"
            />
          </form>
        </Modal>
      )}
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  inputStyle,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputStyle: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-500/20 ${inputStyle}`}
      />
    </label>
  );
}

function Modal({
  title,
  panel,
  onClose,
  children,
}: {
  title: string;
  panel: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 py-8"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        className={`my-auto w-full max-w-xl rounded-2xl border p-5 shadow-2xl sm:p-7 ${panel}`}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-3 py-2"
          >
            ✕
          </button>
        </div>

        {children}
      </section>
    </div>
  );
}

function ModalActions({
  onCancel,
  saving,
  saveText,
}: {
  onCancel: () => void;
  saving: boolean;
  saveText: string;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-3 border-t pt-5">
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="rounded-lg border px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
      >
        Cancel
      </button>

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-teal-600 hover:bg-teal-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
      >
        {saving ? "Saving..." : saveText}
      </button>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = (status || "unknown").toLowerCase();

  const styles =
    normalized === "active"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : normalized === "expired"
        ? "border-red-200 bg-red-50 text-red-800"
        : ["pending", "upcoming", "expiring_soon"].includes(normalized)
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-slate-200 bg-slate-100 text-slate-700";

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${styles}`}
    >
      {status ? status.replaceAll("_", " ") : "Unknown"}
    </span>
  );
}
