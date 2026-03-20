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
  // Use default database strategy when using an adapter
  callbacks: {
    async session({ session, user }) {
      if (session && session.user) {
        (session.user as any).id = user.id;
        (session.user as any).familyId = (user as any).familyId;
        (session.user as any).role = (user as any).role;
      }
      return session
    }
  },
  debug: true, // Enable debug logs
  pages: {
    signIn: "/",
  },
}
