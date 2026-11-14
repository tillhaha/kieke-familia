// src/lib/familyFeatureTypes.ts
// Shared by server and browser (no server imports here).
export type FamilyFeatures = {
  /** Homematic IP heating: page, navbar icon, settings, smart schedule, assistant/MCP tools */
  heating: boolean
  /** Shared custody of a child (with us / at the other parent's): week planner row, calendar, heating rule */
  custody: boolean
  /** Label of the calendar link in the week planner (null = default text) */
  calendarTitle: string | null
}
