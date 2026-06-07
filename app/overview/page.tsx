"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { LayoutGrid, LayoutDashboard, Search, RefreshCw, Wind, Leaf } from "lucide-react"
import { useStation } from "@/contexts/StationContext"
import { useAuth } from "@/contexts/AuthContext"
import { canAccessAdminPages } from "@/utils/permissions"
import { loadSystemConfig } from "@/services/systemConfigCache"
import { defaultSystem } from "@/components/config/configUtils"
import type { SystemConfig } from "@/components/config/configTypes"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { getOverviewData } from "@/services/overviewService"
import type { OverviewStation, LayoutMode } from "@/components/overview/overviewTypes"
type ViewMode = "main" | "client"
import { StationCardGrid } from "@/components/overview/StationOverviewCard"
import { StationBoard } from "@/components/overview/StationBoard"
import { StationDetailModal } from "@/components/overview/StationDetailModal"

const POLL_INTERVAL = 15

type FilterKey = "all" | "online" | "offline"

const FILTER_CFG: Record<FilterKey, { dot?: string; label: string }> = {
  all:     { label: "ทั้งหมด" },
  online:  { dot: "bg-green-500 animate-pulse", label: "ออนไลน์"  },
  offline: { dot: "bg-red-500",                 label: "ออฟไลน์"  },
}

function FilterChip({ active, onClick, children, count, dot }: {
  active: boolean; onClick: () => void; children: React.ReactNode; count: number; dot?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
        active ? "border-transparent bg-foreground text-background" : "border-border bg-background text-muted-foreground hover:bg-muted"
      }`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />}
      {children}
      <span className="tabular-nums opacity-70">{count}</span>
    </button>
  )
}

const LAYOUTS: { value: LayoutMode; label: string; icon: React.ElementType }[] = [
  { value: "cards", label: "การ์ด",  icon: LayoutGrid },
  { value: "board", label: "บอร์ด",  icon: LayoutDashboard },
]

export default function OverviewPage() {
  const { permittedStations, isLoading: stationLoading } = useStation()
  const { user } = useAuth()
  const router = useRouter()

  const [stations, setStations] = useState<OverviewStation[]>([])
  const [loading, setLoading] = useState(true)
  const [countdown, setCountdown] = useState(POLL_INTERVAL)
  const [pulse, setPulse] = useState(false)
  const [layout, setLayout] = useState<LayoutMode>("cards")
  const [filter, setFilter] = useState<FilterKey>("all")
  const [viewMode, setViewMode] = useState<ViewMode>("main")

  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sysConfig, setSysConfig] = useState<SystemConfig>(() => defaultSystem())
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const cdRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!user) return
    if (!canAccessAdminPages(user)) router.push("/dashboard")
  }, [user])

  useEffect(() => { loadSystemConfig().then(setSysConfig) }, [])

  useEffect(() => {
    const saved = localStorage.getItem("wm-overview-layout") as LayoutMode | null
    if (saved && saved !== "table") setLayout(saved)
  }, [])
  useEffect(() => { localStorage.setItem("wm-overview-layout", layout) }, [layout])

  const stationMeta = useMemo(
    () => permittedStations.map((s: any) => ({ id: s.id, name: s.name, province: s.province ?? "", lat: s.lat, lng: s.lng })),
    [permittedStations],
  )

  const fetchAll = useCallback(async (spinner = false) => {
    if (stationMeta.length === 0) return
    if (spinner) setLoading(true)
    else setPulse(true)
    try {
      const data = await getOverviewData(stationMeta)
      setStations(data)
      setCountdown(POLL_INTERVAL)
    } catch {
      // silent
    } finally {
      if (spinner) setLoading(false)
      else setTimeout(() => setPulse(false), 500)
    }
  }, [stationMeta])

  useEffect(() => {
    if (stationMeta.length === 0) return
    fetchAll(true)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => fetchAll(false), POLL_INTERVAL * 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [stationMeta, fetchAll])

  useEffect(() => {
    if (cdRef.current) clearInterval(cdRef.current)
    cdRef.current = setInterval(() => setCountdown(c => c > 1 ? c - 1 : POLL_INTERVAL), 1000)
    return () => { if (cdRef.current) clearInterval(cdRef.current) }
  }, [])

  const counts = useMemo(() => ({
    all:     stations.length,
    online:  stations.filter(s => s.status !== "both-offline").length,
    offline: stations.filter(s => s.status === "both-offline").length,
  }), [stations])

  const filtered = useMemo(() => stations.filter(s => {
    if (query) {
      const q = query.toLowerCase()
      if (!s.name.toLowerCase().includes(q) && !s.id.toLowerCase().includes(q) && !s.province.includes(query)) return false
    }
    if (filter === "online") return s.status !== "both-offline"
    if (filter === "offline") return s.status === "both-offline"
    return true
  }), [stations, query, filter])

  // Unit map from sysConfig — passed to card/modal
  const unitMap = useMemo(() => {
    const c = sysConfig.conversions
    return {
      airTemperature:      c.airTemp.unit,
      relativeHumidity:    c.humidity.unit,
      lightIntensity:      sysConfig.conversions.light.unit ?? "klux",
      rainfall:            c.rain.unit,
      windSpeed:           c.windSpeed.unit,
      atmosphericPressure: c.pressure.unit,
      soilMoisture1:       c.soilMoist1.unit,
      soilMoisture2:       c.soilMoist2.unit,
      soilTemperature1:    c.soilTemp1.unit,
      soilTemperature2:    c.soilTemp2.unit,
    } as Record<string, string>
  }, [sysConfig])

  const vpdEnabled = sysConfig.vpdColorEnabled ?? true
  const vpdLow = sysConfig.vpdLow ?? 0.8
  const vpdHigh = sysConfig.vpdHigh ?? 1.6

  const selected = selectedId ? stations.find(s => s.id === selectedId) ?? null : null

  const { setSelectedStationId } = useStation()
  const handleGoToDashboard = useCallback((s: OverviewStation) => {
    setSelectedStationId(s.id)
    router.push("/dashboard")
  }, [setSelectedStationId, router])

  if (stationLoading || !user) {
    return (
      <div className="mx-auto max-w-[1500px] space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (!canAccessAdminPages(user)) return null

  return (
    <div className="mx-auto max-w-[1500px] pb-10">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center gap-3 border-b pb-4">
        <div className="mr-auto">
          <h1 className="text-xl font-bold tracking-tight">ภาพรวมสถานี</h1>
          <p className="text-xs text-muted-foreground font-mono">{counts.all} สถานี</p>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-xs tabular-nums text-muted-foreground">
          <RefreshCw className={`h-3 w-3 ${pulse ? "animate-spin text-primary" : ""}`} />
          <span>{countdown}s</span>
        </div>
      </div>

      {/* Controls — filter chips + search + layout toggle */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="mr-auto flex flex-wrap gap-1.5">
          {(["all", "online", "offline"] as FilterKey[]).map(key => {
            const cfg = FILTER_CFG[key]
            return (
              <FilterChip
                key={key}
                active={filter === key}
                onClick={() => setFilter(key)}
                count={counts[key]}
                dot={cfg.dot}
              >
                {cfg.label}
              </FilterChip>
            )
          })}
        </div>
        <div className="relative flex items-center">
          <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="ค้นหาสถานี..." className="w-44 pl-9" />
        </div>
        {/* View mode: weather / soil */}
        <div className="inline-flex gap-0.5 rounded-xl border bg-secondary p-0.5">
          {(["main", "client"] as ViewMode[]).map(v => {
            const active = viewMode === v
            const VIcon = v === "main" ? Wind : Leaf
            return (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.65rem] font-semibold transition-colors ${active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <VIcon className="h-4 w-4" />
                <span className="max-sm:hidden">{v === "main" ? "อากาศ" : "ดิน"}</span>
              </button>
            )
          })}
        </div>

        <div className="inline-flex gap-0.5 rounded-xl border bg-secondary p-0.5">
          {LAYOUTS.map(l => {
            const active = layout === l.value
            const LIcon = l.icon
            return (
              <button
                key={l.value}
                onClick={() => setLayout(l.value)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.65rem] font-semibold transition-colors ${active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <LIcon className="h-4 w-4" /> <span className="max-sm:hidden">{l.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      {loading && stations.length === 0 ? (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {[...Array(12)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
          <Search className="h-8 w-8 opacity-30" />
          <p className="text-sm">ไม่พบสถานีที่ตรงกับเงื่อนไข</p>
        </Card>
      ) : layout === "cards" ? (
        <StationCardGrid stations={filtered} onOpen={s => setSelectedId(s.id)} unitMap={unitMap} viewMode={viewMode} vpdEnabled={vpdEnabled} vpdLow={vpdLow} vpdHigh={vpdHigh} />
      ) : (
        <StationBoard stations={filtered} onOpen={s => setSelectedId(s.id)} vpdEnabled={vpdEnabled} vpdLow={vpdLow} vpdHigh={vpdHigh} />
      )}

      <StationDetailModal station={selected} onClose={() => setSelectedId(null)} unitMap={unitMap} onGoToDashboard={handleGoToDashboard} vpdEnabled={vpdEnabled} vpdLow={vpdLow} vpdHigh={vpdHigh} />
    </div>
  )
}
