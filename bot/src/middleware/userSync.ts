import { Context, NextFunction } from "grammy";
import { prisma } from "../lib/prisma";

/**
 * Middleware: upsert the Telegram user into our DB on every interaction.
 * This ensures we always have up-to-date user info without a separate /start gate.
 */
export async function userSyncMiddleware(
  ctx: Context,
  next: NextFunction
): Promise<void> {
  const from = ctx.from;
  if (!from) return next();

  try {
    await prisma.user.upsert({
      where: { telegramId: BigInt(from.id) },
      update: {
        username: from.username ?? null,
        firstName: from.first_name,
        lastName: from.last_name ?? null,
      },
      create: {
        telegramId: BigInt(from.id),
        username: from.username ?? null,
        firstName: from.first_name,
        lastName: from.last_name ?? null,
      },
    });
  } catch (err) {
    console.error("[userSync] DB error:", err);
    // Don't block the user — just log and continue
  }

  return next();
}
