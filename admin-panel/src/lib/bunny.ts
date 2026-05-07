import crypto from "crypto";

const LIBRARY_ID = process.env.BUNNY_LIBRARY_ID!;
const CDN_HOSTNAME = process.env.BUNNY_CDN_HOSTNAME!;
const TOKEN_AUTH_KEY = process.env.BUNNY_TOKEN_AUTH_KEY!;
const API_KEY = process.env.BUNNY_API_KEY!;

/**
 * Generate a signed Bunny Stream embed URL.
 *
 * Bunny Stream token formula (from official docs):
 *   token = SHA256( token_auth_key + video_id + expires )  — as HEX string
 *   url   = https://iframe.mediadelivery.net/embed/LIBRARY_ID/VIDEO_ID
 *           ?token=<hex>&expires=<unix_timestamp>
 *
 * https://docs.bunny.net/stream/token-authentication
 */
export function signBunnyUrl(bunnyVideoId: string, expiresInSeconds = 3600): string {
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;

  // Exact formula from Bunny docs: SHA256(key + videoId + expires)
  const hashInput = TOKEN_AUTH_KEY + bunnyVideoId + expires.toString();
  const token = crypto
    .createHash("sha256")
    .update(hashInput)
    .digest("hex");

  return `https://iframe.mediadelivery.net/embed/${LIBRARY_ID}/${bunnyVideoId}?token=${token}&expires=${expires}&autoplay=false&preload=false`;
}

/**
 * Get video details from Bunny API.
 */
export async function getBunnyVideo(bunnyVideoId: string) {
  const res = await fetch(
    `https://video.bunnycdn.com/library/${LIBRARY_ID}/videos/${bunnyVideoId}`,
    { headers: { AccessKey: API_KEY } }
  );
  if (!res.ok) return null;
  return res.json();
}
