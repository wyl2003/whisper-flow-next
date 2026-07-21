"use client"

import { useEffect } from "react"

interface HtmlLangUpdaterProps {
  lang: string
}

export function HtmlLangUpdater({ lang }: HtmlLangUpdaterProps) {
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang
    }
  }, [lang])

  return null
}
