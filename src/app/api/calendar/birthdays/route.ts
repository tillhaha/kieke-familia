// src/app/api/calendar/birthdays/route.ts
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { name, month, day, year } = await request.json()
    const userId = (session.user as any).id
    let familyId = (session.user as any).familyId

    // Auto-create a family if the user doesn't have one
    if (!familyId) {
      const family = await prisma.family.create({
        data: {
          name: "My Family",
          users: {
            connect: { id: userId }
          }
        }
      })
      familyId = family.id
    }

    const birthday = await prisma.birthday.create({
      data: {
        name,
        month,
        day,
        year: year ?? null,
        familyId
      }
    })

    return NextResponse.json(birthday)
  } catch (error: any) {
    console.error("Birthday create error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
