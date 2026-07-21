"use client"

import { useTranscriptionStore } from "@/store/transcription-store"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { useI18n } from "@/components/i18n-provider"

export function TranscriptionSettings() {
  const {
    transcriptionMode,
    setTranscriptionMode,
    language,
    setLanguage,
    outputFormat,
    setOutputFormat,
    temperature,
    setTemperature,
    prompt,
    setPrompt,
    wordTimestamps,
    setWordTimestamps,
    webgpuModel,
    setWebgpuModel,
  } = useTranscriptionStore()
  const { t, messages } = useI18n()
  const languages = messages.languageOptions
  const outputFormats = messages.outputFormatOptions
  const modes = messages.transcriptionModeOptions
  const webgpuModels = messages.webgpuModelOptions

  return (
    <div className="space-y-4 p-4 rounded-lg border bg-card">
      <h2 className="text-lg font-semibold">{t("transcriptionSettings.title")}</h2>

      <div className="space-y-2">
        <Label htmlFor="mode">{t("transcriptionSettings.mode.label")}</Label>
        <Select value={transcriptionMode} onValueChange={setTranscriptionMode}>
          <SelectTrigger>
            <SelectValue placeholder={t("transcriptionSettings.mode.placeholder")} />
          </SelectTrigger>
          <SelectContent>
            {modes.map((mode) => (
              <SelectItem key={mode.value} value={mode.value}>
                {mode.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {t("transcriptionSettings.mode.description")}
        </p>
      </div>

      {transcriptionMode === "webgpu" && (
        <div className="space-y-2">
          <Label htmlFor="webgpuModel">{t("transcriptionSettings.webgpuModel.label")}</Label>
          <Select value={webgpuModel} onValueChange={setWebgpuModel}>
            <SelectTrigger>
              <SelectValue placeholder={t("transcriptionSettings.webgpuModel.placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {webgpuModels.map((model) => (
                <SelectItem key={model.value} value={model.value}>
                  {model.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            {t("transcriptionSettings.webgpuModel.description")}
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="language">{t("transcriptionSettings.language.label")}</Label>
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger>
            <SelectValue placeholder={t("transcriptionSettings.language.placeholder")} />
          </SelectTrigger>
          <SelectContent>
            {languages.map((lang) => (
              <SelectItem key={lang.value} value={lang.value}>
                {lang.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {t("transcriptionSettings.language.description")}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="outputFormat">{t("transcriptionSettings.outputFormat.label")}</Label>
        <Select value={outputFormat} onValueChange={setOutputFormat}>
          <SelectTrigger>
            <SelectValue placeholder={t("transcriptionSettings.outputFormat.placeholder")} />
          </SelectTrigger>
          <SelectContent>
            {outputFormats.map((format) => (
              <SelectItem key={format.value} value={format.value}>
                {format.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="temperature">{t("transcriptionSettings.temperature.label", { value: temperature })}</Label>
        <Slider
          id="temperature"
          min={0}
          max={1}
          step={0.1}
          value={[temperature]}
          onValueChange={([value]) => setTemperature(value)}
        />
        <p className="text-sm text-muted-foreground">
          {t("transcriptionSettings.temperature.description")}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="prompt">{t("transcriptionSettings.prompt.label")}</Label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t("transcriptionSettings.prompt.placeholder")}
          className="w-full px-3 py-2 rounded-md border bg-background min-h-[100px]"
        />
        <p className="text-sm text-muted-foreground">
          {t("transcriptionSettings.prompt.description")}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="wordTimestamps">{t("transcriptionSettings.wordTimestamps.label")}</Label>
          <p className="text-sm text-muted-foreground">
            {transcriptionMode === "webgpu"
              ? t("transcriptionSettings.wordTimestamps.helperWebgpu")
              : t("transcriptionSettings.wordTimestamps.helperApi")}
          </p>
        </div>
        <Switch
          id="wordTimestamps"
          checked={wordTimestamps}
          onCheckedChange={setWordTimestamps}
          disabled={outputFormat !== "json" || transcriptionMode === "webgpu"}
        />
      </div>
    </div>
  )
} 