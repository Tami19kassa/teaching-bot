import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.VIDEO_TOKEN_SECRET!);

export interface VideoTokenPayload {
  telegramId: number;
  levelId: number;
}

/**
 * Issue a short-lived JWT that grants access to a specific level's videos.
 * Signed with VIDEO_TOKEN_SECRET — never exposed to the client.
 */
export async function signVideoToken(payload: VideoTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2h") // 2-hour window
    .sign(secret);
}

/**
 * Verify and decode a video access token.
 * Returns null if invalid or expired.
 */
export async function verifyVideoToken(
  token: string
): Promise<VideoTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as VideoTokenPayload;
  } catch {
    return null;
  }
}
