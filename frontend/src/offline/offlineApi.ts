import { API } from "../config/api";
import { offlineDb } from "./db";
import { queueLocalAction } from "./syncEngine";

export async function smartApiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;
  const method = (options.method || "GET").toUpperCase();
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${API}${cleanEndpoint}`;

  // 1. If online, try network call with 5s timeout
  if (typeof navigator === "undefined" || navigator.onLine) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      const result = await response.json().catch(() => ({}));

      if (response.ok && result.success !== false) {
        // Cache response in background for offline use
        cacheRemoteResponse(cleanEndpoint, method, result).catch(() => {});
        return result as T;
      }
    } catch (networkError) {
      console.warn("Network unavailable, falling back to offline storage:", endpoint);
    }
  }

  // 2. Offline Fallback Handler
  return handleOfflineFallback<T>(cleanEndpoint, method, options);
}

async function cacheRemoteResponse(endpoint: string, method: string, data: any) {
  if (method !== "GET" || !data) return;

  const rows = Array.isArray(data)
    ? data
    : data.data || data.rows || data.companies || data.products || data.customers || data.warehouses || data.vehicles || data.users || [];

  if (!Array.isArray(rows)) return;

  try {
    if (endpoint.includes("/companies")) {
      await offlineDb.companies.bulkPut(rows);
    } else if (endpoint.includes("/products")) {
      await offlineDb.products.bulkPut(rows);
    } else if (endpoint.includes("/customers")) {
      await offlineDb.customers.bulkPut(rows);
    } else if (endpoint.includes("/warehouses")) {
      await offlineDb.warehouses.bulkPut(rows);
    } else if (endpoint.includes("/vehicles")) {
      await offlineDb.vehicles.bulkPut(rows);
    } else if (endpoint.includes("/users")) {
      await offlineDb.users.bulkPut(rows);
    } else if (endpoint.includes("/stock/in")) {
      const records = rows.map((r) => ({ ...r, type: "IN" as const }));
      await offlineDb.stock_records.bulkPut(records);
    } else if (endpoint.includes("/stock/out")) {
      const records = rows.map((r) => ({ ...r, type: "OUT" as const }));
      await offlineDb.stock_records.bulkPut(records);
    }
  } catch (err) {
    console.warn("Caching failed:", err);
  }
}

function extractIdFromEndpoint(endpoint: string): number | null {
  const parts = endpoint.split("?")[0].split("/");
  const last = parts[parts.length - 1];
  const num = Number(last);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function extractSearchQuery(endpoint: string): string {
  try {
    const qIndex = endpoint.indexOf("?");
    if (qIndex === -1) return "";
    const params = new URLSearchParams(endpoint.slice(qIndex));
    return (params.get("search") || "").trim().toLowerCase();
  } catch {
    return "";
  }
}

async function handleOfflineFallback<T>(
  endpoint: string,
  method: string,
  options: RequestInit
): Promise<T> {
  const cleanEndpoint = endpoint.toLowerCase();
  const search = extractSearchQuery(endpoint);
  const body = options.body ? JSON.parse(options.body as string) : {};

  // GET Requests - Read from Local IndexedDB
  if (method === "GET") {
    if (cleanEndpoint.includes("/companies")) {
      let rows = await offlineDb.companies.toArray();
      if (search) {
        rows = rows.filter((c) => c.company_name.toLowerCase().includes(search));
      }
      return { success: true, data: rows, companies: rows, message: "Loaded from local offline storage" } as unknown as T;
    }

    if (cleanEndpoint.includes("/products")) {
      let rows = await offlineDb.products.toArray();
      if (search) {
        rows = rows.filter((p) => p.product_name.toLowerCase().includes(search));
      }
      return { success: true, data: rows, products: rows, message: "Loaded from local offline storage" } as unknown as T;
    }

    if (cleanEndpoint.includes("/customers")) {
      let rows = await offlineDb.customers.toArray();
      if (search) {
        rows = rows.filter((c) => c.customer_name.toLowerCase().includes(search));
      }
      return { success: true, data: rows, customers: rows, message: "Loaded from local offline storage" } as unknown as T;
    }

    if (cleanEndpoint.includes("/warehouses")) {
      let rows = await offlineDb.warehouses.toArray();
      if (search) {
        rows = rows.filter((w) => w.warehouse_name.toLowerCase().includes(search));
      }
      return { success: true, data: rows, warehouses: rows, message: "Loaded from local offline storage" } as unknown as T;
    }

    if (cleanEndpoint.includes("/vehicles")) {
      let rows = await offlineDb.vehicles.toArray();
      if (search) {
        rows = rows.filter((v) => v.vehicle_number.toLowerCase().includes(search));
      }
      return { success: true, data: rows, vehicles: rows, message: "Loaded from local offline storage" } as unknown as T;
    }

    if (cleanEndpoint.includes("/users")) {
      const rows = await offlineDb.users.toArray();
      return { success: true, data: rows, users: rows, message: "Loaded from local offline storage" } as unknown as T;
    }

    if (cleanEndpoint.includes("/stock/in")) {
      const rows = await offlineDb.stock_records.where("type").equals("IN").toArray();
      return { success: true, data: rows, rows, message: "Loaded from local offline storage" } as unknown as T;
    }

    if (cleanEndpoint.includes("/stock/out")) {
      const rows = await offlineDb.stock_records.where("type").equals("OUT").toArray();
      return { success: true, data: rows, rows, message: "Loaded from local offline storage" } as unknown as T;
    }

    if (cleanEndpoint.includes("/stock/current") || cleanEndpoint.includes("/stock/records")) {
      const allRecords = await offlineDb.stock_records.toArray();
      const allProducts = await offlineDb.products.toArray();

      const stockMap = new Map<number, { inQty: number; outQty: number }>();
      for (const rec of allRecords) {
        const pid = rec.product_id;
        const current = stockMap.get(pid) || { inQty: 0, outQty: 0 };
        const q = Number(rec.quantity) || 0;
        if (rec.type === "IN") current.inQty += q;
        if (rec.type === "OUT") current.outQty += q;
        stockMap.set(pid, current);
      }

      const rows = allProducts.map((p) => {
        const stats = stockMap.get(p.id) || { inQty: 0, outQty: 0 };
        return {
          product_id: p.id,
          product_name: p.product_name,
          company_id: p.company_id,
          company_name: p.company_name || "",
          total_in: stats.inQty,
          total_out: stats.outQty,
          current_stock: stats.inQty - stats.outQty,
          unit: p.unit || p.stock_unit || "Piece",
          pack_size: p.pack_size || "",
          size_unit: p.size_unit || "",
          status: p.status || "active",
        };
      });

      return { success: true, data: rows, rows, message: "Calculated from local offline data" } as unknown as T;
    }

    return { success: true, data: [], message: "No local records available" } as unknown as T;
  }

  // POST / PUT / DELETE Requests - Write Locally & Queue Sync
  if (method === "POST" || method === "PUT" || method === "DELETE") {
    const localId = Date.now();
    const actionMethod = method as "POST" | "PUT" | "DELETE";
    const entityId = extractIdFromEndpoint(endpoint);

    if (cleanEndpoint.includes("/stock/in")) {
      const record = {
        id: localId,
        shop_id: body.shop_id || 1,
        stock_date: body.stock_date || new Date().toISOString(),
        product_id: Number(body.product_id),
        company_id: Number(body.company_id),
        warehouse_id: Number(body.warehouse_id),
        quantity: Number(body.quantity),
        type: "IN" as const,
        voucher_number: body.voucher_number || `LOCAL-IN-${String(localId).slice(-5)}`,
        vehicle_number: body.vehicle_number || null,
        driver_name: body.driver_name || null,
        driver_contact: body.driver_contact || null,
        remarks: body.remarks || null,
        created_at: new Date().toISOString(),
      };
      await offlineDb.stock_records.add(record);
      await queueLocalAction("stock_in", endpoint, actionMethod, body);
      return { success: true, message: "Stock In saved locally! Will sync when connected to internet.", data: record } as unknown as T;
    }

    if (cleanEndpoint.includes("/stock/out")) {
      const record = {
        id: localId,
        shop_id: body.shop_id || 1,
        stock_date: body.stock_date || new Date().toISOString(),
        product_id: Number(body.product_id),
        company_id: Number(body.company_id),
        customer_id: Number(body.customer_id),
        warehouse_id: Number(body.warehouse_id),
        quantity: Number(body.quantity),
        type: "OUT" as const,
        voucher_number: body.voucher_number || `LOCAL-OUT-${String(localId).slice(-5)}`,
        vehicle_number: body.vehicle_number || null,
        driver_name: body.driver_name || null,
        driver_contact: body.driver_contact || null,
        remarks: body.remarks || null,
        created_at: new Date().toISOString(),
      };
      await offlineDb.stock_records.add(record);
      await queueLocalAction("stock_out", endpoint, actionMethod, body);
      return { success: true, message: "Stock Out saved locally! Will sync when connected to internet.", data: record } as unknown as T;
    }

    if (cleanEndpoint.includes("/products")) {
      if (actionMethod === "DELETE" && entityId) {
        await offlineDb.products.delete(entityId);
      } else {
        const product = { ...body, id: entityId || body.id || localId, status: body.status || "active" };
        await offlineDb.products.put(product);
      }
      await queueLocalAction("products", endpoint, actionMethod, body);
      return { success: true, message: "Product updated locally! Will sync when connected.", data: body } as unknown as T;
    }

    if (cleanEndpoint.includes("/companies")) {
      if (actionMethod === "DELETE" && entityId) {
        await offlineDb.companies.delete(entityId);
      } else {
        const company = { ...body, id: entityId || body.id || localId, status: body.status || "active" };
        await offlineDb.companies.put(company);
      }
      await queueLocalAction("companies", endpoint, actionMethod, body);
      return { success: true, message: "Company updated locally! Will sync when connected.", data: body } as unknown as T;
    }

    if (cleanEndpoint.includes("/customers")) {
      if (actionMethod === "DELETE" && entityId) {
        await offlineDb.customers.delete(entityId);
      } else {
        const customer = { ...body, id: entityId || body.id || localId, status: body.status || "active" };
        await offlineDb.customers.put(customer);
      }
      await queueLocalAction("customers", endpoint, actionMethod, body);
      return { success: true, message: "Customer updated locally! Will sync when connected.", data: body } as unknown as T;
    }

    if (cleanEndpoint.includes("/warehouses")) {
      if (actionMethod === "DELETE" && entityId) {
        await offlineDb.warehouses.delete(entityId);
      } else {
        const wh = { ...body, id: entityId || body.id || localId, status: body.status || "active" };
        await offlineDb.warehouses.put(wh);
      }
      await queueLocalAction("warehouses", endpoint, actionMethod, body);
      return { success: true, message: "Warehouse updated locally! Will sync when connected.", data: body } as unknown as T;
    }

    if (cleanEndpoint.includes("/vehicles")) {
      if (actionMethod === "DELETE" && entityId) {
        await offlineDb.vehicles.delete(entityId);
      } else {
        const veh = { ...body, id: entityId || body.id || localId, status: body.status || "active" };
        await offlineDb.vehicles.put(veh);
      }
      await queueLocalAction("vehicles", endpoint, actionMethod, body);
      return { success: true, message: "Vehicle updated locally! Will sync when connected.", data: body } as unknown as T;
    }

    await queueLocalAction("entity", endpoint, actionMethod, body);
    return { success: true, message: "Saved locally! Will sync when connected." } as unknown as T;
  }

  throw new Error("Action not supported offline.");
}
