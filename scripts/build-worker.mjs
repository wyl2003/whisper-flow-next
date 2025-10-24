import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { mkdir } from 'node:fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..')
const entryPoint = resolve(rootDir, 'src/workers/webgpu-transcriber.worker.ts')
const outDir = resolve(rootDir, 'public/workers')
const outfile = resolve(outDir, 'webgpu-transcriber.worker.js')

async function buildWorker() {
  await mkdir(outDir, { recursive: true })

  const isDev = process.env.NODE_ENV === 'development'

  await build({
    entryPoints: [entryPoint],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['es2022'],
    minify: !isDev,
    sourcemap: isDev ? 'inline' : false,
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    },
    logLevel: 'info',
  })
}

buildWorker().catch((error) => {
  console.error('Failed to build WebGPU worker:', error)
  process.exitCode = 1
})
