"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface Payment {
  id: number;
  status: string;
  telegramFileId: string;
  createdAt: Date | string;
  adminNote: string | null;
  user: {
    telegramId: string;
    username: string | null;
    firstName: string;
    lastName: string | null;
  };
  level: {
    id: number;
    name: string;
    price: unknown;
  };
}

export default function PaymentCard({ payment }: { payment: Payment }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [imageError, setImageError] = useState(false);

  const receiptUrl = `/api/admin/receipt-proxy?fileId=${encodeURIComponent(
    payment.telegramFileId
  )}`;

  const userName =
    payment.user.username
      ? `@${payment.user.username}`
      : `${payment.user.firstName}${payment.user.lastName ? " " + payment.user.lastName : ""}`;

  async function handleApprove() {
    setLoading("approve");
    const res = await fetch(`/api/admin/payments/${payment.id}/approve`, {
      method: "POST",
    });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json();
      alert(`Error: ${data.error}`);
    }
    setLoading(null);
  }

  async function handleReject() {
    setLoading("reject");
    const res = await fetch(`/api/admin/payments/${payment.id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: rejectNote }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json();
      alert(`Error: ${data.error}`);
    }
    setLoading(null);
  }

  const isPending = payment.status === "PENDING";

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Receipt image */}
      <div className="relative bg-gray-100 h-48 flex items-center justify-center">
        {imageError ? (
          <div className="text-gray-400 text-center">
            <p className="text-3xl">🖼️</p>
            <p className="text-xs mt-1">Image unavailable</p>
          </div>
        ) : (
          <img
            src={receiptUrl}
            alt="Payment receipt"
            className="w-full h-full object-contain"
            onError={() => setImageError(true)}
          />
        )}
        <span
          className={`absolute top-2 right-2 text-xs font-semibold px-2 py-1 rounded-full ${
            payment.status === "PENDING"
              ? "bg-yellow-100 text-yellow-800"
              : payment.status === "APPROVED"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {payment.status}
        </span>
      </div>

      {/* Details */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="font-semibold text-gray-900">{userName}</p>
            <p className="text-xs text-gray-400">
              ID: {payment.user.telegramId}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-blue-700">
              {payment.level.name}
            </p>
            <p className="text-xs text-gray-400">
              ${String(payment.level.price)}
            </p>
          </div>
        </div>

        <p className="text-xs text-gray-400 mb-4">
          Submitted:{" "}
          {new Date(payment.createdAt).toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>

        {payment.adminNote && (
          <p className="text-xs text-gray-500 bg-gray-50 rounded p-2 mb-3">
            Note: {payment.adminNote}
          </p>
        )}

        {/* Actions */}
        {isPending && (
          <div className="space-y-2">
            {!showRejectForm ? (
              <div className="flex gap-2">
                <button
                  onClick={handleApprove}
                  disabled={loading !== null}
                  className="flex-1 bg-green-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {loading === "approve" ? "Approving..." : "✅ Approve"}
                </button>
                <button
                  onClick={() => setShowRejectForm(true)}
                  disabled={loading !== null}
                  className="flex-1 bg-red-50 text-red-700 text-sm font-medium py-2 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors border border-red-200"
                >
                  ❌ Reject
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Rejection reason (optional)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
                  rows={2}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleReject}
                    disabled={loading !== null}
                    className="flex-1 bg-red-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {loading === "reject" ? "Rejecting..." : "Confirm Reject"}
                  </button>
                  <button
                    onClick={() => setShowRejectForm(false)}
                    className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
