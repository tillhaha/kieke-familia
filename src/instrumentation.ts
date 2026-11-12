// src/instrumentation.ts
// Runs once when the Next.js server starts.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  // The smart heating schedule changes real thermostats, so a dev server only runs it when asked to
  if (process.env.NODE_ENV !== "production" && process.env.HEATING_AUTOMATION !== "on") return
  const { startHeatingScheduler } = await import("@/lib/homematic/automation")
  startHeatingScheduler()
}
