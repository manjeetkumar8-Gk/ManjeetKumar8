import { API } from "../config/api";
import { offlineDb, type SyncQueueItem } from "./db";

let isSyncing = false;
let syncListeners: Array<(status: SyncStatus) => void> = [];

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: Date | null;
  error: string | null;
}

let currentStatus: SyncStatus = {
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  isSyncing: false,
  pendingCount: 0,
  lastSyncedAt: null,
  error: null,
};

export function subscribeSyncStatus(listener: (status: SyncStatus) => void) {
  syncListeners.push(listener);
  listener(currentStatus);
  return () => {
    syncListeners = syncListeners.filter((l) => l !== listener);
  };
}

function updateStatus(updates: Partial<SyncStatus>) {
  currentStatus = { ...currentStatus, ...updates };
  syncListeners.forEach((l) => l(currentStatus));
}

export async function isNetworkAvailable(): Promise<boolean> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return false;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${API}/health`, {
      method: "GET",
      signal: controller.signal,
    }).catch(() => null);
    clearTimeout(timeout);
    return Boolean(res && res.ok);
  } catch {
    return false;
  }
}

export async function queueLocalAction(
  entity: string,
  endpoint: string,
  method: "POST" | "PUT" | "DELETE",
  payload: any
): Promise<number> {
  const item: SyncQueueItem = {
    action: method === "POST" ? "CREATE" : method === "PUT" ? "UPDATE" : "DELETE",
    entity,
    endpoint,
    method,
    payload,
    created_at: new Date().toISOString(),
    status: "pending",
    retryCount: 0,
  };

  const id = await offlineDb.sync_queue.add(item);
  const pendingCount = await offlineDb.sync_queue.where("status").equals("pending").count();
  updateStatus({ pendingCount });

  // If online, attempt background sync immediately
  const token = localStorage.getItem("token");
  if (token && currentStatus.isOnline) {
    triggerAutoSync(token).catch(console.error);
  }

  return id;
}

export async function flushSyncQueue(token: string): Promise<number> {
  const pendingItems = await offlineDb.sync_queue
    .where("status")
    .equals("pending")
    .sortBy("id");

  if (pendingItems.length === 0) {
    updateStatus({ pendingCount: 0 });
    return 0;
  }

  let syncedCount = 0;

  for (const item of pendingItems) {
    if (!item.id) continue;
    try {
      const response = await fetch(`${API}${item.endpoint}`, {
        method: item.method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(item.payload),
      });

      if (response.ok) {
        await offlineDb.sync_queue.delete(item.id);
        syncedCount++;
      } else if (response.status === 401 || response.status === 403) {
        // Auth failure, stop syncing
        throw new Error("Authentication failed during sync.");
      } else {
        // Server validation error or non-retryable error
        const errJson = await response.json().catch(() => ({}));
        await offlineDb.sync_queue.update(item.id, {
          retryCount: (item.retryCount || 0) + 1,
          error: errJson.message || `Server returned ${response.status}`,
        });
      }
    } catch (err: any) {
      console.warn("Sync queue item paused:", item.endpoint, err?.message);
      break; // Pause loop on network error
    }
  }

  const remaining = await offlineDb.sync_queue.where("status").equals("pending").count();
  updateStatus({ pendingCount: remaining });
  return syncedCount;
}

export async function pullRemoteData(token: string) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  try {
    // 1. Companies
    const compRes = await fetch(`${API}/companies`, { headers });
    if (compRes.ok) {
      const data = await compRes.json();
      const rows = Array.isArray(data) ? data : data.data || data.companies || [];
      if (Array.isArray(rows) && rows.length > 0) {
        await offlineDb.companies.clear();
        await offlineDb.companies.bulkPut(rows);
      }
    }

    // 2. Products
    const prodRes = await fetch(`${API}/products`, { headers });
    if (prodRes.ok) {
      const data = await prodRes.json();
      const rows = Array.isArray(data) ? data : data.data || data.products || [];
      if (Array.isArray(rows) && rows.length > 0) {
        await offlineDb.products.clear();
        await offlineDb.products.bulkPut(rows);
      }
    }

    // 3. Customers
    const custRes = await fetch(`${API}/customers`, { headers });
    if (custRes.ok) {
      const data = await custRes.json();
      const rows = Array.isArray(data) ? data : data.data || data.customers || [];
      if (Array.isArray(rows) && rows.length > 0) {
        await offlineDb.customers.clear();
        await offlineDb.customers.bulkPut(rows);
      }
    }

    // 4. Warehouses
    const whRes = await fetch(`${API}/warehouses`, { headers });
    if (whRes.ok) {
      const data = await whRes.json();
      const rows = Array.isArray(data) ? data : data.data || data.warehouses || [];
      if (Array.isArray(rows) && rows.length > 0) {
        await offlineDb.warehouses.clear();
        await offlineDb.warehouses.bulkPut(rows);
      }
    }

    // 5. Vehicles
    const vehRes = await fetch(`${API}/vehicles`, { headers });
    if (vehRes.ok) {
      const data = await vehRes.json();
      const rows = Array.isArray(data) ? data : data.data || data.vehicles || [];
      if (Array.isArray(rows) && rows.length > 0) {
        await offlineDb.vehicles.clear();
        await offlineDb.vehicles.bulkPut(rows);
      }
    }
  } catch (error) {
    console.warn("Pull remote data skipped (working offline):", error);
  }
}

export async function triggerAutoSync(token?: string) {
  if (isSyncing) return;
  const authToken = token || localStorage.getItem("token");
  if (!authToken) return;

  const online = await isNetworkAvailable();
  updateStatus({ isOnline: online });

  if (!online) return;

  isSyncing = true;
  updateStatus({ isSyncing: true, error: null });

  try {
    // 1. Push pending local mutations to cloud
    await flushSyncQueue(authToken);
    // 2. Pull fresh data from cloud
    await pullRemoteData(authToken);

    updateStatus({
      isSyncing: false,
      lastSyncedAt: new Date(),
      error: null,
    });

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("syncora:sync-completed"));
    }
  } catch (err: any) {
    updateStatus({
      isSyncing: false,
      error: err?.message || "Sync failed",
    });
  } finally {
    isSyncing = false;
  }
}

export function initSyncEngine() {
  if (typeof window === "undefined") return;

  // Listen to browser online/offline events
  window.addEventListener("online", async () => {
    updateStatus({ isOnline: true });
    const token = localStorage.getItem("token");
    if (token) {
      await triggerAutoSync(token);
    }
  });

  window.addEventListener("offline", () => {
    updateStatus({ isOnline: false });
  });

  // Background interval every 25 seconds
  setInterval(() => {
    const token = localStorage.getItem("token");
    if (token && navigator.onLine) {
      triggerAutoSync(token).catch(console.error);
    }
  }, 25000);

  // Initial count of pending queue
  offlineDb.sync_queue
    .where("status")
    .equals("pending")
    .count()
    .then((pendingCount) => {
      updateStatus({ pendingCount });
    })
    .catch(() => {});
}
