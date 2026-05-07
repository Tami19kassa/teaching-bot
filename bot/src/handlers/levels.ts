import { Context, InlineKeyboard } from "grammy";
import { InputFile } from "grammy";
import { prisma } from "../lib/prisma";
import { signBunnyDownloadUrl } from "../lib/bunny";

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
 * /mylevels — Show enrolled levels with video buttons.
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

    const keyboard = new InlineKeyboard();
    for (const video of videos) {
      keyboard.text(`▶️ ${video.title}`, `watch:${video.id}`).row();
    }

    await ctx.reply(
      `📘 <b>${level.name}</b>\n\n` +
        `${videos.length} video${videos.length !== 1 ? "s" : ""} available.\n` +
        `Select a video to watch:`,
      {
        parse_mode: "HTML",
        reply_markup: keyboard,
        protect_content: true,
      }
    );
  }
}

/**
 * Callback: watch:<videoId>
 * Downloads video from Bunny and sends it as a native Telegram video
 * with protect_content: true — blocks screenshots AND screen recording.
 */
export async function handleWatchCallback(ctx: Context): Promise<void> {
  await ctx.answerCallbackQuery();

  const data = ctx.callbackQuery?.data ?? "";
  const videoId = parseInt(data.split(":")[1], 10);
  if (isNaN(videoId)) return;

  const telegramId = ctx.from!.id;

  // Load video
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    include: { level: true },
  });

  if (!video) {
    await ctx.reply("Video not found.", { protect_content: true });
    return;
  }

  // Verify access
  const access = await prisma.userLevel.findFirst({
    where: {
      user: { telegramId: BigInt(telegramId) },
      levelId: video.levelId,
    },
  });

  if (!access) {
    await ctx.reply("🚫 You don't have access to this video.", {
      protect_content: true,
    });
    return;
  }

  // Get user info for watermark message
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) },
    select: { firstName: true, username: true },
  });

  const identity = user?.username
    ? `@${user.username}`
    : `${user?.firstName ?? "User"} (ID: ${telegramId})`;

  // Send loading message
  const loadingMsg = await ctx.reply("⏳ Loading your video...", {
    protect_content: true,
  });

  try {
    // Generate a signed download URL from Bunny (direct MP4, not embed)
    const downloadUrl = signBunnyDownloadUrl(video.bunnyVideoId);

    // Send watermark notice
    await ctx.reply(
      `🔒 <b>Licensed Content</b>\n\n` +
        `This video is licensed exclusively to <b>${identity}</b>.\n` +
        `Sharing or redistributing is strictly prohibited.`,
      { parse_mode: "HTML", protect_content: true }
    );

    // Stream the video directly from Bunny URL to Telegram
    // Telegram downloads it server-side — no temp file needed on our server
    await ctx.replyWithVideo(new InputFile({ url: downloadUrl }), {
      caption: `📹 <b>${video.title}</b>\n📘 ${video.level.name}`,
      parse_mode: "HTML",
      protect_content: true,   // ← blocks screenshots AND screen recording
      supports_streaming: true,
    });

    // Delete the loading message
    await ctx.api.deleteMessage(ctx.chat!.id, loadingMsg.message_id);

  } catch (err) {
    console.error("[watch] Error sending video:", err);
    await ctx.api.editMessageText(
      ctx.chat!.id,
      loadingMsg.message_id,
      "❌ Failed to load video. Please try again."
    );
  }
}
