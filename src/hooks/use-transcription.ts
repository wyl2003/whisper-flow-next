"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'
import { useTranscriptionStore } from '@/store/transcription-store'
import { useToast } from '@/components/ui/use-toast'
import { useI18n } from '@/components/i18n-provider'
import {
	convertChineseScript,
	getChineseScriptPreference,
	normalizeWhisperLanguage,
	type ChineseScriptPreference,
} from '@/lib/chinese-script'

const WEBGPU_SAMPLE_RATE = 16000
const WEBGPU_WORKER_URL = '/workers/webgpu-transcriber.worker.js'
const AUDIO_CONTEXT_UNSUPPORTED = 'AUDIO_CONTEXT_UNSUPPORTED'

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

type WebgpuWorkerErrorCode = 'pipeline-init-failed' | 'transcription-failed'

type WebgpuWorkerMessage =
	| { status: 'initiate' | 'ready' | 'done' }
	| { status: 'progress'; progress?: number; file?: string; loaded?: number; total?: number }
	| { status: 'update'; data: { chunks: WebgpuWorkerChunk[]; text?: string; tps?: number } }
	| { status: 'complete'; data: WebgpuWorkerResult }
	| { status: 'error'; data?: { message?: string; code?: WebgpuWorkerErrorCode } }
	| { status: string; [key: string]: unknown }

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

const decodeArrayBuffer = async (arrayBuffer: ArrayBuffer) => {
	const AudioContextCtor = getAudioContextConstructor()
	if (!AudioContextCtor) {
		throw new Error(AUDIO_CONTEXT_UNSUPPORTED)
	}

	let audioContext: AudioContext | null = null
	try {
		audioContext = new AudioContextCtor({ sampleRate: WEBGPU_SAMPLE_RATE } as AudioContextOptions)
	} catch {
		audioContext = new AudioContextCtor()
	}

	try {
		return await audioContext.decodeAudioData(arrayBuffer.slice(0))
	} finally {
		if (audioContext.state !== 'closed') {
			await audioContext.close().catch(() => {})
		}
	}
}

const decodeAudioFile = async (
	file: File,
	fallbackArrayBufferProvider?: () => Promise<ArrayBuffer>
) => {
	const arrayBuffer = await file.arrayBuffer()
	let audioBuffer: AudioBuffer

	try {
		audioBuffer = await decodeArrayBuffer(arrayBuffer)
	} catch (decodeError) {
		if (!fallbackArrayBufferProvider) {
			throw decodeError
		}
		const fallbackBuffer = await fallbackArrayBufferProvider()
		audioBuffer = await decodeArrayBuffer(fallbackBuffer)
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

const convertSegments = (
	segments: Array<{ id: number; start: number; end: number; text: string }>,
	preference: ChineseScriptPreference
) =>
	segments.map((segment) => ({
		...segment,
		text: convertChineseScript(segment.text, preference),
	}))

const hasPunctuation = (text: string) => /[，。！？；：、,.!?;:]/.test(text)

const isChineseLanguage = (language: string | null | undefined) => Boolean(language && language.startsWith('zh'))

const hasChineseCharacters = (text: string) => /[\u3400-\u9fff]/.test(text)

const endsWithPunctuation = (text: string) => /[，。！？；：、,.!?;:]$/.test(text)

const punctuateChineseByLength = (text: string) => {
	const chars = text.trim().split('')
	if (chars.length === 0) {
		return text
	}

	let output = ''
	let runLength = 0
	let commaCountSincePeriod = 0

	for (let i = 0; i < chars.length; i++) {
		const ch = chars[i]
		output += ch

		if (/[，。！？；：、,.!?;:]/.test(ch)) {
			runLength = 0
			if (/[。！？.!?]/.test(ch)) {
				commaCountSincePeriod = 0
			}
			continue
		}

		runLength += 1
		const isLast = i === chars.length - 1
		if (isLast) {
			continue
		}

		if (runLength >= 22) {
			commaCountSincePeriod += 1
			if (commaCountSincePeriod >= 3) {
				output += '。'
				commaCountSincePeriod = 0
			} else {
				output += '，'
			}
			runLength = 0
		}
	}

	if (!endsWithPunctuation(output)) {
		output += '。'
	}

	return output
}

const buildChineseTextWithPunctuation = (
	segments: Array<{ start: number; end: number; text: string }>,
	fallbackText: string
) => {
	if (segments.length === 0) {
		return punctuateChineseByLength(fallbackText)
	}

	let output = ''
	let commaCountSincePeriod = 0

	for (let i = 0; i < segments.length; i++) {
		const currentText = segments[i].text.trim()
		if (!currentText) {
			continue
		}

		output += currentText
		if (endsWithPunctuation(currentText)) {
			continue
		}

		const next = segments[i + 1]
		if (!next) {
			output += '。'
			commaCountSincePeriod = 0
			continue
		}

		const gap = Math.max(0, next.start - segments[i].end)
		if (gap >= 0.9) {
			output += '。'
			commaCountSincePeriod = 0
		} else if (gap >= 0.35) {
			output += '，'
			commaCountSincePeriod += 1
		} else if (currentText.length >= 6) {
			if (commaCountSincePeriod >= 2) {
				output += '。'
				commaCountSincePeriod = 0
			} else {
				output += '，'
				commaCountSincePeriod += 1
			}
		}
	}

	const resolved = output || fallbackText
	if (!hasPunctuation(resolved)) {
		return punctuateChineseByLength(resolved)
	}
	return resolved
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
	const { t } = useI18n()

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
				const data = (message.data as { message?: string; code?: string } | undefined) ?? {}
				let errorMessage: string
				switch (data.code) {
					case 'pipeline-init-failed':
						errorMessage = t('errors.webgpuPipelineInit')
						break
					case 'transcription-failed':
						errorMessage = t('errors.webgpuGeneric')
						break
					default:
						errorMessage = data.message || t('errors.webgpuGeneric')
						break
				}

				if (workerPromiseRef.current) {
					workerPromiseRef.current.reject(new Error(errorMessage))
					workerPromiseRef.current = null
				}
				break
			}
			default:
				break
		}
		}, [t])

	const ensureWorker = useCallback(() => {
		if (typeof window === 'undefined') {
			return null
		}

		if (!workerRef.current) {
			try {

				const worker = new Worker(WEBGPU_WORKER_URL, { type: 'module' })
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
				console.error('Failed to create WebGPU worker:', error)
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
			console.error('Failed to load FFmpeg:', error)
			toast({
				title: t('toasts.loadFfmpegErrorTitle'),
				description: t('toasts.loadFfmpegErrorDescription'),
				variant: 'destructive',
			})
			throw error
		}
		}, [ffmpeg, isFFmpegLoaded, t, toast])

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
			console.error('Audio transcoding failed:', error)
			throw error
		}
	}, [ensureFFmpegLoaded, ffmpeg])

	const convertToWavArrayBuffer = useCallback(async (file: File) => {
		if (!ffmpeg) {
			throw new Error('FFmpeg not initialized')
		}

		await ensureFFmpegLoaded()

		try {
			const inputFileName = `webgpu-input-${Date.now()}.bin`
			const outputFileName = `webgpu-output-${Date.now()}.wav`
			const data = new Uint8Array(await file.arrayBuffer())
			await ffmpeg.writeFile(inputFileName, data)
			await ffmpeg.exec([
				'-i',
				inputFileName,
				'-vn',
				'-ac',
				'1',
				'-ar',
				WEBGPU_SAMPLE_RATE.toString(),
				'-f',
				'wav',
				outputFileName,
			])
			const outputData = await ffmpeg.readFile(outputFileName)
			const bufferView =
				outputData instanceof Uint8Array
					? outputData
					: typeof outputData === 'string'
						? new TextEncoder().encode(outputData)
						: new Uint8Array(outputData as unknown as ArrayBufferLike)

			return bufferView.buffer.slice(
				bufferView.byteOffset,
				bufferView.byteOffset + bufferView.byteLength
			) as ArrayBuffer
		} catch (error) {
			console.error('WebGPU 音频转码失败:', error)
			throw new Error('无法解码该音频文件，请尝试重新导出为 AAC/MP3/WAV 后重试')
		}
	}, [ensureFFmpegLoaded, ffmpeg])

	const transcribeWithApi = useCallback(async (file: File) => {
		if (!ffmpeg) {
			throw new Error('FFmpeg not initialized')
		}

		if (!apiKey) {
			toast({
				title: t('toasts.missingApiKeyTitle'),
				description: t('toasts.missingApiKeyDescription'),
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
		const languageOption = normalizeWhisperLanguage(language)
		const chineseScriptPreference = getChineseScriptPreference(language)
		if (languageOption) {
			formData.append('language', languageOption)
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
			let errorMessage = t('errors.defaultApi')

			if (errorData.error) {
				if (errorData.error.type === 'invalid_request_error') {
					errorMessage = t('errors.invalidRequest')
				} else if (errorData.error.type === 'authentication_error') {
					errorMessage = t('errors.authentication')
				} else if (errorData.error.message) {
					errorMessage = errorData.error.message
				}
			}

			toast({
				title: t('toasts.transcriptionFailedTitle'),
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

		if (chineseScriptPreference) {
			text = convertChineseScript(text, chineseScriptPreference)
			segments = convertSegments(segments, chineseScriptPreference)
			if (result) {
				result = {
					...result,
					text,
					segments,
				}
			}
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
			language: language === 'auto' ? result?.language || language : language,
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
			title: t('toasts.transcriptionCompleteTitle'),
			description: t('toasts.transcriptionCompleteDescriptionApi', {
				amount: formatPriceValue(actualPrice, currency),
			}),
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
		t,
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
						title: t('toasts.webgpuUnsupportedTitle'),
						description: t('toasts.webgpuUnsupportedDescription'),
						variant: 'destructive',
					})
					throw new Error(t('errors.webgpuUnsupported'))
				}

				const worker = ensureWorker()
				if (!worker) {
					toast({
						title: t('toasts.webgpuInitErrorTitle'),
						description: t('toasts.webgpuInitErrorDescription'),
						variant: 'destructive',
					})
					throw new Error(t('errors.webgpuGeneric'))
				}

				setProgress(10)
				let audioBuffer: AudioBuffer
				try {
					audioBuffer = await decodeAudioFile(file, () => convertToWavArrayBuffer(file))
				} catch (error) {
					const message =
							error instanceof Error && error.message === AUDIO_CONTEXT_UNSUPPORTED
							? t('errors.audioContextUnsupported')
						: error instanceof Error && error.message
							? error.message
						: t('errors.webgpuGeneric')
					throw new Error(message)
				}
				setProgress(20)
				const monoAudio = toMonoFloat32(audioBuffer)
				const durationFromAudio = audioBuffer.duration

				const languageOption = normalizeWhisperLanguage(language)
				const chineseScriptPreference = getChineseScriptPreference(language)

				const result = await new Promise<WebgpuWorkerResult>((resolve, reject) => {
					if (workerPromiseRef.current) {
						workerPromiseRef.current.reject(new Error(t('errors.webgpuWorkerConflict')))
					}

					workerPromiseRef.current = { resolve, reject }

					try {
						worker.postMessage(
							{
								audio: monoAudio,
								model: webgpuModel,
								language: languageOption,
								prompt: prompt || null,
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
				const resolvedChunks = chineseScriptPreference
					? chunks.map((chunk) => ({
							...chunk,
							text: convertChineseScript(chunk.text, chineseScriptPreference),
						}))
					: chunks

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

				const resolvedSegments = chineseScriptPreference
					? convertSegments(normalizedSegments, chineseScriptPreference)
					: normalizedSegments
				const resolvedLanguage = language === 'auto' ? result.language || language : language
				let resolvedPlainText = convertChineseScript(plainText, chineseScriptPreference)
				const shouldAutoPunctuateChinese =
					isChineseLanguage(resolvedLanguage) &&
					hasChineseCharacters(resolvedPlainText) &&
					!hasPunctuation(resolvedPlainText)
				if (shouldAutoPunctuateChinese) {
					resolvedPlainText = buildChineseTextWithPunctuation(resolvedSegments, resolvedPlainText)
				}

				const duration = resolvedSegments.length
					? resolvedSegments[resolvedSegments.length - 1].end ?? durationFromAudio
					: durationFromAudio

				let output = resolvedPlainText
				switch (outputFormat) {
					case 'srt':
						output = generateSRT(resolvedSegments)
						break
					case 'vtt':
						output = generateVTT(resolvedSegments)
						break
					case 'json':
						output = JSON.stringify(
							{
								text: resolvedPlainText,
								language: result.language ?? language,
								chunks: resolvedChunks,
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
					language: resolvedLanguage,
					created_at: new Date().toISOString(),
					file_size: file.size,
					segments: resolvedSegments,
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
					title: t('toasts.transcriptionCompleteTitle'),
					description: t('toasts.transcriptionCompleteDescriptionWebgpu'),
				})

				return transcriptionResult
			} catch (error) {
				console.error('WebGPU transcription error:', error)
				toast({
					title: t('toasts.transcriptionFailedTitle'),
					description:
						error instanceof Error && error.message
							? error.message
							: t('toasts.transcriptionFailedDescription'),
					variant: 'destructive',
				})
				throw error
			} finally {
				if (workerPromiseRef.current) {
					workerPromiseRef.current = null
				}
			}
		},
    [addToHistory, convertToWavArrayBuffer, ensureWorker, language, outputFormat, prompt, t, toast, webgpuModel]
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
