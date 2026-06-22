import type { Metadata } from "next"
import { JetBrains_Mono, DM_Sans, Syne } from "next/font/google"
import "./globals.css"

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
  weight: ["400", "500", "600", "700"],
})

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
  weight: ["300", "400", "500", "600"],
})

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
})

export const metadata: Metadata = {
  title: "CodeBase — Understand any codebase in 60 seconds",
  description: "AI-powered codebase onboarding. Drop a GitHub URL, get instant understanding.",
  icons: { icon: "/next.svg" },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${jetbrainsMono.variable} ${dmSans.variable} ${syne.variable}`}
    >
      <body>{children}</body>
    </html>
  )
}
