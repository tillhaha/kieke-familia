// src/lib/auth.ts

import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { prisma } from "@/lib/prisma"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/calendar",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      // `user` is only present on initial sign-in
      if (user) {
        token.id = user.id
        token.familyId = (user as any).familyId
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      if (session && session.user) {
        (session.user as any).id = token.id as string | undefined
        (session.user as any).familyId = token.familyId as string | undefined
        (session.user as any).role = token.role as string | undefined
      }
      return session
    },
  },
  debug: true, // Enable debug logs
  pages: {
    signIn: "/",
  },
}
