// src/app/api/calendar/travel/route.ts
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
    const { destination, startDate, endDate } = await request.json()
    const userId = (session.user as any).id

    const travel = await prisma.travel.create({
      data: {
        destination,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        userId
      }
    })

    return NextResponse.json(travel)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
