"use client"

import type React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import {
  LayoutDashboard, History, Calendar, Download, Activity,
  Map, GitCompare, Settings, Users, CreditCard, Waves, LogOut, ChevronsUpDown,
} from "lucide-react"
import { canAccessAdminPages, canAccessSimPayments, getRoleDisplayName } from "@/utils/permissions"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarRail, SidebarTrigger, useSidebar,
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
  { href: "/admin/system-status", label: "สถานะระบบ",          icon: Settings,   adminOnly: true },
  { href: "/admin/users",         label: "จัดการผู้ใช้",        icon: Users,      adminOnly: true },
  { href: "/payments",            label: "จัดการซิม",          icon: CreditCard, requiresSimAccess: true },
]

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

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
      {/* Header: Logo + SidebarTrigger */}
      <SidebarHeader
        className={cn(
          "flex pt-3.5",
          isCollapsed
            ? "flex-col items-center gap-3"
            : "flex-row items-center justify-between"
        )}
      >
        <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
          <div className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Waves className="size-4" />
          </div>
          {!isCollapsed && (
            <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
              <span className="truncate font-semibold">WiMaRC</span>
              <span className="truncate text-[10px] text-muted-foreground">ตรวจวัดสภาวะแวดล้อม</span>
            </div>
          )}
        </Link>
        <SidebarTrigger className="shrink-0 text-muted-foreground hover:text-foreground" />
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

      {/* Footer: User dropdown (TeamSwitcher style) */}
      <SidebarFooter className="px-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-background text-foreground">
                    <Avatar className="h-7 w-7 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-xs font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{user?.fullName}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user ? getRoleDisplayName(user.role) : ""}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg mb-4"
                align="start"
                side="top"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-xs font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{user?.fullName}</span>
                      <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive gap-2">
                  <LogOut className="size-4" />
                  ออกจากระบบ
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
