import { smartApiRequest } from "../offline/offlineApi";
import { useEffect, useState } from "react";

import { API } from "../config/api";

type Warehouse = {
  id: number;
  warehouse_name: string;
};

type StockRow = {
  product_id: number;
  warehouse_id: number;
  warehouse_name: string;
  company_name: string;
  product_name: string;
  pack_size?: number | string | null;
  size_unit?: string | null;
  stock_unit?: string | null;
  product_size?: string | null;
  unit?: string | null;
  total_in: number | string;
  total_out: number | string;
  current_stock: number | string;
  minimum_stock?: number | string;
};

async function request(path: string) {
  return smartApiRequest(path);
}

function packLabel(row: StockRow) {
  const size = row.pack_size ?? row.product_size ?? "";
  const unit = row.size_unit ?? "";
  const stockUnit = row.stock_unit || row.unit || "units";
  const sizeText = [size, unit].filter(Boolean).join(" ");
  return sizeText ? `${sizeText} ${stockUnit}` : stockUnit;
}

function number(value: string | number | undefined) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export default function CurrentStock() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [rows, setRows] = useState<StockRow[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadWarehouses() {
    try {
      const result = await request("/warehouses");
      setWarehouses(result.data ?? result.warehouses ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load warehouses.");
    }
  }

  async function loadStock(id = warehouseId) {
    setLoading(true);
    setError("");

    try {
      const query = id ? `?warehouse_id=${encodeURIComponent(id)}` : "";
      const result = await request(`/stock/current${query}`);
      setRows(result.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load stock balances.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWarehouses();
    void loadStock("");
  }, []);

  const filtered = rows.filter((row) => {
    const term = search.toLowerCase().trim();
    return (
      !term ||
      row.product_name?.toLowerCase().includes(term) ||
      row.company_name?.toLowerCase().includes(term) ||
      row.warehouse_name?.toLowerCase().includes(term) ||
      packLabel(row).toLowerCase().includes(term)
    );
  });

  const totalIn = filtered.reduce((sum, row) => sum + number(row.total_in), 0);
  const totalOut = filtered.reduce((sum, row) => sum + number(row.total_out), 0);
  const current = filtered.reduce((sum, row) => sum + number(row.current_stock), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Current Stock & Balances
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Real-time stock balance calculated by package and warehouse.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadStock()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <span>↻</span> Refresh Stock
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </div>
      )}

      {/* FILTER BAR */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Filter by Warehouse
          </label>
          <select
            value={warehouseId}
            onChange={(event) => {
              const id = event.target.value;
              setWarehouseId(id);
              void loadStock(id);
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">All Warehouses</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.warehouse_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Search Inventory
          </label>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search product, company, package, warehouse..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* SUMMARY STAT METRICS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Total Inflow
          </p>
          <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            {totalIn.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Cumulative units received
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Total Outflow
          </p>
          <p className="mt-2 text-3xl font-bold text-amber-600 dark:text-amber-400">
            {totalOut.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Cumulative units dispatched
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Current Stock Balance
          </p>
          <p className="mt-2 text-3xl font-bold text-teal-600 dark:text-teal-400">
            {current.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Available on hand right now
          </p>
        </div>
      </div>

      {/* STOCK TABLE */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-700">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Inventory Positions ({filtered.length})
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Breakdown by warehouse and product package.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3.5">Warehouse</th>
                <th className="px-5 py-3.5">Company</th>
                <th className="px-5 py-3.5">Product</th>
                <th className="px-5 py-3.5">Package</th>
                <th className="px-5 py-3.5 text-right">Total In</th>
                <th className="px-5 py-3.5 text-right">Total Out</th>
                <th className="px-5 py-3.5 text-right">Current Balance</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500 dark:text-slate-400">
                    Loading inventory balances...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500 dark:text-slate-400">
                    {search ? "No matching stock balances found." : "No stock balances recorded yet."}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr
                    key={`${row.warehouse_id}-${row.product_id}`}
                    className="transition hover:bg-slate-50/70 dark:hover:bg-slate-700/40"
                  >
                    <td className="px-5 py-4 font-medium text-slate-800 dark:text-slate-200">
                      {row.warehouse_name}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {row.company_name}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900 dark:text-slate-100">
                      {row.product_name}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {packLabel(row)}
                    </td>
                    <td className="px-5 py-4 text-right font-medium text-slate-700 dark:text-slate-300">
                      {number(row.total_in).toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-right font-medium text-slate-700 dark:text-slate-300">
                      {number(row.total_out).toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="font-bold text-teal-600 dark:text-teal-400">
                        {number(row.current_stock).toLocaleString()}{" "}
                        <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                          {row.stock_unit || row.unit || ""}
                        </span>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
