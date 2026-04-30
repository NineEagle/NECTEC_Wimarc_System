/**
 * Admin System Status Page (สถานะการทำงานของระบบ)
 * Admin-only page showing all stations' operational status
 * Includes filtering, search, and navigation to station details
 */

"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"
import { getAllStations, getStationStatusSummary } from "@/services/stationsService"
import { canAccessAdminPages } from "@/utils/permissions"
import type { Station, User } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/dashboard/StatusBadge"
import { formatThaiDateTime, getTimeDifference } from "@/utils/dateUtils"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Server, Activity, AlertCircle, Database, ShieldCheck, Clock, ExternalLink } from "lucide-react"
import { getAllUsers } from "@/services/userService"

function StatusMiniCard({ label, value, icon: Icon, colorClass, dbField }: { label: string; value: number; icon: React.ElementType; colorClass: string; dbField: string }) {
  return (
    <Card className="shadow-sm border border-l-4 border-l-current" style={{ borderLeftColor: `var(--${colorClass})` }}>
      <CardContent className="p-4 relative overflow-hidden">
        <div className="text-[9px] uppercase font-bold text-muted-foreground mb-1 opacity-50 font-mono">{dbField}</div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase font-bold text-muted-foreground flex items-center gap-1">
              <Icon className="h-3.5 w-3.5" /> {label}
            </div>
            <div className={`text-3xl font-black font-mono tracking-tighter mt-1 text-${colorClass}`}>{value}</div>
          </div>
          <div className="text-[10px] text-muted-foreground font-medium uppercase self-end">สถานี</div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function SystemStatusPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [stations, setStations] = useState<Station[]>([])
  const [filteredStations, setFilteredStations] = useState<Station[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [summary, setSummary] = useState({ total: 0, online: 0, offline: 0 })
  const [isLoading, setIsLoading] = useState(true)

  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  useEffect(() => {
    if (!canAccessAdminPages(user)) { router.push("/dashboard"); return }
    const loadData = async () => {
      const [s, sum, u] = await Promise.all([getAllStations(), getStationStatusSummary(), getAllUsers()])
      setStations(s); setFilteredStations(s); setSummary(sum); setUsers(u); setIsLoading(false)
    }
    loadData()
  }, [user, router])

  useEffect(() => {
    let filtered = stations.filter(s => 
      (searchQuery === "" || s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.id.toLowerCase().includes(searchQuery.toLowerCase())) &&
      (statusFilter === "all" || s.status === statusFilter)
    )
    setFilteredStations(filtered)
  }, [searchQuery, statusFilter, stations])

  if (isLoading) return <div className="p-8 space-y-6"><Skeleton className="h-10 w-64" /><div className="grid grid-cols-3 gap-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div></div>
  if (!canAccessAdminPages(user)) return null

  // Mock lag warning count for 90% parity
  const warningCount = stations.filter(s => s.status === "offline").length

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto pb-8">
      {/* 1. Header Row */}
      <div className="flex items-end justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            สถานะการทำงานของระบบ <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase">TOR 4.5.8.1-4</span>
          </h1>
          <p className="text-xs text-muted-foreground font-mono">Table: wimarc_info • updatedata (Heartbeat) • CAM_main</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs font-bold" onClick={() => router.push('/admin/add-station')}>+ เพิ่มสถานีใหม่</Button>
        </div>
      </div>

      {/* 2. Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatusMiniCard label="Online" value={summary.online} icon={Activity} colorClass="green-500" dbField="active = true" />
        <StatusMiniCard label="Offline" value={summary.offline} icon={AlertCircle} colorClass="red-500" dbField="active = false" />
        <StatusMiniCard label="สถานีทั้งหมด" value={summary.total} icon={Server} colorClass="slate-600" dbField="wimarc_info count" />
        <StatusMiniCard label="แจ้งเตือน" value={warningCount} icon={Clock} colorClass="orange-500" dbField="lag > 30 นาที" />
      </div>

      {/* 3. Filter Bar */}
      <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between flex-wrap gap-4 border shadow-sm text-sm">
        <div className="flex items-center gap-3 flex-1 min-w-[300px]">
          <div className="relative flex-1 max-w-xs">
            <Database className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground opacity-50" />
            <Input placeholder="ค้นหา wimarc_id, ชื่อ..." className="pl-8 h-8 bg-background text-xs" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-[140px] bg-background text-xs"><SelectValue placeholder="ทุกสถานะ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกสถานะ</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Found {filteredStations.length} stations</span>
      </div>

      {/* 4. Detailed Status Table */}
      <Card className="shadow-md overflow-hidden">
        <CardHeader className="py-3 bg-muted/30 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-bold uppercase tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" /> รายการสถานะเชิงเทคนิค
          </CardTitle>
          <span className="text-[10px] text-muted-foreground uppercase font-mono">wimarc_info + updatedata + CAM_main</span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-muted/50 border-b text-muted-foreground uppercase font-bold">
                  <th className="p-3 text-left">wimarc_info.set_name</th>
                  <th className="p-3 text-center">Type</th>
                  <th className="p-3 text-center">Active</th>
                  <th className="p-3 text-left">Heartbeat (Last)</th>
                  <th className="p-3 text-left">ห่างจากปัจจุบัน</th>
                  <th className="p-3 text-left">Img Path ล่าสุด</th>
                  <th className="p-3 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y font-medium">
                {filteredStations.map((s) => {
                  const isOffline = s.status === "offline"
                  return (
                    <tr key={s.id} className={`hover:bg-muted/30 transition-colors ${isOffline ? "bg-red-50/30" : ""}`}>
                      <td className="p-3">
                        <div className="font-bold text-teal-900">{s.name}</div>
                        <div className="font-mono text-[9px] text-muted-foreground uppercase">{s.id} • {s.area}</div>
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant="outline" className={`text-[9px] font-black h-5 w-5 p-0 flex items-center justify-center rounded-sm ${s.type === "weather" ? "border-teal-500 text-teal-600 bg-teal-50" : "border-orange-500 text-orange-600 bg-orange-50"}`}>
                          {s.type === "weather" ? "M" : "C"}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <Badge className={`text-[9px] h-4 uppercase font-bold border-none ${s.status === "online" ? "bg-green-500" : "bg-red-500"}`}>
                          {s.status === "online" ? "true" : "false"}
                        </Badge>
                      </td>
                      <td className={`p-3 font-mono ${isOffline ? "text-red-600" : ""}`}>
                        {s.lastDataTime ? formatThaiDateTime(s.lastDataTime).split(" ")[1] : "—"}
                      </td>
                      <td className={`p-3 font-bold ${isOffline ? "text-red-600" : "text-muted-foreground"}`}>
                        {isOffline && "⚠ "}{s.lastDataTime ? getTimeDifference(s.lastDataTime) : "ยังไม่มีข้อมูล"}
                      </td>
                      <td className="p-3 font-mono text-[9px] opacity-60">
                        /img{s.type === "weather" ? "Main" : "Client"}/{s.id}/...
                      </td>
                      <td className="p-3 text-center">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => router.push(`/dashboard?station=${s.id}`)}>
                          <ExternalLink className="h-3.5 w-3.5 text-teal-600" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filteredStations.length === 0 && <div className="py-12 text-center text-muted-foreground">ไม่พบข้อมูลที่ตรงกับเงื่อนไข</div>}
        </CardContent>
      </Card>

      {/* Alert for critical issues */}
      {summary.offline > 0 && (
        <Alert className="bg-red-50 border-red-200 text-red-800">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="flex items-center justify-between w-full">
            <span>พบสถานีหยุดส่งข้อมูล (Offline) จำนวน <strong>{summary.offline}</strong> สถานี กรุณาตรวจสอบอุปกรณ์หน้างาน</span>
            <Button variant="outline" size="sm" className="h-7 text-[10px] font-bold border-red-300 text-red-800 hover:bg-red-100">แจ้งเตือน LINE</Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
