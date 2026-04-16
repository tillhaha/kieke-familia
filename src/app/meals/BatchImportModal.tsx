"use client"

import { useRef, useState } from "react"
import { X } from "lucide-react"
import { useTranslation } from "@/lib/i18n/LanguageContext"
import styles from "./meals.module.css"

type Tab = "text" | "screenshots"

type ItemStatus =
  | { status: "pending" }
  | { status: "success"; name: string }
  | { status: "fail"; label: string }

type ImageEntry = { dataUrl: string; name: string }

function parseItems(text: string): string[] {
  return text
    .split(/^---\s*$/m)
    .map((c) => c.trim())
    .filter(Boolean)
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

interface Props {
  onClose: () => void
  onRefresh: () => void
}

export default function BatchImportModal({ onClose, onRefresh }: Props) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>("text")

  // text tab state
  const [text, setText] = useState("")

  // screenshots tab state
  const [images, setImages] = useState<ImageEntry[]>([])
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // shared state
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState<ItemStatus[]>([])
  const [summary, setSummary] = useState<string | null>(null)

  const items = parseItems(text)
  const n = items.length

  const countLabel =
    n === 1
      ? t.meals.batchItemDetected
      : t.meals.batchItemsDetected.replace("{n}", String(n))

  const completedCount = results.filter((r) => r.status !== "pending").length
  const totalCount = results.length

  const handleClose = () => {
    if (importing) return
    onClose()
  }

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return
    handleClose()
  }

  const addFiles = async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"))
    const entries = await Promise.all(
      imageFiles.map(async (f) => ({ dataUrl: await fileToDataUrl(f), name: f.name }))
    )
    setImages((prev) => [...prev, ...entries])
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files)
    e.target.value = ""
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files)
  }

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const runTextImport = async () => {
    const batch = parseItems(text)
    if (batch.length === 0 || importing) return

    setImporting(true)
    setResults(batch.map(() => ({ status: "pending" })))
    setSummary(null)

    const headers = { "Content-Type": "application/json" }
    const finalResults: ItemStatus[] = batch.map(() => ({ status: "pending" }))

    for (let i = 0; i < batch.length; i++) {
      const item = batch[i]

      const parseRes = await fetch("/api/meals/parse", {
        method: "POST",
        headers,
        body: JSON.stringify({ text: item }),
      })
      const parseData = await parseRes.json().catch(() => ({}))

      if (!parseRes.ok) {
        const errMsg = parseData.error ?? parseRes.statusText
        const label = item.slice(0, 60) + " — " + errMsg
        finalResults[i] = { status: "fail", label }
        setResults((prev) =>
          prev.map((r, idx) => (idx === i ? { status: "fail", label } : r))
        )
        continue
      }

      const saveRes = await fetch("/api/meals", {
        method: "POST",
        headers,
        body: JSON.stringify(parseData.recipe),
      })
      const saveData = await saveRes.json().catch(() => ({}))

      if (!saveRes.ok) {
        const errMsg = saveData.error ?? saveRes.statusText
        const label = item.slice(0, 60) + " — " + errMsg
        finalResults[i] = { status: "fail", label }
        setResults((prev) =>
          prev.map((r, idx) => (idx === i ? { status: "fail", label } : r))
        )
        continue
      }

      finalResults[i] = { status: "success", name: parseData.recipe.name }
      setResults((prev) =>
        prev.map((r, idx) =>
          idx === i ? { status: "success", name: parseData.recipe.name } : r
        )
      )
    }

    const failedInputs = batch.filter((_, i) => finalResults[i]?.status === "fail")
    const importedCount = batch.length - failedInputs.length

    setImporting(false)
    if (importedCount > 0) onRefresh()
    setSummary(
      failedInputs.length === 0
        ? t.meals.batchDoneAll.replace("{total}", String(batch.length))
        : t.meals.batchDoneMixed
            .replace("{imported}", String(importedCount))
            .replace("{failed}", String(failedInputs.length))
    )
    setText(failedInputs.length > 0 ? failedInputs.join("\n---\n") : "")
  }

  const runScreenshotImport = async () => {
    if (images.length === 0 || importing) return

    setImporting(true)
    setResults([{ status: "pending" }])
    setSummary(null)

    const headers = { "Content-Type": "application/json" }

    const parseRes = await fetch("/api/meals/parse", {
      method: "POST",
      headers,
      body: JSON.stringify({ images: images.map((img) => img.dataUrl) }),
    })
    const parseData = await parseRes.json().catch(() => ({}))

    if (!parseRes.ok) {
      const errMsg = parseData.error ?? parseRes.statusText
      setResults([{ status: "fail", label: errMsg }])
      setImporting(false)
      setSummary(t.meals.batchDoneMixed.replace("{imported}", "0").replace("{failed}", "1"))
      return
    }

    const saveRes = await fetch("/api/meals", {
      method: "POST",
      headers,
      body: JSON.stringify(parseData.recipe),
    })
    const saveData = await saveRes.json().catch(() => ({}))

    if (!saveRes.ok) {
      const errMsg = saveData.error ?? saveRes.statusText
      setResults([{ status: "fail", label: errMsg }])
      setImporting(false)
      setSummary(t.meals.batchDoneMixed.replace("{imported}", "0").replace("{failed}", "1"))
      return
    }

    setResults([{ status: "success", name: parseData.recipe.name }])
    setImporting(false)
    onRefresh()
    setSummary(t.meals.batchDoneAll.replace("{total}", "1"))
    setImages([])
  }

  const statusText = (r: ItemStatus) => {
    if (r.status === "pending") return "⋯"
    if (r.status === "success") return `✓ ${r.name}`
    return `✗ ${r.label}`
  }

  const statusClass = (r: ItemStatus) => {
    if (r.status === "pending") return styles.batchStatusPending
    if (r.status === "success") return styles.batchStatusSuccess
    return styles.batchStatusFail
  }

  return (
    <div className={styles.modalBackdrop} onClick={handleBackdrop}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{t.meals.batchImport}</span>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={handleClose}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab toggle */}
        <div className={styles.batchTabs}>
          <button
            type="button"
            className={`${styles.batchTab} ${tab === "text" ? styles.batchTabActive : ""}`}
            onClick={() => { setTab("text"); setResults([]); setSummary(null) }}
            disabled={importing}
          >
            {t.meals.batchTabText}
          </button>
          <button
            type="button"
            className={`${styles.batchTab} ${tab === "screenshots" ? styles.batchTabActive : ""}`}
            onClick={() => { setTab("screenshots"); setResults([]); setSummary(null) }}
            disabled={importing}
          >
            {t.meals.batchTabScreenshots}
          </button>
        </div>

        {/* Text / URL tab */}
        {tab === "text" && (
          <>
            <p className={styles.batchHint}>{t.meals.batchHint}</p>
            <textarea
              className={styles.batchTextarea}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t.meals.batchPlaceholder}
              disabled={importing}
            />
          </>
        )}

        {/* Screenshots tab */}
        {tab === "screenshots" && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={handleFileInput}
            />
            <div
              className={`${styles.batchDropzone} ${dragging ? styles.batchDropzoneDragging : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <span className={styles.batchDropzoneHint}>{t.meals.batchDropzoneHint}</span>
            </div>

            {images.length > 0 && (
              <div className={styles.batchThumbnails}>
                {images.map((img, i) => (
                  <div key={i} className={styles.batchThumb}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.dataUrl} alt={img.name} />
                    <button
                      type="button"
                      className={styles.batchThumbRemove}
                      onClick={(e) => { e.stopPropagation(); removeImage(i) }}
                      disabled={importing}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Progress bar (shared) */}
        {importing && totalCount > 0 && (
          <div className={styles.batchProgressSection}>
            <span className={styles.batchProgressLabel}>
              {t.meals.batchImporting
                .replace("{current}", String(completedCount))
                .replace("{total}", String(totalCount))}
            </span>
            <div className={styles.batchBar}>
              <div
                className={styles.batchBarFill}
                style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Per-item results (shared) */}
        {results.length > 0 && (
          <div className={styles.batchStatusList}>
            {results.map((r, i) => (
              <div key={i} className={`${styles.batchStatusItem} ${statusClass(r)}`}>
                {statusText(r)}
              </div>
            ))}
          </div>
        )}

        {summary && <p className={styles.batchSummary}>{summary}</p>}

        {/* Bottom row */}
        <div className={styles.batchBottomRow}>
          {tab === "text" && (
            <>
              <span className={styles.batchCountLabel}>{n > 0 ? countLabel : ""}</span>
              <button
                type="button"
                className={styles.parseBtn}
                onClick={runTextImport}
                disabled={importing || n === 0}
              >
                {t.meals.importAll}
              </button>
            </>
          )}
          {tab === "screenshots" && (
            <>
              <span className={styles.batchCountLabel}>
                {images.length > 0
                  ? `${images.length} screenshot${images.length === 1 ? "" : "s"}`
                  : ""}
              </span>
              <button
                type="button"
                className={styles.parseBtn}
                onClick={runScreenshotImport}
                disabled={importing || images.length === 0}
              >
                {t.meals.batchScreenshotImport}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
