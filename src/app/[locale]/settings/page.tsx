"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { useI18n } from "@/components/i18n-provider"
import { useTranscriptionStore } from "@/store/transcription-store"

export const dynamic = "force-static"

export default function SettingsPage() {
  const {
    apiKey,
    setApiKey,
    apiEndpoint,
    setApiEndpoint,
    pricePerMinute,
    setPricePerMinute,
    currency,
    setCurrency,
    transcriptionMode,
  } = useTranscriptionStore()
  const { toast } = useToast()
  const { t, locale, messages } = useI18n()

  const handleSave = () => {
    toast({
      title: t("settingsPage.saveToastTitle"),
      description: t("settingsPage.saveToastDescription"),
    })
  }

  const modeLabelKey = transcriptionMode === "webgpu" ? "settingsPage.modeSummary.webgpu" : "settingsPage.modeSummary.api"
  const modeLabel = t(modeLabelKey)
  const modeSummary = t("settingsPage.modeSummary.current", { mode: modeLabel })
  const currencyOptions = messages.currencyOptions

  return (
    <div className="container max-w-2xl py-8 space-y-8">
      <div className="flex items-center gap-4">
        <Link href={`/${locale}`} className="hover:opacity-80">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-2xl font-bold">{t("settingsPage.title")}</h1>
      </div>

      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">{modeSummary}</p>

        <div className="space-y-2">
          <Label htmlFor="apiKey">{t("settingsPage.fields.apiKey.label")}</Label>
          <Input
            id="apiKey"
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={t("settingsPage.fields.apiKey.placeholder")}
          />
          <p className="text-sm text-muted-foreground">
            {t("settingsPage.fields.apiKey.description")}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="apiEndpoint">{t("settingsPage.fields.apiEndpoint.label")}</Label>
          <Input
            id="apiEndpoint"
            value={apiEndpoint}
            onChange={(event) => setApiEndpoint(event.target.value)}
            placeholder={t("settingsPage.fields.apiEndpoint.placeholder")}
          />
          <p className="text-sm text-muted-foreground">
            {t("settingsPage.fields.apiEndpoint.description")}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pricePerMinute">{t("settingsPage.fields.pricePerMinute.label")}</Label>
          <div className="flex gap-4">
            <Input
              id="pricePerMinute"
              type="number"
              min="0"
              step="0.001"
              value={Number.isFinite(pricePerMinute) ? pricePerMinute : ""}
              onChange={(event) => setPricePerMinute(parseFloat(event.target.value))}
              className="flex-1"
            />
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("settingsPage.fields.currency.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {currencyOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("settingsPage.fields.pricePerMinute.description")}
          </p>
        </div>

        <Button onClick={handleSave} className="w-full">
          {t("settingsPage.saveButton")}
        </Button>
      </div>
    </div>
  )
}
