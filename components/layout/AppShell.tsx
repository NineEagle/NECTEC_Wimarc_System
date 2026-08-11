"use client"

import type React from "react"
import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { useStation } from "@/contexts/StationContext"
import { AppSidebar } from "@/components/layout/AppSidebar"
import { AppHeader } from "@/components/layout/AppHeader"
import { GuestLocationGate } from "@/components/layout/GuestLocationGate"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

const PUBLIC_ROUTES = new Set<string>(["/", "/register", "/request-api", "/portal"])
// Guest is restricted to a single page
const GUEST_ALLOWED_ROUTES = new Set<string>(["/dashboard"])

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { isAuthenticated, isAuthLoading } = useAuth()
  const { isGuest, isGuestGeoLocked, geoStatus } = useStation()

  const isPublicRoute = PUBLIC_ROUTES.has(pathname ?? "")

  useEffect(() => {
    if (!isPublicRoute && !isAuthLoading && !isAuthenticated) {
      router.push("/")
    }
  }, [isPublicRoute, isAuthLoading, isAuthenticated, router])

  // Guest may only ever land on /dashboard — bounce any other route
  useEffect(() => {
    if (!isPublicRoute && isAuthenticated && isGuest && !GUEST_ALLOWED_ROUTES.has(pathname ?? "")) {
      router.replace("/dashboard")
    }
  }, [isPublicRoute, isAuthenticated, isGuest, pathname, router])

  if (isPublicRoute) {
    return <>{children}</>
  }

  if (isAuthLoading || !isAuthenticated) {
    return null
  }

  // Only a Guest without admin-assigned stations needs location — an assigned Guest
  // already knows which stations to show, so never gate them on geolocation.
  if (isGuestGeoLocked && geoStatus !== "granted") {
    return <GuestLocationGate status={geoStatus} />
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <AppHeader />
        <main className="flex-1 p-4 lg:p-6 min-w-0">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
