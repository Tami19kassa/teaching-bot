import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_COOKIE = "admin_session";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect all /admin routes — login is now at /login (outside /admin)
  if (pathname.startsWith("/admin")) {
    const session = request.cookies.get(ADMIN_COOKIE);
    const adminSecret = process.env.ADMIN_SECRET;

    if (!session || session.value !== adminSecret) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
