// src/components/assistant/recorder.ts
// Records a voice message and turns it into 16 kHz mono WAV (base64) — the format audio
// models on OpenRouter accept most widely, and small enough to upload quickly.

export const MAX_RECORDING_MS = 2 * 60 * 1000
const SAMPLE_RATE = 16_000

export type Recording = { stop: () => Promise<string>; cancel: () => void }

export async function startRecording(): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const recorder = new MediaRecorder(stream)
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  recorder.start()
  const release = () => stream.getTracks().forEach((t) => t.stop())

  return {
    stop: () =>
      new Promise<string>((resolve, reject) => {
        recorder.onstop = async () => {
          release()
          try {
            resolve(await toWavBase64(new Blob(chunks, { type: recorder.mimeType })))
          } catch (err) {
            reject(err)
          }
        }
        recorder.stop()
      }),
    cancel: () => {
      recorder.onstop = release
      if (recorder.state !== "inactive") recorder.stop()
      else release()
    },
  }
}

async function toWavBase64(blob: Blob): Promise<string> {
  const ctx = new AudioContext()
  let decoded: AudioBuffer
  try {
    decoded = await ctx.decodeAudioData(await blob.arrayBuffer())
  } finally {
    ctx.close()
  }
  // Resample + downmix to mono
  const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * SAMPLE_RATE)), SAMPLE_RATE)
  const source = offline.createBufferSource()
  source.buffer = decoded
  source.connect(offline.destination)
  source.start()
  const samples = (await offline.startRendering()).getChannelData(0)

  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const ascii = (offset: number, s: string) => [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)))
  ascii(0, "RIFF")
  view.setUint32(4, 36 + samples.length * 2, true)
  ascii(8, "WAVE")
  ascii(12, "fmt ")
  view.setUint32(16, 16, true) // PCM chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, SAMPLE_RATE, true)
  view.setUint32(28, SAMPLE_RATE * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  ascii(36, "data")
  view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }

  const bytes = new Uint8Array(buffer)
  let binary = ""
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}
