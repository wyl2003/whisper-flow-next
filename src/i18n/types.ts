export interface Option {
  value: string
  label: string
}

export interface Messages {
  locale: string
  seo: {
    title: string
    description: string
    keywords: string[]
    openGraph: {
      title: string
      description: string
    }
  }
  navigation: {
    homeTitle: string
    github: string
    settings: string
    back: string
  }
  home: {
    headline: string
    subtitle: string
  }
  uploader: {
    dropActive: string
    dropIdleTitle: string
    dropIdleSubtitle: string
    estimatedPrice: string
    localMode: string
    buttonIdle: string
    buttonLoading: string
  }
  transcriptionSettings: {
    title: string
    mode: {
      label: string
      placeholder: string
      description: string
    }
    webgpuModel: {
      label: string
      placeholder: string
      description: string
    }
    language: {
      label: string
      placeholder: string
      description: string
    }
    outputFormat: {
      label: string
      placeholder: string
    }
    temperature: {
      label: string
      description: string
    }
    prompt: {
      label: string
      placeholder: string
      description: string
    }
    wordTimestamps: {
      label: string
      helperApi: string
      helperWebgpu: string
    }
  }
  history: {
    title: string
    empty: string
    priceWithValue: string
    priceLocal: string
    selectFormatPlaceholder: string
    copySuccess: string
    copyErrorTitle: string
    copyErrorDescription: string
  }
  settingsPage: {
    title: string
    saveToastTitle: string
    saveToastDescription: string
    modeSummary: {
      current: string
      api: string
      webgpu: string
    }
    fields: {
      apiKey: {
        label: string
        placeholder: string
        description: string
        linkLabel: string
      }
      apiEndpoint: {
        label: string
        placeholder: string
        description: string
      }
      pricePerMinute: {
        label: string
        description: string
      }
      currency: {
        placeholder: string
      }
    }
    saveButton: string
  }
  toasts: {
    loadFfmpegErrorTitle: string
    loadFfmpegErrorDescription: string
    missingApiKeyTitle: string
    missingApiKeyDescription: string
    transcriptionCompleteTitle: string
    transcriptionCompleteDescriptionApi: string
    transcriptionCompleteDescriptionWebgpu: string
    webgpuUnsupportedTitle: string
    webgpuUnsupportedDescription: string
    webgpuInitErrorTitle: string
    webgpuInitErrorDescription: string
    transcriptionFailedTitle: string
    transcriptionFailedDescription: string
  }
  errors: {
    defaultApi: string
    invalidRequest: string
    authentication: string
    webgpuUnsupported: string
    webgpuWorkerConflict: string
    webgpuGeneric: string
    audioContextUnsupported: string
    webgpuPipelineInit: string
  }
  languageOptions: Option[]
  outputFormatOptions: Option[]
  historyOutputFormatOptions: Option[]
  transcriptionModeOptions: Option[]
  currencyOptions: Option[]
  historyModeLabels: Record<string, string>
  webgpuModelOptions: Option[]
}

export type Locale = "en" | "zh"
