import { smartApiRequest } from "../offline/offlineApi";
import { useEffect, useState, type FormEvent } from "react";

import { API } from "../config/api";

type Company = {
  id: number;
  company_name: string;
  status?: string;
};

type Product = {
  id: number;
  company_id: number;
  company_name?: string;
  product_name: string;
  product_size?: string | null;
  pack_size?: number | string | null;
  size_unit?: string | null;
  stock_unit?: string | null;
  product_code?: string | null;
  unit?: string | null;
  status?: string;
};

const emptyForm = {
  company_id: "",
  product_name: "",
  pack_size: "",
  size_unit: "ML",
  stock_unit: "Bottle",
  product_code: "",
};

const sizeUnits = ["ML", "Liter", "Gram", "KG", "MG", "Piece"];
const stockUnits = ["Bottle", "Packet", "Bag", "Piece", "Box", "Can", "Carton"];

async function apiRequest(path: string, options: RequestInit = {}) {
  return smartApiRequest(path, options);
}

function getPackSize(product: Product) {
  const size = product.pack_size ?? product.product_size ?? "";
  const sizeUnit = product.size_unit ?? "";
  return [size, sizeUnit].filter(Boolean).join(" ");
}

function getStockUnit(product: Product) {
  return product.stock_unit || product.unit || "—";
}

export default function Products() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [companyResult, productResult] = await Promise.all([
        apiRequest("/companies"),
        apiRequest(`/products?search=${encodeURIComponent(search)}`),
      ]);

      const companyRows = companyResult.companies ?? companyResult.data ?? [];
      const productRows = productResult.products ?? productResult.data ?? [];

      setCompanies(
        companyRows.filter((company: Company) => company.status !== "inactive")
      );
      setProducts(productRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [search]);

  function updateField(key: keyof typeof emptyForm, value: string) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setError("");
    setMessage("");
  }

  function startEdit(product: Product) {
    setEditingId(product.id);
    setForm({
      company_id: String(product.company_id || ""),
      product_name: product.product_name,
      pack_size: String(product.pack_size ?? product.product_size ?? ""),
      size_unit: product.size_unit || "ML",
      stock_unit: product.stock_unit || product.unit || "Bottle",
      product_code: product.product_code || "",
    });
    setShowForm(true);
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        company_id: Number(form.company_id),
        product_name: form.product_name.trim(),
        pack_size: Number(form.pack_size),
        size_unit: form.size_unit,
        stock_unit: form.stock_unit,
        product_code: form.product_code.trim() || undefined,
      };

      const path = editingId === null ? "/products" : `/products/${editingId}`;

      const result = await apiRequest(path, {
        method: editingId === null ? "POST" : "PUT",
        body: JSON.stringify(payload),
      });

      setMessage(
        result.message ||
          (editingId === null
            ? "Product created successfully."
            : "Product updated successfully.")
      );

      resetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save product.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(product: Product) {
    const nextStatus = product.status === "inactive" ? "active" : "inactive";

    const confirmed = window.confirm(
      `Are you sure you want to ${
        nextStatus === "active" ? "activate" : "deactivate"
      } "${product.product_name}" (${getPackSize(product)})?`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      if (nextStatus === "inactive") {
        await apiRequest(`/products/${product.id}`, { method: "DELETE" });
        setMessage(`Product "${product.product_name}" deactivated. Stock history was preserved.`);
      } else {
        await apiRequest(`/products/${product.id}`, {
          method: "PUT",
          body: JSON.stringify({
            company_id: product.company_id,
            product_name: product.product_name,
            pack_size: product.pack_size,
            size_unit: product.size_unit,
            stock_unit: product.stock_unit || product.unit,
            product_code: product.product_code,
            status: "active",
          }),
        });
        setMessage(`Product "${product.product_name}" activated successfully.`);
      }

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update product status.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Products & Packages
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage each package size and variation as an individual stock item.
          </p>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={() => {
            if (showForm) {
              resetForm();
            } else {
              resetForm();
              setShowForm(true);
            }
          }}
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50"
        >
          {showForm ? "✕ Close Form" : "+ Add Product"}
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

      {message && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          {message}
        </div>
      )}

      {showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {editingId === null ? "Add New Product" : "Edit Product Details"}
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Specify the manufacturer, product name, exact package volume/weight, and dispensing unit.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Company / Supplier *
              </label>
              <select
                required
                value={form.company_id}
                onChange={(event) => updateField("company_id", event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">Select company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.company_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Product Name *
              </label>
              <input
                required
                value={form.product_name}
                onChange={(event) => updateField("product_name", event.target.value)}
                placeholder="e.g. Urea, DAP, Insecticide X"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Pack Size (Number) *
              </label>
              <input
                required
                type="number"
                min="0.001"
                step="0.001"
                value={form.pack_size}
                onChange={(event) => updateField("pack_size", event.target.value)}
                placeholder="e.g. 50, 250, 500"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Size Unit *
              </label>
              <select
                required
                value={form.size_unit}
                onChange={(event) => updateField("size_unit", event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {sizeUnits.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Stock / Container Unit *
              </label>
              <select
                required
                value={form.stock_unit}
                onChange={(event) => updateField("stock_unit", event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {stockUnits.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Product Code / SKU
              </label>
              <input
                value={form.product_code}
                onChange={(event) => updateField("product_code", event.target.value)}
                placeholder="Optional SKU / Barcode"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 sm:col-span-2 lg:col-span-3 pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={resetForm}
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-10 items-center justify-center rounded-lg bg-teal-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingId === null
                    ? "Save Product"
                    : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PRODUCTS TABLE */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-700">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Product List ({products.length})
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Catalogued stock items with package specifications.
            </p>
          </div>

          <div className="w-full sm:w-72">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search product, size, company or code..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3.5">Product Name</th>
                <th className="px-5 py-3.5">Company</th>
                <th className="px-5 py-3.5">Pack Size</th>
                <th className="px-5 py-3.5">Stock Unit</th>
                <th className="px-5 py-3.5">Code</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500 dark:text-slate-400">
                    Loading products...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500 dark:text-slate-400">
                    {search ? "No products match your search." : "No products found."}
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr
                    key={product.id}
                    className="transition hover:bg-slate-50/70 dark:hover:bg-slate-700/40"
                  >
                    <td className="px-5 py-4 font-semibold text-slate-900 dark:text-slate-100">
                      {product.product_name}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {product.company_name || "—"}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {getPackSize(product) || "—"}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {getStockUnit(product)}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {product.product_code || "—"}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                          product.status !== "inactive"
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "border border-red-200 bg-red-50 text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300"
                        }`}
                      >
                        {product.status || "active"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(product)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => void toggleStatus(product)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                            product.status === "inactive"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-900/40"
                              : "border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-900/40"
                          }`}
                        >
                          {product.status === "inactive" ? "Activate" : "Deactivate"}
                        </button>
                      </div>
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
