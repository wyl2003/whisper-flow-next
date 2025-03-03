"use client"

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Language =
  | "auto"
  | "zh"
  | "en"
  | "ja"
  | "ko"
  | "fr"
  | "de"
  | "es"
  | "ru"
  | "it"
  | "pt"
  | "nl"
  | "pl"
  | "tr"
  | "ar"
  | "th"
  | "vi"
  | "hi"

export type OutputFormat = "text" | "srt" | "vtt" | "json"

export interface TranscriptionResult {
  id: string
  filename: string
  file_size: number
  duration: number
  text: string
  segments: Array<{
    id: number
    start: number
    end: number
    text: string
  }>
  language: string
  created_at: string
  format: string
  actualPrice: number
}

interface TranscriptionStore {
  // API 设置
  apiKey: string
  setApiKey: (key: string) => void
  apiEndpoint: string
  setApiEndpoint: (endpoint: string) => void
  pricePerMinute: number
  setPricePerMinute: (price: number) => void
  currency: string
  setCurrency: (currency: string) => void

  // 转录设置
  language: string
  setLanguage: (language: string) => void
  outputFormat: string
  setOutputFormat: (format: string) => void
  temperature: number
  setTemperature: (temperature: number) => void
  prompt: string
  setPrompt: (prompt: string) => void
  wordTimestamps: boolean
  setWordTimestamps: (enabled: boolean) => void

  // 历史记录
  history: TranscriptionResult[]
  addToHistory: (result: TranscriptionResult) => void
  removeFromHistory: (id: string) => void
  clearHistory: () => void

  // 导出设置
  exportFormat: OutputFormat
  setExportFormat: (format: OutputFormat) => void
}

export const useTranscriptionStore = create<TranscriptionStore>()(
  persist(
    (set) => ({
      // API 设置
      apiKey: "",
      setApiKey: (key) => set({ apiKey: key }),
      apiEndpoint: "https://api.openai.com/v1/audio/transcriptions",
      setApiEndpoint: (endpoint) => set({ apiEndpoint: endpoint }),
      pricePerMinute: 0.006,
      setPricePerMinute: (price) => set({ pricePerMinute: price }),
      currency: "USD",
      setCurrency: (currency) => set({ currency: currency }),

      // 转录设置
      language: "auto",
      setLanguage: (language) => set({ language }),
      outputFormat: "text",
      setOutputFormat: (format) => set({ outputFormat: format }),
      temperature: 0,
      setTemperature: (temperature) => set({ temperature }),
      prompt: "",
      setPrompt: (prompt) => set({ prompt }),
      wordTimestamps: false,
      setWordTimestamps: (enabled) => set({ wordTimestamps: enabled }),

      // 历史记录
      history: [],
      addToHistory: (result) =>
        set((state) => ({
          history: [result, ...state.history],
        })),
      removeFromHistory: (id) =>
        set((state) => ({
          history: state.history.filter((item) => item.id !== id),
        })),
      clearHistory: () => set({ history: [] }),

      // 导出设置
      exportFormat: "text",
      setExportFormat: (format) => set({ exportFormat: format }),
    }),
    {
      name: 'transcription-store',
    }
  )
) 