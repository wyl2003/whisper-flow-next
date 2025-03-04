"use client"

import { useState } from "react"
import { Download, Trash2, Copy, Check } from "lucide-react"
import { generateSRT, generateVTT } from "@/lib/format-transcription"
import { formatBytes } from "@/lib/format-bytes"
import { formatDuration } from "@/lib/format-duration"
import { formatPrice } from "@/lib/calculate-price"
import { useTranscriptionStore } from "@/store/transcription-store"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const languages = {
  auto: "自动检测",
  zh: "中文",
  en: "英文",
  ja: "日文",
  ko: "韩文",
  fr: "法文",
  de: "德文",
  es: "西班牙文",
  ru: "俄文",
  it: "意大利文",
  pt: "葡萄牙文",
  nl: "荷兰文",
  pl: "波兰文",
  tr: "土耳其文",
  ar: "阿拉伯文",
  th: "泰文",
  vi: "越南文",
  hi: "印地文",
}

const outputFormats = [
  { value: "text", label: "纯文本" },
  { value: "srt", label: "SRT 字幕" },
  { value: "vtt", label: "VTT 字幕" },
  { value: "json", label: "JSON" },
]

export function History() {
  const {
    history,
    clearHistory,
    removeFromHistory,
    currency,
  } = useTranscriptionStore()
  const [exportFormats, setExportFormats] = useState<{ [key: string]: string }>(
    {}
  )
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const { toast } = useToast()

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
        description: "已复制到剪贴板",
      })
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      toast({
        title: "复制失败",
        description: "无法访问剪贴板",
        variant: "destructive",
      })
    }
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        还没有转录历史记录
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold px-4 sm:px-0">转录历史</h2>
      <div className="space-y-4">
        {history.map((item) => (
          <div
            key={item.id}
            className="p-4 border-b sm:border sm:rounded-lg bg-card space-y-4"
          >
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium truncate flex-1">{item.filename}</div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    费用: {formatPrice(item.actualPrice || 0, currency)}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span>{formatBytes(item.file_size)}</span>
                  <span>•</span>
                  <span>{formatDuration(item.duration)}</span>
                  <span>•</span>
                  <span>{languages[item.language as keyof typeof languages] || item.language}</span>
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
                    <SelectValue placeholder="选择格式" />
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