"use client"

import { useTranscriptionStore } from "@/store/transcription-store"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/components/ui/use-toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { supportedCurrencies } from "@/lib/calculate-price"

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

  const handleSave = () => {
    toast({
      title: "设置已保存",
      description: "您的API配置已成功更新",
    })
  }

  return (
    <div className="container max-w-2xl py-8 space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/" className="hover:opacity-80">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <h1 className="text-2xl font-bold">API 设置</h1>
      </div>

      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          当前转录模式：{transcriptionMode === 'webgpu' ? '本地 WebGPU（浏览器内推理，无需 API）' : '云端 API（需要有效的 API Key）'}
        </p>

        <div className="space-y-2">
          <Label htmlFor="apiKey">API 密钥</Label>
          <Input
            id="apiKey"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="输入您的 API 密钥"
          />
          <p className="text-sm text-muted-foreground">
            您可以在 OpenAI 的控制面板中找到您的 API 密钥
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="apiEndpoint">API 端点</Label>
          <Input
            id="apiEndpoint"
            value={apiEndpoint}
            onChange={(e) => setApiEndpoint(e.target.value)}
            placeholder="https://api.openai.com/v1/audio/transcriptions"
          />
          <p className="text-sm text-muted-foreground">
            如果您使用自定义端点，请在此处输入完整的 URL
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pricePerMinute">每分钟价格</Label>
          <div className="flex gap-4">
            <Input
              id="pricePerMinute"
              type="number"
              min="0"
              step="0.001"
              value={pricePerMinute}
              onChange={(e) => setPricePerMinute(parseFloat(e.target.value))}
              className="flex-1"
            />
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="选择货币" />
              </SelectTrigger>
              <SelectContent>
                {supportedCurrencies.map((curr) => (
                  <SelectItem key={curr.value} value={curr.value}>
                    {curr.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground">
            设置每分钟音频的转录价格，用于计算预估费用
          </p>
        </div>

        <Button onClick={handleSave} className="w-full">
          保存设置
        </Button>
      </div>
    </div>
  )
} 