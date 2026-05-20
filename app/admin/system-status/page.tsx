/**
 * Admin System Status Page (สถานะการทำงานของระบบ)
 * Admin-only page showing all stations' operational status
 * Includes filtering, search, and navigation to station details
 */

"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
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
import { Server, Activity, AlertCircle, Database, ShieldCheck, Clock, ExternalLink, LayoutGrid, List, Cpu, HardDrive, MemoryStick, Wifi, WifiOff, RefreshCw, CloudSun } from "lucide-react"
import { getAllUsers } from "@/services/userService"
import { apiRequest } from "@/services/apiClient"

interface ServerHealth {
  status: string
  timestamp?: string
  db_app?: string
  db_wimarc?: string
  file_server?: string
  cpu_percent?: number
  mem_used_mb?: number
  mem_total_mb?: number
  mem_percent?: number
  disk_used_gb?: number
  disk_total_gb?: number
  disk_percent?: number
}

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
  const [users, setUsers] = useState<User[]>([])
  const [summary, setSummary] = useState({ total: 0, online: 0, offline: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<"grouped" | "list">("grouped")
  const [serverHealth, setServerHealth] = useState<ServerHealth | null>(null)
  const [forecastRefreshing, setForecastRefreshing] = useState(false)
  const [forecastResult, setForecastResult] = useState<string | null>(null)

  const handleRefreshForecasts = async () => {
    setForecastRefreshing(true)
    setForecastResult(null)
    try {
      const res = await apiRequest<{ refreshed: Record<string, number> }>("/admin/forecasts/refresh", { method: "POST" })
      const total = Object.values(res.refreshed).reduce((a, b) => a + b, 0)
      setForecastResult(`อัปเดตแล้ว ${total} วัน (${Object.keys(res.refreshed).length} สถานี)`)
    } catch {
      setForecastResult("ล้มเหลว — ตรวจสอบ internet หรือ lat/lng ของสถานี")
    } finally {
      setForecastRefreshing(false)
    }
  }

  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const loadData = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true)
    try {
      const [s, sum, u, health] = await Promise.all([
        getAllStations(),
        getStationStatusSummary(),
        getAllUsers(),
        apiRequest<ServerHealth>("/health/detail").catch(() => null),
      ])
      setStations(s)
      setSummary(sum)
      setUsers(u)
      setServerHealth(health)
    } catch (error) {
      console.error("Failed to load status data", error)
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!canAccessAdminPages(user)) { router.push("/dashboard"); return }
    
    // Initial load
    loadData(true)

    // Set up polling interval (every 10 minutes — matches 10-min sensor cadence)
    const intervalId = setInterval(() => {
      loadData(false)
    }, 600000)

    return () => clearInterval(intervalId)
  }, [user, router, loadData])

  // Grouping logic
  const groupedStations = useMemo(() => {
    const groups: Record<string, { main?: Station; client?: Station; orchardName: string }> = {}
    
    stations.forEach(s => {
      const baseId = s.id.endsWith('c') ? s.id.slice(0, -1) : s.id
      if (!groups[baseId]) {
        // Extract orchard name from station name (everything after " — ")
        const parts = s.name.split(" — ")
        groups[baseId] = { orchardName: parts[1] || s.name }
      }
      
      if (s.type === "weather") {
        groups[baseId].main = s
      } else {
        groups[baseId].client = s
      }
    })
    
    const wimarcNum = (id: string) => { const m = id.match(/^wimarc(\d+)/i); return m ? parseInt(m[1], 10) : 9999 }
    return Object.entries(groups).map(([baseId, data]) => ({
      baseId,
      ...data
    })).filter(group => {
      const matchesSearch = group.orchardName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           group.baseId.toLowerCase().includes(searchQuery.toLowerCase())
      
      if (!matchesSearch) return false
      
      if (statusFilter === "all") return true
      if (statusFilter === "online") return group.main?.status === "online" && group.client?.status === "online"
      if (statusFilter === "offline") return group.main?.status === "offline" || group.client?.status === "offline"

      return true
    }).sort((a, b) => wimarcNum(a.baseId) - wimarcNum(b.baseId))
  }, [stations, searchQuery, statusFilter])

  const filteredStations = useMemo(() => {
    const wimarcNum = (id: string) => { const m = id.match(/^wimarc(\d+)/i); return m ? parseInt(m[1], 10) : 9999 }
    return stations
      .filter(s =>
        (searchQuery === "" || s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.id.toLowerCase().includes(searchQuery.toLowerCase())) &&
        (statusFilter === "all" || s.status === statusFilter)
      )
      .sort((a, b) => wimarcNum(a.id) - wimarcNum(b.id))
  }, [searchQuery, statusFilter, stations])

  if (isLoading) return <div className="p-8 space-y-6"><Skeleton className="h-10 w-64" /><div className="grid grid-cols-3 gap-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div></div>
  if (!canAccessAdminPages(user)) return null

  const warningCount = stations.filter(s => s.status === "offline").length

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto pb-8">
      {/* 1. Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            สถานะการทำงานของระบบ <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase">TOR 4.5.8.1-4</span>
          </h1>
          <p className="text-xs text-muted-foreground font-mono">Table: wimarc_info • updatedata (Heartbeat) • CAM_main</p>
        </div>
        <div className="flex gap-2">
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-2">
              <Button
                size="sm" variant="outline"
                className="h-8 text-xs font-bold gap-1.5"
                onClick={handleRefreshForecasts}
                disabled={forecastRefreshing}
              >
                <RefreshCw className={`h-3 w-3 ${forecastRefreshing ? "animate-spin" : ""}`} />
                <CloudSun className="h-3 w-3" />
                Refresh Forecast
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs font-bold" onClick={() => router.push('/admin/add-station')}>+ เพิ่มสถานีใหม่</Button>
            </div>
            {forecastResult && <span className="text-[10px] text-muted-foreground font-mono">{forecastResult}</span>}
          </div>
        </div>
      </div>

      {/* 2. Summary Cards */}
      <div className="text-[10px] font-mono text-muted-foreground/50 -mb-1 px-0.5">TOR 4.5.8.1 — สถานะ Online/Offline + เวลาส่งข้อมูลล่าสุด</div>
      <div className="grid gap-4 md:grid-cols-4">
        <StatusMiniCard label="Online" value={summary.online} icon={Activity} colorClass="green-500" dbField="active = true" />
        <StatusMiniCard label="Offline" value={summary.offline} icon={AlertCircle} colorClass="red-500" dbField="active = false" />
        <StatusMiniCard label="สถานีทั้งหมด" value={summary.total} icon={Server} colorClass="slate-600" dbField="wimarc_info count" />
        <StatusMiniCard label="แจ้งเตือน" value={warningCount} icon={Clock} colorClass="orange-500" dbField="lag > 30 นาที" />
      </div>

      {/* 2b. Server Health */}
      {serverHealth && (
        <Card className="shadow-sm border overflow-hidden">
          <CardHeader className="py-2.5 bg-muted/20 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-[11px] font-bold uppercase tracking-tight flex items-center gap-1.5 text-muted-foreground">
              <Server className="h-3.5 w-3.5" /> สถานะ Server
              <span className="text-[10px] font-mono font-normal text-muted-foreground/50 ml-auto">TOR 4.5.8.3</span>
            </CardTitle>
            <div className="flex items-center gap-1.5">
              {serverHealth.status === "ok"
                ? <><span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span><span className="text-[10px] font-bold text-green-600 uppercase">Healthy</span></>
                : <><span className="h-2 w-2 rounded-full bg-orange-500 inline-block"></span><span className="text-[10px] font-bold text-orange-600 uppercase">Degraded</span></>
              }
            </div>
          </CardHeader>
          <CardContent className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* DB App */}
            <div className="flex flex-col gap-1">
              <div className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1"><Database className="h-3 w-3" /> App DB</div>
              <span className={`text-[11px] font-bold ${serverHealth.db_app === "ok" ? "text-green-600" : "text-red-600"}`}>{serverHealth.db_app === "ok" ? "✓ OK" : "✗ Error"}</span>
            </div>
            {/* DB WiMaRC */}
            <div className="flex flex-col gap-1">
              <div className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1"><Database className="h-3 w-3" /> WiMaRC DB</div>
              <span className={`text-[11px] font-bold ${serverHealth.db_wimarc === "ok" ? "text-green-600" : "text-red-600"}`}>{serverHealth.db_wimarc === "ok" ? "✓ OK" : "✗ Error"}</span>
            </div>
            {/* File Server */}
            <div className="flex flex-col gap-1">
              <div className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1"><Wifi className="h-3 w-3" /> File Server</div>
              <span className={`text-[11px] font-bold ${serverHealth.file_server === "ok" ? "text-green-600" : "text-orange-500"}`}>{serverHealth.file_server === "ok" ? "✓ OK" : "✗ Offline"}</span>
            </div>
            {/* CPU */}
            {serverHealth.cpu_percent != null && (
              <div className="flex flex-col gap-1">
                <div className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1"><Cpu className="h-3 w-3" /> CPU</div>
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full ${serverHealth.cpu_percent > 80 ? "bg-red-500" : serverHealth.cpu_percent > 50 ? "bg-orange-400" : "bg-green-500"}`} style={{ width: `${serverHealth.cpu_percent}%` }} /></div>
                  <span className="text-[10px] font-mono font-bold">{serverHealth.cpu_percent.toFixed(0)}%</span>
                </div>
              </div>
            )}
            {/* RAM */}
            {serverHealth.mem_percent != null && (
              <div className="flex flex-col gap-1">
                <div className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1"><MemoryStick className="h-3 w-3" /> RAM</div>
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full ${serverHealth.mem_percent > 85 ? "bg-red-500" : serverHealth.mem_percent > 65 ? "bg-orange-400" : "bg-green-500"}`} style={{ width: `${serverHealth.mem_percent}%` }} /></div>
                  <span className="text-[10px] font-mono font-bold">{serverHealth.mem_used_mb}MB</span>
                </div>
              </div>
            )}
            {/* Disk */}
            {serverHealth.disk_percent != null && (
              <div className="flex flex-col gap-1">
                <div className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1"><HardDrive className="h-3 w-3" /> Disk</div>
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full ${serverHealth.disk_percent > 90 ? "bg-red-500" : serverHealth.disk_percent > 70 ? "bg-orange-400" : "bg-green-500"}`} style={{ width: `${serverHealth.disk_percent}%` }} /></div>
                  <span className="text-[10px] font-mono font-bold">{serverHealth.disk_used_gb}/{serverHealth.disk_total_gb}GB</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
              <SelectItem value="online">Online ทั้งคู่</SelectItem>
              <SelectItem value="offline">Offline อย่างน้อยหนึ่ง</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex items-center border rounded-md overflow-hidden bg-background h-8">
            <Button 
              variant={viewMode === "grouped" ? "secondary" : "ghost"} 
              size="sm" 
              className="h-full px-2 rounded-none"
              onClick={() => setViewMode("grouped")}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button 
              variant={viewMode === "list" ? "secondary" : "ghost"} 
              size="sm" 
              className="h-full px-2 rounded-none"
              onClick={() => setViewMode("list")}
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
          Found {viewMode === "grouped" ? groupedStations.length : filteredStations.length} {viewMode === "grouped" ? "orchards" : "stations"}
        </span>
      </div>

      {/* 4. Detailed Status Table */}
      <Card className="shadow-md overflow-hidden">
        <CardHeader className="py-3 bg-muted/30 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-bold uppercase tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" /> รายการสถานะเชิงเทคนิค ({viewMode === "grouped" ? "แบบรายแปลง" : "แบบแยกสถานี"})
          </CardTitle>
          <span className="text-[10px] text-muted-foreground uppercase font-mono">wimarc_info + updatedata + CAM_main</span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {viewMode === "grouped" ? (
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-muted/50 border-b text-muted-foreground uppercase font-bold">
                    <th className="p-3 text-left">wimarc_id / รายแปลง</th>
                    <th className="p-3 text-center border-l" colSpan={2}>สถานีอากาศ</th>
                    <th className="p-3 text-center border-l" colSpan={2}>สถานีดิน</th>
                    <th className="p-3 text-center border-l">ภาพล่าสุด</th>
                    <th className="p-3 text-center border-l">จัดการ</th>
                  </tr>
                  <tr className="bg-muted/30 border-b text-[9px] text-muted-foreground uppercase">
                    <th className="p-1 px-3"></th>
                    <th className="p-1 text-center border-l">Active</th>
                    <th className="p-1 text-center">Last Ping</th>
                    <th className="p-1 text-center border-l">Active</th>
                    <th className="p-1 text-center">Last Ping</th>
                    <th className="p-1 border-l"></th>
                    <th className="p-1 border-l"></th>
                  </tr>
                </thead>
                <tbody className="divide-y font-medium">
                  {groupedStations.map((g) => {
                    const mainOffline = g.main?.status === "offline"
                    const clientOffline = g.client?.status === "offline"
                    const hasIssue = mainOffline || clientOffline
                    
                    return (
                      <tr key={g.baseId} className={`hover:bg-muted/30 transition-colors ${hasIssue ? "bg-red-50/20" : ""}`}>
                        <td className="p-3">
                          <div className="font-bold text-teal-900">{g.orchardName}</div>
                          <div className="font-mono text-[9px] text-muted-foreground uppercase">{g.baseId} • {g.main?.area || g.client?.area}</div>
                        </td>
                        
                        {/* Main Status */}
                        <td className="p-3 text-center border-l">
                          {g.main ? (
                            <Badge className={`text-[9px] h-4 uppercase font-bold border-none ${g.main.status === "online" ? "bg-green-500" : "bg-red-500"}`}>
                              {g.main.status === "online" ? "true" : "false"}
                            </Badge>
                          ) : <span className="text-muted-foreground/30">—</span>}
                        </td>
                        <td className={`p-3 text-center font-mono ${mainOffline ? "text-red-600 font-bold" : "text-muted-foreground"}`}>
                          {g.main?.lastDataTime ? getTimeDifference(g.main.lastDataTime) : "—"}
                        </td>
                        
                        {/* Client Status */}
                        <td className="p-3 text-center border-l">
                          {g.client ? (
                            <Badge className={`text-[9px] h-4 uppercase font-bold border-none ${g.client.status === "online" ? "bg-green-500" : "bg-red-500"}`}>
                              {g.client.status === "online" ? "true" : "false"}
                            </Badge>
                          ) : <span className="text-muted-foreground/30">—</span>}
                        </td>
                        <td className={`p-3 text-center font-mono ${clientOffline ? "text-red-600 font-bold" : "text-muted-foreground"}`}>
                          {g.client?.lastDataTime ? getTimeDifference(g.client.lastDataTime) : "—"}
                        </td>
                        
                        <td className="p-3 text-center border-l font-mono text-[9px] opacity-60">
                          {g.main ? `/imgMain/${g.main.id}/...` : "—"}
                        </td>
                        
                        <td className="p-3 text-center border-l">
                          <div className="flex items-center justify-center gap-1">
                            {g.main && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => router.push(`/dashboard?station=${g.main?.id}`)}>
                                <ExternalLink className="h-3.5 w-3.5 text-teal-600" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
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
                          /media/img{s.type === "weather" ? "Main" : "Client"}/{s.id}/...
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
            )}
          </div>
          {(viewMode === "grouped" ? groupedStations.length : filteredStations.length) === 0 && (
            <div className="py-12 text-center text-muted-foreground">ไม่พบข้อมูลที่ตรงกับเงื่อนไข</div>
          )}
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
