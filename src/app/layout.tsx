import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Whisper Flow - 免费、本地的语音转文字工具",
  description: "Whisper Flow 是一款免费、保护隐私的语音转文字应用。利用 WebGPU 技术在您的浏览器本地完成音频和视频转录，无需上传文件，安全高效。",
  keywords: ["免费语音转文字", "语音转文字", "音频转文字", "视频转文字", "语音识别", "音频转录", "本地转录", "离线转录", "WebGPU", "Whisper", "OpenAI", "隐私保护", "免费工具"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <main className="min-h-screen bg-background">
          <div className="container py-10 space-y-8">
            {children}
          </div>
        </main>
        <Toaster />
      </body>
    </html>
  );
}
