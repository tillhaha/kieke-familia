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
  matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico).*)"],
}
