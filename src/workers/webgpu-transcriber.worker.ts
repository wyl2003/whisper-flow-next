/// <reference lib="webworker" />

type WorkerRequest = {
	audio: Float32Array
	model: string
	language?: string | null
	subtask?: string | null
}

interface ProgressMessage {
	status: string
	file?: string
	progress?: number
	loaded?: number
	total?: number
}

interface PipelineInstance {
	processor: { feature_extractor: { config: { chunk_length: number } } }
	model: { config: { max_source_positions: number } }
	tokenizer: unknown
	dispose?: () => Promise<void> | void
	(
		input: Float32Array,
		options: Record<string, unknown>
	): Promise<{ text: string; language?: string; chunks?: WebgpuWorkerChunk[] }>
}

interface WebgpuWorkerChunk {
	text: string
	timestamp: [number, number | null]
}

interface CompletionPayload {
	text: string
	language?: string
	chunks?: WebgpuWorkerChunk[]
	tps?: number
}

const ctx = self as unknown as DedicatedWorkerGlobalScope

let currentModel: string | null = null
let pipelineInstance: PipelineInstance | null = null

type TransformersModule = typeof import('@huggingface/transformers')

let transformersPromise: Promise<TransformersModule> | null = null

const DEFAULT_REMOTE_HOST = 'https://huggingface.co/'
const FALLBACK_MIRROR_HOSTS = ['https://aifasthub.com/', 'https://hf-mirror.com/']
const HOST_PING_TIMEOUT_MS = 3000
const HOST_OVERRIDE_KEYS = ['NEXT_PUBLIC_HF_ENDPOINT', 'HF_ENDPOINT', 'VITE_HF_ENDPOINT']

type EnvRecord = Partial<Record<string, string | undefined>>

const ensureTrailingSlash = (host: string) => (host.endsWith('/') ? host : `${host}/`)

const resolveProcessEnv = (): EnvRecord | undefined => {
	const withProcess = globalThis as typeof globalThis & { process?: { env?: EnvRecord } }
	return withProcess.process?.env
}

const resolveEnvHostOverride = () => {
	const env = resolveProcessEnv()
	if (!env) {
		return null
	}
	for (const key of HOST_OVERRIDE_KEYS) {
		const value = env[key]
		if (value && value.trim()) {
			return ensureTrailingSlash(value.trim())
		}
	}
	return null
}

const pingHost = async (host: string) => {
	const normalizedHost = ensureTrailingSlash(host)
	const controller = new AbortController()
	const timeoutId = setTimeout(() => controller.abort(), HOST_PING_TIMEOUT_MS)
	try {
		await fetch(`${normalizedHost}favicon.ico`, {
			method: 'GET',
			mode: 'no-cors',
			cache: 'no-store',
			signal: controller.signal,
		})
		return true
	} catch (error) {
		console.warn(`Ping to ${normalizedHost} failed`, error)
		return false
	} finally {
		clearTimeout(timeoutId)
	}
}

let hostCandidates: string[] | null = null
let hostCandidatesPromise: Promise<string[]> | null = null
let activeHostIndex = 0
let lastAppliedHost: string | null = null

const resolveHostCandidates = async () => {
	if (hostCandidates) {
		return hostCandidates
	}
	if (!hostCandidatesPromise) {
		hostCandidatesPromise = (async () => {
			const overrideHost = resolveEnvHostOverride()
			if (overrideHost) {
				return [overrideHost]
			}

			const defaultHost = ensureTrailingSlash(DEFAULT_REMOTE_HOST)
			const mirrorHosts = FALLBACK_MIRROR_HOSTS.map(ensureTrailingSlash)
			const allHosts = [defaultHost, ...mirrorHosts]

			const reachableHosts: string[] = []
			for (const host of allHosts) {
				if (await pingHost(host)) {
					reachableHosts.push(host)
				}
			}

			if (reachableHosts.length > 0) {
				const remainingHosts = allHosts.filter((host) => !reachableHosts.includes(host))
				return [...reachableHosts, ...remainingHosts]
			}

			return allHosts
		})()
	}
	hostCandidates = await hostCandidatesPromise
	return hostCandidates
}

const applyRemoteHost = async (transformers: TransformersModule, desiredHost?: string) => {
	const candidates = await resolveHostCandidates()
	const candidateHost = desiredHost ?? candidates[activeHostIndex] ?? candidates[0] ?? DEFAULT_REMOTE_HOST
	const host = ensureTrailingSlash(candidateHost)
	if (lastAppliedHost === host) {
		return host
	}
	transformers.env.remoteHost = host
	lastAppliedHost = host
	return host
}

const loadTransformersModule = async (): Promise<TransformersModule> => {
	if (!transformersPromise) {
		const globalScope = globalThis as typeof globalThis
		const anyGlobal = globalScope as Record<string, unknown>

		if (typeof anyGlobal.window === 'undefined') {
			anyGlobal.window = globalScope
		}

		if (typeof anyGlobal.navigator === 'undefined') {
			anyGlobal.navigator = {
				userAgent: 'webgpu-worker',
				platform: 'webgpu-worker',
				product: 'WebWorker',
			} satisfies Record<string, unknown>
		}

		if (typeof anyGlobal.document === 'undefined') {
			anyGlobal.document = undefined
		}

		transformersPromise = (async () => {
			const module = await import('@huggingface/transformers')
			await applyRemoteHost(module)
			return module
		})()
	}

	return transformersPromise
}

const getPipeline = async (model: string) => {
	if (currentModel !== model && pipelineInstance) {
		try {
			await pipelineInstance.dispose?.()
		} catch (error) {
			console.warn('Failed to dispose previous pipeline instance', error)
		}
		pipelineInstance = null
	}

	if (!pipelineInstance) {
		const transformers = await loadTransformersModule()
		const { pipeline } = transformers
		const candidates = await resolveHostCandidates()

		const options: Record<string, unknown> = {
			device: 'webgpu',
			progress_callback: (data: ProgressMessage) => ctx.postMessage(data),
		}

		if (model === 'onnx-community/whisper-large-v3-turbo') {
			options.dtype = { encoder_model: 'fp16', decoder_model_merged: 'q4' }
		}

		const attemptOrder = [
			...candidates.slice(activeHostIndex),
			...candidates.slice(0, activeHostIndex),
		]

		let lastError: unknown = null
		for (let index = 0; index < attemptOrder.length; index++) {
			const host = attemptOrder[index]
			const appliedHost = await applyRemoteHost(transformers, host)
			try {
				pipelineInstance = (await pipeline('automatic-speech-recognition', model, options)) as unknown as PipelineInstance
				activeHostIndex = candidates.indexOf(appliedHost)
				currentModel = model
				break
			} catch (error) {
				lastError = error
				const hasAlternateHost = index < attemptOrder.length - 1
				if (hasAlternateHost) {
					console.warn(`Failed to load model from ${host}, retrying with alternate host`, error)
				}
			}
		}

		if (!pipelineInstance) {
			throw lastError instanceof Error ? lastError : new Error('Failed to initialize transcription pipeline')
		}
	}

	return pipelineInstance
}

const transcribe = async ({ audio, model, subtask, language }: WorkerRequest) => {
	const { WhisperTextStreamer } = await loadTransformersModule()

	let transcriber: PipelineInstance
	try {
		transcriber = await getPipeline(model)
	} catch (error) {
		console.error('Failed to initialize transcription pipeline', error)
		ctx.postMessage({
			status: 'error',
			data: {
				message: '模型资源加载失败，请检查网络连接或稍后重试',
			},
		})
		return null
	}

	const isDistil = model.startsWith('onnx-community/distil') || model.startsWith('distil-whisper/')
	const chunkLength = isDistil ? 20 : 30
	const strideLength = isDistil ? 3 : 5

	const timePrecision =
		transcriber.processor.feature_extractor.config.chunk_length /
		transcriber.model.config.max_source_positions

	const chunks: Array<{ text: string; offset: number; timestamp: [number, number | null]; finalised: boolean }> = []
	let chunkCount = 0
	let startTime: number | undefined
	let tokenCount = 0
	let tokensPerSecond: number | undefined

	const streamer = new WhisperTextStreamer(transcriber.tokenizer as any, {
		time_precision: timePrecision,
		on_chunk_start: (timestampStart: number) => {
			const offset = (chunkLength - strideLength) * chunkCount
			chunks.push({
				text: '',
				timestamp: [offset + timestampStart, null],
				offset,
				finalised: false,
			})
		},
		token_callback_function: () => {
			startTime ??= performance.now()
			if (tokenCount++ > 0) {
				tokensPerSecond = (tokenCount / (performance.now() - startTime)) * 1000
			}
		},
		callback_function: (text: string) => {
			if (chunks.length === 0) {
				return
			}

			chunks[chunks.length - 1].text += text

			ctx.postMessage({
				status: 'update',
				data: {
					text: '',
					chunks: chunks.map(({ text, timestamp }) => ({ text, timestamp })),
					tps: tokensPerSecond,
				},
			})
		},
		on_chunk_end: (timestampEnd: number) => {
			const current = chunks[chunks.length - 1]
			current.timestamp[1] = timestampEnd + current.offset
			current.finalised = true
		},
		on_finalize: () => {
			startTime = undefined
			tokenCount = 0
			chunkCount += 1
		},
	})

	const options: Record<string, unknown> = {
		top_k: 0,
		do_sample: false,
		chunk_length_s: chunkLength,
		stride_length_s: strideLength,
		return_timestamps: true,
		force_full_sequences: false,
		streamer,
	}

	if (language) {
		options.language = language
	}

	if (subtask) {
		options.task = subtask
	}

	const output = await transcriber(audio, options).catch((error: unknown) => {
		console.error(error)
		ctx.postMessage({
			status: 'error',
			data: error instanceof Error ? { message: error.message } : { message: 'Transcription failed' },
		})
		return null
	})

	if (!output) {
		return null
	}

	const payload: CompletionPayload = {
		...output,
		chunks: output.chunks ?? chunks.map(({ text, timestamp }) => ({ text, timestamp })),
		tps: tokensPerSecond,
	}

	ctx.postMessage({
		status: 'complete',
		data: payload,
	})

	return payload
}

ctx.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
	const message = event.data
	if (!message || !message.audio || !message.model) {
		return
	}

	await transcribe(message)
})

export {}
