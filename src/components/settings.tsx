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

const languages = [
  { value: "auto", label: "自动检测" },
  { value: "zh-cn", label: "中文（简体）" },
  { value: "zh-tw", label: "中文（繁体）" },
  { value: "zh", label: "中文（不转换）" },
  { value: "en", label: "英文" },
  { value: "ja", label: "日文" },
  { value: "ko", label: "韩文" },
  { value: "fr", label: "法文" },
  { value: "de", label: "德文" },
  { value: "es", label: "西班牙文" },
  { value: "ru", label: "俄文" },
  { value: "it", label: "意大利文" },
  { value: "pt", label: "葡萄牙文" },
  { value: "nl", label: "荷兰文" },
  { value: "pl", label: "波兰文" },
  { value: "tr", label: "土耳其文" },
  { value: "ar", label: "阿拉伯文" },
  { value: "th", label: "泰文" },
  { value: "vi", label: "越南文" },
  { value: "hi", label: "印地文" },
]

const outputFormats = [
  { value: "text", label: "纯文本" },
  { value: "srt", label: "SRT 字幕" },
  { value: "vtt", label: "VTT 字幕" },
  { value: "json", label: "JSON (包含详细信息)" },
]

export function Settings() {
  const {
    apiKey,
    setApiKey,
    apiEndpoint,
    setApiEndpoint,
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
  } = useTranscriptionStore()
  const { t, messages } = useI18n()
  const languages = messages.languageOptions
  const outputFormats = messages.outputFormatOptions

  return (
    <div className="space-y-6">
      {/* API 设置 */}
      <div className="space-y-4 p-4 rounded-lg border bg-card">
        <h2 className="text-lg font-semibold">{t("settingsPage.title")}</h2>
        
        <div className="space-y-2">
          <Label htmlFor="apiKey">{t("settingsPage.fields.apiKey.label")}</Label>
          <input
            id="apiKey"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={t("settingsPage.fields.apiKey.placeholder")}
            className="w-full px-3 py-2 rounded-md border bg-background"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="apiEndpoint">{t("settingsPage.fields.apiEndpoint.label")}</Label>
          <input
            id="apiEndpoint"
            type="text"
            value={apiEndpoint}
            onChange={(e) => setApiEndpoint(e.target.value)}
            placeholder={t("settingsPage.fields.apiEndpoint.placeholder")}
            className="w-full px-3 py-2 rounded-md border bg-background"
          />
        </div>

        <div className="pt-2 text-sm text-gray-500">
          <p>
            {t("settingsPage.fields.apiKey.description")}
            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {t("settingsPage.fields.apiKey.linkLabel")}
            </a>
          </p>
        </div>
      </div>

      {/* 转录设置 */}
      <div className="space-y-4 p-4 rounded-lg border bg-card">
        <h2 className="text-lg font-semibold">{t("transcriptionSettings.title")}</h2>

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
          <Label htmlFor="temperature">
            {t("transcriptionSettings.temperature.label", { value: temperature })}
          </Label>
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
              {t("transcriptionSettings.wordTimestamps.helperApi")}
            </p>
          </div>
          <Switch
            id="wordTimestamps"
            checked={wordTimestamps}
            onCheckedChange={setWordTimestamps}
            disabled={outputFormat !== "json"}
          />
        </div>
      </div>
    </div>
  )
} 