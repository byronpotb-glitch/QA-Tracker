import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() calls out to Supabase's auth server on every request. If that
  // call ever hangs (Supabase slowness/outage), there's nothing bounding it —
  // Vercel eventually kills the whole invocation with a 504
  // MIDDLEWARE_INVOCATION_TIMEOUT, taking the entire site down with it. Cap
  // it so a slow/unreachable auth server degrades to "treat as logged out"
  // instead of a dead site.
  const user = await Promise.race([
    supabase.auth.getUser().then(({ data }) => data.user),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
  ]).catch(() => null);

  const isLoginRoute = request.nextUrl.pathname.startsWith("/login");
  const isPublicAuthRoute =
    isLoginRoute ||
    request.nextUrl.pathname.startsWith("/forgot-password") ||
    request.nextUrl.pathname.startsWith("/auth/confirm");

  if (!user && !isPublicAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
