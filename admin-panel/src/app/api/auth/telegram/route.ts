import { NextResponse } from "next/server";
import { verifyTelegramAuth, TelegramAuthData } from "@/lib/telegram";
import { signVideoToken } from "@/lib/videoToken";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/auth/telegram
 * Body: { telegramAuthData: TelegramAuthData, levelId: number }
 *
 * Called by the Telegram Login Widget callback on the /watch page.
 * 1. Verifies the Telegram auth hash
 * 2. Checks the user has access to the requested level
 * 3. Returns a signed video access token
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body?.telegramAuthData || !body?.levelId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const authData: TelegramAuthData = body.telegramAuthData;
  const levelId: number = parseInt(body.levelId, 10);

  // 1. Verify Telegram signature
  if (!verifyTelegramAuth(authData)) {
    return NextResponse.json({ error: "Invalid Telegram auth data" }, { status: 401 });
  }

  // 2. Check level access in DB
  const userLevel = await prisma.userLevel.findFirst({
    where: {
      user: { telegramId: BigInt(authData.id) },
      levelId,
    },
  });

  if (!userLevel) {
    return NextResponse.json(
      { error: "Access denied. You have not been approved for this level." },
      { status: 403 }
    );
  }

  // 3. Issue a short-lived video access token
  const token = await signVideoToken({ telegramId: authData.id, levelId });

  return NextResponse.json({ token });
}
