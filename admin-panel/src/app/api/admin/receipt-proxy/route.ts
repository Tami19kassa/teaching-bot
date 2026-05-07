import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getTelegramFileUrl } from "@/lib/telegram";

/**
 * GET /api/admin/receipt-proxy?fileId=<telegram_file_id>
 *
 * Proxies the receipt image from Telegram's servers to the admin browser.
 * This is necessary because:
 *  1. Telegram file URLs require the bot token in the path (secret)
 *  2. file_ids need to be resolved to a temporary download URL first
 *  3. We don't want to expose the bot token to the browser
 */
export async function GET(request: Request) {
  if (!isAdminAuthenticated()) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get("fileId");

  if (!fileId) {
    return new NextResponse("Missing fileId", { status: 400 });
  }

  try {
    const fileUrl = await getTelegramFileUrl(fileId);

    // Fetch the actual image from Telegram
    const imageRes = await fetch(fileUrl);
    if (!imageRes.ok) {
      return new NextResponse("Failed to fetch image from Telegram", { status: 502 });
    }

    const contentType = imageRes.headers.get("content-type") ?? "image/jpeg";
    const buffer = await imageRes.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // Cache for 10 minutes — Telegram file URLs are short-lived
        "Cache-Control": "private, max-age=600",
      },
    });
  } catch (err) {
    console.error("[receipt-proxy] Error:", err);
    return new NextResponse("Error fetching receipt", { status: 500 });
  }
}
