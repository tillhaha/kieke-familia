// src/app/api/weather/route.ts

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export type DayWeather = {
  low: number
  high: number
  morningRain: number
  afternoonRain: number
  eveningRain: number
}

function avg(arr: number[]): number {
  if (!arr.length) return 0
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const familyId = (session.user as any).familyId as string | undefined
  if (!familyId) return NextResponse.json({ weather: null })

  try {
    const family = await prisma.family.findUnique({
      where: { id: familyId },
      select: { city: true },
    })

    if (!family?.city) return NextResponse.json({ weather: null })

    // Geocode city
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(family.city)}&count=1&language=en&format=json`,
      { next: { revalidate: 3600 } }
    )
    if (!geoRes.ok) return NextResponse.json({ weather: null })

    const geoData = await geoRes.json()
    if (!geoData.results?.length) return NextResponse.json({ weather: null })

    const { latitude, longitude, timezone } = geoData.results[0]

    // Fetch 7-day hourly forecast
    const forecastRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,precipitation_probability&timezone=${encodeURIComponent(timezone)}&past_days=6&forecast_days=7`,
      { next: { revalidate: 1800 } }
    )
    if (!forecastRes.ok) return NextResponse.json({ weather: null })

    const forecastData = await forecastRes.json()
    const times: string[] = forecastData.hourly.time
    const temps: number[] = forecastData.hourly.temperature_2m
    const precip: number[] = forecastData.hourly.precipitation_probability

    // Group by date
    type DayBucket = {
      temps: number[]
      morningRain: number[]
      afternoonRain: number[]
      eveningRain: number[]
    }
    const byDate: Record<string, DayBucket> = {}

    for (let i = 0; i < times.length; i++) {
      const date = times[i].slice(0, 10)
      const hour = parseInt(times[i].slice(11, 13), 10)
      if (!byDate[date]) {
        byDate[date] = { temps: [], morningRain: [], afternoonRain: [], eveningRain: [] }
      }
      byDate[date].temps.push(temps[i])
      if (hour >= 6 && hour < 12) byDate[date].morningRain.push(precip[i])
      else if (hour >= 12 && hour < 18) byDate[date].afternoonRain.push(precip[i])
      else if (hour >= 18 && hour < 24) byDate[date].eveningRain.push(precip[i])
    }

    const weather: Record<string, DayWeather> = {}
    for (const [date, data] of Object.entries(byDate)) {
      weather[date] = {
        low: Math.round(Math.min(...data.temps)),
        high: Math.round(Math.max(...data.temps)),
        morningRain: avg(data.morningRain),
        afternoonRain: avg(data.afternoonRain),
        eveningRain: avg(data.eveningRain),
      }
    }

    return NextResponse.json({ weather })
  } catch {
    return NextResponse.json({ weather: null })
  }
}
