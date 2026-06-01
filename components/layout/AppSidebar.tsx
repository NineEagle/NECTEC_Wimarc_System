"use client"

import type React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import {
  LayoutDashboard, History, Calendar, Download, Activity,
  Map, GitCompare, Settings, Users, CreditCard, Waves, LogOut, ChevronUp,
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
  SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarRail,
} from "@/components/ui/sidebar"

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
  requiresSimAccess?: boolean
}

const navItems: NavItem[] = [
  { href: "/dashboard",           label: "สภาวะแวดล้อม",       icon: LayoutDashboard },
  { href: "/historical",          label: "ข้อมูลย้อนหลัง",      icon: History },
  { href: "/daily",               label: "ค่าเฉลี่ยรายวัน",     icon: Calendar },
  { href: "/download",            label: "ดาวน์โหลด",           icon: Download },
  { href: "/activities",          label: "กิจกรรมแปลง",         icon: Activity },
  { href: "/map",                 label: "แผนที่",               icon: Map },
  { href: "/compare",             label: "เปรียบเทียบสถานี",    icon: GitCompare },
  { href: "/admin/system-status", label: "สถานะระบบ",           icon: Settings, adminOnly: true },
  { href: "/admin/users",         label: "จัดการผู้ใช้",         icon: Users,    adminOnly: true },
  { href: "/payments",            label: "จัดการซิม",           icon: CreditCard, requiresSimAccess: true },
]


export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()

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
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Waves className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">WiMaRC</span>
                  <span className="truncate text-[10px] text-muted-foreground">ตรวจวัดสภาวะแวดล้อม</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleNavItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                      <Link href={item.href}>
                        <Icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-xs font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{user?.fullName}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user ? getRoleDisplayName(user.role) : ""}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="top"
                align="end"
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
