"use client";

import { useState } from "react";
import { Plus, Copy, Check, ShieldCheck, ShieldOff, X } from "lucide-react";
import { inviteShopStaff, updateShopStaffRole, setShopStaffStatus, type InviteShopStaffInput } from "./staff-actions";

export interface StaffRow {
  id: string;
  shop_id: string;
  full_name: string;
  email: string;
  role: "owner" | "manager" | "staff";
  status: "active" | "suspended";
  created_at: string;
}

const ROLE_LABEL: Record<StaffRow["role"], string> = {
  owner: "Owner",
  manager: "Manager",
  staff: "Staff",
};

// Mirrors AdminsManager.tsx's shape (list + role select + suspend toggle +
// one-time temp-password reveal) but scoped to a single shop, since a shop
// owner shouldn't see or manage another shop's staff. Opened from a per-row
// "Staff" button in ShopsManager rather than living on its own page — there's
// no standalone staff list anyone needs across all shops yet.
export function StaffModal({
  shopId,
  shopName,
  initialStaff,
  canManage,
  onClose,
}: {
  shopId: string;
  shopName: string;
  initialStaff: StaffRow[];
  canManage: boolean;
  onClose: () => void;
}) {
  const [staff, setStaff] = useState(initialStaff);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<{ email: string; password: string } | null>(null);

  async function changeRole(id: string, role: StaffRow["role"]) {
    setBusyId(id);
    setError(null);
    const res = await updateShopStaffRole(id, role);
    setBusyId(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, role } : s)));
  }

  async function toggleStatus(row: StaffRow) {
    const next = row.status === "active" ? "suspended" : "active";
    if (next === "suspended" && !window.confirm(`Suspend ${row.full_name}? They'll immediately lose access to the redeem app.`)) return;
    setBusyId(row.id);
    setError(null);
    const res = await setShopStaffStatus(row.id, next);
    setBusyId(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    setStaff((prev) => prev.map((s) => (s.id === row.id ? { ...s, status: next } : s)));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Staff — {shopName}</h2>
            <p className="text-xs text-neutral-500">
              Logins for the Zabetna Shop app, used to verify redemptions and view reports for this shop.
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-900">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        {revealed && <TempPasswordReveal reveal={revealed} onDismiss={() => setRevealed(null)} />}

        <div className="overflow-hidden rounded-lg border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {staff.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-5 text-center text-neutral-500">
                    No staff yet — add one below.
                  </td>
                </tr>
              )}
              {staff.map((row) => (
                <tr key={row.id} className="border-t border-neutral-100">
                  <td className="px-3 py-2">
                    <div className="font-medium text-neutral-900">{row.full_name}</div>
                    <div className="text-xs text-neutral-500">{row.email}</div>
                  </td>
                  <td className="px-3 py-2">
                    {canManage ? (
                      <select
                        value={row.role}
                        disabled={busyId === row.id}
                        onChange={(e) => changeRole(row.id, e.target.value as StaffRow["role"])}
                        className="rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-neutral-900 disabled:opacity-50"
                      >
                        <option value="owner">Owner</option>
                        <option value="manager">Manager</option>
                        <option value="staff">Staff</option>
                      </select>
                    ) : (
                      <span className="text-neutral-600">{ROLE_LABEL[row.role]}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-neutral-200 text-neutral-600"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {canManage && (
                      <button
                        onClick={() => toggleStatus(row)}
                        disabled={busyId === row.id}
                        className="text-neutral-400 hover:text-neutral-900 disabled:opacity-50"
                        title={row.status === "active" ? "Suspend" : "Reactivate"}
                      >
                        {row.status === "active" ? <ShieldOff size={16} /> : <ShieldCheck size={16} />}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {canManage && (
          <button
            onClick={() => setAdding(true)}
            className="mt-4 flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            <Plus size={16} /> Add staff
          </button>
        )}

        {adding && (
          <AddStaffModal
            shopId={shopId}
            onClose={() => setAdding(false)}
            onCreated={(row, tempPassword) => {
              setStaff((prev) => [...prev, row]);
              setRevealed({ email: row.email, password: tempPassword });
              setAdding(false);
            }}
          />
        )}
      </div>
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
      // Clipboard API can be unavailable — the password is still shown below.
    }
  }

  return (
    <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-medium text-amber-900">
        Login created for {reveal.email}. This temporary password is shown once — copy it now and send it to them
        securely (not by email or text). They should sign in on the Shop app and change it right away.
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

function AddStaffModal({
  shopId,
  onClose,
  onCreated,
}: {
  shopId: string;
  onClose: () => void;
  onCreated: (row: StaffRow, tempPassword: string) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRow["role"]>("staff");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!fullName.trim() || !email.trim()) {
      setError("Name and email are both required.");
      return;
    }
    setSaving(true);
    setError(null);
    const input: InviteShopStaffInput = { shopId, fullName, email, role };
    const res = await inviteShopStaff(input);
    setSaving(false);
    if (res.error || !res.tempPassword || !res.staff) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    onCreated(res.staff as StaffRow, res.tempPassword);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">Add staff</h2>

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
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRow["role"])}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            >
              <option value="owner">Owner</option>
              <option value="manager">Manager</option>
              <option value="staff">Staff</option>
            </select>
          </div>
          <p className="text-xs text-neutral-400">
            This creates their real login immediately with a random temporary password, shown to you once after
            creation — there&apos;s no email invite flow yet, so you&apos;ll need to send it to them yourself. They
            should change it the moment they sign in on the Shop app.
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
            {saving ? "Creating…" : "Create staff login"}
          </button>
        </div>
      </div>
    </div>
  );
}
