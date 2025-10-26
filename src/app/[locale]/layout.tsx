import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type { ReactNode } from "react"
import { I18nProvider } from "@/components/i18n-provider"
import { HtmlLangUpdater } from "@/components/html-lang-updater"
import { Toaster } from "@/components/ui/toaster"
import { getDictionary, isLocale, locales } from "@/i18n"
import type { Locale } from "@/i18n/types"

const languageTags: Record<Locale, string> = {
  zh: "zh-CN",
  en: "en",
}

export const dynamicParams = false

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

function getLanguageAlternates(currentLocale: Locale) {
  return Object.fromEntries(
    locales.map((locale) => {
      const tag = languageTags[locale]
      return [tag, `/${locale}`]
    })
  )
}

export async function generateMetadata({
  params,
}: {
  params: { locale: string }
}): Promise<Metadata> {
  const localeParam = params.locale

  if (!isLocale(localeParam)) {
    return {}
  }

  const messages = await getDictionary(localeParam)
  const languageAlternates = getLanguageAlternates(localeParam)
  const languageTag = languageTags[localeParam]
  const alternateLocales = locales.filter((locale) => locale !== localeParam).map((locale) => languageTags[locale])

  return {
    title: messages.seo.title,
    description: messages.seo.description,
    keywords: messages.seo.keywords,
    alternates: {
      canonical: `/${localeParam}`,
      languages: languageAlternates,
    },
    openGraph: {
      title: messages.seo.openGraph.title,
      description: messages.seo.openGraph.description,
      locale: languageTag,
      alternateLocale: alternateLocales,
    },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode
  params: { locale: string }
}) {
  const localeParam = params.locale

  if (!isLocale(localeParam)) {
    notFound()
  }

  const locale = localeParam
  const messages = await getDictionary(locale)
  const languageTag = languageTags[locale]

  return (
    <I18nProvider locale={locale} messages={messages}>
      <HtmlLangUpdater lang={languageTag} />
      <main className="min-h-screen bg-background" data-locale={locale}>
        <div className="container py-10 space-y-8">{children}</div>
      </main>
      <Toaster />
    </I18nProvider>
  )
}
