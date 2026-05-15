"use client"

import type React from "react"
import { useMemo } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { useStation } from "@/contexts/StationContext"
import { cn } from "@/lib/utils"
import type { Station } from "@/types"
import {
  LayoutDashboard,
  History,
  Calendar,
  Download,
  Activity,
  Map,
  GitCompare,
  Settings,
  Users,
  CreditCard,

} from "lucide-react"
import { canAccessAdminPages, canAccessSimPayments } from "@/utils/permissions"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
  requiresSimAccess?: boolean
  requiresMultiStation?: boolean
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "ดูข้อมูลสภาวะแวดล้อม", icon: LayoutDashboard },
  { href: "/historical", label: "ดูข้อมูลย้อนหลัง", icon: History },
  { href: "/daily", label: "ค่าเฉลี่ยรายวัน", icon: Calendar },
  { href: "/download", label: "ดาวน์โหลดข้อมูล", icon: Download },
  { href: "/activities", label: "กิจกรรมแปลงเพาะปลูก", icon: Activity },
  { href: "/map", label: "แผนที่จุดติดตั้ง", icon: Map },
  { href: "/compare", label: "เปรียบเทียบ 2 สถานี", icon: GitCompare },
  { href: "/admin/system-status", label: "สถานะการทำงานของระบบ", icon: Settings, adminOnly: true },
  { href: "/admin/users", label: "จัดการผู้ใช้งาน", icon: Users, adminOnly: true },
  { href: "/payments", label: "จัดการซิม", icon: CreditCard, requiresSimAccess: true },
]

interface AppSidebarProps {
  open?: boolean
  onClose?: () => void
}

export function AppSidebar({ open = false, onClose }: AppSidebarProps) {
  const pathname = usePathname()
  const { user } = useAuth()
  const {
    clients,
    permittedStations,
    selectedStationId,
    setSelectedStationId,
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

  const visibleNavItems = navItems.filter((item) => {
    if (item.adminOnly && !canAccessAdminPages(user)) return false
    if (item.requiresSimAccess && !canAccessSimPayments(user)) return false
    if (item.requiresMultiStation && stationGroups.length < 2) return false
    return true
  })

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

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div className="fixed inset-0 z-[1050] bg-black/40 lg:hidden" onClick={onClose} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-16 left-0 z-[1100] h-[calc(100vh-4rem)] w-64 lg:border-r bg-background transition-transform duration-200 ease-in-out flex flex-col",
          "lg:sticky lg:translate-x-0 lg:bg-muted/30",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Mobile-only: station selector at top of sidebar */}
        {!stationLoading && stationGroups.length > 0 && (
          <div className="lg:hidden border-b p-3 space-y-2 shrink-0">
            {stationGroups.length > 1 && (
              <Select value={selectedNumber?.toString()} onValueChange={handleNumberChange}>
                <SelectTrigger className="h-8 text-sm w-full">
                  <SelectValue placeholder="เลือกสถานี" />
                </SelectTrigger>
                <SelectContent>
                  {stationGroups.map((g) => (
                    <SelectItem key={g.num} value={g.num.toString()}>
                      wimarc{g.num}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={selectedType ?? undefined} onValueChange={handleTypeChange}>
              <SelectTrigger className="h-8 text-sm w-full">
                <SelectValue placeholder="ประเภท" />
              </SelectTrigger>
              <SelectContent>
                {currentGroup?.main && <SelectItem value="main">สถานีอากาศ</SelectItem>}
                {currentGroup?.client && <SelectItem value="client">สถานีดิน</SelectItem>}
              </SelectContent>
            </Select>
            {/* Owner name */}
            {ownerName && (
              <p className="text-xs text-muted-foreground px-0.5 truncate">
                สวน: <span className="font-medium text-foreground">{ownerName}</span>
              </p>
            )}
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto space-y-1 p-4">
          {visibleNavItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="line-clamp-1">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
