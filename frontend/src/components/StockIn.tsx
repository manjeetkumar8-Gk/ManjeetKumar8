import { smartApiRequest } from "../offline/offlineApi";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

import { API } from "../config/api";

type Company = {
  id: number;
  company_name?: string;
  name?: string;
  status?: string;
};

type Product = {
  id: number;
  company_id?: number;
  companyId?: number;
  company_name?: string;
  product_name?: string;
  name?: string;
  pack_size?: number | string | null;
  product_size?: number | string | null;
  size_unit?: string | null;
  stock_unit?: string | null;
  unit?: string | null;
  product_code?: string | null;
  status?: string;
};

type Warehouse = {
  id: number;
  warehouse_name?: string;
  name?: string;
  status?: string;
};

type Vehicle = {
  id: number;
  vehicle_number: string;
  vehicle_type?: string | null;
  driver_name?: string | null;
  driver_contact?: string | null;
};

type ApiResult = {
  data?: unknown;
  rows?: unknown;
  companies?: unknown;
  products?: unknown;
  warehouses?: unknown;
  vehicles?: unknown;
  message?: string;
  error?: string;
  success?: boolean;
};

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  return smartApiRequest<T>(endpoint, options);
}

function getRows<T>(result: unknown, key: string): T[] {
  if (Array.isArray(result)) return result as T[];

  if (result && typeof result === "object") {
    const obj = result as Record<string, unknown>;

    if (Array.isArray(obj[key])) return obj[key] as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
    if (Array.isArray(obj.rows)) return obj.rows as T[];
  }

  return [];
}

function todayLocal(): string {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function productName(product: Product): string {
  return product.product_name ?? product.name ?? `Product ${product.id}`;
}

function companyName(company: Company): string {
  return company.company_name ?? company.name ?? `Company ${company.id}`;
}

function warehouseName(warehouse: Warehouse): string {
  return (
    warehouse.warehouse_name ??
    warehouse.name ??
    `Warehouse ${warehouse.id}`
  );
}

function productStockUnit(product: Product): string {
  return product.stock_unit?.trim() || product.unit?.trim() || "Piece";
}

function productPackSize(product: Product): string {
  const size = product.pack_size ?? product.product_size;
  const sizeUnit = product.size_unit?.trim() ?? "";

  if (size === null || size === undefined || String(size).trim() === "") {
    return "Pack size not set";
  }

  return `${size}${sizeUnit ? ` ${sizeUnit}` : ""}`;
}

function normalizePhone(value: string): string {
  return value.replace(/[\s\-()]/g, "");
}

function isValidPakistaniMobile(value: string): boolean {
  if (!value.trim()) return true;

  const phone = normalizePhone(value);

  return /^(?:03\d{9}|\+923\d{9}|00923\d{9}|923\d{9})$/.test(phone);
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500";

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
      <span className="mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

export default function StockIn() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  const [companyId, setCompanyId] = useState("");
  const [productNameChoice, setProductNameChoice] = useState("");
  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [stockDate, setStockDate] = useState(todayLocal());

  const [challanNumber, setChallanNumber] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverContact, setDriverContact] = useState("");
  const [remarks, setRemarks] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const [companyResult, productResult, warehouseResult, vehicleResult] =
          await Promise.all([
            request<unknown>("/companies"),
            request<unknown>("/products"),
            request<unknown>("/warehouses"),
            request<unknown>("/vehicles").catch(() => ({ vehicles: [] })),
          ]);

        if (!active) return;

        setCompanies(
          getRows<Company>(companyResult, "companies").filter(
            (item) => item.status?.toLowerCase() !== "inactive"
          )
        );

        setProducts(
          getRows<Product>(productResult, "products").filter(
            (item) => item.status?.toLowerCase() !== "inactive"
          )
        );

        setWarehouses(
          getRows<Warehouse>(warehouseResult, "warehouses").filter(
            (item) => item.status?.toLowerCase() !== "inactive"
          )
        );

        setVehicles(getRows<Vehicle>(vehicleResult, "vehicles"));
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load companies, products, warehouses, or vehicles."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadData();

    return () => {
      active = false;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    if (!companyId) return [];

    return products.filter(
      (product) =>
        String(product.company_id ?? product.companyId ?? "") === companyId
    );
  }, [products, companyId]);

  const uniqueProductNames = useMemo(() => {
    const names = new Map<string, string>();

    filteredProducts.forEach((product) => {
      const name = productName(product).trim();

      if (name) names.set(name.toLowerCase(), name);
    });

    return Array.from(names.entries()).map(([key, name]) => ({
      key,
      name,
    }));
  }, [filteredProducts]);

  const productVariants = useMemo(
    () =>
      filteredProducts.filter(
        (product) =>
          productName(product).trim().toLowerCase() ===
          productNameChoice.trim().toLowerCase()
      ),
    [filteredProducts, productNameChoice]
  );

  const selectedProduct = filteredProducts.find(
    (product) => String(product.id) === productId
  );

  const selectedCompany = companies.find(
    (company) => String(company.id) === companyId
  );

  const selectedWarehouse = warehouses.find(
    (warehouse) => String(warehouse.id) === warehouseId
  );

  function handleCompanyChange(value: string) {
    setCompanyId(value);
    setProductNameChoice("");
    setProductId("");
    setQuantity("");
    setError("");
    setSuccess("");
  }

  function handleProductChange(value: string) {
    setProductNameChoice(value);
    setProductId("");
    setQuantity("");
    setError("");
    setSuccess("");
  }

  function handleVehicleSelect(value: string) {
    setVehicleNumber(value);
    const matched = vehicles.find(
      (v) => v.vehicle_number?.toLowerCase() === value.trim().toLowerCase()
    );
    if (matched) {
      if (matched.vehicle_type) setVehicleType(matched.vehicle_type);
      if (matched.driver_name) setDriverName(matched.driver_name);
      if (matched.driver_contact) setDriverContact(matched.driver_contact);
    }
  }

  function clearForm() {
    setCompanyId("");
    setProductNameChoice("");
    setProductId("");
    setWarehouseId("");
    setQuantity("");
    setStockDate(todayLocal());
    setChallanNumber("");
    setVehicleNumber("");
    setVehicleType("");
    setDriverName("");
    setDriverContact("");
    setRemarks("");
    setError("");
    setSuccess("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const company = companies.find(
      (item) => String(item.id) === companyId
    );

    if (!company) {
      setError("Please select a valid company.");
      return;
    }

    const product = filteredProducts.find(
      (item) => String(item.id) === productId
    );

    if (!product) {
      setError("Please select a valid product and packing size.");
      return;
    }

    const warehouse = warehouses.find(
      (item) => String(item.id) === warehouseId
    );

    if (!warehouse) {
      setError("Please select a valid warehouse.");
      return;
    }

    const unit = productStockUnit(product);

    if (!unit || unit.length > 30) {
      setError("The selected product has an invalid stock unit.");
      return;
    }

    if (!/^\d{1,9}$/.test(quantity.trim())) {
      setError("Quantity must be a whole number, such as 1, 10, or 100.");
      return;
    }

    const quantityValue = Number(quantity);

    if (!Number.isSafeInteger(quantityValue) || quantityValue <= 0) {
      setError("Quantity must be a positive whole number.");
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(stockDate)) {
      setError("Please select a valid stock date.");
      return;
    }

    const [year, month, day] = stockDate.split("-").map(Number);
    const parsedDate = new Date(year, month - 1, day);

    if (
      parsedDate.getFullYear() !== year ||
      parsedDate.getMonth() !== month - 1 ||
      parsedDate.getDate() !== day
    ) {
      setError("The selected stock date is invalid.");
      return;
    }

    if (stockDate > todayLocal()) {
      setError("A future date cannot be used for a Stock IN record.");
      return;
    }

    const cleanChallan = challanNumber.trim();
    const cleanVehicle = vehicleNumber.trim();
    const cleanDriver = driverName.trim();
    const cleanContact = driverContact.trim();
    const cleanRemarks = remarks.trim();

    if (cleanChallan.length > 50) {
      setError("Challan number cannot exceed 50 characters.");
      return;
    }

    if (cleanVehicle.length > 30) {
      setError("Vehicle number cannot exceed 30 characters.");
      return;
    }

    if (cleanDriver.length > 100) {
      setError("Driver name cannot exceed 100 characters.");
      return;
    }

    if (cleanContact && !isValidPakistaniMobile(cleanContact)) {
      setError(
        "Enter a valid Pakistani mobile number, e.g. 03001234567 or +923001234567."
      );
      return;
    }

    if (cleanRemarks.length > 500) {
      setError("Remarks cannot exceed 500 characters.");
      return;
    }

    const allowedVehicleTypes = [
      "",
      "Truck",
      "Trailer",
      "Mazda",
      "Tractor",
      "Pickup",
      "Other",
    ];

    if (!allowedVehicleTypes.includes(vehicleType)) {
      setError("Please select a valid vehicle type.");
      return;
    }

    setSaving(true);

    try {
      await request("/stock/in", {
        method: "POST",
        body: JSON.stringify({
          company_id: Number(companyId),
          product_id: Number(productId),
          warehouse_id: Number(warehouseId),
          quantity: quantityValue,
          stock_date: stockDate,
          vehicle_number: cleanVehicle || null,
          vehicle_type: vehicleType || null,
          challan_number: cleanChallan || null,
          driver_name: cleanDriver || null,
          driver_contact: cleanContact
            ? normalizePhone(cleanContact)
            : null,
          remarks: cleanRemarks || null,
        }),
      });

      setSuccess(
        `Stock IN saved successfully: ${quantityValue} ${unit} of ${productName(product)}.`
      );

      setProductId("");
      setQuantity("");
      setChallanNumber("");
      setVehicleNumber("");
      setVehicleType("");
      setDriverName("");
      setDriverContact("");
      setRemarks("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save the Stock IN record."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Stock In
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Record incoming product shipments and receipts into warehouse inventory.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          {success}
        </div>
      )}

      {loading && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-400">
          Loading companies, products, warehouses, and vehicles...
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800/80"
      >
        <section>
          <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">
            Stock Details
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Stock Date *">
              <input
                type="date"
                value={stockDate}
                max={todayLocal()}
                onChange={(e) => setStockDate(e.target.value)}
                required
                className={inputClass}
              />
            </Field>

            <Field label="Company *">
              <select
                value={companyId}
                onChange={(e) => handleCompanyChange(e.target.value)}
                required
                disabled={loading}
                className={inputClass}
              >
                <option value="">Select Company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {companyName(company)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Product Name *">
              <select
                value={productNameChoice}
                onChange={(e) => handleProductChange(e.target.value)}
                required
                disabled={!companyId || loading}
                className={inputClass}
              >
                <option value="">Select Product</option>
                {uniqueProductNames.map((item) => (
                  <option key={item.key} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Packing Size / Unit *">
              <select
                value={productId}
                onChange={(e) => {
                  setProductId(e.target.value);
                  setQuantity("");
                  setError("");
                  setSuccess("");
                }}
                required
                disabled={!productNameChoice || loading}
                className={inputClass}
              >
                <option value="">Select Packing</option>
                {productVariants.map((product) => (
                  <option key={product.id} value={product.id}>
                    {productPackSize(product)} / {productStockUnit(product)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Warehouse *">
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                required
                disabled={loading}
                className={inputClass}
              >
                <option value="">Select Warehouse</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouseName(warehouse)}
                  </option>
                ))}
              </select>
            </Field>

            {selectedProduct && (
              <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-4 md:col-span-2 dark:border-teal-900/50 dark:bg-teal-950/30">
                <p className="text-sm font-semibold text-teal-900 dark:text-teal-200">
                  {productName(selectedProduct)}
                </p>

                <div className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 text-slate-700 dark:text-slate-300">
                  <p>
                    Pack Size:{" "}
                    <strong className="font-semibold text-teal-800 dark:text-teal-300">
                      {productPackSize(selectedProduct)}
                    </strong>
                  </p>

                  <p>
                    Stock Unit:{" "}
                    <strong className="font-semibold text-teal-800 dark:text-teal-300">
                      {productStockUnit(selectedProduct)}
                    </strong>
                  </p>
                </div>

                <p className="mt-2 text-xs text-teal-700 dark:text-teal-400">
                  Enter the number of packs, bags, bottles, or other stock units received.
                </p>
              </div>
            )}

            <Field
              label={`Quantity *${selectedProduct ? ` (${productStockUnit(selectedProduct)})` : ""}`}
            >
              <input
                type="number"
                min="1"
                max="999999999"
                step="1"
                inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                placeholder="Enter whole-number quantity"
                className={inputClass}
              />

              <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                Whole numbers only. Decimals are not allowed.
              </span>
            </Field>

            <Field label="Challan Number">
              <input
                value={challanNumber}
                onChange={(e) => setChallanNumber(e.target.value)}
                maxLength={50}
                placeholder="Enter challan number (optional)"
                className={inputClass}
              />
            </Field>
          </div>
        </section>

        <section className="border-t border-slate-200 pt-5 dark:border-slate-700">
          <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">
            Logistics & Transport
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Vehicle Number Plate">
              <input
                list="stockin-vehicles"
                value={vehicleNumber}
                onChange={(e) => handleVehicleSelect(e.target.value)}
                maxLength={30}
                placeholder="e.g. ABC-123"
                className={inputClass}
              />
              <datalist id="stockin-vehicles">
                {vehicles.map((v) => (
                  <option key={v.id} value={v.vehicle_number}>
                    {v.vehicle_type ? `${v.vehicle_type} - ` : ""}
                    {v.driver_name || "Driver"}
                  </option>
                ))}
              </datalist>
            </Field>

            <Field label="Vehicle Type">
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className={inputClass}
              >
                <option value="">Select Vehicle Type</option>
                <option value="Truck">Truck</option>
                <option value="Trailer">Trailer</option>
                <option value="Mazda">Mazda</option>
                <option value="Tractor">Tractor</option>
                <option value="Pickup">Pickup</option>
                <option value="Other">Other</option>
              </select>
            </Field>

            <Field label="Driver Name">
              <input
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                maxLength={100}
                placeholder="Enter driver name (optional)"
                className={inputClass}
              />
            </Field>

            <Field label="Driver Contact Number">
              <input
                type="tel"
                value={driverContact}
                onChange={(e) => setDriverContact(e.target.value)}
                maxLength={20}
                placeholder="03001234567 or +923001234567"
                autoComplete="tel"
                className={inputClass}
              />

              <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                Pakistani mobile number required if provided.
              </span>
            </Field>

            <div className="md:col-span-2">
              <Field label="Remarks">
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Additional notes (optional)"
                  className={inputClass}
                />
              </Field>
            </div>
          </div>
        </section>

        {selectedProduct && (
          <section className="rounded-xl border border-teal-200 bg-teal-50/60 p-4 text-xs text-slate-700 dark:border-teal-900/50 dark:bg-teal-950/30 dark:text-slate-300">
            <h2 className="mb-3 text-sm font-semibold text-teal-900 dark:text-teal-200">
              Stock In Summary
            </h2>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
              <p>
                <strong className="text-slate-900 dark:text-white">Company:</strong>{" "}
                {selectedCompany ? companyName(selectedCompany) : "Not selected"}
              </p>

              <p>
                <strong className="text-slate-900 dark:text-white">Product:</strong>{" "}
                {productName(selectedProduct)}
              </p>

              <p>
                <strong className="text-slate-900 dark:text-white">Packing:</strong>{" "}
                {productPackSize(selectedProduct)}
              </p>

              <p>
                <strong className="text-slate-900 dark:text-white">Stock Unit:</strong>{" "}
                {productStockUnit(selectedProduct)}
              </p>

              <p>
                <strong className="text-slate-900 dark:text-white">Incoming Quantity:</strong>{" "}
                {quantity && Number(quantity) > 0 && /^\d+$/.test(quantity)
                  ? `${quantity} ${productStockUnit(selectedProduct)}`
                  : "Not entered"}
              </p>

              <p>
                <strong className="text-slate-900 dark:text-white">Warehouse:</strong>{" "}
                {selectedWarehouse
                  ? warehouseName(selectedWarehouse)
                  : "Not selected"}
              </p>

              {challanNumber.trim() && (
                <p>
                  <strong className="text-slate-900 dark:text-white">Challan:</strong>{" "}
                  {challanNumber.trim()}
                </p>
              )}

              {vehicleNumber.trim() && (
                <p>
                  <strong className="text-slate-900 dark:text-white">Vehicle:</strong>{" "}
                  {vehicleNumber.trim()}
                </p>
              )}

              {driverName.trim() && (
                <p>
                  <strong className="text-slate-900 dark:text-white">Driver:</strong>{" "}
                  {driverName.trim()}
                </p>
              )}

              {driverContact.trim() && (
                <p>
                  <strong className="text-slate-900 dark:text-white">Driver Contact:</strong>{" "}
                  {driverContact.trim()}
                </p>
              )}
            </div>
          </section>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5 dark:border-slate-700">
          <button
            type="submit"
            disabled={saving || loading}
            className="rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-teal-600 dark:hover:bg-teal-500"
          >
            {saving ? "Saving..." : "Save Stock In"}
          </button>

          <button
            type="button"
            onClick={clearForm}
            disabled={saving}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Clear Form
          </button>
        </div>
      </form>
    </div>
  );
}
