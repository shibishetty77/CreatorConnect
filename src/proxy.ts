import { NextResponse, type NextRequest } from "next/server";

import {
  dashboardForRole,
  SESSION_COOKIE_NAME,
  type Role,
} from "@/lib/auth/constants";
import { verifySessionToken } from "@/lib/auth/token";

const AUTH_ROUTES = new Set(["/login", "/register"]);

const ROLE_PREFIX: Array<{ prefix: string; role: Role }> = [
  { prefix: "/creator", role: "Creator" },
  { prefix: "/brand", role: "Brand" },
  { prefix: "/admin", role: "Admin" },
];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (AUTH_ROUTES.has(pathname)) {
    if (session) {
      return NextResponse.redirect(
        new URL(dashboardForRole(session.role), request.url),
      );
    }

    return NextResponse.next();
  }

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  for (const route of ROLE_PREFIX) {
    if (
      pathname === route.prefix ||
      pathname.startsWith(`${route.prefix}/`)
    ) {
      if (session.role !== route.role) {
        return NextResponse.redirect(new URL("/forbidden", request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/register",
    "/dashboard/:path*",
    "/creator/:path*",
    "/brand/:path*",
    "/admin/:path*",
  ],
};
