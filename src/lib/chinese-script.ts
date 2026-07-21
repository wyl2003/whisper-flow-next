import OpenCC from 'opencc-js'

const simplifyConverter = OpenCC.Converter({ from: 'tw', to: 'cn' })
const traditionalConverter = OpenCC.Converter({ from: 'cn', to: 'tw' })

export type ChineseScriptPreference = 'simplified' | 'traditional' | null

export const getChineseScriptPreference = (language: string): ChineseScriptPreference => {
  if (language === 'zh-cn') {
    return 'simplified'
  }

  if (language === 'zh-tw') {
    return 'traditional'
  }

  return null
}

export const normalizeWhisperLanguage = (language: string) => {
  if (language === 'auto') {
    return null
  }

  if (language === 'zh-cn' || language === 'zh-tw') {
    return 'zh'
  }

  return language
}

export const convertChineseScript = (text: string, preference: ChineseScriptPreference) => {
  if (preference === 'simplified') {
    return simplifyConverter(text)
  }

  if (preference === 'traditional') {
    return traditionalConverter(text)
  }

  return text
}
