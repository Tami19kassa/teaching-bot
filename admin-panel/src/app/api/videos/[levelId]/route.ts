import { NextResponse } from "next/server";
import { verifyVideoToken } from "@/lib/videoToken";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/videos/[levelId]?token=<jwt>
 *
 * Returns the list of videos for a level, but ONLY if the JWT token
 * is valid and grants access to this specific level.
 *
 * The response includes signed embed URLs for Cloudflare Stream / Bunny.net.
 */
export async function GET(
  request: Request,
  { params }: { params: { levelId: string } }
) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const levelId = parseInt(params.levelId, 10);
  if (isNaN(levelId)) {
    return NextResponse.json({ error: "Invalid level ID" }, { status: 400 });
  }

  // Verify token
  const payload = await verifyVideoToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  // Token must be for this specific level
  if (payload.levelId !== levelId) {
    return NextResponse.json({ error: "Token not valid for this level" }, { status: 403 });
  }

  const videos = await prisma.video.findMany({
    where: { levelId, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      videoId: true,
      provider: true,
      sortOrder: true,
    },
  });

  // Build embed URLs — never expose raw video IDs without the embed wrapper
  const videosWithUrls = videos.map((v) => ({
    ...v,
    embedUrl: buildEmbedUrl(v.videoId, v.provider),
  }));

  return NextResponse.json(videosWithUrls);
}

function buildEmbedUrl(videoId: string, provider: string): string {
  if (provider === "CLOUDFLARE") {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID!;
    return `https://iframe.cloudflarestream.com/${videoId}?controls=true&preload=none`;
  }

  if (provider === "BUNNY") {
    const libraryId = process.env.BUNNY_LIBRARY_ID!;
    return `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}?autoplay=false&preload=false`;
  }

  return "";
}
