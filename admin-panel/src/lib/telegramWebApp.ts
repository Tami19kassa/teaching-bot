import crypto from "crypto";

export interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

/**
 * Verify Telegram Mini App initData.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Returns the parsed user object if valid, null if invalid or expired.
 */
export function verifyTelegramWebApp(initData: string): TelegramWebAppUser | null {
  if (!initData) return null;

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return null;

    // Check auth_date is not older than 1 hour
    const authDate = parseInt(params.get("auth_date") ?? "0", 10);
    const age = Math.floor(Date.now() / 1000) - authDate;
    if (age > 3600) return null;

    // Build data-check-string: all params except hash, sorted, joined with \n
    params.delete("hash");
    const checkString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    // HMAC-SHA256 with key = HMAC-SHA256("WebAppData", BOT_TOKEN)
    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(process.env.BOT_TOKEN!)
      .digest();

    const expectedHash = crypto
      .createHmac("sha256", secretKey)
      .update(checkString)
      .digest("hex");

    if (expectedHash !== hash) return null;

    // Parse user object
    const userJson = params.get("user");
    if (!userJson) return null;

    return JSON.parse(userJson) as TelegramWebAppUser;
  } catch {
    return null;
  }
}
