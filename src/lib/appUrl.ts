// src/lib/appUrl.ts
// Absolute links into the app (for MCP / assistant answers that get pasted into other tools).
// Uses NEXTAUTH_URL (the public address of the app); without it, the path alone is returned.
export function appUrl(path: string): string {
  const base = (process.env.NEXTAUTH_URL || "").replace(/\/$/, "")
  return `${base}${path.startsWith("/") ? path : `/${path}`}`
}

export const recipeUrl = (id: string) => appUrl(`/meals/${id}`)
