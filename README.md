# Whisper Flow

一个现代化的在线音视频转文字NEXT应用，使用 OpenAI 的 Whisper 模型在浏览器端进行准确的语音识别。
点击直接开始使用 [https://whisper.wyls.top/]([https://whisper.wyls.top/]())

## 主要特性

- 🎯 支持多种音视频格式浏览器端转换为支持的格式
- 🔒 支持使用WebGPU在浏览器中本地转录，保护隐私
- 🌍 支持多语言识别
- 💾 本地历史记录
- 📝 多种输出格式（SRT、TXT等）
- 💰 实时价格估算（使用API转录时）

## 技术栈

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Shadcn/ui
- FFmpeg.wasm
- @huggingface/transformers.js
- Zustand

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## 部署

本项目可以轻松部署到 Vercel 或 Cloudflare Pages。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/wyl2003/whisper-flow)
[![Deploy to Cloudflare Pages](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/wyl2003/whisper-flow)

## 环境变量

```env
# 使用OpenAI API时需要
NEXT_PUBLIC_OPENAI_API_KEY=your_api_key
NEXT_PUBLIC_OPENAI_API_ENDPOINT=your_api_endpoint
```

## 许可证

MIT
