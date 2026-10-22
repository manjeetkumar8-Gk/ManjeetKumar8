import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { API } from "../config/api";
import { smartApiRequest } from "../offline/offlineApi";

type CustomerRecord = {
  id: number;
  customer_name: string;
  cnic?: string | null;
  phone?: string | null;
  address?: string | null;
  remarks?: string | null;
};

type ApiResult = {
  success?: boolean;
  message?: string;
  customers?: CustomerRecord[];
  customer?: CustomerRecord;
  data?: CustomerRecord[];
};

export default function Customer() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [cnic, setCnic] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [remarks, setRemarks] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);

  const getToken = () => {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("Your session has expired. Please log in again.");
    return token;
  };

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await smartApiRequest<ApiResult>(
        `/customers?search=${encodeURIComponent(search.trim())}`
      );

      const rows = Array.isArray(result.customers)
        ? result.customers
        : Array.isArray(result.data)
          ? result.data
          : [];

      setCustomers(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load customers.");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCustomers(), 250);
    return () => window.clearTimeout(timer);
  }, [loadCustomers]);

  function resetForm() {
    setCustomerName("");
    setCnic("");
    setPhone("");
    setAddress("");
    setRemarks("");
    setEditingId(null);
    setShowForm(false);
    setError("");
    setSuccess("");
  }

  function startEditing(customer: CustomerRecord) {
    setEditingId(customer.id);
    setCustomerName(customer.customer_name || "");
    setCnic(customer.cnic || "");
    setPhone(customer.phone || "");
    setAddress(customer.address || "");
    setRemarks(customer.remarks || "");
    setShowForm(true);
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanName = customerName.trim();
    if (!cleanName) {
      setError("Customer name is required.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const endpoint = editingId !== null ? `/customers/${editingId}` : `/customers`;
      const method = editingId !== null ? "PUT" : "POST";

      const result = await smartApiRequest<ApiResult>(endpoint, {
        method,
        body: JSON.stringify({
          customer_name: cleanName,
          cnic: cnic.trim() || undefined,
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
          remarks: remarks.trim() || undefined,
        }),
      });

      setSuccess(
        result.message ||
          (editingId !== null ? "Customer updated successfully." : "Customer created successfully.")
      );

      resetForm();
      await loadCustomers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save customer.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(customer: CustomerRecord) {
    const confirmed = window.confirm(
      `Are you sure you want to delete customer "${customer.customer_name}"?`
    );
    if (!confirmed) return;

    setDeletingId(customer.id);
    setError("");
    setSuccess("");

    try {
      const result = await smartApiRequest<ApiResult>(`/customers/${customer.id}`, {
        method: "DELETE",
      });

      if (editingId === customer.id) resetForm();
      setSuccess(result.message || "Customer deleted successfully.");
      await loadCustomers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete customer.");
    } finally {
      setDeletingId(null);
    }
  }

  const customerRows = useMemo(() => customers, [customers]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Customers
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage customer records, CNIC identification, and contact details.
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
          {showForm ? "✕ Close Form" : "+ Add Customer"}
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

      {success && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          {success}
        </div>
      )}

      {showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {editingId !== null ? "Edit Customer" : "Add New Customer"}
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Fields marked with * are required for customer records.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Customer Name *
              </label>
              <input
                required
                maxLength={150}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Full name of customer or firm"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                CNIC / Identification No.
              </label>
              <input
                maxLength={30}
                value={cnic}
                onChange={(e) => setCnic(e.target.value)}
                placeholder="e.g. 42101-1234567-1"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Phone Number
              </label>
              <input
                maxLength={30}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 03001234567"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Address
              </label>
              <input
                maxLength={255}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Village / Town / City address"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Remarks / Notes
              </label>
              <textarea
                rows={2}
                maxLength={500}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional customer notes or references"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 sm:col-span-2 pt-2">
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
                  : editingId !== null
                    ? "Save Changes"
                    : "Save Customer"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CUSTOMER TABLE */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-700">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Customer Directory ({customerRows.length})
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Registered customers and buyers on record.
            </p>
          </div>

          <div className="w-full sm:w-72">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, CNIC, phone..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3.5">Customer Name</th>
                <th className="px-5 py-3.5">CNIC</th>
                <th className="px-5 py-3.5">Phone</th>
                <th className="px-5 py-3.5">Address</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500 dark:text-slate-400">
                    Loading customers...
                  </td>
                </tr>
              ) : customerRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500 dark:text-slate-400">
                    {search ? "No customers match your search query." : "No customers found. Add a customer above."}
                  </td>
                </tr>
              ) : (
                customerRows.map((customer) => (
                  <tr
                    key={customer.id}
                    className="transition hover:bg-slate-50/70 dark:hover:bg-slate-700/40"
                  >
                    <td className="px-5 py-4 font-semibold text-slate-900 dark:text-slate-100">
                      {customer.customer_name}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {customer.cnic || "—"}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {customer.phone || "—"}
                    </td>
                    <td className="max-w-xs truncate px-5 py-4 text-slate-600 dark:text-slate-300" title={customer.address || ""}>
                      {customer.address || "—"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => startEditing(customer)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(customer)}
                          disabled={deletingId === customer.id}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-900/40"
                        >
                          {deletingId === customer.id ? "Deleting..." : "Delete"}
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
