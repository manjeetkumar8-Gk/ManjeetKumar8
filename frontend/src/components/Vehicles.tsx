import { useEffect, useState, type FormEvent } from "react";

import { API } from "../config/api";

export type Vehicle = {
  id: number;
  vehicle_number: string;
  vehicle_type: string | null;
  driver_name: string | null;
  driver_contact: string | null;
  created_at?: string;
  updated_at?: string;
};

const emptyForm = {
  vehicle_number: "",
  vehicle_type: "",
  driver_name: "",
  driver_contact: "",
};

export default function Vehicles() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  async function request(path: string, options: RequestInit = {}) {
    const token = localStorage.getItem("token");

    if (!token) {
      throw new Error("Session expired. Please log in again.");
    }

    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.message || "Request failed.");
    }

    return result;
  }

  async function loadVehicles() {
    setLoading(true);
    setError("");

    try {
      const result = await request("/vehicles");
      setVehicles(Array.isArray(result.vehicles) ? result.vehicles : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load vehicles.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadVehicles();
  }, []);

  function handleChange(field: keyof typeof emptyForm, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.vehicle_number.trim()) {
      setError("Vehicle number is required.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const path = editingId === null ? "/vehicles" : `/vehicles/${editingId}`;

      const result = await request(path, {
        method: editingId === null ? "POST" : "PUT",
        body: JSON.stringify(form),
      });

      setMessage(
        result.message ||
          (editingId === null
            ? "Vehicle registered successfully."
            : "Vehicle updated successfully.")
      );
      setForm(emptyForm);
      setEditingId(null);
      await loadVehicles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save vehicle.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(vehicle: Vehicle) {
    setEditingId(vehicle.id);
    setForm({
      vehicle_number: vehicle.vehicle_number,
      vehicle_type: vehicle.vehicle_type || "",
      driver_name: vehicle.driver_name || "",
      driver_contact: vehicle.driver_contact || "",
    });
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(vehicle: Vehicle) {
    const confirmed = window.confirm(
      `Are you sure you want to delete vehicle "${vehicle.vehicle_number}"?`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      const result = await request(`/vehicles/${vehicle.id}`, {
        method: "DELETE",
      });

      setMessage(result.message || "Vehicle deleted successfully.");
      await loadVehicles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete vehicle.");
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setMessage("");
  }

  const filteredVehicles = vehicles.filter((v) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      v.vehicle_number.toLowerCase().includes(q) ||
      (v.vehicle_type && v.vehicle_type.toLowerCase().includes(q)) ||
      (v.driver_name && v.driver_name.toLowerCase().includes(q)) ||
      (v.driver_contact && v.driver_contact.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Vehicles & Drivers
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Register transport vehicle numbers, types, and driver contact details.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (editingId !== null) cancelEdit();
            else void loadVehicles();
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <span>↻</span> Refresh List
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

      {/* REGISTRATION FORM */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {editingId === null ? "Register New Vehicle" : "Edit Vehicle Details"}
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          These details are available as quick lookups during Stock In and Stock Out entry.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Vehicle Number *
            </label>
            <input
              required
              value={form.vehicle_number}
              onChange={(e) => handleChange("vehicle_number", e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              placeholder="e.g. ABC-1234"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Vehicle Type
            </label>
            <input
              value={form.vehicle_type}
              onChange={(e) => handleChange("vehicle_type", e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              placeholder="Truck, Trailer, Van, Pickup..."
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Driver Name
            </label>
            <input
              value={form.driver_name}
              onChange={(e) => handleChange("driver_name", e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              placeholder="Driver full name"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Driver Contact
            </label>
            <input
              value={form.driver_contact}
              onChange={(e) => handleChange("driver_contact", e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              placeholder="Phone number"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : editingId === null
                  ? "+ Register Vehicle"
                  : "Save Changes"}
            </button>

            {editingId !== null && (
              <button
                type="button"
                onClick={cancelEdit}
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* VEHICLES LIST */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-700">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Registered Vehicles ({filteredVehicles.length})
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              All vehicles on record for your shop.
            </p>
          </div>

          <div className="w-full sm:w-72">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vehicle or driver..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3.5">Vehicle Number</th>
                <th className="px-5 py-3.5">Type</th>
                <th className="px-5 py-3.5">Driver</th>
                <th className="px-5 py-3.5">Contact</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500 dark:text-slate-400">
                    Loading vehicles...
                  </td>
                </tr>
              ) : filteredVehicles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500 dark:text-slate-400">
                    {search ? "No vehicles match your search." : "No vehicles registered yet."}
                  </td>
                </tr>
              ) : (
                filteredVehicles.map((vehicle) => (
                  <tr
                    key={vehicle.id}
                    className="transition hover:bg-slate-50/70 dark:hover:bg-slate-700/40"
                  >
                    <td className="px-5 py-4 font-semibold text-slate-900 dark:text-slate-100">
                      {vehicle.vehicle_number}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {vehicle.vehicle_type || "—"}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {vehicle.driver_name || "—"}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {vehicle.driver_contact || "—"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(vehicle)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(vehicle)}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-900/40"
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
