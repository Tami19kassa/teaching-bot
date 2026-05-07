import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import { exec } from "child_process";
import { promisify } from "util";
import { createReadStream, statSync, unlinkSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const execAsync = promisify(exec);

const BOT_TOKEN = process.env.BOT_TOKEN!;
// A dedicated private Telegram channel/chat to upload videos to.
// The bot must be an admin of this chat.
// Use a private channel and copy its numeric ID (e.g. -1001234567890)
const UPLOAD_CHAT_ID = process.env.TELEGRAM_UPLOAD_CHAT_ID!;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

/**
 * POST /api/admin/videos/[id]/process
 *
 * Full pipeline:
 * 1. Mark video as PROCESSING
 * 2. Download via yt-dlp to a temp file (max 2GB — Telegram bot limit)
 * 3. Upload to a private Telegram channel using sendVideo
 * 4. Store the returned file_id in the DB
 * 5. Mark as READY (or FAILED on error)
 *
 * Requires yt-dlp to be installed on the server:
 *   Windows: winget install yt-dlp  OR  pip install yt-dlp
 *   Linux:   pip install yt-dlp
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const videoId = parseInt(params.id, 10);
  if (isNaN(videoId)) {
    return NextResponse.json({ error: "Invalid video ID" }, { status: 400 });
  }

  const video = await prisma.video.findUnique({ where: { id: videoId } });
  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  if (video.processingStatus === "READY") {
    return NextResponse.json({ message: "Already processed" });
  }

  // Mark as processing
  await prisma.video.update({
    where: { id: videoId },
    data: { processingStatus: "PROCESSING", processingError: null },
  });

  // Run the pipeline in the background — respond immediately so the UI doesn't hang
  processVideo(videoId, video.youtubeUrl, video.title).catch(console.error);

  return NextResponse.json({ message: "Processing started" });
}

async function processVideo(videoId: number, youtubeUrl: string, title: string) {
  const outputPath = join(tmpdir(), `tgbot_video_${videoId}_${Date.now()}.mp4`);

  try {
    // ── Step 1: Download with yt-dlp ─────────────────────────────────────────
    // -f: best mp4 under 1.9GB (Telegram bot API limit is 2GB)
    // --no-playlist: don't download entire playlist if URL is a playlist item
    // --merge-output-format mp4: ensure output is mp4
    console.log(`[process] Downloading video ${videoId}: ${youtubeUrl}`);

    const ytDlpCmd = [
      "yt-dlp",
      `"${youtubeUrl}"`,
      `-f "bestvideo[ext=mp4][filesize<1900M]+bestaudio[ext=m4a]/best[ext=mp4][filesize<1900M]/best"`,
      "--merge-output-format mp4",
      "--no-playlist",
      "--no-warnings",
      `-o "${outputPath}"`,
    ].join(" ");

    await execAsync(ytDlpCmd, { timeout: 30 * 60 * 1000 }); // 30 min timeout

    if (!existsSync(outputPath)) {
      throw new Error("yt-dlp finished but output file not found");
    }

    const fileSizeBytes = statSync(outputPath).size;
    const fileSizeMB = (fileSizeBytes / 1024 / 1024).toFixed(1);
    console.log(`[process] Downloaded ${fileSizeMB}MB for video ${videoId}`);

    // ── Step 2: Upload to Telegram ────────────────────────────────────────────
    console.log(`[process] Uploading video ${videoId} to Telegram...`);

    const formData = new FormData();
    formData.append("chat_id", UPLOAD_CHAT_ID);
    formData.append("supports_streaming", "true");
    formData.append("caption", `📹 ${title}`);
    // Append the file as a Blob
    const fileBuffer = await import("fs/promises").then((fs) =>
      fs.readFile(outputPath)
    );
    const blob = new Blob([fileBuffer], { type: "video/mp4" });
    formData.append("video", blob, `video_${videoId}.mp4`);

    const uploadRes = await fetch(`${TELEGRAM_API}/sendVideo`, {
      method: "POST",
      body: formData,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Telegram upload failed: ${errText}`);
    }

    const uploadData = (await uploadRes.json()) as {
      ok: boolean;
      result: {
        video: { file_id: string; file_unique_id: string };
      };
    };

    if (!uploadData.ok) {
      throw new Error("Telegram returned ok=false on upload");
    }

    const telegramFileId = uploadData.result.video.file_id;
    console.log(`[process] Video ${videoId} uploaded. file_id: ${telegramFileId}`);

    // ── Step 3: Save file_id and mark READY ───────────────────────────────────
    await prisma.video.update({
      where: { id: videoId },
      data: {
        telegramFileId,
        processingStatus: "READY",
        processingError: null,
      },
    });

    console.log(`[process] Video ${videoId} is READY`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[process] Video ${videoId} FAILED:`, message);

    await prisma.video.update({
      where: { id: videoId },
      data: {
        processingStatus: "FAILED",
        processingError: message,
      },
    });
  } finally {
    // Always clean up the temp file
    if (existsSync(outputPath)) {
      try {
        unlinkSync(outputPath);
      } catch {
        // ignore cleanup errors
      }
    }
  }
}
