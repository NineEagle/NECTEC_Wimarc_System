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
      <SidebarHeader className="flex items-center justify-center pt-3.5 pb-2">
        <Link href="/dashboard" className={cn("flex items-center gap-2.5 min-w-0", isCollapsed && "justify-center")}>
          <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg overflow-hidden bg-primary/10">
            <Image src="/dlogo.png" alt="WiMaRC" width={32} height={32} className="object-contain" />
          </div>
          {!isCollapsed && (
            <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
              <span className="truncate font-bold tracking-widest">WIMARC</span>
              <span className="truncate text-[10px] text-muted-foreground">ตรวจวัดสภาวะแวดล้อม</span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      {/* Nav */}
      <SidebarContent className="gap-0 px-2 py-3">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu>
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
                        "flex w-full items-center rounded-lg px-2 transition-colors",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
                        isCollapsed && "justify-center"
                      )}
                    >
                      <Link href={item.href}>
                        <Icon className="size-4" />
                        {!isCollapsed && (
                          <span className="ml-2 text-sm font-medium">{item.label}</span>
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
      <SidebarFooter className="px-2 pb-3">
        {isCollapsed ? (
          /* Collapsed: avatar button → expand sidebar */
          <button
            onClick={toggleSidebar}
            className="flex w-full items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
            title="ขยาย / ออกจากระบบ"
          >
            <Avatar className="h-7 w-7 rounded-lg">
              <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        ) : (
          /* Expanded: user info row + logout button */
          <div className="flex items-center gap-2 px-1 py-1">
            <Avatar className="h-8 w-8 shrink-0 rounded-lg">
              <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 min-w-0 text-left text-sm leading-tight">
              <span className="truncate font-semibold">{user?.fullName}</span>
              <span className="truncate text-xs text-muted-foreground">
                {user ? getRoleDisplayName(user.role) : ""}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              title="ออกจากระบบ"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
