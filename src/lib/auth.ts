import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
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
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { username: credentials.username },
        })

        if (!user?.passwordHash) return null
        if (!user.active) return null

        const valid = await bcrypt.compare(credentials.password, user.passwordHash)
        if (!valid) return null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.familyId = (user as unknown as Record<string, unknown>).familyId
        token.role = (user as unknown as Record<string, unknown>).role
        token.name = user.name
      }
      if (trigger === "update") {
        if (session?.name !== undefined) token.name = session.name
        if (session?.familyId !== undefined) token.familyId = session.familyId
        if (session?.role !== undefined) token.role = session.role
      }
      // Refresh familyId from DB if missing (covers credential users on first login)
      if (!token.familyId && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { familyId: true, role: true },
        })
        if (dbUser?.familyId) token.familyId = dbUser.familyId
        if (dbUser?.role) token.role = dbUser.role
      }
      return token
    },
    async session({ session, token }) {
      if (session?.user) {
        (session.user as Record<string, unknown>).id = token.id as string | undefined
        (session.user as Record<string, unknown>).familyId = token.familyId as string | undefined
        (session.user as Record<string, unknown>).role = token.role as string | undefined
        session.user.name = (token.name as string | null) ?? null
      }
      return session
    },
  },
  pages: {
    signIn: "/",
  },
}
