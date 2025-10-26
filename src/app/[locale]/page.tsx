"use client"

import Link from "next/link"
import { Github, Settings } from "lucide-react"
import { Uploader } from "@/components/uploader"
import { TranscriptionSettings } from "@/components/transcription-settings"
import { History } from "@/components/history"
import { useI18n } from "@/components/i18n-provider"

export default function HomePage() {
  const { t, locale } = useI18n()
  const settingsHref = `/${locale}/settings`

  return (
    <div className="space-y-8 px-0 sm:px-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-0">
        <div>
          <h1 className="text-2xl font-bold">{t("home.headline")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("home.subtitle")}</p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="https://github.com/wyl2003/whisper-flow-next"
            target="_blank"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <Github className="w-4 h-4" />
            {t("navigation.github")}
          </Link>
          <Link
            href={settingsHref}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <Settings className="w-4 h-4" />
            {t("navigation.settings")}
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
