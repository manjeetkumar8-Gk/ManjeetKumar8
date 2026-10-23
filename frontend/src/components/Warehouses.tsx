import { useCallback, useEffect, useState, type FormEvent } from "react";
import { smartApiRequest } from "../offline/offlineApi";

type Warehouse = {
  id: number;
  warehouse_name: string;
  address: string | null;
  description: string | null;
  status: "active" | "inactive";
};

import { API as BASE_API } from "../config/api";
const API = `${BASE_API}/warehouses`;

export default function Warehouses() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);

  const getHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  });

  const loadWarehouses = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await smartApiRequest(
        `/warehouses?search=${encodeURIComponent(search)}`
      );

      const records = Array.isArray(data)
        ? data
        : data.warehouses ?? data.data ?? [];

      setWarehouses(records);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Cannot connect to server. Please check your backend connection."
      );
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void loadWarehouses();
  }, [loadWarehouses]);

  const resetForm = () => {
    setName("");
    setAddress("");
    setDescription("");
    setStatus("active");
    setEditingId(null);
    setShowForm(false);
    setError("");
    setMessage("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    const payload = {
      warehouse_name: name.trim(),
      address: address.trim(),
      description: description.trim(),
      status,
    };

    if (!payload.warehouse_name) {
      setError("Warehouse name is required.");
      return;
    }

    setSaving(true);

    try {
      const endpoint = editingId === null ? "/warehouses" : `/warehouses/${editingId}`;
      const data = await smartApiRequest(endpoint, {
        method: editingId === null ? "POST" : "PUT",
        body: JSON.stringify(payload),
      });

      setMessage(
        editingId === null
          ? "Warehouse created successfully."
          : "Warehouse updated successfully."
      );

      resetForm();
      await loadWarehouses();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save warehouse."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (warehouse: Warehouse) => {
    setEditingId(warehouse.id);
    setName(warehouse.warehouse_name);
    setAddress(warehouse.address ?? "");
    setDescription(warehouse.description ?? "");
    setStatus(warehouse.status);
    setShowForm(true);
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (warehouse: Warehouse) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete warehouse "${warehouse.warehouse_name}"?`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");
    setSaving(true);

    try {
      const data = await smartApiRequest(`/warehouses/${warehouse.id}`, {
        method: "DELETE",
      });

      setMessage("Warehouse deleted successfully.");
      if (editingId === warehouse.id) resetForm();
      await loadWarehouses();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete warehouse."
      );
    } finally {
      setSaving(false);
    }
  };

  const filteredWarehouses = warehouses.filter((w) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      w.warehouse_name.toLowerCase().includes(q) ||
      (w.address && w.address.toLowerCase().includes(q)) ||
      (w.description && w.description.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Warehouses & Locations
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Add storage facilities and manage inventory locations.
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
          {showForm ? "✕ Close Form" : "+ Add Warehouse"}
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
            {editingId === null ? "Add New Warehouse" : "Edit Warehouse Details"}
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Storage names must be unique within your shop account.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Warehouse Name *
                </label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Main Godown, Sanghar Road"
                  required
                  maxLength={150}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Address / Location
                </label>
                <input
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="Street or area address"
                  maxLength={255}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value as "active" | "inactive")
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Description / Remarks
                </label>
                <input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Optional details, contact person or notes"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
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
                    ? "Save Warehouse"
                    : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* WAREHOUSES TABLE */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-700">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Warehouse List ({filteredWarehouses.length})
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Storage locations available for stock transactions.
            </p>
          </div>

          <div className="w-full sm:w-72">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search warehouse..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3.5">Warehouse Name</th>
                <th className="px-5 py-3.5">Address</th>
                <th className="px-5 py-3.5">Description</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {loading && warehouses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500 dark:text-slate-400">
                    Loading warehouses...
                  </td>
                </tr>
              ) : filteredWarehouses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500 dark:text-slate-400">
                    {search ? "No warehouses match your search." : "No warehouses found. Please add a warehouse above."}
                  </td>
                </tr>
              ) : (
                filteredWarehouses.map((warehouse) => (
                  <tr
                    key={warehouse.id}
                    className="transition hover:bg-slate-50/70 dark:hover:bg-slate-700/40"
                  >
                    <td className="px-5 py-4 font-semibold text-slate-900 dark:text-slate-100">
                      {warehouse.warehouse_name}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {warehouse.address || "—"}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {warehouse.description || "—"}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                          warehouse.status === "active"
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "border border-red-200 bg-red-50 text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300"
                        }`}
                      >
                        {warehouse.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(warehouse)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(warehouse)}
                          disabled={saving}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-900/40"
                        >
                          Delete
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
