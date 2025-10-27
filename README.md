# Whisper Flow Next

A modern browser-based audio and video transcription app powered by OpenAI Whisper, built with Next.js. Start transcribing instantly at [whisper.wyls.top](https://whisper.wyls.top/).

一个现代化的浏览器端音视频转文字应用，基于 OpenAI Whisper 和 Next.js 构建。访问 [whisper.wyls.top](https://whisper.wyls.top/) 立即体验。

## Overview | 项目概览

- **Use cases / 使用场景**: Accurate speech-to-text in the browser, no server required.
- **Privacy / 隐私保护**: WebGPU local transcription keeps your audio on-device.
- **Multilingual / 多语言支持**: Detects and transcribes multiple languages automatically.

## Key Features | 核心特性

- 🎯 Browser-side format conversion for common audio/video files. 支持常见音视频在浏览器端转换为可识别格式。
- 🔒 WebGPU-powered on-device transcription for maximum privacy. 支持在浏览器中使用 WebGPU 本地转录，全面保护隐私。
- 🌍 Automatic language detection across global languages. 自动识别并转录多种语言。
- 💾 Persistent local history of past transcriptions. 支持在本地保存转录历史记录。
- 📝 Export transcripts as SRT, TXT, and more. 支持 SRT、TXT 等多种导出格式。
- 💰 Real-time pricing estimate when using API transcription. 使用 API 转录时实时估算成本。

## Tech Stack | 技术栈

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- FFmpeg.wasm
- @huggingface/transformers.js
- Zustand

## Getting Started | 本地开发

```bash
# Install dependencies / 安装依赖
npm install

# Start the dev server / 启动开发服务器
npm run dev
```

Visit `http://localhost:3000` in your browser to verify the app. 在浏览器中访问 `http://localhost:3000` 确认项目正常运行。

## Deployment | 部署

Deploy to Vercel or Cloudflare Pages with one click. 可一键部署至 Vercel 或 Cloudflare Pages。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/wyl2003/whisper-flow)
[![Deploy to Cloudflare Pages](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/wyl2003/whisper-flow)

Live demo: [whisper-flow.vercel.app](https://whisper-flow.vercel.app/)

在线预览: [whisper-flow.vercel.app](https://whisper-flow.vercel.app/)

## Environment Variables | 环境变量

```env
# Required when using the OpenAI API / 使用 OpenAI API 时必填
NEXT_PUBLIC_OPENAI_API_KEY=your_api_key
NEXT_PUBLIC_OPENAI_API_ENDPOINT=your_api_endpoint
```

## License & Credits | 许可证与致谢

Inspired by `xenova/whisper-web` with additional improvements. Huge thanks to the original open-source contributors.

项目受 `xenova/whisper-web` 启发，并在此基础上进行了扩展和优化，感谢原作者的开源贡献。

Licensed under the MIT License. 使用 MIT 许可证。
