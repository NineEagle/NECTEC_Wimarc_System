"use client"

import type React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { useStation } from "@/contexts/StationContext"
import { cn } from "@/lib/utils"
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
  Building2,
  Radio,
} from "lucide-react"
import { canAccessAdminPages, canAccessSimPayments } from "@/utils/permissions"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
  requiresSimAccess?: boolean
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
    selectedClientId,
    selectedStationId,
    setSelectedClientId,
    setSelectedStationId,
    isLoading: stationLoading,
  } = useStation()

  const visibleNavItems = navItems.filter((item) => {
    if (item.adminOnly && !canAccessAdminPages(user)) return false
    if (item.requiresSimAccess && !canAccessSimPayments(user)) return false
    return true
  })

  const stationsForClient = selectedClientId
    ? permittedStations.filter((s) => s.ownerId === selectedClientId)
    : permittedStations

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onClose} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-16 left-0 z-40 h-[calc(100vh-4rem)] w-64 border-r bg-background transition-transform duration-200 ease-in-out flex flex-col",
          "lg:sticky lg:translate-x-0 lg:bg-muted/30",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Mobile-only: station selector at top of sidebar */}
        {!stationLoading && (
          <div className="lg:hidden border-b p-3 space-y-2 shrink-0">
            {clients.length > 0 && (
              <div className="space-y-1">
                <Label className="flex items-center gap-1.5 text-xs text-muted-foreground font-normal">
                  <Building2 className="h-3 w-3" />
                  ไคลเอนต์
                </Label>
                <Select
                  value={selectedClientId ?? undefined}
                  onValueChange={(id) => {
                    setSelectedClientId(id)
                  }}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="เลือกไคลเอนต์" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label className="flex items-center gap-1.5 text-xs text-muted-foreground font-normal">
                <Radio className="h-3 w-3" />
                สถานี
              </Label>
              <Select
                value={selectedStationId ?? undefined}
                onValueChange={(id) => {
                  setSelectedStationId(id)
                }}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="เลือกสถานี" />
                </SelectTrigger>
                <SelectContent>
                  {stationsForClient.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
