import { useEffect, useState, type FormEvent } from "react";

import { API } from "../config/api";

type Row = { id: number; [key: string]: any };

type Product = Row & {
  company_id: number;
  product_name: string;
  pack_size?: number | string;
  size_unit?: string;
  stock_unit?: string;
  unit?: string;
};

type Vehicle = {
  id: number;
  vehicle_number: string;
  vehicle_type?: string | null;
  driver_name?: string | null;
  driver_contact?: string | null;
};

async function request(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success === false) {
    throw new Error(result.message || "Request failed");
  }

  return result;
}

function rows(result: any): Row[] {
  const data =
    result.data ??
    result.companies ??
    result.products ??
    result.warehouses ??
    result.customers ??
    result.vehicles ??
    [];

  return Array.isArray(data) ? data : [];
}

function packageName(p?: Product) {
  if (!p) return "";
  return `${p.product_name} — ${p.pack_size ?? ""} ${p.size_unit ?? ""} ${p.stock_unit || p.unit || ""}`.trim();
}

export default function StockOut() {
  const [companies, setCompanies] = useState<Row[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Row[]>([]);
  const [customers, setCustomers] = useState<Row[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  const [companyId, setCompanyId] = useState("");
  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [customerId, setCustomerId] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomerCnic, setNewCustomerCnic] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerAddress, setNewCustomerAddress] = useState("");
  const [addingCustomer, setAddingCustomer] = useState(false);

  const [voucher, setVoucher] = useState("");
  const [quantity, setQuantity] = useState("");
  const [stockDate, setStockDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [driverName, setDriverName] = useState("");
  const [remarks, setRemarks] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [c, p, w, cu, v] = await Promise.all([
        request("/companies"),
        request("/products"),
        request("/warehouses"),
        request("/customers"),
        request("/vehicles").catch(() => ({ vehicles: [] })),
      ]);

      setCompanies(rows(c));
      setProducts(
        rows(p).filter((x: any) => x.status !== "inactive") as Product[]
      );
      setWarehouses(rows(w));
      setCustomers(rows(cu));
      setVehicles(rows(v) as Vehicle[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Data loading failed.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filteredProducts = products.filter(
    (p) => String(p.company_id) === companyId
  );

  const selectedProduct = products.find((p) => String(p.id) === productId);

  const matchedCustomers = customers.filter((c) =>
    String(c.customer_name || "")
      .toLowerCase()
      .includes(customerName.trim().toLowerCase())
  );

  function handleVehicleSelect(number: string) {
    setVehicleNumber(number);
    const found = vehicles.find(
      (v) => v.vehicle_number.toLowerCase() === number.toLowerCase()
    );
    if (found) {
      if (found.vehicle_type) setVehicleType(found.vehicle_type);
      if (found.driver_name) setDriverName(found.driver_name);
    }
  }

  async function addCustomer() {
    setError("");
    setMessage("");

    if (!customerName.trim()) {
      setError("Please enter customer name.");
      return;
    }

    const existing = customers.find(
      (c) =>
        String(c.customer_name || "").trim().toLowerCase() ===
        customerName.trim().toLowerCase()
    );

    if (existing) {
      setCustomerId(String(existing.id));
      setCustomerName(String(existing.customer_name));
      setShowAddCustomer(false);
      setMessage("Existing customer selected.");
      return;
    }

    setAddingCustomer(true);

    try {
      const result = await request("/customers", {
        method: "POST",
        body: JSON.stringify({
          customer_name: customerName.trim(),
          cnic: newCustomerCnic.trim(),
          phone: newCustomerPhone.trim(),
          address: newCustomerAddress.trim(),
        }),
      });

      const data = result.data;
      const created =
        data?.customer ?? (Array.isArray(data) ? data[0] : data);

      if (!created?.id) {
        await load();
        setError("Could not confirm customer creation. Please review the customer list.");
        return;
      }

      setCustomers((prev) => [
        ...prev.filter((c) => c.id !== created.id),
        created,
      ]);

      setCustomerId(String(created.id));
      setCustomerName(String(created.customer_name || customerName.trim()));
      setShowAddCustomer(false);
      setNewCustomerCnic("");
      setNewCustomerPhone("");
      setNewCustomerAddress("");
      setMessage("Customer registered successfully. You may now complete Stock Out.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add customer.");
    } finally {
      setAddingCustomer(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (
      !voucher.trim() ||
      !companyId ||
      !productId ||
      !warehouseId ||
      !quantity ||
      !stockDate
    ) {
      setError(
        "Voucher number, company, product, warehouse, quantity and date are all required."
      );
      return;
    }

    if (!Number.isFinite(Number(quantity)) || Number(quantity) <= 0) {
      setError("Quantity must be a positive number.");
      return;
    }

    if (showAddCustomer || addingCustomer) {
      setError("Please complete saving the new customer or close the customer dialog first.");
      return;
    }

    if (customerName.trim() && !customerId) {
      setError("Please select an existing customer or click '+ Add New Customer'.");
      return;
    }

    setSaving(true);

    try {
      await request("/stock/out", {
        method: "POST",
        body: JSON.stringify({
          voucher_number: voucher.trim(),
          company_id: Number(companyId),
          product_id: Number(productId),
          warehouse_id: Number(warehouseId),
          customer_id: customerId ? Number(customerId) : null,
          quantity: Number(quantity),
          stock_date: stockDate,
          vehicle_number: vehicleNumber.trim() || undefined,
          vehicle_type: vehicleType.trim() || undefined,
          driver_name: driverName.trim() || undefined,
          remarks: remarks.trim() || undefined,
        }),
      });

      setMessage("Stock Out voucher recorded successfully.");
      setVoucher("");
      setQuantity("");
      setVehicleNumber("");
      setVehicleType("");
      setDriverName("");
      setRemarks("");
      setCustomerId("");
      setCustomerName("");
      setShowAddCustomer(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stock Out submission failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Stock Out Dispatch
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Issue inventory to customers or retail points and generate official voucher dispatches.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </div>
      )}

      {message && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          {message}
        </div>
      )}

      <form
        onSubmit={submit}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800/80"
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Voucher Number *
            </label>
            <input
              value={voucher}
              onChange={(e) => setVoucher(e.target.value)}
              placeholder="e.g. VCH-00123"
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Dispatch Date *
            </label>
            <input
              type="date"
              value={stockDate}
              onChange={(e) => setStockDate(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Company / Supplier *
            </label>
            <select
              value={companyId}
              onChange={(e) => {
                setCompanyId(e.target.value);
                setProductId("");
              }}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="">Select company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Product & Package *
            </label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="">Select product package</option>
              {filteredProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {packageName(p)}
                </option>
              ))}
            </select>
          </div>

          {selectedProduct && (
            <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-4 text-sm text-teal-900 dark:border-teal-900/60 dark:bg-teal-950/40 dark:text-teal-200 md:col-span-2">
              <span className="font-bold">Active Package Specification:</span>{" "}
              {packageName(selectedProduct)} (Unit: {selectedProduct.stock_unit || selectedProduct.unit || "Units"})
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Source Warehouse *
            </label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="">Select warehouse location</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.warehouse_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Quantity to Dispatch *
            </label>
            <input
              type="number"
              min="1"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 50"
              required
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          {/* CUSTOMER SEARCH & QUICK ADD */}
          <div className="space-y-2 md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Customer Name
            </label>

            <input
              value={customerName}
              placeholder="Type customer name to search..."
              onChange={(e) => {
                setCustomerName(e.target.value);
                setCustomerId("");
                setShowAddCustomer(false);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            />

            {customerName.trim() && !customerId && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                {matchedCustomers.length > 0 ? (
                  <div>
                    <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Matching Customers:
                    </p>
                    <div className="max-h-40 space-y-1 overflow-y-auto">
                      {matchedCustomers.map((c) => (
                        <button
                          type="button"
                          key={c.id}
                          className="w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
                          onClick={() => {
                            setCustomerId(String(c.id));
                            setCustomerName(String(c.customer_name));
                            setShowAddCustomer(false);
                          }}
                        >
                          <span className="font-semibold">{c.customer_name}</span>{" "}
                          {c.phone && <span className="text-xs text-slate-400">({c.phone})</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No matching customer found.
                  </p>
                )}

                {!showAddCustomer && (
                  <button
                    type="button"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-teal-700 transition"
                    onClick={() => setShowAddCustomer(true)}
                  >
                    + Register "{customerName.trim()}" as New Customer
                  </button>
                )}
              </div>
            )}

            {customerId && (
              <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-300">
                <span>✓</span> Customer Selected: {customerName}
              </div>
            )}

            {showAddCustomer && (
              <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  New Customer Quick Registration
                </p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <input
                    value={newCustomerCnic}
                    onChange={(e) => setNewCustomerCnic(e.target.value)}
                    placeholder="CNIC (optional)"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                  <input
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    placeholder="Phone (optional)"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                  <input
                    value={newCustomerAddress}
                    onChange={(e) => setNewCustomerAddress(e.target.value)}
                    placeholder="Address (optional)"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    disabled={addingCustomer}
                    onClick={() => void addCustomer()}
                    className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50"
                  >
                    {addingCustomer ? "Saving..." : "Save Customer Record"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAddCustomer(false)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* TRANSPORT & LOGISTICS */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Vehicle Number
            </label>
            <input
              list="stockout-vehicles"
              value={vehicleNumber}
              onChange={(e) => handleVehicleSelect(e.target.value)}
              placeholder="e.g. ABC-123"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            <datalist id="stockout-vehicles">
              {vehicles.map((v) => (
                <option key={v.id} value={v.vehicle_number}>
                  {v.vehicle_type ? `${v.vehicle_type} - ` : ""}
                  {v.driver_name || "Driver"}
                </option>
              ))}
            </datalist>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Vehicle Type
            </label>
            <input
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              placeholder="Truck, Mazda, Van, etc."
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Driver Name
            </label>
            <input
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              placeholder="Driver full name"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Remarks
            </label>
            <input
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional dispatch notes"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={saving || addingCustomer}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50"
          >
            {saving ? "Processing..." : "✓ Record Stock Out Voucher"}
          </button>
        </div>
      </form>
    </div>
  );
}
