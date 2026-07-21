"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { useI18n } from "@/components/i18n-provider"

export function LanguageSwitcher() {
  const { locale, t } = useI18n()
  const pathname = usePathname()

  const targetLocale = locale === "zh" ? "en" : "zh"
  const pathWithoutLocale = pathname.replace(`/${locale}`, "") || "/"
  const targetPath = `/${targetLocale}${pathWithoutLocale}`

  return (
    <Link
      href={targetPath}
      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
        />
      </svg>
      {t("navigation.switchLanguage")}
    </Link>
  )
}
