import { Context, InlineKeyboard } from "grammy";
import { prisma } from "../lib/prisma";

const ADMIN_PANEL_URL = process.env.ADMIN_PANEL_URL!;

/**
 * /levels — Show all active levels with inline buttons to purchase.
 */
export async function handleLevels(ctx: Context): Promise<void> {
  const levels = await prisma.level.findMany({
    where: { isActive: true },
    orderBy: { id: "asc" },
  });

  if (levels.length === 0) {
    await ctx.reply("No levels available yet. Check back soon!", {
      protect_content: true,
    });
    return;
  }

  const keyboard = new InlineKeyboard();
  for (const level of levels) {
    keyboard.text(`📘 ${level.name} — $${level.price}`, `enroll:${level.id}`).row();
  }

  await ctx.reply(
    "🎓 <b>Available Learning Levels</b>\n\nChoose a level to enroll:",
    {
      parse_mode: "HTML",
      reply_markup: keyboard,
      protect_content: true,
    }
  );
}

/**
 * /mylevels — Show enrolled levels with video list buttons.
 */
export async function handleMyLevels(ctx: Context): Promise<void> {
  const telegramId = ctx.from!.id;

  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) },
    include: {
      userLevels: {
        include: {
          level: {
            include: {
              videos: {
                where: { isActive: true },
                orderBy: { sortOrder: "asc" },
                select: { id: true, title: true },
              },
            },
          },
        },
      },
    },
  });

  if (!user || user.userLevels.length === 0) {
    await ctx.reply(
      "You haven't been approved for any levels yet.\n\nUse /levels to enroll.",
      { protect_content: true }
    );
    return;
  }

  for (const ul of user.userLevels) {
    const level = ul.level;
    const videos = level.videos;

    if (videos.length === 0) {
      await ctx.reply(
        `📘 <b>${level.name}</b>\n\nNo videos available yet. Check back soon!`,
        { parse_mode: "HTML", protect_content: true }
      );
      continue;
    }

    // One Mini App button per video
    const keyboard = new InlineKeyboard();
    for (const video of videos) {
      // web_app opens the Next.js player page inside Telegram
      keyboard
        .webApp(
          `▶️ ${video.title}`,
          `${ADMIN_PANEL_URL}/player/${video.id}`
        )
        .row();
    }

    await ctx.reply(
      `📘 <b>${level.name}</b>\n\n` +
        `${videos.length} video${videos.length !== 1 ? "s" : ""} available.\n` +
        `Tap to watch — videos open securely inside Telegram:`,
      {
        parse_mode: "HTML",
        reply_markup: keyboard,
        protect_content: true,
      }
    );
  }
}

/**
 * Callback: watch:<videoId>  (kept for backwards compatibility)
 * Now redirects users to use /mylevels which has Mini App buttons.
 */
export async function handleWatchCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();
  await ctx.reply(
    "Use /mylevels to access your videos.",
    { protect_content: true }
  );
}
