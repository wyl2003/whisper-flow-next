"use client"

import { Uploader } from "@/components/uploader"
import { TranscriptionSettings } from "@/components/transcription-settings"
import { History } from "@/components/history"
import { Settings } from "lucide-react"
import Link from "next/link"

export default function Home() {
  return (
    <div className="container py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Whisper Flow 语音转文字</h1>
        <Link
          href="/settings"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <Settings className="w-4 h-4" />
          API 设置
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Uploader />
          <History />
        </div>
        <div className="md:sticky md:top-8">
          <TranscriptionSettings />
        </div>
      </div>
    </div>
  )
}
