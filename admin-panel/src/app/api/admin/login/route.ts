import { NextResponse } from "next/server";
import { ADMIN_COOKIE, ADMIN_SECRET } from "@/lib/auth";

/**
 * POST /api/admin/login
 * Body: { password: string }
 *
 * Simple password-based admin login. Sets a session cookie.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  if (body.password !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_COOKIE, ADMIN_SECRET, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 8, // 8 hours
    path: "/",
  });

  return response;
}

/** POST /api/admin/logout */
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(ADMIN_COOKIE);
  return response;
}
