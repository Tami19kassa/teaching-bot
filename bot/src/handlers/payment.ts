import { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { prisma } from "../lib/prisma";
import { SessionData } from "../lib/session";

type BotContext = Context & { session: SessionData };

/**
 * Callback: enroll:<levelId>
 * Triggered when user taps a level button. Starts the payment flow.
 */
export async function handleEnrollCallback(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery();

  const data = ctx.callbackQuery?.data ?? "";
  const levelId = parseInt(data.split(":")[1], 10);

  if (isNaN(levelId)) return;

  const telegramId = ctx.from!.id;

  // Check if already enrolled
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) },
    include: {
      userLevels: { where: { levelId } },
    },
  });

  if (user?.userLevels.length) {
    await ctx.reply("✅ You already have access to this level! Use /mylevels to watch.", {
      protect_content: true,
    });
    return;
  }

  // Check for existing pending payment
  const existingPending = await prisma.payment.findFirst({
    where: {
      user: { telegramId: BigInt(telegramId) },
      levelId,
      status: "PENDING",
    },
  });

  if (existingPending) {
    await ctx.reply(
      "⏳ You already have a pending payment for this level. Please wait for admin approval.",
      { protect_content: true }
    );
    return;
  }

  const level = await prisma.level.findUnique({ where: { id: levelId } });
  if (!level) return;

  // Store in session and prompt for receipt
  ctx.session.pendingLevelId = levelId;
  ctx.session.step = "awaiting_receipt";

  await ctx.reply(
    `💳 <b>Enroll in: ${level.name}</b>\n\n` +
      `Price: <b>$${level.price}</b>\n\n` +
      `Please make your payment and then send a <b>screenshot/photo</b> of your payment receipt here.\n\n` +
      `Our admin will review and approve your access within 24 hours.`,
    {
      parse_mode: "HTML",
      protect_content: true,
      reply_markup: new InlineKeyboard().text("❌ Cancel", "cancel_payment"),
    }
  );
}

/**
 * Callback: cancel_payment
 */
export async function handleCancelPayment(ctx: BotContext): Promise<void> {
  await ctx.answerCallbackQuery("Cancelled.");
  ctx.session.step = "idle";
  ctx.session.pendingLevelId = undefined;

  await ctx.reply("Payment cancelled. Use /levels to start over.", {
    protect_content: true,
  });
}

/**
 * Photo message handler — captures the receipt screenshot.
 * Only active when session.step === "awaiting_receipt".
 */
export async function handleReceiptPhoto(ctx: BotContext): Promise<void> {
  if (ctx.session.step !== "awaiting_receipt" || !ctx.session.pendingLevelId) {
    // Not in payment flow — ignore silently
    return;
  }

  const photos = ctx.message?.photo;
  if (!photos || photos.length === 0) return;

  // Telegram sends multiple sizes; take the largest (last in array)
  const bestPhoto = photos[photos.length - 1];
  const fileId = bestPhoto.file_id;
  const telegramId = ctx.from!.id;
  const levelId = ctx.session.pendingLevelId;

  try {
    // Upsert user (should already exist via middleware, but be safe)
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!user) {
      await ctx.reply("Something went wrong. Please send /start and try again.", {
        protect_content: true,
      });
      return;
    }

    // Save payment record
    await prisma.payment.create({
      data: {
        userId: user.id,
        levelId,
        telegramFileId: fileId,
        status: "PENDING",
      },
    });

    // Clear session
    ctx.session.step = "idle";
    ctx.session.pendingLevelId = undefined;

    await ctx.reply(
      "✅ <b>Receipt received!</b>\n\n" +
        "Your payment is under review. You'll receive a notification once approved.\n\n" +
        "This usually takes less than 24 hours.",
      {
        parse_mode: "HTML",
        protect_content: true,
      }
    );
  } catch (err) {
    console.error("[handleReceiptPhoto] Error:", err);
    await ctx.reply("❌ Failed to save your receipt. Please try again.", {
      protect_content: true,
    });
  }
}
