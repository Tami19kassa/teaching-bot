import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signBunnyUrl } from "@/lib/bunny";
import { verifyTelegramWebApp } from "@/lib/telegramWebApp";

/**
 * GET /api/stream/[videoId]
 * Headers: { Authorization: "tma <initData>" }
 *
 * Called by the Telegram Mini App player page.
 * 1. Verifies the Telegram WebApp initData (proves the request comes from Telegram)
 * 2. Checks the user has access to the level this video belongs to
 * 3. Returns a signed Bunny URL (expires in 120 seconds) + user identity for watermark
 */
export async function GET(
  request: Request,
  { params }: { params: { videoId: string } }
) {
  // ── 1. Verify Telegram Mini App auth ──────────────────────────────────────
  const authHeader = request.headers.get("Authorization") ?? "";
  const initData = authHeader.replace("tma ", "");

  const telegramUser = verifyTelegramWebApp(initData);
  if (!telegramUser) {
    return NextResponse.json({ error: "Invalid Telegram auth" }, { status: 401 });
  }

  // ── 2. Load video + check access ──────────────────────────────────────────
  const videoDbId = parseInt(params.videoId, 10);
  if (isNaN(videoDbId)) {
    return NextResponse.json({ error: "Invalid video ID" }, { status: 400 });
  }

  const video = await prisma.video.findUnique({
    where: { id: videoDbId, isActive: true },
    include: { level: true },
  });

  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  const access = await prisma.userLevel.findFirst({
    where: {
      user: { telegramId: BigInt(telegramUser.id) },
      levelId: video.levelId,
    },
  });

  if (!access) {
    return NextResponse.json(
      { error: "Access denied. You are not enrolled in this level." },
      { status: 403 }
    );
  }

  // ── 3. Generate signed embed URL ─────────────────────────────────────────
  const embedUrl = signBunnyUrl(video.bunnyVideoId, 3600);

  // ── 4. Build watermark identity string ────────────────────────────────────
  const identity = telegramUser.username
    ? `@${telegramUser.username}`
    : `${telegramUser.first_name} · ID ${telegramUser.id}`;

  return NextResponse.json({
    embedUrl,
    title: video.title,
    levelName: video.level.name,
    watermark: identity,
  });
}
