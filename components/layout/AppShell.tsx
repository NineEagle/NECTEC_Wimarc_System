"use client"

import type React from "react"
import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { AppHeader } from "@/components/layout/AppHeader"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

const PUBLIC_ROUTES = new Set<string>(["/"])

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { isAuthenticated, isAuthLoading } = useAuth()

  const isPublicRoute = PUBLIC_ROUTES.has(pathname ?? "")

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
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <main className="flex-1 p-4 lg:p-6 min-w-0">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
