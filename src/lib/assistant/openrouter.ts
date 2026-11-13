// src/lib/assistant/openrouter.ts
// Minimal OpenRouter client (OpenAI-compatible chat completions): streaming text + tool calls,
// and audio transcription with an audio-capable model.
import type { ChatMessage, ToolCall } from "./messages"

export const DEFAULT_MODEL = "anthropic/claude-haiku-5.5"

export function assistantConfig() {
  return {
    apiKey: process.env.OPENROUTER_API_KEY || null,
    model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
    /** Audio-capable model for spoken messages; unset = browser dictation only */
    audioModel: process.env.OPENROUTER_AUDIO_MODEL || null,
    baseUrl: (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, ""),
  }
}

type ToolDef = { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } }

export class OpenRouterError extends Error {
  constructor(
    public code: "NOT_CONFIGURED" | "NO_CREDITS" | "RATE_LIMITED" | "UPSTREAM" | "WRONG_MODEL",
    message: string,
  ) {
    super(message)
  }
}

function headers(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    // Optional attribution headers OpenRouter shows in its dashboard
    "HTTP-Referer": process.env.NEXTAUTH_URL || "https://kieke.app",
    "X-Title": "Kieke",
  }
}

async function errorFrom(res: Response): Promise<OpenRouterError> {
  const raw = await res.text().catch(() => "")
  let body: { error?: { message?: string; metadata?: { raw?: unknown; provider_name?: string } } } | null = null
  try {
    body = JSON.parse(raw)
  } catch {
    // not JSON (proxy error page etc.)
  }
  // OpenRouter puts the provider's own explanation (e.g. a rejected tool schema) in metadata.raw
  const provider = body?.error?.metadata
  const providerText = provider?.raw ? ` — ${provider.provider_name ?? "provider"}: ${typeof provider.raw === "string" ? provider.raw : JSON.stringify(provider.raw)}` : ""
  const message = `OpenRouter ${res.status}: ${body?.error?.message || raw.slice(0, 300) || res.statusText}${providerText}`.slice(0, 1000)
  console.error("[assistant] openrouter error", message)
  if (res.status === 402) return new OpenRouterError("NO_CREDITS", message)
  if (res.status === 429) return new OpenRouterError("RATE_LIMITED", message)
  return new OpenRouterError("UPSTREAM", message)
}

/** fetch, but a connection failure says why (DNS, refused, TLS, timeout …) */
async function reach(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (err) {
    if (init.signal?.aborted) throw err
    const cause = (err as { cause?: { code?: string; message?: string } }).cause
    throw new OpenRouterError("UPSTREAM", `Can't reach ${new URL(url).host}: ${cause?.code ?? ""} ${cause?.message ?? (err instanceof Error ? err.message : String(err))}`.trim())
  }
}

/**
 * One streamed completion. Calls `onText` for every text delta and returns the full text
 * plus any tool calls the model made.
 */
export async function streamChat(opts: {
  system: string
  messages: ChatMessage[]
  tools: ToolDef[]
  onText: (delta: string) => void
  signal?: AbortSignal
}): Promise<{ content: string; toolCalls: ToolCall[] }> {
  const cfg = assistantConfig()
  if (!cfg.apiKey) throw new OpenRouterError("NOT_CONFIGURED", "OPENROUTER_API_KEY is not set")

  const res = await reach(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: headers(cfg.apiKey),
    body: JSON.stringify({
      model: cfg.model,
      stream: true,
      max_tokens: 2048,
      messages: [{ role: "system", content: opts.system }, ...opts.messages],
      tools: opts.tools,
    }),
    signal: opts.signal,
  })
  if (!res.ok || !res.body) throw await errorFrom(res)

  let content = ""
  const calls: { id: string; name: string; args: string }[] = []
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  const handle = (line: string) => {
    // SSE: "data: {...}", "data: [DONE]", and ": keep-alive" comments
    if (!line.startsWith("data:")) return
    const data = line.slice(5).trim()
    if (!data || data === "[DONE]") return
    let chunk: {
      error?: { message?: string }
      choices?: { delta?: { content?: string | null; tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[] } }[]
    }
    try {
      chunk = JSON.parse(data)
    } catch {
      return
    }
    if (chunk.error) throw new OpenRouterError("UPSTREAM", chunk.error.message || "OpenRouter stream error")
    const delta = chunk.choices?.[0]?.delta
    if (!delta) return
    if (delta.content) {
      content += delta.content
      opts.onText(delta.content)
    }
    for (const tc of delta.tool_calls ?? []) {
      const i = tc.index ?? calls.length
      calls[i] ??= { id: "", name: "", args: "" }
      if (tc.id) calls[i].id = tc.id
      if (tc.function?.name) calls[i].name += tc.function.name
      if (tc.function?.arguments) calls[i].args += tc.function.arguments
    }
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let nl: number
    while ((nl = buffer.indexOf("\n")) >= 0) {
      handle(buffer.slice(0, nl).trim())
      buffer = buffer.slice(nl + 1)
    }
  }
  handle(buffer.trim())

  const toolCalls = calls
    .filter((c) => c && c.name)
    .map((c, i) => ({ id: c.id || `call_${Date.now()}_${i}`, type: "function" as const, function: { name: c.name, arguments: c.args || "{}" } }))
  return { content, toolCalls }
}

/**
 * Speech → text with OPENROUTER_AUDIO_MODEL. Uses OpenRouter's speech-to-text endpoint
 * (Whisper, GPT-4o Transcribe, Voxtral, …); a chat model that only accepts audio input is
 * asked to transcribe via chat completions instead.
 */
export async function transcribe(audioBase64: string, format: "wav" | "mp3", signal?: AbortSignal): Promise<string> {
  const cfg = assistantConfig()
  if (!cfg.apiKey || !cfg.audioModel) throw new OpenRouterError("NOT_CONFIGURED", "Voice model is not configured")

  const stt = await fetch(`${cfg.baseUrl}/audio/transcriptions`, {
    method: "POST",
    headers: headers(cfg.apiKey),
    body: JSON.stringify({ model: cfg.audioModel, input_audio: { data: audioBase64, format } }),
    signal,
  })
  if (stt.ok) {
    const body = (await stt.json()) as { text?: string }
    return (body.text ?? "").trim()
  }
  // Out of credits / rate limited: no point trying the other way
  if (stt.status === 402 || stt.status === 429) throw await errorFrom(stt)
  const sttError = await errorFrom(stt)

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: headers(cfg.apiKey),
    body: JSON.stringify({
      model: cfg.audioModel,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Transcribe this voice message word for word, in the language it is spoken in. Reply with the transcript only — no quotes, no comments. If nothing is said, reply with an empty message.",
            },
            { type: "input_audio", input_audio: { data: audioBase64, format } },
          ],
        },
      ],
    }),
    signal,
  })
  if (!res.ok) {
    const chatError = await errorFrom(res)
    if (chatError.code === "NO_CREDITS" || chatError.code === "RATE_LIMITED") throw chatError
    // Neither way works: most likely not a speech-to-text model (e.g. a text-to-speech one)
    throw new OpenRouterError("WRONG_MODEL", `${cfg.audioModel} can't transcribe audio (${sttError.message}; ${chatError.message})`)
  }
  const body = (await res.json()) as { choices?: { message?: { content?: string | null } }[] }
  return (body.choices?.[0]?.message?.content ?? "").trim()
}
