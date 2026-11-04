// src/lib/personalProfile.ts
// The user's private "About me" profile plus the life context the thoughts
// assistant gets: the free-text profile combined with what the app already
// knows (name, family members, city, saved birthdays with ages).
// Everything personal here is scoped by userId; family data by the user's own familyId.
import { prisma } from "@/lib/prisma"

export const MAX_PROFILE_LENGTH = 10000

export async function getProfileText(userId: string): Promise<string> {
  const row = await prisma.personalProfile.findUnique({ where: { userId }, select: { text: true } })
  return row?.text ?? ""
}

export async function saveProfileText(userId: string, text: string): Promise<{ text: string; updatedAt: Date }> {
  return prisma.personalProfile.upsert({
    where: { userId },
    create: { userId, text },
    update: { text },
    select: { text: true, updatedAt: true },
  })
}

function pad(n: number) {
  return String(n).padStart(2, "0")
}

// "Mia — 14.03.2016 (age 10, next birthday 2027-03-14)"
function describeBirthday(b: { name: string; month: number; day: number; year: number | null }, today: Date): string {
  const y = today.getUTCFullYear()
  const todayKey = `${pad(today.getUTCMonth() + 1)}-${pad(today.getUTCDate())}`
  const bdayKey = `${pad(b.month)}-${pad(b.day)}`
  const nextYear = bdayKey >= todayKey ? y : y + 1
  const next = `${nextYear}-${bdayKey}`
  if (b.year) {
    const age = y - b.year - (bdayKey > todayKey ? 1 : 0)
    return `- ${b.name}: born ${b.year}-${bdayKey} (age ${age}, next birthday ${next})`
  }
  return `- ${b.name}: birthday ${bdayKey} (next ${next})`
}

// Plain-text context block for prompts and the MCP profile tool. Returns ""
// only if there is nothing at all to say.
export async function buildLifeContext(userId: string, today = new Date()): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      familyId: true,
      personalProfile: { select: { text: true } },
      family: {
        select: {
          name: true,
          city: true,
          users: { where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } },
          birthdays: { select: { name: true, month: true, day: true, year: true }, orderBy: [{ month: "asc" }, { day: "asc" }] },
        },
      },
    },
  })
  if (!user) return ""

  const parts: string[] = []
  const known: string[] = []
  if (user.name) known.push(`Name: ${user.name}`)
  if (user.family) {
    known.push(`Family in the app: ${user.family.name}${user.family.city ? ` (lives in ${user.family.city})` : ""}`)
    const others = user.family.users.filter((u) => u.id !== userId && u.name).map((u) => u.name)
    if (others.length) known.push(`Other family members using the app: ${others.join(", ")}`)
  }
  if (known.length) parts.push(known.join("\n"))

  const birthdays = user.family?.birthdays ?? []
  if (birthdays.length) parts.push(`Saved birthdays:\n${birthdays.map((b) => describeBirthday(b, today)).join("\n")}`)

  const profile = user.personalProfile?.text.trim()
  if (profile) parts.push(`In their own words ("About me"):\n${profile}`)

  return parts.join("\n\n")
}
