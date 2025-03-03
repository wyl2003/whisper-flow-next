"use client"

import { useState } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import { useTranscriptionStore } from '@/store/transcription-store'
import { useToast } from '@/components/ui/use-toast'

export function useTranscription() {
  const {
    apiKey,
    apiEndpoint,
    language,
    outputFormat,
    temperature,
    prompt,
    wordTimestamps,
    addToHistory,
    pricePerMinute,
    currency,
  } = useTranscriptionStore()
  
  const [ffmpeg] = useState<FFmpeg | null>(() => 
    typeof window !== 'undefined' ? new FFmpeg() : null
  )
  const [progress, setProgress] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isFFmpegLoaded, setIsFFmpegLoaded] = useState(false)
  const { toast } = useToast()

  const loadFFmpeg = async () => {
    if (!ffmpeg) {
      throw new Error('FFmpeg not initialized')
    }

    if (isFFmpegLoaded) return

    try {
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      })
      setIsFFmpegLoaded(true)
    } catch (error) {
      console.error('加载 FFmpeg 失败:', error)
      toast({
        title: "加载音频处理组件失败",
        description: "请检查网络连接并刷新页面重试",
        variant: "destructive",
      })
      throw error
    }
  }

  const checkAudioStream = async (file: File) => {
    if (!ffmpeg) {
      throw new Error('FFmpeg not initialized')
    }

    await loadFFmpeg()
    
    const inputFileName = 'check.' + file.name.split('.').pop()
    await ffmpeg.writeFile(inputFileName, await fetchFile(file))
    
    // 获取音频流信息
    try {
      // 尝试提取一小段音频，如果成功说明有音频轨道
      await ffmpeg.exec([
        '-i', inputFileName,
        '-t', '1',
        '-f', 'null',
        '-'
      ])
      return true
    } catch (error) {
      throw new Error('no_audio')
    }
  }

  const convertToMp3 = async (file: File) => {
    if (!ffmpeg) {
      throw new Error('FFmpeg not initialized')
    }

    if (!isFFmpegLoaded) {
      await ffmpeg.load()
      setIsFFmpegLoaded(true)
    }

    try {
      const data = new Uint8Array(await file.arrayBuffer())
      await ffmpeg.writeFile('input', data)
      await ffmpeg.exec([
        '-i',
        'input',
        '-vn',
        '-acodec',
        'libmp3lame',
        '-b:a',
        '128k',
        'output.mp3',
      ])
      const outputData = await ffmpeg.readFile('output.mp3')
      return new File([outputData], 'audio.mp3', { type: 'audio/mpeg' })
    } catch (error) {
      console.error('Error converting file:', error)
      throw error
    }
  }

  const formatTimestamp = (seconds: number) => {
    const pad = (num: number) => num.toString().padStart(2, '0')
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${ms.toString().padStart(3, '0')}`
  }

  const generateSRT = (segments: Array<{ start: number; end: number; text: string }>) => {
    return segments
      .map((segment, index) => {
        return `${index + 1}\n${formatTimestamp(segment.start)} --> ${formatTimestamp(segment.end)}\n${segment.text}\n`
      })
      .join('\n')
  }

  const generateVTT = (segments: Array<{ start: number; end: number; text: string }>) => {
    return `WEBVTT\n\n` + segments
      .map((segment) => {
        return `${formatTimestamp(segment.start).replace(',', '.')} --> ${formatTimestamp(segment.end).replace(',', '.')}\n${segment.text}\n`
      })
      .join('\n')
  }

  const calculatePrice = (duration: number, pricePerMinute: number) => {
    const minutes = duration / 60
    return minutes * pricePerMinute
  }

  const formatPrice = (price: number, currency: string) => {
    return `${price.toFixed(2)} ${currency}`
  }

  const transcribe = async (file: File) => {
    if (!ffmpeg) {
      throw new Error('FFmpeg not initialized')
    }

    if (!apiKey) {
      toast({
        title: "错误",
        description: "请先设置 API Key",
        variant: "destructive",
      })
      return
    }

    try {
      setIsLoading(true)
      setProgress(0)
      
      // 转换文件为 MP3
      const mp3File = await convertToMp3(file)
      setProgress(30)

      // 准备表单数据
      const formData = new FormData()
      formData.append('file', mp3File)
      formData.append('model', 'whisper-1')
      if (language !== 'auto') {
        formData.append('language', language)
      }
      formData.append('response_format', outputFormat === 'text' ? 'text' : 'verbose_json')
      formData.append('temperature', temperature.toString())
      if (prompt) {
        formData.append('prompt', prompt)
      }
      if (wordTimestamps && outputFormat === 'json') {
        formData.append('word_timestamps', 'true')
      }
      
      // 发送请求
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
      })
      
      setProgress(90)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        let errorMessage = '请检查 API 密钥和网络连接'
        
        if (errorData.error) {
          if (errorData.error.type === 'invalid_request_error') {
            errorMessage = '无效的请求参数'
          } else if (errorData.error.type === 'authentication_error') {
            errorMessage = 'API 密钥无效或已过期'
          } else if (errorData.error.message) {
            errorMessage = errorData.error.message
          }
        }

        toast({
          title: "转录失败",
          description: errorMessage,
          variant: "destructive",
        })
        throw new Error(errorMessage)
      }

      let result: any
      let text: string
      let segments: Array<{ id: number; start: number; end: number; text: string }> = []

      if (outputFormat === 'text') {
        text = await response.text()
        // 对于纯文本格式，创建一个单一的段落
        segments = [{
          id: 1,
          start: 0,
          end: 0, // 由于没有时间信息，设置为0
          text: text
        }]
      } else {
        result = await response.json()
        text = result.text
        segments = (result.segments || []).map((segment: any, index: number) => ({
          ...segment,
          id: index + 1
        }))
      }

      let output: string = text
      if (segments) {
        switch (outputFormat) {
          case 'srt':
            output = generateSRT(segments)
            break
          case 'vtt':
            output = generateVTT(segments)
            break
          case 'json':
            output = JSON.stringify(result, null, 2)
            break
        }
      }
      
      // 计算实际费用
      const duration = segments ? segments[segments.length - 1].end : 0
      const actualPrice = calculatePrice(duration, pricePerMinute) || 0
      
      const transcriptionResult = {
        id: Date.now().toString(),
        filename: file.name,
        duration,
        text: output,
        language: result?.language || language,
        created_at: new Date().toISOString(),
        file_size: file.size,
        segments,
        format: outputFormat,
        actualPrice,
      }
      
      addToHistory(transcriptionResult)
      setProgress(100)

      const actualPriceFormatted = formatPrice(actualPrice, currency)
      
      toast({
        title: "转录完成",
        description: `音频已成功转录为文字，费用：${actualPriceFormatted}`,
      })
      
      return transcriptionResult
    } catch (error) {
      console.error('Transcription error:', error)
      toast({
        title: "转录失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      })
      throw error
    } finally {
      setIsLoading(false)
      setProgress(0)
    }
  }

  return {
    transcribe,
    progress,
    isLoading,
  }
} 
