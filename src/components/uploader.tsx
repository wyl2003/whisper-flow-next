"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { Cloud, File, Loader2 } from "lucide-react"
import { useTranscription } from "@/hooks/use-transcription"
import { formatBytes } from "@/lib/format-bytes"
import { useToast } from "@/components/ui/use-toast"
import { useTranscriptionStore } from "@/store/transcription-store"
import { estimatePrice, formatPrice } from "@/lib/calculate-price"

export function Uploader() {
  const [file, setFile] = useState<File | null>(null)
  const { transcribe, isLoading, progress } = useTranscription()
  const { toast } = useToast()
  const { pricePerMinute, currency } = useTranscriptionStore()

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file) {
      setFile(file)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a', '.ogg'],
      'video/*': ['.mp4', '.webm', '.mov'],
    },
  })

  const handleTranscribe = async () => {
    if (!file) return

    try {
      await transcribe(file)
      setFile(null)
    } catch (error) {
      // 错误已在 transcribe 函数中处理
    }
  }

  const estimatedPrice = file ? estimatePrice(file.size, pricePerMinute) : 0

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`
          p-8 rounded-lg border-2 border-dashed
          ${isDragActive ? "border-primary bg-primary/10" : "border-gray-300"}
          hover:border-primary hover:bg-primary/5
          transition-colors cursor-pointer
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center gap-4">
          <Cloud className="h-10 w-10 text-gray-400" />
          <div className="text-center">
            {isDragActive ? (
              <p>将文件放在这里 ...</p>
            ) : (
              <>
                <p>拖放文件到这里，或点击选择文件</p>
                <p className="text-sm text-gray-500 mt-1">
                  支持 MP3, WAV, M4A, MP4 等格式
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {file && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-900 gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <File className="h-8 w-8 flex-shrink-0 text-blue-500" />
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{file.name}</p>
              <div className="text-sm text-gray-500 space-y-1">
                <p>{formatBytes(file.size)}</p>
                <p>预估费用：{formatPrice(estimatedPrice, currency)}</p>
              </div>
            </div>
          </div>
          <button
            onClick={handleTranscribe}
            disabled={isLoading}
            className="w-full sm:w-auto px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>转录中 {progress}%</span>
              </>
            ) : (
              "开始转录"
            )}
          </button>
        </div>
      )}
    </div>
  )
} 