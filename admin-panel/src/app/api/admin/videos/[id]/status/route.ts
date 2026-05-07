import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

/**
 * GET /api/admin/videos/[id]/status
 * Returns the current processing status of a video.
 * Polled by the LevelManager UI every 5 seconds.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const videoId = parseInt(params.id, 10);
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: {
      id: true,
      processingStatus: true,
      processingError: true,
      telegramFileId: true,
    },
  });

  if (!video) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(video);
}

/**
 * POST /api/admin/videos/[id]/status (retry failed video)
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const videoId = parseInt(params.id, 10);
  const video = await prisma.video.findUnique({ where: { id: videoId } });

  if (!video || video.processingStatus !== "FAILED") {
    return NextResponse.json({ error: "Video not found or not in FAILED state" }, { status: 400 });
  }

  // Reset to PENDING and re-trigger
  await prisma.video.update({
    where: { id: videoId },
    data: { processingStatus: "PENDING", processingError: null },
  });

  const baseUrl = process.env.NEXT_PUBLIC_ADMIN_PANEL_URL ?? "http://localhost:3000";
  fetch(`${baseUrl}/api/admin/videos/${videoId}/process`, {
    method: "POST",
    headers: { Cookie: request.headers.get("cookie") ?? "" },
  }).catch(console.error);

  return NextResponse.json({ message: "Retry started" });
}
