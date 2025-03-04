"use client"

import { Uploader } from "@/components/uploader"
import { TranscriptionSettings } from "@/components/transcription-settings"
import { History } from "@/components/history"
import { Settings, Github } from "lucide-react"
import Link from "next/link"

export default function Home() {
  return (
    <div className="container py-8 px-0 sm:px-4 space-y-8">
      <div className="flex items-center justify-between px-4 sm:px-0">
        <h1 className="text-2xl font-bold">Whisper Flow 语音转文字</h1>
        <div className="flex items-center gap-4">
          <Link
            href="https://github.com/wyl2003/whisper-flow-next"
            target="_blank"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <Github className="w-4 h-4" />
            GitHub
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <Settings className="w-4 h-4" />
            API 设置
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-0 sm:px-0">
        <div className="space-y-6 order-1 md:order-1">
          <Uploader />
          <div className="block md:hidden order-2">
            <TranscriptionSettings />
          </div>
          <div className="order-3">
            <History />
          </div>
        </div>
        <div className="hidden md:block md:sticky md:top-8 order-2 md:order-2">
          <TranscriptionSettings />
        </div>
      </div>
    </div>
  )
}
