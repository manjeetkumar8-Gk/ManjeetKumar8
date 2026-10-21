import { useEffect, useState, type FormEvent } from 'react';
import { API } from "../config/api";

type UserRecord = {
  id: number;
  name: string;
  username: string;
  email: string | null;
  role: string;
  shop_id: number | null;
  is_active: boolean;
  created_at?: string;
};

const roles = [
  'Shop Admin',
  'Stock Operator',
  'Viewer',
];

export default function Users() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Stock Operator');

  const token = localStorage.getItem('token') || '';

  async function request(
    path: string,
    options: RequestInit = {},
  ) {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.success === false) {
      throw new Error(result.message || 'Request failed');
    }

    return result;
  }

  async function loadUsers() {
    setLoading(true);
    setError('');

    try {
      const result = await request('/users');
      setUsers(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  function resetForm() {
    setName('');
    setUsername('');
    setEmail('');
    setPassword('');
    setRole('Stock Operator');
    setEditingId(null);
  }

  function startEdit(user: UserRecord) {
    setEditingId(user.id);
    setName(user.name);
    setUsername(user.username);
    setEmail(user.email || '');
    setRole(user.role);
    setPassword('');
    setMessage('');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      if (editingId !== null) {
        await request(`/users/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: name.trim(),
            username: username.trim(),
            email: email.trim() || null,
            role,
          }),
        });

        if (password.trim()) {
          await request(`/users/${editingId}/password`, {
            method: 'PATCH',
            body: JSON.stringify({ password }),
          });
        }

        setMessage('User updated successfully.');
      } else {
        if (password.length < 8) {
          setError('Password must be at least 8 characters.');
          return;
        }

        await request('/users', {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
            username: username.trim(),
            email: email.trim() || null,
            password,
            role,
          }),
        });

        setMessage('User created successfully.');
      }

      resetForm();
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(user: UserRecord) {
    setError('');
    setMessage('');

    try {
      await request(`/users/${user.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !user.is_active }),
      });

      setMessage(
        `${user.username} is now ${user.is_active ? 'inactive' : 'active'}.`,
      );

      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed');
    }
  }

  const filteredUsers = users.filter((user) =>
    [
      user.name,
      user.username,
      user.email || '',
      user.role,
      String(user.shop_id ?? ''),
    ]
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-800 dark:bg-slate-950 dark:text-slate-100 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold md:text-3xl">User Management</h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage users, roles and account status.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadUsers()}
            className="rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Refresh
          </button>
        </header>

        {error && (
          <div role="alert" className="rounded-lg bg-red-100 p-3 text-red-800">
            {error}
          </div>
        )}

        {message && (
          <div role="status" className="rounded-lg bg-green-100 p-3 text-green-800">
            {message}
          </div>
        )}

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-4 text-lg font-semibold">
            {editingId === null ? 'Create User' : `Edit User #${editingId}`}
          </h2>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span>Name *</span>
              <input
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-transparent p-2.5 dark:border-slate-700"
                placeholder="Full name"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span>Username *</span>
              <input
                required
                maxLength={50}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-transparent p-2.5 dark:border-slate-700"
                placeholder="Unique username"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-transparent p-2.5 dark:border-slate-700"
                placeholder="user@example.com"
              />
            </label>

            <label className="space-y-1 text-sm">
              <span>
                Password {editingId === null ? '*' : '(leave blank to keep current)'}
              </span>
              <input
                type="password"
                required={editingId === null}
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-transparent p-2.5 dark:border-slate-700"
                placeholder={editingId === null ? 'Minimum 8 characters' : 'Optional new password'}
              />
            </label>

            <label className="space-y-1 text-sm">
              <span>Role *</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900"
              >
                {roles.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>

            <div className="flex flex-wrap items-end gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingId === null ? 'Create User' : 'Save Changes'}
              </button>

              {editingId !== null && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-slate-300 px-5 py-2.5 dark:border-slate-700"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5">
            <h2 className="text-lg font-semibold">Users ({filteredUsers.length})</h2>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              className="w-full rounded-lg border border-slate-300 bg-transparent p-2.5 sm:w-72 dark:border-slate-700"
            />
          </div>

          {loading ? (
            <p className="p-6 text-slate-500">Loading users...</p>
          ) : filteredUsers.length === 0 ? (
            <p className="p-6 text-slate-500">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <tr>
                    <th className="p-3">User</th>
                    <th className="p-3">Username</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Shop</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="p-3">
                        <div className="font-medium">{user.name}</div>
                        <div className="text-xs text-slate-500">{user.email || 'No email'}</div>
                      </td>
                      <td className="p-3">{user.username}</td>
                      <td className="p-3">{user.role}</td>
                      <td className="p-3">{user.shop_id ?? '—'}</td>
                      <td className="p-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          user.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="space-x-2 whitespace-nowrap p-3">
                        <button
                          type="button"
                          onClick={() => startEdit(user)}
                          className="text-blue-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleStatus(user)}
                          className="text-amber-600 hover:underline"
                        >
                          {user.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}