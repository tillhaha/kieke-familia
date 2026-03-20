// src/lib/google/calendar.ts
import { google, calendar_v3 } from 'googleapis'
import { prisma } from '@/lib/prisma'

export async function getGoogleCalendarClient(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, provider: 'google' },
  })

  if (!account) {
    throw new Error('User has no Google account linked')
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
  )

  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  })

  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.refresh_token) {
      await prisma.account.update({
        where: {
          provider_providerAccountId: {
            provider: 'google',
            providerAccountId: account.providerAccountId,
          },
        },
        data: { refresh_token: tokens.refresh_token },
      })
    }
    if (tokens.access_token) {
      await prisma.account.update({
        where: {
          provider_providerAccountId: {
            provider: 'google',
            providerAccountId: account.providerAccountId,
          },
        },
        data: {
          access_token: tokens.access_token,
          expires_at: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : undefined,
        },
      })
    }
  })

  return google.calendar({ version: 'v3', auth: oauth2Client })
}

export async function listEventsFromCalendars(
  userId: string,
  calendarIds: string[],
  timeMin: Date,
  timeMax: Date
): Promise<calendar_v3.Schema$Event[]> {
  if (calendarIds.length === 0) return []

  const calendar = await getGoogleCalendarClient(userId)

  const results = await Promise.allSettled(
    calendarIds.map((calendarId) =>
      calendar.events.list({
        calendarId,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      })
    )
  )

  const allEvents = results.flatMap((result, i) => {
    if (result.status === 'rejected') {
      console.error(`Failed to fetch calendar ${calendarIds[i]}:`, result.reason)
      return []
    }
    return result.value.data.items ?? []
  })

  // Deduplicate by event id (best-effort)
  const seen = new Set<string>()
  return allEvents.filter((event) => {
    if (!event.id || seen.has(event.id)) return false
    seen.add(event.id)
    return true
  })
}
