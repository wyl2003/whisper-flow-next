export const currencySymbols: { [key: string]: string } = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
}

export function formatPrice(price: number | undefined, currency: string): string {
  if (price === undefined || isNaN(price)) {
    return `${currencySymbols[currency] || currency}0.000`
  }
  const symbol = currencySymbols[currency] || currency
  return `${symbol}${price.toFixed(3)}`
}

export function calculatePrice(duration: number, pricePerMinute: number): number {
  const minutes = duration / 60
  return minutes * pricePerMinute
}

export function estimatePrice(fileSize: number, pricePerMinute: number): number {
  // 假设音频比特率为 128kbps
  const bitrate = 128 * 1024 / 8 // 转换为字节每秒
  const durationInSeconds = fileSize / bitrate
  return calculatePrice(durationInSeconds, pricePerMinute)
}

export const supportedCurrencies = [
  { value: "USD", label: "美元 (USD)" },
  { value: "EUR", label: "欧元 (EUR)" },
  { value: "GBP", label: "英镑 (GBP)" },
  { value: "JPY", label: "日元 (JPY)" },
  { value: "CNY", label: "人民币 (CNY)" },
] 