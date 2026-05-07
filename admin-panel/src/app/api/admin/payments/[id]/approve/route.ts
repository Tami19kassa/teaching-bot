import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { sendTelegramMessage } from "@/lib/telegram";

/**
 * POST /api/admin/payments/[id]/approve
 *
 * 1. Marks the payment as APPROVED
 * 2. Creates a UserLevel record granting access
 * 3. Sends a Telegram notification to the user
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const paymentId = parseInt(params.id, 10);
  if (isNaN(paymentId)) {
    return NextResponse.json({ error: "Invalid payment ID" }, { status: 400 });
  }

  // Load payment with relations
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      user: true,
      level: true,
    },
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

  // Run approval in a transaction
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // 1. Update payment status
    await tx.payment.update({
      where: { id: paymentId },
      data: { status: "APPROVED" },
    });

    // 2. Grant level access (upsert to avoid duplicate key on double-click)
    await tx.userLevel.upsert({
      where: {
        userId_levelId: {
          userId: payment.userId,
          levelId: payment.levelId,
        },
      },
      update: {},
      create: {
        userId: payment.userId,
        levelId: payment.levelId,
      },
    });
  });

  // 3. Notify user via Telegram (outside transaction — network call)
  const adminPanelUrl = process.env.NEXT_PUBLIC_ADMIN_PANEL_URL ?? "";
  const watchUrl = `${adminPanelUrl}/watch/${payment.levelId}`;

  try {
    await sendTelegramMessage(
      payment.user.telegramId,
      `🎉 <b>Payment Approved!</b>\n\n` +
        `Your access to <b>${payment.level.name}</b> has been granted.\n\n` +
        `▶️ <a href="${watchUrl}">Click here to watch your videos</a>\n\n` +
        `You can also use /mylevels in the bot anytime.`
    );
  } catch (err) {
    // Log but don't fail the request — DB is already updated
    console.error("[approve] Telegram notification failed:", err);
  }

  return NextResponse.json({ success: true, message: "Payment approved and user notified." });
}
