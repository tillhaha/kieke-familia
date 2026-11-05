// src/app/meals/importItems.ts
// Splits the AI-import text into separate recipes:
//  - a line of three or more dashes (---, ------------) separates recipes
//  - a block that consists only of links becomes one recipe per link
// One item → the recipe is parsed into the form for review; several → each
// is parsed and saved directly.
const URL_LINE = /^(https?:\/\/|www\.)\S+$/i

export function splitImportText(text: string): string[] {
  return text
    .split(/^\s*-{3,}\s*$/m)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .flatMap((chunk) => {
      const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean)
      return lines.length > 1 && lines.every((l) => URL_LINE.test(l)) ? lines : [chunk]
    })
}
