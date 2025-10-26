"use client"

import { createContext, useContext, useMemo } from "react"
import type { ReactNode } from "react"
import type { Locale, Messages } from "@/i18n/types"

type TranslationValues = Record<string, string | number>

type I18nContextValue = {
  locale: Locale
  messages: Messages
  t: (path: string, values?: TranslationValues) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

function resolvePath(object: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, object)
}

function formatMessage(template: string, values?: TranslationValues): string {
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = values[key]
    return value !== undefined ? String(value) : match
  })
}

interface I18nProviderProps {
  locale: Locale
  messages: Messages
  children: ReactNode
}

export function I18nProvider({ locale, messages, children }: I18nProviderProps) {
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      messages,
      t: (path: string, values?: TranslationValues) => {
        const result = resolvePath(messages as unknown as Record<string, unknown>, path)

        if (typeof result !== "string") {
          throw new Error(`Missing translation for path: ${path}`)
        }

        return formatMessage(result, values)
      },
    }),
    [locale, messages]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider")
  }
  return context
}
