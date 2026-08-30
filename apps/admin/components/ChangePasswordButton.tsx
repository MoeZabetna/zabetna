"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Available to every signed-in admin regardless of role/permissions — this
// is deliberately separate from the Admins tab (admins.manage-gated),
// since anyone should be able to change their own password. Re-verifies
// the current password via signInWithPassword before calling
// updateUser(), rather than trusting the existing session alone — a
// password change is exactly the kind of action a hijacked/left-open
// session shouldn't be able to do without proving the password again.
export function ChangePasswordButton({ email }: { email: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-sm text-neutral-500 hover:text-neutral-900">
        Change password
      </button>
      {open && <ChangePasswordModal email={email} onClose={() => setOpen(false)} />}
    </>
  );
}

function ChangePasswordModal({ email, onClose }: { email: string; onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }
    setSaving(true);
    const supabase = createClient();

    const { error: reauthError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (reauthError) {
      setSaving(false);
      setError("Current password is incorrect.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">Change password</h2>

        {done ? (
          <div>
            <p className="text-sm text-neutral-600">Your password has been updated.</p>
            <div className="mt-4 flex justify-end">
              <button
                onClick={onClose}
                className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">Current password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
                  autoComplete="current-password"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">Confirm new password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={onClose} className="rounded-md px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Update password"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
