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

  // 1. If user is online, attempt network call with quick 6s timeout
  if (typeof navigator === "undefined" || navigator.onLine) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

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
      console.warn("Network unavailable, seamlessly using local offline storage:", endpoint, networkError);
    }
  }

  // 2. Offline Fallback Handler
  return handleOfflineFallback<T>(cleanEndpoint, method, options);
}

async function cacheRemoteResponse(endpoint: string, method: string, data: any) {
  if (method !== "GET" || !data) return;

  const rows = Array.isArray(data)
    ? data
    : data.data || data.rows || data.companies || data.products || data.customers || data.warehouses || data.vehicles || [];

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

async function handleOfflineFallback<T>(
  endpoint: string,
  method: string,
  options: RequestInit
): Promise<T> {
  const cleanEndpoint = endpoint.toLowerCase();
  const body = options.body ? JSON.parse(options.body as string) : {};

  // GET Requests - Read from Local IndexedDB
  if (method === "GET") {
    if (cleanEndpoint.includes("/companies")) {
      const rows = await offlineDb.companies.toArray();
      return { success: true, data: rows, companies: rows, message: "Loaded from local offline storage" } as unknown as T;
    }

    if (cleanEndpoint.includes("/products")) {
      const rows = await offlineDb.products.toArray();
      return { success: true, data: rows, products: rows, message: "Loaded from local offline storage" } as unknown as T;
    }

    if (cleanEndpoint.includes("/customers")) {
      const rows = await offlineDb.customers.toArray();
      return { success: true, data: rows, customers: rows, message: "Loaded from local offline storage" } as unknown as T;
    }

    if (cleanEndpoint.includes("/warehouses")) {
      const rows = await offlineDb.warehouses.toArray();
      return { success: true, data: rows, warehouses: rows, message: "Loaded from local offline storage" } as unknown as T;
    }

    if (cleanEndpoint.includes("/vehicles")) {
      const rows = await offlineDb.vehicles.toArray();
      return { success: true, data: rows, vehicles: rows, message: "Loaded from local offline storage" } as unknown as T;
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

      // Compute stock per product
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
      const product = { ...body, id: localId, status: "active" };
      await offlineDb.products.add(product);
      await queueLocalAction("products", endpoint, actionMethod, body);
      return { success: true, message: "Product saved locally! Will sync when connected.", data: product } as unknown as T;
    }

    if (cleanEndpoint.includes("/companies")) {
      const company = { ...body, id: localId, status: "active" };
      await offlineDb.companies.add(company);
      await queueLocalAction("companies", endpoint, actionMethod, body);
      return { success: true, message: "Company saved locally! Will sync when connected.", data: company } as unknown as T;
    }

    if (cleanEndpoint.includes("/customers")) {
      const customer = { ...body, id: localId, status: "active" };
      await offlineDb.customers.add(customer);
      await queueLocalAction("customers", endpoint, actionMethod, body);
      return { success: true, message: "Customer saved locally! Will sync when connected.", data: customer } as unknown as T;
    }

    if (cleanEndpoint.includes("/warehouses")) {
      const wh = { ...body, id: localId, status: "active" };
      await offlineDb.warehouses.add(wh);
      await queueLocalAction("warehouses", endpoint, actionMethod, body);
      return { success: true, message: "Warehouse saved locally! Will sync when connected.", data: wh } as unknown as T;
    }

    if (cleanEndpoint.includes("/vehicles")) {
      const veh = { ...body, id: localId, status: "active" };
      await offlineDb.vehicles.add(veh);
      await queueLocalAction("vehicles", endpoint, actionMethod, body);
      return { success: true, message: "Vehicle saved locally! Will sync when connected.", data: veh } as unknown as T;
    }

    await queueLocalAction("entity", endpoint, actionMethod, body);
    return { success: true, message: "Saved locally! Will sync when connected." } as unknown as T;
  }

  throw new Error("Action not supported offline.");
}
