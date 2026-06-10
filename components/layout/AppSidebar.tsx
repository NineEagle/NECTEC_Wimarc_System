"use client"

import type React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import Image from "next/image"
import {
  LayoutDashboard, History, Calendar, Download, Activity,
  Map, GitCompare, Settings, Users, CreditCard, LogOut, LayoutGrid, SlidersHorizontal,
} from "lucide-react"
import { canAccessAdminPages, canAccessSimPayments, getRoleDisplayName } from "@/utils/permissions"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarRail, useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
  requiresSimAccess?: boolean
}

const navItems: NavItem[] = [
  { href: "/dashboard",           label: "สภาวะแวดล้อม",      icon: LayoutDashboard },
  { href: "/historical",          label: "ข้อมูลย้อนหลัง",     icon: History },
  { href: "/daily",               label: "ค่าเฉลี่ยรายวัน",    icon: Calendar },
  { href: "/download",            label: "ดาวน์โหลด",          icon: Download },
  { href: "/activities",          label: "กิจกรรมแปลง",        icon: Activity },
  { href: "/map",                 label: "แผนที่",              icon: Map },
  { href: "/compare",             label: "เปรียบเทียบสถานี",   icon: GitCompare },
  { href: "/overview",            label: "ภาพรวมสถานี",         icon: LayoutGrid,         adminOnly: true },
  { href: "/config",              label: "ตั้งค่าระบบ",          icon: SlidersHorizontal,  adminOnly: true },
  { href: "/admin/system-status", label: "สถานะระบบ",           icon: Settings,           adminOnly: true },
  { href: "/admin/users",         label: "จัดการผู้ใช้",        icon: Users,      adminOnly: true },
  { href: "/payments",            label: "จัดการซิม",          icon: CreditCard, requiresSimAccess: true },
]

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const { state, isMobile, toggleSidebar } = useSidebar()
  const isCollapsed = !isMobile && state === "collapsed"

  const handleLogout = () => {
    logout()
    router.push("/")
  }

  const visibleNavItems = (() => {
    if (!user) return []
    const filtered = navItems.filter((item) => {
      if (item.adminOnly && !canAccessAdminPages(user)) return false
      if (item.requiresSimAccess && !canAccessSimPayments(user)) return false
      return true
    })
    if (!canAccessAdminPages(user)) return filtered
    const mapIdx = filtered.findIndex(i => i.href === "/map")
    if (mapIdx <= 0) return filtered
    const reordered = [...filtered]
    const [mapItem] = reordered.splice(mapIdx, 1)
    reordered.unshift(mapItem)
    return reordered
  })()

  const initials = user
    ? (user.fullName?.trim().charAt(0) ?? user.role.charAt(0)).toUpperCase()
    : "?"

  return (
    <Sidebar variant="floating" collapsible="icon">
      {/* Header: Logo */}
      <SidebarHeader className="flex items-center justify-center pt-4 pb-2 px-3">
        <Link href="/dashboard" className={cn("flex items-center gap-3 min-w-0", isCollapsed && "justify-center")}>
          <div className="flex shrink-0 items-center justify-center rounded-2xl overflow-hidden bg-primary/10 shadow-sm" style={{ width: 36, height: 36 }}>
            <Image src="/apple-icon.png" alt="NECTEC" width={32} height={32} className="object-contain" />
          </div>
          {!isCollapsed && (
            <div className="grid flex-1 text-left leading-tight min-w-0">
              <span className="truncate font-extrabold tracking-widest" style={{ fontSize: 14 }}>WIMARC</span>
              <span className="truncate text-muted-foreground/70" style={{ fontSize: 10 }}>ตรวจวัดสภาวะแวดล้อม</span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      {/* Nav */}
      <SidebarContent className="gap-0 px-2.5 py-2">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {visibleNavItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.label}
                      className={cn(
                        "flex w-full items-center rounded-xl px-3 py-1.5 h-auto transition-all duration-150",
                        isActive
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        isCollapsed && "justify-center px-2"
                      )}
                    >
                      <Link href={item.href} className="flex items-center gap-3 w-full">
                        <Icon className={cn("shrink-0", isActive ? "opacity-100" : "opacity-50")} style={{ width: 16, height: 16 }} />
                        {!isCollapsed && (
                          <span className="font-medium" style={{ fontSize: 13 }}>{item.label}</span>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer: User info + Logout */}
      <SidebarFooter className="px-2.5 pb-4">
        {isCollapsed ? (
          <button
            onClick={toggleSidebar}
            className="flex w-full items-center justify-center rounded-2xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="ขยาย / ออกจากระบบ"
          >
            <Avatar className="rounded-xl" style={{ width: 28, height: 28 }}>
              <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-bold" style={{ fontSize: 11 }}>
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        ) : (
          <div className="flex items-center gap-2.5 rounded-2xl bg-muted/60 px-3 py-2.5">
            <Avatar className="shrink-0 rounded-xl" style={{ width: 32, height: 32 }}>
              <AvatarFallback className="rounded-xl bg-primary/15 text-primary font-bold" style={{ fontSize: 12 }}>
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 min-w-0 text-left leading-tight">
              <span className="truncate font-semibold" style={{ fontSize: 13 }}>{user?.fullName}</span>
              <span className="truncate text-muted-foreground" style={{ fontSize: 11 }}>
                {user ? getRoleDisplayName(user.role) : ""}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="shrink-0 rounded-xl p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              title="ออกจากระบบ"
            >
              <LogOut style={{ width: 16, height: 16 }} />
            </button>
          </div>
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
