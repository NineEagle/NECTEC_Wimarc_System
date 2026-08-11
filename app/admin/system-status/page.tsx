/**
 * Admin System Status Page (สถานะการทำงานของระบบ)
 * Admin-only page showing all stations' operational status
 * Includes filtering, search, and navigation to station details
 */

"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"
import { getAllStations } from "@/services/stationsService"
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
import { Server, Activity, AlertCircle, Database, ShieldCheck, Clock, ExternalLink, LayoutGrid, List, Cpu, HardDrive, MemoryStick, Wifi, WifiOff, RefreshCw, CloudSun, Pencil } from "lucide-react"
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
  server_api?: string
  api_cpu_percent?: number
  api_mem_used_mb?: number
  api_mem_total_mb?: number
  api_mem_percent?: number
  api_disk_used_gb?: number
  api_disk_total_gb?: number
  api_disk_percent?: number
}

function StatusMiniCard({ label, value, icon: Icon, colorClass, dbField }: { label: string; value: number; icon: React.ElementType; colorClass: string; dbField: string }) {
  return (
    <Card className="shadow-sm border border-l-4 border-l-current" style={{ borderLeftColor: `var(--${colorClass})` }}>
      <CardContent className="p-4 relative overflow-hidden">
        <div className="text-[0.5625rem] uppercase font-bold text-muted-foreground mb-1 opacity-50 font-mono">{dbField}</div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[0.6875rem] uppercase font-bold text-muted-foreground flex items-center gap-1">
              <Icon className="h-3.5 w-3.5" /> {label}
            </div>
            <div className={`text-3xl font-black font-mono tracking-tighter mt-1 text-${colorClass}`}>{value}</div>
          </div>
          <div className="text-[0.625rem] text-muted-foreground font-medium uppercase self-end">สถานี</div>
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
  type PairStatus = "both-online" | "both-offline" | "main-only" | "client-only"
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
      const [s, u, health] = await Promise.all([
        getAllStations(),
        getAllUsers(),
        apiRequest<ServerHealth>("/health/detail").catch(() => null),
      ])
      setStations(s)
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

  const getPairStatus = (main?: Station, client?: Station): PairStatus => {
    const mainOn = main?.status === "online"
    const clientOn = client?.status === "online"
    if (mainOn && clientOn) return "both-online"
    if (!mainOn && !clientOn) return "both-offline"
    return mainOn ? "main-only" : "client-only"
  }

  const PAIR_CFG: Record<PairStatus, { label: string; dot: string; color: string; icon: React.ElementType }> = {
    "both-online":  { label: "ออนไลน์ทั้งคู่",             dot: "bg-green-500",  color: "green-500",  icon: Wifi       },
    "both-offline": { label: "ออฟไลน์ทั้งคู่",             dot: "bg-red-500",    color: "red-500",    icon: WifiOff    },
    "main-only":    { label: "อากาศ Online · ดิน Offline", dot: "bg-yellow-500", color: "yellow-500", icon: Activity   },
    "client-only":  { label: "อากาศ Offline · ดิน Online", dot: "bg-orange-500", color: "orange-500", icon: AlertCircle },
  }

  // Pair counts — from all stations, grouped, unfiltered
  const pairCounts = useMemo(() => {
    const map: Record<string, { main?: Station; client?: Station }> = {}
    stations.forEach(s => {
      const baseId = s.id.endsWith("c") ? s.id.slice(0, -1) : s.id
      if (!map[baseId]) map[baseId] = {}
      if (s.type === "weather") map[baseId].main = s
      else map[baseId].client = s
    })
    const counts = { "both-online": 0, "both-offline": 0, "main-only": 0, "client-only": 0 } as Record<PairStatus, number>
    Object.values(map).forEach(g => counts[getPairStatus(g.main, g.client)]++)
    return counts
  }, [stations])

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
      
      if (statusFilter !== "all") {
        const ps = getPairStatus(group.main, group.client)
        if (ps !== statusFilter) return false
      }
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

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto pb-8">
      {/* 1. Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            สถานะการทำงานของระบบ <span className="text-[0.625rem] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase">TOR 4.5.8.1-4</span>
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
            {forecastResult && <span className="text-[0.625rem] text-muted-foreground font-mono">{forecastResult}</span>}
          </div>
        </div>
      </div>

      {/* 2. Summary Cards — pair status, 30 base stations */}
      <div className="text-[0.625rem] font-mono text-muted-foreground/50 -mb-1 px-0.5">TOR 4.5.8.1 — สถานะ Online/Offline + เวลาส่งข้อมูลล่าสุด</div>
      <div className="grid gap-4 md:grid-cols-4">
        {(["both-online", "both-offline", "main-only", "client-only"] as PairStatus[]).map(key => {
          const cfg = PAIR_CFG[key]
          const Icon = cfg.icon
          const count = pairCounts[key] ?? 0
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(statusFilter === key ? "all" : key)}
              className={`rounded-lg border shadow-sm text-left transition-all ${statusFilter === key ? "ring-2 ring-offset-1 ring-current" : "hover:shadow-md"}`}
            >
              <div className="p-4 relative overflow-hidden">
                <div className="text-[0.5625rem] uppercase font-bold text-muted-foreground mb-1 opacity-50 font-mono flex items-center gap-1">
                  <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}${key === "both-online" ? " animate-pulse" : ""}`} />
                  {cfg.label}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div>
                    <div className={`text-[0.6875rem] uppercase font-bold text-muted-foreground flex items-center gap-1`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 900, fontFamily: 'monospace', letterSpacing: '-0.04em', marginTop: 4 }} className={`text-${cfg.color}`}>{count}</div>
                  </div>
                  <div className="text-[0.625rem] text-muted-foreground font-medium uppercase self-end">แปลง</div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* 2b. Server Health */}
      {serverHealth && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Server 1 — Jasmine (.161) */}
          <Card className="shadow-sm border overflow-hidden">
            <CardHeader className="py-2.5 bg-muted/20 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-[0.6875rem] font-bold uppercase tracking-tight flex items-center gap-1.5 text-muted-foreground">
                <Server className="h-3.5 w-3.5" />
                <span>wimarc-app</span>
                <span className="text-[0.5625rem] font-mono font-normal text-muted-foreground/50">203.185.101.161</span>
                <span className="text-[0.625rem] font-mono font-normal text-muted-foreground/40 ml-1">TOR 4.5.8.3</span>
              </CardTitle>
              <div className="flex items-center gap-1.5">
                {serverHealth.status === "ok"
                  ? <><span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span><span className="text-[0.625rem] font-bold text-green-600 uppercase">Healthy</span></>
                  : <><span className="h-2 w-2 rounded-full bg-orange-500 inline-block"></span><span className="text-[0.625rem] font-bold text-orange-600 uppercase">Degraded</span></>
                }
              </div>
            </CardHeader>
            <CardContent className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <div className="text-[0.5625rem] font-bold text-muted-foreground uppercase flex items-center gap-1"><Database className="h-3 w-3" /> App DB</div>
                <span className={`text-[0.6875rem] font-bold ${serverHealth.db_app === "ok" ? "text-green-600" : "text-red-600"}`}>{serverHealth.db_app === "ok" ? "✓ OK" : "✗ Error"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <div className="text-[0.5625rem] font-bold text-muted-foreground uppercase flex items-center gap-1"><Database className="h-3 w-3" /> WiMaRC DB</div>
                <span className={`text-[0.6875rem] font-bold ${serverHealth.db_wimarc === "ok" ? "text-green-600" : "text-red-600"}`}>{serverHealth.db_wimarc === "ok" ? "✓ OK" : "✗ Error"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <div className="text-[0.5625rem] font-bold text-muted-foreground uppercase flex items-center gap-1"><Wifi className="h-3 w-3" /> File Server</div>
                <span className={`text-[0.6875rem] font-bold ${serverHealth.file_server === "ok" ? "text-green-600" : "text-orange-500"}`}>{serverHealth.file_server === "ok" ? "✓ OK" : "✗ Offline"}</span>
              </div>
              {serverHealth.cpu_percent != null && (
                <div className="flex flex-col gap-1">
                  <div className="text-[0.5625rem] font-bold text-muted-foreground uppercase flex items-center gap-1"><Cpu className="h-3 w-3" /> CPU</div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full ${serverHealth.cpu_percent > 80 ? "bg-red-500" : serverHealth.cpu_percent > 50 ? "bg-orange-400" : "bg-green-500"}`} style={{ width: `${serverHealth.cpu_percent}%` }} /></div>
                    <span className="text-[0.625rem] font-mono font-bold">{serverHealth.cpu_percent.toFixed(0)}%</span>
                  </div>
                </div>
              )}
              {serverHealth.mem_percent != null && (
                <div className="flex flex-col gap-1">
                  <div className="text-[0.5625rem] font-bold text-muted-foreground uppercase flex items-center gap-1"><MemoryStick className="h-3 w-3" /> RAM</div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full ${serverHealth.mem_percent > 85 ? "bg-red-500" : serverHealth.mem_percent > 65 ? "bg-orange-400" : "bg-green-500"}`} style={{ width: `${serverHealth.mem_percent}%` }} /></div>
                    <span className="text-[0.625rem] font-mono font-bold">{serverHealth.mem_used_mb}MB</span>
                  </div>
                </div>
              )}
              {serverHealth.disk_percent != null && (
                <div className="flex flex-col gap-1">
                  <div className="text-[0.5625rem] font-bold text-muted-foreground uppercase flex items-center gap-1"><HardDrive className="h-3 w-3" /> Disk</div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full ${serverHealth.disk_percent > 90 ? "bg-red-500" : serverHealth.disk_percent > 70 ? "bg-orange-400" : "bg-green-500"}`} style={{ width: `${serverHealth.disk_percent}%` }} /></div>
                    <span className="text-[0.625rem] font-mono font-bold">{serverHealth.disk_used_gb}/{serverHealth.disk_total_gb}GB</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Server 2 — Wimarc-API (.200) */}
          <Card className="shadow-sm border overflow-hidden">
            <CardHeader className="py-2.5 bg-muted/20 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-[0.6875rem] font-bold uppercase tracking-tight flex items-center gap-1.5 text-muted-foreground">
                <Server className="h-3.5 w-3.5" />
                <span>wimarc-api</span>
                <span className="text-[0.5625rem] font-mono font-normal text-muted-foreground/50">203.185.101.200</span>
              </CardTitle>
              <div className="flex items-center gap-1.5">
                {serverHealth.server_api === "ok"
                  ? <><span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span><span className="text-[0.625rem] font-bold text-green-600 uppercase">Online</span></>
                  : <><span className="h-2 w-2 rounded-full bg-red-500 inline-block"></span><span className="text-[0.625rem] font-bold text-red-600 uppercase">Offline</span></>
                }
              </div>
            </CardHeader>
            <CardContent className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {serverHealth.api_cpu_percent != null ? (
                <div className="flex flex-col gap-1">
                  <div className="text-[0.5625rem] font-bold text-muted-foreground uppercase flex items-center gap-1"><Cpu className="h-3 w-3" /> CPU</div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full ${serverHealth.api_cpu_percent > 80 ? "bg-red-500" : serverHealth.api_cpu_percent > 50 ? "bg-orange-400" : "bg-green-500"}`} style={{ width: `${serverHealth.api_cpu_percent}%` }} /></div>
                    <span className="text-[0.625rem] font-mono font-bold">{serverHealth.api_cpu_percent.toFixed(0)}%</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <div className="text-[0.5625rem] font-bold text-muted-foreground uppercase flex items-center gap-1"><Cpu className="h-3 w-3" /> CPU</div>
                  <span className="text-[0.6875rem] font-mono font-bold text-muted-foreground">8 cores</span>
                </div>
              )}
              {serverHealth.api_mem_percent != null ? (
                <div className="flex flex-col gap-1">
                  <div className="text-[0.5625rem] font-bold text-muted-foreground uppercase flex items-center gap-1"><MemoryStick className="h-3 w-3" /> RAM</div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full ${serverHealth.api_mem_percent > 85 ? "bg-red-500" : serverHealth.api_mem_percent > 65 ? "bg-orange-400" : "bg-green-500"}`} style={{ width: `${serverHealth.api_mem_percent}%` }} /></div>
                    <span className="text-[0.625rem] font-mono font-bold">{serverHealth.api_mem_used_mb}MB</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <div className="text-[0.5625rem] font-bold text-muted-foreground uppercase flex items-center gap-1"><MemoryStick className="h-3 w-3" /> RAM</div>
                  <span className="text-[0.6875rem] font-mono font-bold text-muted-foreground">16 GB</span>
                </div>
              )}
              {serverHealth.api_disk_percent != null ? (
                <div className="flex flex-col gap-1">
                  <div className="text-[0.5625rem] font-bold text-muted-foreground uppercase flex items-center gap-1"><HardDrive className="h-3 w-3" /> Disk</div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden"><div className={`h-full rounded-full ${serverHealth.api_disk_percent > 90 ? "bg-red-500" : serverHealth.api_disk_percent > 70 ? "bg-orange-400" : "bg-green-500"}`} style={{ width: `${serverHealth.api_disk_percent}%` }} /></div>
                    <span className="text-[0.625rem] font-mono font-bold">{serverHealth.api_disk_used_gb}/{serverHealth.api_disk_total_gb}GB</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <div className="text-[0.5625rem] font-bold text-muted-foreground uppercase flex items-center gap-1"><HardDrive className="h-3 w-3" /> Disk</div>
                  <span className="text-[0.6875rem] font-mono font-bold text-muted-foreground">100 GB</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 3. Filter Bar */}
      <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between flex-wrap gap-4 border shadow-sm" style={{ fontSize: '0.8125rem' }}>
        <div className="flex items-center gap-3 flex-1 min-w-[300px]">
          <div className="relative flex-1 max-w-xs">
            <Database className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground opacity-50" />
            <Input placeholder="ค้นหา wimarc_id, ชื่อ..." className="pl-8 bg-background text-xs" style={{ height: '2rem' }} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[200px] bg-background text-xs" style={{ height: '2rem' }}><SelectValue placeholder="ทุกสถานะ" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกสถานะ</SelectItem>
              <SelectItem value="both-online">ออนไลน์ทั้งคู่</SelectItem>
              <SelectItem value="both-offline">ออฟไลน์ทั้งคู่</SelectItem>
              <SelectItem value="main-only">อากาศ Online · ดิน Offline</SelectItem>
              <SelectItem value="client-only">อากาศ Offline · ดิน Online</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex items-center border rounded-md overflow-hidden bg-background" style={{ height: '2rem' }}>
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
        <span className="text-[0.625rem] text-muted-foreground font-bold uppercase tracking-widest">
          Found {viewMode === "grouped" ? groupedStations.length : filteredStations.length} {viewMode === "grouped" ? "orchards" : "stations"}
        </span>
      </div>

      {/* 4. Detailed Status Table */}
      <Card className="shadow-md overflow-hidden">
        <CardHeader className="py-3 bg-muted/30 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-bold uppercase tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" /> รายการสถานะเชิงเทคนิค ({viewMode === "grouped" ? "แบบรายแปลง" : "แบบแยกสถานี"})
          </CardTitle>
          <span className="text-[0.625rem] text-muted-foreground uppercase font-mono">wimarc_info + updatedata + CAM_main</span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {viewMode === "grouped" ? (
              <table className="w-full text-[0.6875rem]">
                <thead>
                  <tr className="bg-muted/50 border-b text-muted-foreground uppercase font-bold">
                    <th className="p-3 text-left">wimarc_id / รายแปลง</th>
                    <th className="p-3 text-center border-l" colSpan={2}>สถานีอากาศ</th>
                    <th className="p-3 text-center border-l" colSpan={2}>สถานีดิน</th>
                    <th className="p-3 text-center border-l">แก้ไข</th>
                  </tr>
                  <tr className="bg-muted/30 border-b text-[0.5625rem] text-muted-foreground uppercase">
                    <th className="p-1 px-3"></th>
                    <th className="p-1 text-center border-l">Active</th>
                    <th className="p-1 text-center">Last Ping</th>
                    <th className="p-1 text-center border-l">Active</th>
                    <th className="p-1 text-center">Last Ping</th>
                    <th className="p-1 border-l"></th>
                  </tr>
                </thead>
                <tbody className="divide-y font-medium">
                  {groupedStations.map((g) => {
                    const ps = getPairStatus(g.main, g.client)
                    const rowBg = ps === "both-offline" ? "bg-red-50/30 dark:bg-red-950/20"
                      : ps === "main-only" ? "bg-yellow-50/30 dark:bg-yellow-950/20"
                      : ps === "client-only" ? "bg-orange-50/30 dark:bg-orange-950/20"
                      : ""

                    return (
                      <tr key={g.baseId} className={`hover:bg-muted/30 transition-colors ${rowBg}`}>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full shrink-0 ${PAIR_CFG[ps].dot}${ps === "both-online" ? " animate-pulse" : ""}`} />
                            <span className="font-bold text-teal-900">{g.orchardName}</span>
                          </div>
                          <div className="font-mono text-[0.5625rem] text-muted-foreground uppercase mt-0.5 ml-3.5">{g.baseId} • {g.main?.area || g.client?.area}</div>
                        </td>
                        
                        {/* Main Status */}
                        <td className="p-3 text-center border-l">
                          {g.main ? (
                            <Badge className={`text-[0.5625rem] h-4 uppercase font-bold border-none ${g.main.status === "online" ? "bg-green-500" : "bg-red-500"}`}>
                              {g.main.status === "online" ? "true" : "false"}
                            </Badge>
                          ) : <span className="text-muted-foreground/30">—</span>}
                        </td>
                        <td className={`p-3 text-center font-mono ${g.main?.status === "offline" ? "text-red-600 font-bold" : "text-muted-foreground"}`}>
                          {g.main?.lastDataTime ? getTimeDifference(g.main.lastDataTime) : "—"}
                        </td>
                        
                        {/* Client Status */}
                        <td className="p-3 text-center border-l">
                          {g.client ? (
                            <Badge className={`text-[0.5625rem] h-4 uppercase font-bold border-none ${g.client.status === "online" ? "bg-green-500" : "bg-red-500"}`}>
                              {g.client.status === "online" ? "true" : "false"}
                            </Badge>
                          ) : <span className="text-muted-foreground/30">—</span>}
                        </td>
                        <td className={`p-3 text-center font-mono ${g.client?.status === "offline" ? "text-red-600 font-bold" : "text-muted-foreground"}`}>
                          {g.client?.lastDataTime ? getTimeDifference(g.client.lastDataTime) : "—"}
                        </td>
                        
                        <td className="p-3 text-center border-l">
                          <Button variant="outline" size="sm" className="h-7 gap-1 text-[0.6875rem] font-semibold" onClick={() => router.push(`/admin/edit-station?id=${g.baseId}`)}>
                            <Pencil className="h-3 w-3" /> แก้ไข
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-[0.6875rem]">
                <thead>
                  <tr className="bg-muted/50 border-b text-muted-foreground uppercase font-bold">
                    <th className="p-3 text-left">wimarc_info.set_name</th>
                    <th className="p-3 text-center">Type</th>
                    <th className="p-3 text-center">Active</th>
                    <th className="p-3 text-left">Heartbeat (Last)</th>
                    <th className="p-3 text-left">ห่างจากปัจจุบัน</th>
                    <th className="p-3 text-center">แก้ไข</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-medium">
                  {filteredStations.map((s) => {
                    const isOffline = s.status === "offline"
                    return (
                      <tr key={s.id} className={`hover:bg-muted/30 transition-colors ${isOffline ? "bg-red-50/30" : ""}`}>
                        <td className="p-3">
                          <div className="font-bold text-teal-900">{s.name}</div>
                          <div className="font-mono text-[0.5625rem] text-muted-foreground uppercase">{s.id} • {s.area}</div>
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="outline" className={`text-[0.5625rem] font-black h-5 w-5 p-0 flex items-center justify-center rounded-sm ${s.type === "weather" ? "border-teal-500 text-teal-600 bg-teal-50" : "border-orange-500 text-orange-600 bg-orange-50"}`}>
                            {s.type === "weather" ? "M" : "C"}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          <Badge className={`text-[0.5625rem] h-4 uppercase font-bold border-none ${s.status === "online" ? "bg-green-500" : "bg-red-500"}`}>
                            {s.status === "online" ? "true" : "false"}
                          </Badge>
                        </td>
                        <td className={`p-3 font-mono ${isOffline ? "text-red-600" : ""}`}>
                          {s.lastDataTime ? formatThaiDateTime(s.lastDataTime).split(" ")[1] : "—"}
                        </td>
                        <td className={`p-3 font-bold ${isOffline ? "text-red-600" : "text-muted-foreground"}`}>
                          {isOffline && "⚠ "}{s.lastDataTime ? getTimeDifference(s.lastDataTime) : "ยังไม่มีข้อมูล"}
                        </td>
                        <td className="p-3 text-center">
                          <Button variant="outline" size="sm" className="h-7 gap-1 text-[0.6875rem] font-semibold" onClick={() => router.push(`/admin/edit-station?id=${s.id.endsWith("c") ? s.id.slice(0,-1) : s.id}`)}>
                            <Pencil className="h-3 w-3" /> แก้ไข
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

    </div>
  )
}
