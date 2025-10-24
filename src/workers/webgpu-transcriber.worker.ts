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

		transformersPromise = import('@huggingface/transformers')
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
		const { pipeline } = await loadTransformersModule()

		const options: Record<string, unknown> = {
			device: 'webgpu',
			progress_callback: (data: ProgressMessage) => ctx.postMessage(data),
		}

		if (model === 'onnx-community/whisper-large-v3-turbo') {
			options.dtype = { encoder_model: 'fp16', decoder_model_merged: 'q4' }
		}

		pipelineInstance = (await pipeline('automatic-speech-recognition', model, options)) as unknown as PipelineInstance
		currentModel = model
	}

	return pipelineInstance
}

const transcribe = async ({ audio, model, subtask, language }: WorkerRequest) => {
	const { WhisperTextStreamer } = await loadTransformersModule()

	const transcriber = await getPipeline(model)

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
