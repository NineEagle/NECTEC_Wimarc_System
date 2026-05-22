import type React from "react"
/**
 * Root layout for WiMaRC application
 * Provides authentication context and global styling
 */

import type { Metadata, Viewport } from "next"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

import { AuthProvider } from "@/contexts/AuthContext"
import { StationProvider } from "@/contexts/StationContext"
import { Toaster } from "@/components/ui/toaster"
import { AppShell } from "@/components/layout/AppShell"
import { SessionProviderWrapper } from "@/components/SessionProviderWrapper"

import { Sarabun } from "next/font/google"

// Initialize fonts
const sarabun = Sarabun({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-sarabun",
})

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: "WIMARC - ระบบตรวจวัดและจัดเก็บสภาวะแวดล้อม",
  description: "ระบบตรวจวัดและจัดเก็บสภาวะแวดล้อมเชิงพื้นที่ด้วยเซนเซอร์บนเครือข่ายไร้สาย",
  generator: "wimarc",
  icons: {
    icon: "/apple-icon.png",
    apple: "/apple-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="th">
      <body className={`${sarabun.variable} font-sans antialiased overflow-x-hidden`}>
        <SessionProviderWrapper>
          <AuthProvider>
            <StationProvider>
              <AppShell>{children}</AppShell>
              <Toaster />
            </StationProvider>
          </AuthProvider>
        </SessionProviderWrapper>
        <Analytics />
      </body>
    </html>
  )
}
