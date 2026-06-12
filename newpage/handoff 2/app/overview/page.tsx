// app/overview/page.tsx
"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import {
  LayoutGrid, Table2, LayoutDashboard, Search, RefreshCw,
  Wifi, WifiOff, AlertTriangle, Moon, Sun,
} from "lucide-react"
import { useStation } from "@/contexts/StationContext"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { getOverviewData } from "@/services/overviewService"
import type { OverviewStation, LayoutMode } from "@/components/overview/overviewTypes"
import { isAlertStation } from "@/components/overview/overviewUtils"
import { StationCardGrid } from "@/components/overview/StationOverviewCard"
import { StationsTable } from "@/components/overview/StationsTable"
import { StationBoard } from "@/components/overview/StationBoard"
import { StationDetailModal } from "@/components/overview/StationDetailModal"

const POLL_INTERVAL = 15 // seconds — match dashboard cadence

function StatPill({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: number; color: string
}) {
  return (
    <div className="flex min-w-[130px] flex-1 items-center gap-2.5 rounded-xl border bg-card px-3.5 py-2.5 shadow-sm">
      <span className={`grid h-7 w-7 place-items-center rounded-lg ${color}`}><Icon className="h-4 w-4" /></span>
      <div className="leading-tight">
        <div className="text-[22px] font-bold tabular-nums">{value}</div>
        <div className="text-[11.5px] text-muted-foreground">{label}</div>
      </div>
    </div>
  )
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
  { value: "cards", label: "การ์ด", icon: LayoutGrid },
  { value: "table", label: "ตาราง", icon: Table2 },
  { value: "board", label: "บอร์ด", icon: LayoutDashboard },
]

export default function OverviewPage() {
  const { permittedStations, isLoading: stationLoading } = useStation()
  const [stations, setStations] = useState<OverviewStation[]>([])
  const [loading, setLoading] = useState(true)
  const [countdown, setCountdown] = useState(POLL_INTERVAL)
  const [pulse, setPulse] = useState(false)
  const [layout, setLayout] = useState<LayoutMode>("cards")
  const [filter, setFilter] = useState<"all" | "alert" | "offline">("all")
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const cdRef = useRef<NodeJS.Timeout | null>(null)

  // restore layout preference
  useEffect(() => {
    const saved = localStorage.getItem("wm-overview-layout") as LayoutMode | null
    if (saved) setLayout(saved)
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light")
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
      // surface via your toast/logging if desired
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
    cdRef.current = setInterval(() => setCountdown((c) => (c > 1 ? c - 1 : POLL_INTERVAL)), 1000)
    return () => { if (cdRef.current) clearInterval(cdRef.current) }
  }, [])

  const counts = useMemo(() => ({
    all: stations.length,
    online: stations.filter((s) => s.status === "online").length,
    offline: stations.filter((s) => s.status === "offline").length,
    alert: stations.filter(isAlertStation).length,
  }), [stations])

  const filtered = useMemo(() => stations.filter((s) => {
    if (query) {
      const q = query.toLowerCase()
      if (!s.name.toLowerCase().includes(q) && !s.id.toLowerCase().includes(q) && !s.province.includes(query)) return false
    }
    if (filter === "alert") return isAlertStation(s)
    if (filter === "offline") return s.status === "offline"
    return true
  }), [stations, query, filter])

  const selected = selectedId ? stations.find((s) => s.id === selectedId) ?? null : null

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark"
    setTheme(next)
    document.documentElement.classList.toggle("dark", next === "dark")
  }

  if (stationLoading) {
    return (
      <div className="mx-auto max-w-[1500px] space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))" }}>
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1500px] pb-10">
      {/* header */}
      <div className="mb-4 flex flex-wrap items-center gap-3 border-b pb-4">
        <div className="mr-auto">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">ภาพรวมสถานีตรวจวัด</h1>
          <p className="text-xs text-muted-foreground">WiMaRC · {counts.all} สถานี</p>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-green-100 bg-green-50 px-3 py-1 text-xs font-bold text-green-700 md:flex" role="status" aria-live="polite">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          Real-time
        </div>
        <div className="flex items-center gap-1.5 font-mono text-xs tabular-nums text-muted-foreground" role="timer" aria-label={`อัปเดตในอีก ${countdown} วินาที`}>
          <RefreshCw className={`h-3 w-3 ${pulse ? "animate-spin text-primary" : ""}`} /> {countdown}s
        </div>
        <button onClick={toggleTheme} aria-label="สลับธีม" className="grid h-9 w-9 place-items-center rounded-lg border bg-secondary text-foreground hover:bg-muted">
          {theme === "dark" ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
        </button>
      </div>

      {/* summary */}
      <div className="mb-4 flex flex-wrap gap-3">
        <StatPill icon={LayoutGrid} label="ทั้งหมด" value={counts.all} color="bg-primary/10 text-primary" />
        <StatPill icon={Wifi} label="ออนไลน์" value={counts.online} color="bg-green-500/10 text-green-600" />
        <StatPill icon={WifiOff} label="ออฟไลน์" value={counts.offline} color="bg-red-500/10 text-red-600" />
        <StatPill icon={AlertTriangle} label="แจ้งเตือน VPD" value={counts.alert} color="bg-orange-500/10 text-orange-600" />
      </div>

      {/* controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="mr-auto flex flex-wrap gap-2">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")} count={counts.all}>ทั้งหมด</FilterChip>
          <FilterChip active={filter === "alert"} onClick={() => setFilter("alert")} count={counts.alert} dot="bg-orange-500">แจ้งเตือน</FilterChip>
          <FilterChip active={filter === "offline"} onClick={() => setFilter("offline")} count={counts.offline} dot="bg-red-500">ออฟไลน์</FilterChip>
        </div>
        <div className="relative flex items-center">
          <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาสถานี..." className="w-44 pl-9" />
        </div>
        <div className="inline-flex gap-0.5 rounded-xl border bg-secondary p-0.5">
          {LAYOUTS.map((l) => {
            const active = layout === l.value
            const LIcon = l.icon
            return (
              <button
                key={l.value}
                onClick={() => setLayout(l.value)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <LIcon className="h-4 w-4" /> <span className="max-sm:hidden">{l.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* active layout */}
      {loading && stations.length === 0 ? (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))" }}>
          {[...Array(12)].map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
          <Search className="h-8 w-8 opacity-30" />
          <p className="text-sm">ไม่พบสถานีที่ตรงกับเงื่อนไข</p>
        </Card>
      ) : layout === "cards" ? (
        <StationCardGrid stations={filtered} onOpen={(s) => setSelectedId(s.id)} />
      ) : layout === "table" ? (
        <StationsTable stations={filtered} onOpen={(s) => setSelectedId(s.id)} />
      ) : (
        <StationBoard stations={filtered} onOpen={(s) => setSelectedId(s.id)} />
      )}

      <StationDetailModal station={selected} onClose={() => setSelectedId(null)} />
    </div>
  )
}
