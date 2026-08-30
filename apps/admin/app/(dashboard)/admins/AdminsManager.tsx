"use client";

import { useState } from "react";
import { Plus, Copy, Check, ShieldCheck, ShieldOff } from "lucide-react";
import { inviteAdmin, updateAdminRole, setAdminStatus, type InviteAdminInput } from "./actions";
import { formatDate } from "@/lib/format";

interface RoleRef {
  name: string | null;
}

export interface AdminRow {
  id: string;
  full_name: string;
  email: string;
  status: "active" | "suspended";
  created_at: string;
  role_id: string;
  admin_roles: RoleRef | RoleRef[] | null;
}

function roleName(row: AdminRow): string {
  const r = Array.isArray(row.admin_roles) ? row.admin_roles[0] : row.admin_roles;
  return r?.name ?? "—";
}

export function AdminsManager({
  initialAdmins,
  roles,
  currentAdminId,
}: {
  initialAdmins: AdminRow[];
  roles: { id: string; name: string }[];
  currentAdminId: string;
}) {
  const [admins, setAdmins] = useState(initialAdmins);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<{ email: string; password: string } | null>(null);

  async function changeRole(id: string, roleId: string) {
    setBusyId(id);
    setError(null);
    const res = await updateAdminRole(id, roleId);
    setBusyId(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    setAdmins((prev) => prev.map((a) => (a.id === id ? { ...a, role_id: roleId } : a)));
  }

  async function toggleStatus(row: AdminRow) {
    const next = row.status === "active" ? "suspended" : "active";
    if (next === "suspended" && !window.confirm(`Suspend ${row.full_name}? They'll immediately lose access.`)) return;
    setBusyId(row.id);
    setError(null);
    const res = await setAdminStatus(row.id, next);
    setBusyId(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    setAdmins((prev) => prev.map((a) => (a.id === row.id ? { ...a, status: next } : a)));
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {revealed && <TempPasswordReveal reveal={revealed} onDismiss={() => setRevealed(null)} />}

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Joined</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {admins.map((row) => {
              const isSelf = row.id === currentAdminId;
              return (
                <tr key={row.id} className="border-t border-neutral-100">
                  <td className="px-4 py-3 font-medium text-neutral-900">
                    {row.full_name}
                    {isSelf && (
                      <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">
                        You
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{row.email}</td>
                  <td className="px-4 py-3">
                    {isSelf ? (
                      <span className="text-neutral-600">{roleName(row)}</span>
                    ) : (
                      <select
                        value={row.role_id}
                        disabled={busyId === row.id}
                        onChange={(e) => changeRole(row.id, e.target.value)}
                        className="rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-neutral-900 disabled:opacity-50"
                      >
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-neutral-200 text-neutral-600"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{formatDate(row.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    {!isSelf && (
                      <button
                        onClick={() => toggleStatus(row)}
                        disabled={busyId === row.id}
                        className="flex items-center gap-1 text-neutral-400 hover:text-neutral-900 disabled:opacity-50"
                        title={row.status === "active" ? "Suspend" : "Reactivate"}
                      >
                        {row.status === "active" ? <ShieldOff size={16} /> : <ShieldCheck size={16} />}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        onClick={() => setAdding(true)}
        className="mt-4 flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
      >
        <Plus size={16} /> Add admin
      </button>

      {adding && (
        <AddAdminModal
          roles={roles}
          onClose={() => setAdding(false)}
          onCreated={(adminUser, tempPassword) => {
            setAdmins((prev) => [...prev, adminUser]);
            setRevealed({ email: adminUser.email, password: tempPassword });
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}

function TempPasswordReveal({
  reveal,
  onDismiss,
}: {
  reveal: { email: string; password: string };
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(reveal.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (e.g. non-HTTPS/older browser) —
      // the password is still shown in the box, so this is non-fatal.
    }
  }

  return (
    <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-medium text-amber-900">
        Admin account created for {reveal.email}. This temporary password is shown once — copy it now and send it
        to them securely (not by email or text). They should sign in and change it right away from the account
        menu.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded-md border border-amber-200 bg-white px-3 py-2 text-sm">
          {reveal.password}
        </code>
        <button
          onClick={copy}
          className="flex items-center gap-1 rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <button onClick={onDismiss} className="mt-2 text-xs text-amber-700 underline hover:text-amber-900">
        I&apos;ve saved it — dismiss
      </button>
    </div>
  );
}

function AddAdminModal({
  roles,
  onClose,
  onCreated,
}: {
  roles: { id: string; name: string }[];
  onClose: () => void;
  onCreated: (adminUser: AdminRow, tempPassword: string) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!fullName.trim() || !email.trim() || !roleId) {
      setError("Name, email, and role are all required.");
      return;
    }
    setSaving(true);
    setError(null);
    const input: InviteAdminInput = { fullName, email, roleId };
    const res = await inviteAdmin(input);
    setSaving(false);
    if (res.error || !res.tempPassword || !res.adminUser) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    onCreated(res.adminUser as unknown as AdminRow, res.tempPassword);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">Add admin</h2>

        {error && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Full name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Role</label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-neutral-400">
            This creates their real login immediately with a random temporary password, shown to you once after
            creation — there&apos;s no email invite flow yet, so you&apos;ll need to send it to them yourself. They should
            change it the moment they sign in.
          </p>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create admin"}
          </button>
        </div>
      </div>
    </div>
  );
}
