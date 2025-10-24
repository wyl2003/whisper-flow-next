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

export type TranscriptionMode = 'api' | 'webgpu'

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
  mode: TranscriptionMode
  metadata?: {
    model?: string
    tps?: number
  }
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

  // 模式设置
  transcriptionMode: TranscriptionMode
  setTranscriptionMode: (mode: TranscriptionMode) => void
  webgpuModel: string
  setWebgpuModel: (model: string) => void

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
    (
      set: (
        partial:
          | TranscriptionStore
          | Partial<TranscriptionStore>
          | ((state: TranscriptionStore) => TranscriptionStore | Partial<TranscriptionStore>),
        replace?: boolean,
        action?: string
      ) => void
    ) => ({
      // API 设置
      apiKey: "",
      setApiKey: (key: string) => set({ apiKey: key }),
      apiEndpoint: "https://api.openai.com/v1/audio/transcriptions",
      setApiEndpoint: (endpoint: string) => set({ apiEndpoint: endpoint }),
      pricePerMinute: 0.006,
      setPricePerMinute: (price: number) => set({ pricePerMinute: price }),
      currency: "USD",
      setCurrency: (currency: string) => set({ currency }),

      // 模式设置
      transcriptionMode: 'api',
      setTranscriptionMode: (mode: TranscriptionMode) => set({ transcriptionMode: mode }),
      webgpuModel: 'onnx-community/whisper-base',
      setWebgpuModel: (model: string) => set({ webgpuModel: model }),

      // 转录设置
      language: "auto",
      setLanguage: (language: string) => set({ language }),
      outputFormat: "text",
      setOutputFormat: (format: string) => set({ outputFormat: format }),
      temperature: 0,
      setTemperature: (temperature: number) => set({ temperature }),
      prompt: "",
      setPrompt: (prompt: string) => set({ prompt }),
      wordTimestamps: false,
      setWordTimestamps: (enabled: boolean) => set({ wordTimestamps: enabled }),

      // 历史记录
      history: [],
      addToHistory: (result: TranscriptionResult) =>
        set((state: TranscriptionStore) => ({
          history: [result, ...state.history],
        })),
      removeFromHistory: (id: string) =>
        set((state: TranscriptionStore) => ({
          history: state.history.filter((item: TranscriptionResult) => item.id !== id),
        })),
      clearHistory: () => set({ history: [] }),

      // 导出设置
      exportFormat: "text",
      setExportFormat: (format: OutputFormat) => set({ exportFormat: format }),
    }),
    {
      name: 'transcription-store',
    }
  )
)