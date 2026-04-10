// src/app/meals/BatchImportModal.tsx
"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { useTranslation } from "@/lib/i18n/LanguageContext"
import styles from "./meals.module.css"

type ItemStatus =
  | { status: "pending" }
  | { status: "success"; name: string }
  | { status: "fail"; label: string }

function parseItems(text: string): string[] {
  return text
    .split(/^---\s*$/m)
    .map((c) => c.trim())
    .filter(Boolean)
}

interface Props {
  onClose: () => void
  onRefresh: () => void
}

export default function BatchImportModal({ onClose, onRefresh }: Props) {
  const { t } = useTranslation()
  const [text, setText] = useState("")
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

  const runImport = async () => {
    const batch = parseItems(text)
    if (batch.length === 0 || importing) return

    setImporting(true)
    setResults(batch.map(() => ({ status: "pending" })))
    setSummary(null)

    const headers = { "Content-Type": "application/json" }

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
        setResults((prev) =>
          prev.map((r, idx) => (idx === i ? { status: "fail", label } : r))
        )
        continue
      }

      setResults((prev) =>
        prev.map((r, idx) =>
          idx === i ? { status: "success", name: parseData.recipe.name } : r
        )
      )
    }

    setImporting(false)

    // Read final results snapshot to compute summary and repopulate textarea
    setResults((finalResults) => {
      const failedInputs = batch.filter((_, i) => finalResults[i]?.status === "fail")
      const importedCount = batch.length - failedInputs.length

      if (importedCount > 0) onRefresh()

      const newSummary =
        failedInputs.length === 0
          ? t.meals.batchDoneAll.replace("{total}", String(batch.length))
          : t.meals.batchDoneMixed
              .replace("{imported}", String(importedCount))
              .replace("{failed}", String(failedInputs.length))

      setSummary(newSummary)
      setText(failedInputs.length > 0 ? failedInputs.join("\n---\n") : "")

      return finalResults
    })
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

        <p className={styles.batchHint}>{t.meals.batchHint}</p>

        <textarea
          className={styles.batchTextarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t.meals.batchPlaceholder}
          disabled={importing}
        />

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

        <div className={styles.batchBottomRow}>
          <span className={styles.batchCountLabel}>{n > 0 ? countLabel : ""}</span>
          <button
            type="button"
            className={styles.parseBtn}
            onClick={runImport}
            disabled={importing || n === 0}
          >
            {t.meals.importAll}
          </button>
        </div>
      </div>
    </div>
  )
}
