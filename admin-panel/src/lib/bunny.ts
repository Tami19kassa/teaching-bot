import crypto from "crypto";

const LIBRARY_ID = process.env.BUNNY_LIBRARY_ID!;
const CDN_HOSTNAME = process.env.BUNNY_CDN_HOSTNAME!;
const TOKEN_AUTH_KEY = process.env.BUNNY_TOKEN_AUTH_KEY!;
const API_KEY = process.env.BUNNY_API_KEY!;

/**
 * Generate a signed Bunny Stream HLS URL that expires after `expiresInSeconds`.
 *
 * Bunny token auth formula:
 *   token = base64url( SHA256( token_auth_key + video_path + expiry_timestamp ) )
 *   url   = https://CDN_HOSTNAME/VIDEO_ID/playlist.m3u8
 *           ?token=<token>&expires=<unix_timestamp>
 */
export function signBunnyUrl(bunnyVideoId: string, expiresInSeconds = 120): string {
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const videoPath = `/${bunnyVideoId}/playlist.m3u8`;

  // Bunny's signing formula: SHA256(token_key + path + expires)
  const hashInput = TOKEN_AUTH_KEY + videoPath + expires.toString();
  const token = crypto
    .createHash("sha256")
    .update(hashInput)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return `https://${CDN_HOSTNAME}${videoPath}?token=${token}&expires=${expires}`;
}

/**
 * Get video details from Bunny API (used to verify a video exists).
 */
export async function getBunnyVideo(bunnyVideoId: string) {
  const res = await fetch(
    `https://video.bunnycdn.com/library/${LIBRARY_ID}/videos/${bunnyVideoId}`,
    { headers: { AccessKey: API_KEY } }
  );
  if (!res.ok) return null;
  return res.json();
}

/**
 * List all videos in the library (for admin panel).
 */
export async function listBunnyVideos() {
  const res = await fetch(
    `https://video.bunnycdn.com/library/${LIBRARY_ID}/videos?page=1&itemsPerPage=100`,
    { headers: { AccessKey: API_KEY } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.items ?? [];
}
