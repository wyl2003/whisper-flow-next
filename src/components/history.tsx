"use client"

import { useState } from "react"
import { Download, Trash2, Copy, Check } from "lucide-react"
import { generateSRT, generateVTT } from "@/lib/format-transcription"
import { formatBytes } from "@/lib/format-bytes"
import { formatDuration } from "@/lib/format-duration"
import { formatPrice } from "@/lib/calculate-price"
import { useTranscriptionStore } from "@/store/transcription-store"
import type { TranscriptionResult } from "@/store/transcription-store"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useI18n } from "@/components/i18n-provider"

export function History() {
  const { history, removeFromHistory, currency } = useTranscriptionStore()
  const [exportFormats, setExportFormats] = useState<{ [key: string]: string }>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const { toast } = useToast()
  const { t, messages } = useI18n()
  const languageOptions = messages.languageOptions
  const languageMap = Object.fromEntries(languageOptions.map((option) => [option.value, option.label])) as Record<string, string>
  const outputFormats = messages.historyOutputFormatOptions
  const modeLabels = messages.historyModeLabels

  const downloadTranscription = (item: any) => {
    const format = exportFormats[item.id] || item.format || "text"
    let content = ""
    let extension = ""

    switch (format) {
      case "text":
        content = item.text
        extension = "txt"
        break
      case "srt":
        content = generateSRT(item.segments)
        extension = "srt"
        break
      case "vtt":
        content = generateVTT(item.segments)
        extension = "vtt"
        break
      case "json":
        content = JSON.stringify(item, null, 2)
        extension = "json"
        break
    }

    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `transcription-${item.id}.${extension}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      toast({
        description: t("history.copySuccess"),
      })
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      toast({
        title: t("history.copyErrorTitle"),
        description: t("history.copyErrorDescription"),
        variant: "destructive",
      })
    }
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {t("history.empty")}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold px-4 sm:px-0">{t("history.title")}</h2>
      <div className="space-y-4">
  {history.map((item: TranscriptionResult) => (
          <div
            key={item.id}
            className="p-4 border-b sm:border sm:rounded-lg bg-card space-y-4"
          >
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium truncate flex-1">{item.filename}</div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {(item.mode ?? "api") === "api"
                      ? t("history.priceWithValue", {
                          amount: formatPrice(item.actualPrice || 0, currency),
                        })
                      : t("history.priceLocal")}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span>{formatBytes(item.file_size)}</span>
                  <span>•</span>
                  <span>{formatDuration(item.duration)}</span>
                  <span>•</span>
                  <span>{languageMap[item.language] || item.language}</span>
                  {modeLabels[(item.mode ?? "api")] && (
                    <>
                      <span>•</span>
                      <span>{modeLabels[item.mode ?? "api"]}</span>
                    </>
                  )}
                  {item.metadata?.model && (
                    <>
                      <span>•</span>
                      <span>{item.metadata.model}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Select
                  value={exportFormats[item.id] || item.format || "text"}
                  onValueChange={(value) =>
                    setExportFormats((prev) => ({ ...prev, [item.id]: value }))
                  }
                >
                  <SelectTrigger className="h-8 w-[120px] sm:w-[140px]">
                    <SelectValue placeholder={t("history.selectFormatPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {outputFormats.map((format) => (
                      <SelectItem key={format.value} value={format.value}>
                        {format.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => downloadTranscription(item)}
                    className="h-8 w-8"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => copyToClipboard(item.text, item.id)}
                    className="h-8 w-8"
                  >
                    {copiedId === item.id ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => removeFromHistory(item.id)}
                    className="h-8 w-8"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="text-sm break-words whitespace-pre-wrap max-h-32 overflow-y-auto border rounded-md p-2 bg-muted/10">
              <p>{item.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
} 