import { Role } from "@prisma/client"
import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface User {
    familyId?: string | null
    role?: Role
  }
  interface Session {
    user: {
      id?: string
      familyId?: string | null
      role?: Role
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    familyId?: string | null
    role?: Role
  }
}
