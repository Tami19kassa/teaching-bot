import crypto from "crypto";

const BOT_TOKEN = process.env.BOT_TOKEN!;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const TELEGRAM_FILE_API = `https://api.telegram.org/file/bot${BOT_TOKEN}`;

// ─── Send a message to a Telegram user ───────────────────────────────────────

export async function sendTelegramMessage(
  chatId: number | bigint,
  text: string
): Promise<void> {
  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId.toString(),
      text,
      parse_mode: "HTML",
      protect_content: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram sendMessage failed: ${body}`);
  }
}

// ─── Resolve a file_id to a download URL ─────────────────────────────────────

export async function getTelegramFileUrl(fileId: string): Promise<string> {
  const res = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
  if (!res.ok) throw new Error("getFile failed");

  const data = (await res.json()) as {
    ok: boolean;
    result: { file_path: string };
  };

  if (!data.ok) throw new Error("getFile returned ok=false");

  return `${TELEGRAM_FILE_API}/${data.result.file_path}`;
}

// ─── Validate Telegram Login Widget data ─────────────────────────────────────
// https://core.telegram.org/widgets/login#checking-authorization

export interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export function verifyTelegramAuth(data: TelegramAuthData): boolean {
  const { hash, ...rest } = data;

  // Build the data-check-string
  const checkString = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${rest[key as keyof typeof rest]}`)
    .join("\n");

  // Secret key = SHA256 of bot token
  const secretKey = crypto
    .createHash("sha256")
    .update(BOT_TOKEN)
    .digest();

  const expectedHash = crypto
    .createHmac("sha256", secretKey)
    .update(checkString)
    .digest("hex");

  // Also check auth_date is not older than 1 day
  const authAge = Math.floor(Date.now() / 1000) - data.auth_date;
  if (authAge > 86400) return false;

  return expectedHash === hash;
}
