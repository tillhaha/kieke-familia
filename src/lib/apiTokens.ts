import { createHash, randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"

const TOKEN_PREFIX = "fam_"

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function generateToken(): { token: string; prefix: string; tokenHash: string } {
  const token = TOKEN_PREFIX + randomBytes(32).toString("base64url")
  return { token, prefix: token.slice(0, TOKEN_PREFIX.length + 6), tokenHash: hashToken(token) }
}

// Resolves an `Authorization: Bearer <token>` header to the token's user.
// Returns null for a missing/unknown token, an inactive user or one without a family.
export async function authenticateBearer(request: Request): Promise<{ userId: string; familyId: string } | null> {
  const header = request.headers.get("authorization") ?? ""
  const match = header.match(/^Bearer\s+(\S+)$/i)
  if (!match) return null

  const apiToken = await prisma.apiToken.findUnique({
    where: { tokenHash: hashToken(match[1]) },
    include: { user: { select: { id: true, familyId: true, active: true } } },
  })
  if (!apiToken || !apiToken.user.active || !apiToken.user.familyId) return null

  await prisma.apiToken.update({ where: { id: apiToken.id }, data: { lastUsedAt: new Date() } })
  return { userId: apiToken.user.id, familyId: apiToken.user.familyId }
}
