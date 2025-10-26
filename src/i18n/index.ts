import { en } from "./dictionaries/en"
import { zh } from "./dictionaries/zh"
import type { Locale, Messages } from "./types"

export const dictionaries: Record<Locale, Messages> = {
  en,
  zh,
}

export const locales: Locale[] = ["en", "zh"]

export const defaultLocale: Locale = "zh"

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale)
}

export async function getDictionary(locale: Locale): Promise<Messages> {
  return dictionaries[locale] ?? dictionaries[defaultLocale]
}
