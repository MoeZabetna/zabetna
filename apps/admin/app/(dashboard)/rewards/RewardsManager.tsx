"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { confirmRewardRequest, rejectRewardRequest } from "./actions";
import { formatUsd, formatDateTime } from "@/lib/format";

interface ProfileRef {
  full_name: string | null;
}

export interface RewardRequestRow {
  id: string;
  user_id: string;
  points_requested: number;
  /** Gross value of the points, before the service fee. */
  usd_amount: number;
  service_fee_usd: number;
  /** What must actually be transferred via Wish Money. */
  net_usd_amount: number;
  phone_number: string;
  status: "pending" | "confirmed" | "rejected";
  requested_at: string;
  processed_at: string | null;
  admin_note: string | null;
  profiles: ProfileRef | ProfileRef[] | null;
}

const STATUS_STYLE: Record<RewardRequestRow["status"], string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  rejected: "bg-neutral-200 text-neutral-600",
};

function userName(row: RewardRequestRow): string {
  const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return p?.full_name ?? "—";
}

export function RewardsManager({
  initialRows,
  canManage,
}: {
  initialRows: RewardRequestRow[];
  canManage: boolean;
}) {
  const [rows, setRows] = useState(initialRows);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function confirm(id: string) {
    const row = rows.find((r) => r.id === id);
    // Name the exact figure and destination in the prompt. This is the last
    // step before a real transfer is recorded as sent, and the amount to
    // send is the NET one — quoting it here makes an over-payment of the
    // gross much harder to make by accident.
    const detail = row
      ? `\n\nSend ${formatUsd(row.net_usd_amount)} to ${row.phone_number}.\n(${row.points_requested} points = ${formatUsd(
          row.usd_amount
        )}, less the ${formatUsd(row.service_fee_usd)} service fee.)`
      : "";
    if (
      !window.confirm(
        `Confirm this payout? Only do this after the Wish Money transfer has actually been sent.${detail}`
      )
    )
      return;
    setBusyId(id);
    setError(null);
    const res = await confirmRewardRequest(id);
    setBusyId(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "confirmed", processed_at: new Date().toISOString() } : r))
    );
  }

  async function reject(id: string) {
    const note = window.prompt("Reason for rejecting this request (shown in the admin log, optional):", "");
    if (note === null) return; // cancelled
    setBusyId(id);
    setError(null);
    const res = await rejectRewardRequest(id, note);
    setBusyId(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: "rejected", admin_note: note || null, processed_at: new Date().toISOString() } : r
      )
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">User</th>
              <th className="px-4 py-2 font-medium">Requested</th>
              <th className="px-4 py-2 font-medium text-right">Points</th>
              <th className="px-4 py-2 font-medium text-right">Points value</th>
              <th className="px-4 py-2 font-medium text-right">Fee</th>
              <th className="px-4 py-2 font-medium text-right">Send this amount</th>
              <th className="px-4 py-2 font-medium">Wish Money number</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-neutral-500">
                  No requests here.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-neutral-100 align-top">
                <td className="px-4 py-3 font-medium text-neutral-900">{userName(r)}</td>
                <td className="px-4 py-3 text-neutral-600">{formatDateTime(r.requested_at)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-900">{r.points_requested}</td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-500">{formatUsd(r.usd_amount)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-500">
                  -{formatUsd(r.service_fee_usd)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-neutral-900">
                  {formatUsd(r.net_usd_amount)}
                </td>
                <td className="px-4 py-3 tabular-nums text-neutral-600">{r.phone_number}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[r.status]}`}>
                    {r.status}
                  </span>
                  {r.processed_at && (
                    <div className="mt-1 text-xs text-neutral-400">{formatDateTime(r.processed_at)}</div>
                  )}
                  {r.admin_note && <div className="mt-1 text-xs text-neutral-500">{r.admin_note}</div>}
                </td>
                <td className="px-4 py-3 text-right">
                  {r.status === "pending" && canManage && (
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => confirm(r.id)}
                        disabled={busyId === r.id}
                        className="flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        <CheckCircle2 size={14} />
                        Confirm
                      </button>
                      <button
                        onClick={() => reject(r.id)}
                        disabled={busyId === r.id}
                        className="flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100 disabled:opacity-50"
                      >
                        <XCircle size={14} />
                        Reject
                      </button>
                    </div>
                  )}
                  {r.status === "pending" && !canManage && (
                    <span className="text-xs text-neutral-400">View only</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
