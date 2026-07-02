import { NextResponse, type NextRequest } from "next/server";

import { verifyToken } from "../lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname === "/login" ||
    pathname === "/api/auth/request-link" ||
    pathname === "/api/auth/verify-link" ||
    pathname === "/api/auth/logout" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  if (
    !pathname.startsWith("/dashboard") &&
    !pathname.startsWith("/admin") &&
    !pathname.startsWith("/mentor")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("token")?.value;

  if (!token || !(await verifyToken(token))) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/mentor/:path*"],
};
