"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { AppHeader } from "@/components/layout/AppHeader"
import { AppSidebar } from "@/components/layout/AppSidebar"

const PUBLIC_ROUTES = new Set<string>(["/"])

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { isAuthenticated, isAuthLoading } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isPublicRoute = PUBLIC_ROUTES.has(pathname ?? "")

  // Set html font-size: 24px for authenticated pages, 18px for login
  useEffect(() => {
    document.documentElement.style.fontSize = isPublicRoute ? "18px" : "24px"
    return () => { document.documentElement.style.fontSize = "18px" }
  }, [isPublicRoute])

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!isPublicRoute && !isAuthLoading && !isAuthenticated) {
      router.push("/")
    }
  }, [isPublicRoute, isAuthLoading, isAuthenticated, router])

  if (isPublicRoute) {
    return <>{children}</>
  }

  if (isAuthLoading || !isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen">
      <AppHeader onMenuClick={() => setSidebarOpen((o) => !o)} />
      <div className="flex">
        <AppSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 p-4 lg:p-6 min-w-0">{children}</main>
      </div>
    </div>
  )
}
