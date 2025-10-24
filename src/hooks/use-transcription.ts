"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'
import { useTranscriptionStore } from '@/store/transcription-store'
import { useToast } from '@/components/ui/use-toast'

const WEBGPU_SAMPLE_RATE = 16000

interface WebgpuWorkerChunk {
	text: string
	timestamp: [number, number | null]
}

interface WebgpuWorkerResult {
	text?: string
	chunks?: WebgpuWorkerChunk[]
	language?: string
	tps?: number
}

type WebgpuWorkerMessage =
	| { status: 'initiate' | 'ready' | 'done' }
	| { status: 'progress'; progress?: number; file?: string; loaded?: number; total?: number }
	| { status: 'update'; data: { chunks: WebgpuWorkerChunk[]; text?: string; tps?: number } }
	| { status: 'complete'; data: WebgpuWorkerResult }
	| { status: 'error'; data?: { message?: string } }
	| { status: string; [key: string]: unknown }

const WEBGPU_UNSUPPORTED_ERROR = '当前浏览器不支持 WebGPU'

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
	return (
		`WEBVTT\n\n` +
		segments
			.map((segment) => {
				return `${formatTimestamp(segment.start).replace(',', '.')} --> ${formatTimestamp(segment.end).replace(',', '.')}\n${segment.text}\n`
			})
			.join('\n')
	)
}

const calculatePrice = (duration: number, pricePerMinute: number) => {
	const minutes = duration / 60
	return minutes * pricePerMinute
}

const formatPriceValue = (price: number, currency: string) => {
	return `${price.toFixed(2)} ${currency}`
}

const getAudioContextConstructor = () => {
	if (typeof window === 'undefined') return null
	const globalWindow = window as typeof window & { webkitAudioContext?: typeof AudioContext }
	return globalWindow.AudioContext || globalWindow.webkitAudioContext || null
}

const getOfflineAudioContextConstructor = () => {
	if (typeof window === 'undefined') return null
	const globalWindow = window as typeof window & {
		webkitOfflineAudioContext?: typeof OfflineAudioContext
	}
	return globalWindow.OfflineAudioContext || globalWindow.webkitOfflineAudioContext || null
}

const resampleAudioBuffer = async (buffer: AudioBuffer, targetSampleRate: number) => {
	if (buffer.sampleRate === targetSampleRate) {
		return buffer
	}

	const OfflineContext = getOfflineAudioContextConstructor()
	if (!OfflineContext) {
		return buffer
	}

	const offlineContext = new OfflineContext(
		buffer.numberOfChannels,
		Math.ceil(buffer.duration * targetSampleRate),
		targetSampleRate
	)

	const source = offlineContext.createBufferSource()
	source.buffer = buffer
	source.connect(offlineContext.destination)
	source.start(0)

	return offlineContext.startRendering()
}

const decodeAudioFile = async (file: File) => {
	const AudioContextCtor = getAudioContextConstructor()
	if (!AudioContextCtor) {
		throw new Error('当前环境不支持 AudioContext')
	}

	const arrayBuffer = await file.arrayBuffer()
	let audioContext: AudioContext | null = null
	try {
		audioContext = new AudioContextCtor({ sampleRate: WEBGPU_SAMPLE_RATE } as AudioContextOptions)
	} catch {
		audioContext = new AudioContextCtor()
	}

	const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0))

	if (audioContext.state !== 'closed') {
		await audioContext.close().catch(() => {})
	}

	const processed = await resampleAudioBuffer(audioBuffer, WEBGPU_SAMPLE_RATE).catch(() => audioBuffer)
	return processed ?? audioBuffer
}

const toMonoFloat32 = (buffer: AudioBuffer) => {
	const { numberOfChannels, length } = buffer
	if (numberOfChannels === 0) {
		return new Float32Array()
	}

	if (numberOfChannels === 1) {
		const data = buffer.getChannelData(0)
		return new Float32Array(data)
	}

	const output = new Float32Array(length)
	for (let channel = 0; channel < numberOfChannels; channel++) {
		const channelData = buffer.getChannelData(channel)
		for (let i = 0; i < length; i++) {
			output[i] += channelData[i]
		}
	}

	for (let i = 0; i < length; i++) {
		output[i] /= numberOfChannels
	}

	return output
}

const buildSegments = (chunks: WebgpuWorkerChunk[]) => {
	return chunks
		.map((chunk, index) => {
			const [startRaw, endRaw] = chunk.timestamp
			const start = typeof startRaw === 'number' ? startRaw : 0
			const end = typeof endRaw === 'number' ? endRaw : start
			const text = chunk.text.trim()
			if (!text) {
				return null
			}
			return {
				id: index + 1,
				start,
				end,
				text,
			}
		})
		.filter((segment): segment is { id: number; start: number; end: number; text: string } => Boolean(segment))
}

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
		transcriptionMode,
		webgpuModel,
	} = useTranscriptionStore()

	const [ffmpeg] = useState<FFmpeg | null>(() => (typeof window !== 'undefined' ? new FFmpeg() : null))
	const [progress, setProgress] = useState(0)
	const [isLoading, setIsLoading] = useState(false)
	const [isFFmpegLoaded, setIsFFmpegLoaded] = useState(false)
	const workerRef = useRef<Worker | null>(null)
	const workerPromiseRef = useRef<{
		resolve: (value: WebgpuWorkerResult) => void
		reject: (reason?: unknown) => void
	} | null>(null)
	const { toast } = useToast()

	const handleWorkerMessage = useCallback((event: MessageEvent<WebgpuWorkerMessage>) => {
		const message = event.data
		if (!message || typeof message.status !== 'string') {
			return
		}

		switch (message.status) {
			case 'initiate':
				setProgress((prev: number) => (prev < 10 ? 10 : prev))
				break
			case 'progress': {
				const percent = typeof message.progress === 'number' ? message.progress : 0
				const value = Math.max(10, Math.min(80, Math.round(20 + percent * 60)))
				setProgress((prev: number) => (value > prev ? value : prev))
				break
			}
			case 'ready':
				setProgress((prev: number) => (prev < 85 ? 85 : prev))
				break
			case 'update':
				setProgress((prev: number) => (prev < 90 ? 90 : prev))
				break
			case 'done':
				setProgress((prev: number) => (prev < 95 ? prev + 1 : prev))
				break
			case 'complete':
				setProgress(100)
				if (workerPromiseRef.current) {
					workerPromiseRef.current.resolve(message.data as WebgpuWorkerResult)
					workerPromiseRef.current = null
				}
				break
			case 'error': {
				const errorMessage =
					(message.data as { message?: string } | undefined)?.message || 'WebGPU 转录失败'
				if (workerPromiseRef.current) {
					workerPromiseRef.current.reject(new Error(errorMessage))
					workerPromiseRef.current = null
				}
				break
			}
			default:
				break
		}
	}, [])

	const ensureWorker = useCallback(() => {
		if (typeof window === 'undefined') {
			return null
		}

		if (!workerRef.current) {
			try {
				if (typeof URL !== 'undefined') {
					const urlProto = URL.prototype as URL & {
						replace?: (pattern: Parameters<string['replace']>[0], replacement: Parameters<string['replace']>[1]) => string
					}
					if (typeof urlProto.replace !== 'function') {
						urlProto.replace = function (pattern, replacement) {
							return this.toString().replace(pattern as never, replacement as never)
						}
					}
				}

				const workerUrl = new URL('../workers/webgpu-transcriber.worker.ts', import.meta.url)
				const worker = new Worker(workerUrl, { type: 'module' })
				worker.addEventListener('message', handleWorkerMessage)
				worker.addEventListener('error', (event) => {
					console.error('WebGPU worker error:', event)
					if (workerPromiseRef.current) {
						workerPromiseRef.current.reject(event.error || new Error('WebGPU worker error'))
						workerPromiseRef.current = null
					}
				})
				workerRef.current = worker
			} catch (error) {
				console.error('创建 WebGPU worker 失败:', error)
				return null
			}
		}

		return workerRef.current
	}, [handleWorkerMessage])

	useEffect(() => {
		return () => {
			if (workerRef.current) {
				workerRef.current.terminate()
				workerRef.current = null
			}
		}
	}, [])

	const ensureFFmpegLoaded = useCallback(async () => {
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
				title: '加载音频处理组件失败',
				description: '请检查网络连接并刷新页面重试',
				variant: 'destructive',
			})
			throw error
		}
	}, [ffmpeg, isFFmpegLoaded, toast])

	const convertToMp3 = useCallback(async (file: File) => {
		if (!ffmpeg) {
			throw new Error('FFmpeg not initialized')
		}

		await ensureFFmpegLoaded()

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
			const bufferView =
				outputData instanceof Uint8Array
					? outputData
					: typeof outputData === 'string'
						? new TextEncoder().encode(outputData)
						: new Uint8Array(outputData as unknown as ArrayBufferLike)
			const arrayBuffer = bufferView.buffer.slice(
				bufferView.byteOffset,
				bufferView.byteOffset + bufferView.byteLength
			) as ArrayBuffer
			const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' })
			return new File([blob], 'audio.mp3', { type: 'audio/mpeg' })
		} catch (error) {
			console.error('音频转码失败:', error)
			throw error
		}
	}, [ensureFFmpegLoaded, ffmpeg])

	const transcribeWithApi = useCallback(async (file: File) => {
		if (!ffmpeg) {
			throw new Error('FFmpeg not initialized')
		}

		if (!apiKey) {
			toast({
				title: '错误',
				description: '请先设置 API Key',
				variant: 'destructive',
			})
			throw new Error('MISSING_API_KEY')
		}

		setProgress(5)
		const mp3File = await convertToMp3(file)
		setProgress(30)

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

		const response = await fetch(apiEndpoint, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
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
				title: '转录失败',
				description: errorMessage,
				variant: 'destructive',
			})
			throw new Error(errorMessage)
		}

		let result: any
		let text: string
		let segments: Array<{ id: number; start: number; end: number; text: string }>

		if (outputFormat === 'text') {
			text = await response.text()
			segments = [
				{
					id: 1,
					start: 0,
					end: 0,
					text,
				},
			]
		} else {
			result = await response.json()
			text = result.text
			segments = (result.segments || []).map((segment: any, index: number) => ({
				...segment,
				id: index + 1,
			}))
		}

		let output = text
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

		const duration = segments.length > 0 ? segments[segments.length - 1].end : 0
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
			mode: 'api' as const,
			metadata: {
				model: 'whisper-1',
			},
		}

		addToHistory(transcriptionResult)
		setProgress(100)

		toast({
			title: '转录完成',
			description: `音频已成功转录为文字，费用：${formatPriceValue(actualPrice, currency)}`,
		})

		return transcriptionResult
	}, [
		addToHistory,
		apiEndpoint,
		apiKey,
		convertToMp3,
		currency,
		ffmpeg,
		language,
		outputFormat,
		pricePerMinute,
		prompt,
		temperature,
		toast,
		wordTimestamps,
	])

	const transcribeWithWebgpu = useCallback(
		async (file: File) => {
			try {
				const hasWebgpu =
					typeof navigator !== 'undefined' && Boolean((navigator as Navigator & { gpu?: unknown }).gpu)

				if (!hasWebgpu) {
					toast({
						title: '浏览器不支持 WebGPU',
						description: '请使用最新版本的 Chrome、Edge 或其他支持 WebGPU 的浏览器',
						variant: 'destructive',
					})
					throw new Error(WEBGPU_UNSUPPORTED_ERROR)
				}

				const worker = ensureWorker()
				if (!worker) {
					toast({
						title: '初始化 WebGPU 失败',
						description: '无法创建 WebGPU 工作线程，请刷新页面后重试',
						variant: 'destructive',
					})
					throw new Error('WEBGPU_WORKER_UNAVAILABLE')
				}

				setProgress(10)
				const audioBuffer = await decodeAudioFile(file)
				setProgress(20)
				const monoAudio = toMonoFloat32(audioBuffer)
				const durationFromAudio = audioBuffer.duration

				const languageOption = language !== 'auto' ? language : null

				const result = await new Promise<WebgpuWorkerResult>((resolve, reject) => {
					if (workerPromiseRef.current) {
						workerPromiseRef.current.reject(new Error('已有 WebGPU 转录任务正在执行'))
					}

					workerPromiseRef.current = { resolve, reject }

					try {
						worker.postMessage(
							{
								audio: monoAudio,
								model: webgpuModel,
								language: languageOption,
								subtask: 'transcribe',
							},
							[monoAudio.buffer]
						)
					} catch (error) {
						workerPromiseRef.current = null
						reject(error)
					}
				})

				const chunks = result.chunks ?? []
				const segments = buildSegments(chunks)
				const fallbackText = segments.map((segment) => segment.text).join(' ').trim()
				const plainText = (result.text || fallbackText).trim()

				const normalizedSegments = segments.length
					? segments
					: plainText
						? [
								{
									id: 1,
									start: 0,
									end: durationFromAudio,
									text: plainText,
								},
							]
						: []

				const duration = normalizedSegments.length
					? normalizedSegments[normalizedSegments.length - 1].end ?? durationFromAudio
					: durationFromAudio

				let output = plainText
				switch (outputFormat) {
					case 'srt':
						output = generateSRT(normalizedSegments)
						break
					case 'vtt':
						output = generateVTT(normalizedSegments)
						break
					case 'json':
						output = JSON.stringify(
							{
								text: result.text ?? plainText,
								language: result.language ?? language,
								chunks,
							},
							null,
							2
						)
						break
					default:
						break
				}

				const transcriptionResult = {
					id: Date.now().toString(),
					filename: file.name,
					duration,
					text: output,
					language: result.language || language,
					created_at: new Date().toISOString(),
					file_size: file.size,
					segments: normalizedSegments,
					format: outputFormat,
					actualPrice: 0,
					mode: 'webgpu' as const,
					metadata: {
						model: webgpuModel,
						tps: result.tps,
					},
				}

				addToHistory(transcriptionResult)
				setProgress(100)

				toast({
					title: '转录完成',
					description: '已在浏览器内通过 WebGPU 完成转录',
				})

				return transcriptionResult
			} catch (error) {
				console.error('WebGPU transcription error:', error)
				toast({
					title: '转录失败',
					description: error instanceof Error ? error.message : 'WebGPU 转录失败',
					variant: 'destructive',
				})
				throw error
			} finally {
				if (workerPromiseRef.current) {
					workerPromiseRef.current = null
				}
			}
		},
		[addToHistory, ensureWorker, language, outputFormat, toast, webgpuModel]
	)

	const transcribe = useCallback(
		async (file: File) => {
			setIsLoading(true)
			setProgress(0)

			try {
				if (transcriptionMode === 'webgpu') {
					return await transcribeWithWebgpu(file)
				}

				return await transcribeWithApi(file)
			} catch (error) {
				console.error('Transcription error:', error)
				throw error
			} finally {
				setIsLoading(false)
				setProgress(0)
			}
		},
		[transcribeWithApi, transcribeWithWebgpu, transcriptionMode]
	)

	return {
		transcribe,
		progress,
		isLoading,
	}
}

