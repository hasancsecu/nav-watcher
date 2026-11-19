import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose/jwt/verify";

const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ||
    process.env.JWT_SECRET ||
    "nav-watcher-bini-secure-session-secret-key-2026"
);

const SESSION_COOKIE_NAME = "nav_session";

// Public endpoints that do not require an active session
const PUBLIC_API_ROUTES = [
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/logout",
  "/api/auth/send-otp",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Intercept and protect /api/* routes
  if (pathname.startsWith("/api")) {
    // 1. Allow public auth endpoints (login, signup, logout)
    if (PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route))) {
      const res = NextResponse.next();
      res.headers.set(
        "Cache-Control",
        "private, no-cache, no-store, max-age=0, must-revalidate"
      );
      return res;
    }

    // 2. Scheduled scraper cron route — allow Vercel Cron header OR CRON_SECRET Bearer token
    if (pathname === "/api/scrape" && req.method === "GET") {
      const isVercelCron =
        req.headers.get("x-vercel-cron") === "1" ||
        req.headers.get("user-agent")?.toLowerCase().includes("vercel-cron");
      const authHeader = req.headers.get("authorization");
      const cronSecret = process.env.CRON_SECRET;
      const isBearerMatch = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);

      if (isVercelCron || isBearerMatch) {
        const res = NextResponse.next();
        res.headers.set(
          "Cache-Control",
          "private, no-cache, no-store, max-age=0, must-revalidate"
        );
        return res;
      }
    }

    // 3. For all other private APIs, strictly require and verify the session JWT
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json(
        {
          error: "Unauthorized. Please log in to access this resource.",
          isAuthRequired: true,
        },
        {
          status: 401,
          headers: {
            "Cache-Control":
              "private, no-cache, no-store, max-age=0, must-revalidate",
            Pragma: "no-cache",
          },
        }
      );
    }

    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      if (!payload.userId) {
        return NextResponse.json(
          {
            error: "Unauthorized. Invalid session payload.",
            isAuthRequired: true,
          },
          {
            status: 401,
            headers: {
              "Cache-Control":
                "private, no-cache, no-store, max-age=0, must-revalidate",
              Pragma: "no-cache",
            },
          }
        );
      }
    } catch {
      return NextResponse.json(
        {
          error: "Unauthorized. Session expired or invalid.",
          isAuthRequired: true,
        },
        {
          status: 401,
          headers: {
            "Cache-Control":
              "private, no-cache, no-store, max-age=0, must-revalidate",
            Pragma: "no-cache",
          },
        }
      );
    }

    const res = NextResponse.next();
    // Critical: Ensure no browser or intermediate proxy ever caches private user responses
    res.headers.set(
      "Cache-Control",
      "private, no-cache, no-store, max-age=0, must-revalidate"
    );
    res.headers.set("Pragma", "no-cache");
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("X-Frame-Options", "DENY");
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
