import { Inter } from "next/font/google"
import type { ReactNode } from "react"
import { defaultLocale } from "@/i18n"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={defaultLocale} suppressHydrationWarning>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
