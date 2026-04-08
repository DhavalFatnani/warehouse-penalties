import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const pathname = req.nextUrl.pathname;

  const supabase = createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: Record<string, unknown>) {
          res.cookies.set({ name, value: "", ...options });
        }
      }
    }
  );

  const { data } = await supabase.auth.getUser();
  const allowPublicSignup = process.env.NEXT_PUBLIC_ALLOW_PUBLIC_SIGNUP === "true";
  const isPublicApi = pathname === "/api/auth/forgot-password";
  const isProtected =
    pathname.startsWith("/dashboard") ||
    (pathname.startsWith("/api") && !isPublicApi);
  const isAuthRoute =
    pathname.startsWith("/login") || pathname.startsWith("/forgot-password");
  const isSignupRoute = pathname.startsWith("/signup");

  if (isProtected && !data.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isAuthRoute && data.user) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (isSignupRoute && !allowPublicSignup) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return res;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/:path*",
    "/login",
    "/signup",
    "/forgot-password"
  ]
};
