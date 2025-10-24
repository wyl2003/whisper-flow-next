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

const languages = [
  { value: "auto", label: "自动检测" },
  { value: "zh", label: "中文" },
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

const transcriptionModes = [
  { value: "api", label: "云端 API" },
  { value: "webgpu", label: "本地 WebGPU" },
]

const webgpuModels = [
  { value: "onnx-community/whisper-tiny", label: "Whisper Tiny (~120MB)" },
  { value: "onnx-community/whisper-base", label: "Whisper Base (~206MB)" },
  { value: "onnx-community/whisper-small", label: "Whisper Small (~586MB)" },
  { value: "onnx-community/whisper-large-v3-turbo", label: "Whisper Large v3 Turbo (~1.6GB)" },
]

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

  return (
    <div className="space-y-4 p-4 rounded-lg border bg-card">
      <h2 className="text-lg font-semibold">转录设置</h2>

      <div className="space-y-2">
        <Label htmlFor="mode">转录模式</Label>
        <Select value={transcriptionMode} onValueChange={setTranscriptionMode}>
          <SelectTrigger>
            <SelectValue placeholder="选择转录模式" />
          </SelectTrigger>
          <SelectContent>
            {transcriptionModes.map((mode) => (
              <SelectItem key={mode.value} value={mode.value}>
                {mode.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          云端 API 需要有效的 API Key，WebGPU 会在浏览器本地执行推理（需支持 WebGPU 的浏览器，首次使用会加载模型耗时较长）
        </p>
      </div>

      {transcriptionMode === 'webgpu' && (
        <div className="space-y-2">
          <Label htmlFor="webgpuModel">WebGPU 模型</Label>
          <Select value={webgpuModel} onValueChange={setWebgpuModel}>
            <SelectTrigger>
              <SelectValue placeholder="选择模型" />
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
            模型越大准确率越高，但加载和推理速度也会越慢
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="language">语言</Label>
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger>
            <SelectValue placeholder="选择语言" />
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
          选择音频的主要语言，自动检测可能不太准确
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="outputFormat">输出格式</Label>
        <Select value={outputFormat} onValueChange={setOutputFormat}>
          <SelectTrigger>
            <SelectValue placeholder="选择输出格式" />
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
          温度 ({temperature})
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
          较高的值会使输出更加随机，较低的值会使其更加集中和确定
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="prompt">提示词</Label>
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="添加特定的上下文或指导来改善转录质量..."
          className="w-full px-3 py-2 rounded-md border bg-background min-h-[100px]"
        />
        <p className="text-sm text-muted-foreground">
          可以添加特定的上下文或指导来改善转录质量
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="wordTimestamps">词级时间戳</Label>
          <p className="text-sm text-muted-foreground">
            {transcriptionMode === 'webgpu'
              ? 'WebGPU 模式暂不支持词级时间戳'
              : '为每个单词生成时间戳（仅在选择 JSON 格式时可用）'}
          </p>
        </div>
        <Switch
          id="wordTimestamps"
          checked={wordTimestamps}
          onCheckedChange={setWordTimestamps}
          disabled={outputFormat !== "json" || transcriptionMode === 'webgpu'}
        />
      </div>
    </div>
  )
} 