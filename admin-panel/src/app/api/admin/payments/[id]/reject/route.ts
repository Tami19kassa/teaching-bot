import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { sendTelegramMessage } from "@/lib/telegram";

/**
 * POST /api/admin/payments/[id]/reject
 * Body: { note?: string }
 *
 * Marks payment as REJECTED and notifies the user.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const paymentId = parseInt(params.id, 10);
  if (isNaN(paymentId)) {
    return NextResponse.json({ error: "Invalid payment ID" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const note: string = body.note ?? "";

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { user: true, level: true },
  });

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  if (payment.status !== "PENDING") {
    return NextResponse.json(
      { error: `Payment is already ${payment.status}` },
      { status: 409 }
    );
  }

  await prisma.payment.update({
    where: { id: paymentId },
    data: { status: "REJECTED", adminNote: note || null },
  });

  try {
    const noteText = note ? `\n\nReason: ${note}` : "";
    await sendTelegramMessage(
      payment.user.telegramId,
      `❌ <b>Payment Rejected</b>\n\n` +
        `Your payment for <b>${payment.level.name}</b> was not approved.${noteText}\n\n` +
        `Please use /levels to try again or contact support.`
    );
  } catch (err) {
    console.error("[reject] Telegram notification failed:", err);
  }

  return NextResponse.json({ success: true });
}
