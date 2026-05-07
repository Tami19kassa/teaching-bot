import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { getBunnyVideo } from "@/lib/bunny";

/**
 * POST /api/admin/levels/[id]/videos
 * Body: { title, description?, bunnyVideoId, sortOrder? }
 *
 * Links a Bunny Stream video GUID to a level.
 * The video must already be uploaded to Bunny via their dashboard or API.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const levelId = parseInt(params.id, 10);
  if (isNaN(levelId)) {
    return NextResponse.json({ error: "Invalid level ID" }, { status: 400 });
  }

  const body = await request.json();
  const { title, description, bunnyVideoId, sortOrder = 0 } = body;

  if (!title || !bunnyVideoId) {
    return NextResponse.json(
      { error: "title and bunnyVideoId are required" },
      { status: 400 }
    );
  }

  // Verify the video exists in Bunny
  const bunnyVideo = await getBunnyVideo(bunnyVideoId);
  if (!bunnyVideo) {
    return NextResponse.json(
      { error: "Video not found in Bunny Stream library. Check the GUID." },
      { status: 404 }
    );
  }

  const video = await prisma.video.create({
    data: {
      levelId,
      title,
      description: description ?? null,
      bunnyVideoId,
      sortOrder,
    },
  });

  return NextResponse.json(video, { status: 201 });
}

/** DELETE /api/admin/levels/[id]/videos?videoId=<db_id> */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const videoDbId = parseInt(searchParams.get("videoId") ?? "", 10);

  if (isNaN(videoDbId)) {
    return NextResponse.json({ error: "Invalid videoId" }, { status: 400 });
  }

  await prisma.video.delete({ where: { id: videoDbId } });
  return NextResponse.json({ success: true });
}
