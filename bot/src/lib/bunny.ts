import crypto from "crypto";

const CDN_HOSTNAME = process.env.BUNNY_CDN_HOSTNAME!;
const TOKEN_AUTH_KEY = process.env.BUNNY_TOKEN_AUTH_KEY!;

/**
 * Generate a signed Bunny CDN direct download URL for a video.
 * This gives a direct MP4 URL that Telegram can download server-side.
 *
 * Bunny CDN token formula:
 *   token = base64url( SHA256( token_key + path + expires ) )
 *   url   = https://CDN_HOSTNAME/VIDEO_ID/play_720p.mp4?token=<token>&expires=<ts>
 *
 * The bot passes this URL to Telegram's sendVideo — Telegram downloads
 * it from Bunny directly, so no video data passes through our server.
 */
export function signBunnyDownloadUrl(bunnyVideoId: string, expiresInSeconds = 3600): string {
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;

  // Try 720p first, fall back to original
  const path = `/${bunnyVideoId}/play_720p.mp4`;

  const hashInput = TOKEN_AUTH_KEY + path + expires.toString();
  const token = crypto
    .createHash("sha256")
    .update(hashInput)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return `https://${CDN_HOSTNAME}${path}?token=${token}&expires=${expires}`;
}
