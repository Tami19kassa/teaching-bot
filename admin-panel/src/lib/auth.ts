import { cookies } from "next/headers";

const ADMIN_COOKIE = "admin_session";
const ADMIN_SECRET = process.env.ADMIN_SECRET!;

/**
 * Simple cookie-based admin auth.
 * For production, replace with NextAuth or a proper session library.
 */
export function isAdminAuthenticated(): boolean {
  const cookieStore = cookies();
  const session = cookieStore.get(ADMIN_COOKIE);
  return session?.value === ADMIN_SECRET;
}

export { ADMIN_COOKIE, ADMIN_SECRET };
