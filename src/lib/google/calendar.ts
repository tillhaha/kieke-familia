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

  oauth2Client.on('tokens', (tokens) => {
    const data: Record<string, unknown> = {}
    if (tokens.refresh_token) data.refresh_token = tokens.refresh_token
    if (tokens.access_token) {
      data.access_token = tokens.access_token
      if (tokens.expiry_date) data.expires_at = Math.floor(tokens.expiry_date / 1000)
    }
    if (Object.keys(data).length === 0) return

    prisma.account
      .update({
        where: {
          provider_providerAccountId: {
            provider: 'google',
            providerAccountId: account.providerAccountId,
          },
        },
        data,
      })
      .catch((err) => console.error('Failed to update Google token:', err))
  })

  return google.calendar({ version: 'v3', auth: oauth2Client })
}

export type TaggedGoogleEvent = calendar_v3.Schema$Event & { calendarId: string }

export async function listEventsFromCalendars(
  userId: string,
  calendarIds: string[],
  timeMin: Date,
  timeMax: Date
): Promise<TaggedGoogleEvent[]> {
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
    return (result.value.data.items ?? []).map((event) => ({
      ...event,
      calendarId: calendarIds[i],
    }))
  })

  // Deduplicate by event id (best-effort)
  const seen = new Set<string>()
  return allEvents.filter((event) => {
    if (!event.id || seen.has(event.id)) return false
    seen.add(event.id)
    return true
  })
}
