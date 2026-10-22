import { smartApiRequest } from "../offline/offlineApi";
import { useEffect, useState, type FormEvent } from "react";

type Company = {
  id: number;
  company_name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

import { API } from "../config/api";

function normalizeCompanyName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function Companies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const token = localStorage.getItem("token");

  const resetForm = () => {
    setCompanyName("");
    setContactPerson("");
    setPhone("");
    setEmail("");
    setAddress("");
    setEditingCompanyId(null);
    setShowForm(false);
    setError("");
    setMessage("");
  };

  const fetchCompanies = async () => {
    try {
      const data = await smartApiRequest("/companies");

      setCompanies(data.companies || data.data || []);
    } catch (err) {
      console.error("Fetch companies error:", err);
      setError("Cannot connect to server. Please check backend connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCompanies();
  }, []);

  const handleEdit = (company: Company) => {
    setEditingCompanyId(company.id);
    setCompanyName(company.company_name);
    setContactPerson(company.contact_person || "");
    setPhone(company.phone || "");
    setEmail(company.email || "");
    setAddress(company.address || "");
    setShowForm(true);
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setMessage("");

    const cleanedName = companyName.trim().replace(/\s+/g, " ");

    if (!cleanedName) {
      setError("Company name is required.");
      return;
    }

    const normalizedName = normalizeCompanyName(cleanedName);

    const duplicateCompany = companies.find(
      (company) =>
        normalizeCompanyName(company.company_name) === normalizedName &&
        company.id !== editingCompanyId
    );

    if (duplicateCompany) {
      setError(
        `Company "${duplicateCompany.company_name}" already exists. Duplicate company cannot be added.`
      );
      return;
    }

    setSaving(true);

    try {
      const isEditing = editingCompanyId !== null;

      const endpoint = isEditing
        ? `/companies/${editingCompanyId}`
        : "/companies";

      const data = await smartApiRequest(endpoint, {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify({
          company_name: cleanedName,
          contact_person: contactPerson.trim(),
          phone: phone.trim(),
          email: email.trim(),
          address: address.trim(),
        }),
      });

      setMessage(
        isEditing
          ? "Company updated successfully."
          : "Company created successfully."
      );

      resetForm();
      await fetchCompanies();
    } catch (err) {
      console.error("Save company error:", err);
      setError("Cannot connect to server. Please check backend connection.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (company: Company) => {
    const activating = company.status !== "active";
    const newStatus = activating ? "active" : "inactive";

    const confirmed = window.confirm(
      activating
        ? `Are you sure you want to activate "${company.company_name}"?`
        : `Are you sure you want to deactivate "${company.company_name}"?`
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API}/companies/${company.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          company_name: company.company_name,
          contact_person: company.contact_person || "",
          phone: company.phone || "",
          email: company.email || "",
          address: company.address || "",
          status: newStatus,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Unable to update company status");
        return;
      }

      setMessage(
        activating
          ? "Company activated successfully."
          : "Company deactivated successfully."
      );

      await fetchCompanies();
    } catch (err) {
      console.error("Toggle company status error:", err);
      setError("Cannot connect to server. Please check backend connection.");
    } finally {
      setSaving(false);
    }
  };

  const filteredCompanies = companies.filter((c) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      c.company_name.toLowerCase().includes(q) ||
      (c.contact_person && c.contact_person.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Companies & Suppliers
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage manufacturer and supplier profiles for product cataloguing.
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
          {showForm ? "✕ Close Form" : "+ Add Company"}
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
            {editingCompanyId !== null ? "Edit Company" : "Add New Company"}
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Fill in the company details. Company names are case-insensitive.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Company Name *
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                placeholder="e.g. Engro, FFC, Bayer"
                required
              />
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                Company names are case-insensitive (e.g. FFC, ffc, and Ffc are treated as identical).
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Contact Person
              </label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                placeholder="Contact person full name"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Phone Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                placeholder="e.g. 03001234567"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                placeholder="company@example.com"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Business Address
              </label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                placeholder="Physical address or warehouse location"
                rows={2}
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
                  : editingCompanyId !== null
                    ? "Save Changes"
                    : "Save Company"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* COMPANIES LIST */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-800/80">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-700">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Company List ({filteredCompanies.length})
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              All registered companies and suppliers.
            </p>
          </div>

          <div className="w-full sm:w-72">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search companies..."
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3.5">Company</th>
                <th className="px-5 py-3.5">Contact Person</th>
                <th className="px-5 py-3.5">Phone</th>
                <th className="px-5 py-3.5">Email</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500 dark:text-slate-400">
                    Loading companies...
                  </td>
                </tr>
              ) : filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500 dark:text-slate-400">
                    {search ? "No companies match your search." : "No companies found."}
                  </td>
                </tr>
              ) : (
                filteredCompanies.map((company) => (
                  <tr
                    key={company.id}
                    className="transition hover:bg-slate-50/70 dark:hover:bg-slate-700/40"
                  >
                    <td className="px-5 py-4 font-semibold text-slate-900 dark:text-slate-100">
                      {company.company_name}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {company.contact_person || "—"}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {company.phone || "—"}
                    </td>
                    <td className="px-5 py-4 text-slate-600 dark:text-slate-300">
                      {company.email || "—"}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                          company.status === "active"
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "border border-red-200 bg-red-50 text-red-700 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-300"
                        }`}
                      >
                        {company.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleEdit(company)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void handleToggleStatus(company)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                            company.status === "active"
                              ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-900/40"
                              : "border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-900/40"
                          }`}
                        >
                          {company.status === "active" ? "Deactivate" : "Activate"}
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

export default Companies;
