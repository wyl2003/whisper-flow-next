import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Whisper Flow",
  description: "使用 OpenAI Whisper 将音视频转换为文字",
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
