import { prisma } from "@/lib/prisma";
import PaymentCard from "@/components/PaymentCard";

export const dynamic = "force-dynamic";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const status = (searchParams.status ?? "PENDING") as
    | "PENDING"
    | "APPROVED"
    | "REJECTED";

  const payments = await prisma.payment.findMany({
    where: { status },
    include: {
      user: true,
      level: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const tabs = [
    { label: "⏳ Pending", value: "PENDING" },
    { label: "✅ Approved", value: "APPROVED" },
    { label: "❌ Rejected", value: "REJECTED" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Payment Reviews</h1>
        <p className="text-gray-500 text-sm mt-1">
          Review and approve manual payment receipts
        </p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => (
          <a
            key={tab.value}
            href={`/admin/payments?status=${tab.value}`}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              status === tab.value
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {tab.label}
            {tab.value === "PENDING" && (
              <span className="ml-2 bg-red-100 text-red-700 text-xs px-1.5 py-0.5 rounded-full">
                {payments.length}
              </span>
            )}
          </a>
        ))}
      </div>

      {payments.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-lg font-medium">No {status.toLowerCase()} payments</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {payments.map((payment) => (
            <PaymentCard
              key={payment.id}
              payment={{
                ...payment,
                user: {
                  ...payment.user,
                  telegramId: payment.user.telegramId.toString(),
                },
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
