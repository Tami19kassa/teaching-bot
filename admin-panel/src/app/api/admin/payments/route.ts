import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

/**
 * GET /api/admin/payments
 * Returns all pending payments with user and level info.
 * Query param: ?status=PENDING|APPROVED|REJECTED (default: PENDING)
 */
export async function GET(request: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = (searchParams.get("status") ?? "PENDING") as
    | "PENDING"
    | "APPROVED"
    | "REJECTED";

  const payments = await prisma.payment.findMany({
    where: { status },
    include: {
      user: {
        select: {
          id: true,
          telegramId: true,
          username: true,
          firstName: true,
          lastName: true,
        },
      },
      level: {
        select: { id: true, name: true, price: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Serialize BigInt for JSON
  return NextResponse.json(
    payments.map((p) => ({
      ...p,
      user: { ...p.user, telegramId: p.user.telegramId.toString() },
    }))
  );
}
