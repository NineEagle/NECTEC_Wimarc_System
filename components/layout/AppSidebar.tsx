"use client"

import type React from "react"
import { useMemo } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { useStation } from "@/contexts/StationContext"
import type { Station } from "@/types"
import {
  LayoutDashboard, History, Calendar, Download, Activity,
  Map, GitCompare, Settings, Users, CreditCard, Waves, LogOut, ChevronUp,
} from "lucide-react"
import { canAccessAdminPages, canAccessSimPayments, getRoleDisplayName } from "@/utils/permissions"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StationTypeToggle } from "@/components/layout/StationTypeToggle"
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
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarRail, useSidebar,
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

function StationPicker() {
  const { state } = useSidebar()
  const {
    permittedStations, clients,
    selectedStationId, setSelectedStationId,
    isLoading: stationLoading,
  } = useStation()

  type StationGroup = { num: number; main?: Station; client?: Station }
  const stationGroups = useMemo((): StationGroup[] => {
    const map: Record<number, StationGroup> = {}
    for (const s of permittedStations) {
      const m = s.id.match(/^wimarc(\d+)(c?)$/)
      if (!m) continue
      const n = parseInt(m[1], 10)
      if (!map[n]) map[n] = { num: n }
      if (m[2] === "c") map[n].client = s
      else map[n].main = s
    }
    return Object.values(map).sort((a, b) => a.num - b.num)
  }, [permittedStations])

  const selectedNumber = useMemo(() => {
    const m = selectedStationId?.match(/^wimarc(\d+)c?$/)
    return m ? parseInt(m[1], 10) : null
  }, [selectedStationId])

  const selectedType: "main" | "client" | null = selectedStationId
    ? selectedStationId.endsWith("c") ? "client" : "main"
    : null

  const currentGroup = stationGroups.find((g) => g.num === selectedNumber)

  const ownerName = useMemo(() => {
    const station = permittedStations.find((s) => s.id === selectedStationId)
    if (!station) return null
    const owner = clients.find((c) => c.id === station.ownerId)
    return owner?.fullName ?? null
  }, [selectedStationId, permittedStations, clients])

  const handleNumberChange = (val: string) => {
    const n = parseInt(val, 10)
    const group = stationGroups.find((g) => g.num === n)
    if (!group) return
    const wantClient = selectedType === "client" && group.client
    const next = wantClient ? group.client! : group.main ?? group.client!
    setSelectedStationId(next.id)
  }

  const handleTypeChange = (val: string) => {
    if (!currentGroup) return
    const next = val === "client" ? currentGroup.client : currentGroup.main
    if (next) setSelectedStationId(next.id)
  }

  if (stationLoading || stationGroups.length === 0) return null
  if (state === "collapsed") return null

  return (
    <SidebarGroup className="border-t pt-3 mt-1">
      <SidebarGroupLabel className="text-[10px] uppercase tracking-wider px-2 mb-1">สถานี</SidebarGroupLabel>
      <SidebarGroupContent className="space-y-2 px-2">
        {stationGroups.length > 1 && (
          <Select value={selectedNumber?.toString()} onValueChange={handleNumberChange}>
            <SelectTrigger className="h-8 text-xs w-full bg-background">
              <SelectValue placeholder="เลือกสถานี" />
            </SelectTrigger>
            <SelectContent>
              {stationGroups.map((g) => (
                <SelectItem key={g.num} value={g.num.toString()} className="text-xs">
                  wimarc{g.num}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <StationTypeToggle
          value={selectedType}
          hasMain={!!currentGroup?.main}
          hasClient={!!currentGroup?.client}
          onChange={handleTypeChange}
          fullWidth
        />
        {ownerName && (
          <p className="text-[10px] text-muted-foreground px-0.5 truncate">
            สวน: <span className="font-medium text-foreground">{ownerName}</span>
          </p>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

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
        <StationPicker />
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
