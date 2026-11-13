// src/proxy.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export async function proxy(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  const { pathname } = request.nextUrl

  // Unauthenticated: redirect to sign-in (home page) for protected routes
  if (!token) {
    if (pathname === "/" || pathname === "/onboarding") return NextResponse.next()
    const signInUrl = new URL("/", request.url)
    signInUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(signInUrl)
  }

  // Authenticated but no family: redirect to onboarding
  if (!token.familyId && pathname !== "/onboarding") {
    return NextResponse.redirect(new URL("/onboarding", request.url))
  }

  // Already in a family but on onboarding: redirect home
  if (token.familyId && pathname === "/onboarding") {
    return NextResponse.redirect(new URL("/", request.url))
  }
}

export const config = {
  // App icons and the web manifest must be reachable without a session —
  // iOS/browsers fetch them anonymously when adding the app to the home screen.
  // theme-init.js runs on every page, including the sign-in page.
  matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico|icon\\.svg|apple-icon|manifest\\.webmanifest|kieke-icon-|theme-init\\.js).*)"],
}
