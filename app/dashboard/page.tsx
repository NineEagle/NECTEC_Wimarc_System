"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { useStation } from "@/contexts/StationContext"
import { getLiveData, getTmdForecast, getHourlyForecast, getTmdWarnings } from "@/services/sensorService"
import type { LiveData, TmdForecastDay, HourlyForecastSlot, TmdWarning } from "@/types"
import { StatusBadge } from "@/components/dashboard/StatusBadge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { formatThaiDateTime, formatThaiDateTimeSeconds } from "@/utils/dateUtils"
import {
  Thermometer, Droplets, Sun, Wind, CloudRain, Gauge,
  Activity, ImageIcon, RefreshCw, Bell, AlertTriangle, Maximize2, X,
  CheckCircle2, ArrowDown, ArrowUp,
  Map, BarChart2, CalendarDays, Download, GitCompare, Sprout, Calendar, Settings
} from "lucide-react"
import Link from "next/link"
import { VpdInfoButton } from "@/components/ui/VpdInfoButton"
import { getTodayImages, type HourlyImage } from "@/services/sensorService"
import { loadSystemConfig } from "@/services/systemConfigCache"
import type { SystemConfig } from "@/components/config/configTypes"
import { defaultSystem } from "@/components/config/configUtils"

const POLL_INTERVAL = 15 // seconds — sensors arrive every ~1 min, poll faster for live feel

function useSecondsAgo(anchorTime: Date | null) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (!anchorTime) { setSeconds(0); return }
    const tick = () => setSeconds(Math.floor((Date.now() - anchorTime.getTime()) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [anchorTime])
  return seconds
}

function secondsLabel(s: number) {
  if (s < 60) return `${s} วินาทีที่แล้ว`
  if (s < 3600) return `${Math.floor(s / 60)} นาทีที่แล้ว`
  return `${Math.floor(s / 3600)} ชั่วโมงที่แล้ว`
}

const SHOW_TOR = process.env.NEXT_PUBLIC_SHOW_TOR_LABELS === "1"

function SensorCard({
  title, value, unit, icon: Icon, className = "", vpdStatus = null, type = "default", dbField = "", chartKey = ""
}: {
  title: string; value?: number | null; unit: string; icon: React.ElementType; className?: string; vpdStatus?: string | null; type?: string; dbField?: string; chartKey?: string
}) {
  const sensorStyles: Record<string, { bg: string; border: string; fg: string }> = {
    temp:     { bg: "bg-sensor-temp-bg",     border: "border-sensor-temp-border",     fg: "text-sensor-temp-fg" },
    humid:    { bg: "bg-sensor-humid-bg",    border: "border-sensor-humid-border",    fg: "text-sensor-humid-fg" },
    light:    { bg: "bg-sensor-light-bg",    border: "border-sensor-light-border",    fg: "text-sensor-light-fg" },
    rain:     { bg: "bg-sensor-rain-bg",     border: "border-sensor-rain-border",     fg: "text-sensor-rain-fg" },
    wind:     { bg: "bg-sensor-wind-bg",     border: "border-sensor-wind-border",     fg: "text-sensor-wind-fg" },
    pressure: { bg: "bg-sensor-pressure-bg", border: "border-sensor-pressure-border", fg: "text-sensor-pressure-fg" },
    vpd:      { bg: "bg-sensor-vpd-bg",      border: "border-sensor-vpd-border",      fg: "text-sensor-vpd-fg" },
    soil:     { bg: "bg-sensor-soil-bg",     border: "border-sensor-soil-border",     fg: "text-sensor-soil-fg" },
    default:  { bg: "bg-card",               border: "border-border",                 fg: "text-foreground" },
  }
  const style = sensorStyles[type] ?? sensorStyles.default

  const href = chartKey ? `/historical?chart=${chartKey}` : "/historical"
  return (
    <Link href={href}>
    <Card className={`${style.bg} ${style.border} ${className} shadow-sm border cursor-pointer hover:shadow-md hover:brightness-95 transition-all`}>
      <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-1">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide leading-none">{title}</CardTitle>
            {type === "vpd" && <VpdInfoButton />}
          </div>
          {SHOW_TOR && dbField && <span className="text-[10px] font-mono text-muted-foreground/60 mt-1 uppercase">{dbField}</span>}
        </div>
        <Icon className={`h-4 w-4 ${style.fg} opacity-80`} aria-hidden="true" />
      </CardHeader>
      <CardContent className="px-3 pb-2">
        <div className="flex items-baseline gap-2 flex-wrap">
          <div className={`text-2xl font-black ${style.fg}`}>
            {value != null ? `${typeof value === "number" && !Number.isInteger(value) ? value.toFixed(1) : value}` : "—"}
            <span className="text-sm font-normal ml-1 text-muted-foreground">{unit}</span>
          </div>
          {vpdStatus && (
            <Badge
              aria-label={`สถานะ VPD: ${vpdStatus}`}
              className={
                vpdStatus === "เหมาะสม" ? "bg-green-600 text-white hover:bg-green-700 border-none px-1.5 h-5 text-xs gap-1" :
                vpdStatus === "ต่ำ" ? "bg-blue-600 text-white hover:bg-blue-700 border-none px-1.5 h-5 text-xs gap-1" :
                "bg-red-600 text-white hover:bg-red-700 border-none px-1.5 h-5 text-xs gap-1"
              }
            >
              {vpdStatus === "เหมาะสม" && <CheckCircle2 className="h-3 w-3" />}
              {vpdStatus === "ต่ำ" && <ArrowDown className="h-3 w-3" />}
              {vpdStatus === "สูง" && <ArrowUp className="h-3 w-3" />}
              {vpdStatus}
            </Badge>
          )}
        </div>
        <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold text-muted-foreground/60">
          <BarChart2 className="h-3 w-3" /> ดูกราฟ
        </span>
      </CardContent>
    </Card>
    </Link>
  )
}

const WIND_DIRS_TH = ["เหนือ", "ตะวันออกเฉียงเหนือ", "ตะวันออก", "ตะวันออกเฉียงใต้", "ใต้", "ตะวันตกเฉียงใต้", "ตะวันตก", "ตะวันตกเฉียงเหนือ"]
const WIND_DIRS_EN = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]

function degToCompass(deg: number | null | undefined) {
  if (deg == null) return { label: "—", th: "", idx: -1, deg: 0 }
  const idx = Math.round(((deg % 360) / 45)) % 8
  return { label: WIND_DIRS_EN[idx], th: WIND_DIRS_TH[idx], idx, deg }
}

function WindCombinedCard({ speed, deg, dbField }: { speed: number | null | undefined; deg: number | null | undefined; dbField?: string }) {
  const c = degToCompass(deg)
  return (
    <Card className="bg-sensor-wind-bg border-sensor-wind-border shadow-sm border">
      <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3">
        <div className="flex flex-col">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide leading-none">ลม</CardTitle>
          {SHOW_TOR && dbField && <span className="text-[10px] font-mono text-muted-foreground/60 mt-1 uppercase">{dbField}</span>}
        </div>
        <Wind className="h-4 w-4 text-sensor-wind-fg opacity-80" aria-hidden="true" />
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <div className="grid grid-cols-2 gap-2 divide-x divide-sensor-wind-border/40">
          {/* Left: speed */}
          <div>
            <div className="text-[9px] text-muted-foreground uppercase mb-0.5">ความเร็ว</div>
            <div className="text-xl font-black text-sensor-wind-fg leading-tight">
              {speed != null ? speed.toFixed(1) : "—"}
              <span className="text-xs font-normal ml-1 text-muted-foreground">m/s</span>
            </div>
          </div>
          {/* Right: direction */}
          <div className="pl-2">
            <div className="text-[9px] text-muted-foreground uppercase mb-0.5 flex items-center gap-1">
              ทิศ
              <svg viewBox="0 0 24 24" className="h-3 w-3 text-sensor-wind-fg opacity-80"
                   style={{ transform: deg != null ? `rotate(${deg}deg)` : "none", transition: "transform 0.3s" }} aria-hidden="true">
                <path d="M12 2 L17 12 L12 9 L7 12 Z" fill="currentColor" />
              </svg>
            </div>
            {deg != null ? (
              <>
                <div className="text-xl font-black text-sensor-wind-fg leading-tight">
                  {Math.round(c.deg)}°
                  <span className="text-xs font-normal ml-1">{c.label}</span>
                </div>
                <div className="text-[9px] text-muted-foreground mt-0.5 truncate">จาก{c.th}</div>
              </>
            ) : (
              <div className="text-xl font-black text-sensor-wind-fg">—</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// TMD cond codes 1-8; WMO codes as fallback
function condIcon(code: number | null, source?: string): string {
  if (code === null || code === undefined) return "🌡️"
  if (source !== "openmeteo") {
    // TMD cond 1-8
    const tmd: Record<number, string> = { 1: "☀️", 2: "🌤️", 3: "⛅", 4: "☁️", 5: "🌦️", 6: "🌧️", 7: "🌧️", 8: "⛈️" }
    if (tmd[code]) return tmd[code]
  }
  // WMO fallback
  if (code === 0) return "☀️"
  if (code <= 2) return "🌤️"
  if (code <= 3) return "☁️"
  if (code <= 48) return "🌫️"
  if (code <= 67) return "🌧️"
  if (code <= 77) return "❄️"
  if (code <= 82) return "🌦️"
  if (code <= 99) return "⛈️"
  return "🌡️"
}

const TMD_COND_LABEL: Record<number, string> = {
  1: "ท้องฟ้าแจ่มใส", 2: "มีเมฆบางส่วน", 3: "มีเมฆเป็นส่วนมาก",
  4: "มีเมฆมาก", 5: "ฝนตกเล็กน้อย", 6: "ฝนตกปานกลาง",
  7: "ฝนตกหนัก", 8: "ฝนฟ้าคะนอง",
}

function HourlyForecastCard({
  slots,
  tempMax,
  tempMin,
  warnings,
}: {
  slots: HourlyForecastSlot[]
  tempMax?: number | null
  tempMin?: number | null
  warnings: TmdWarning[]
}) {
  const nowHour = new Date().getHours()
  const scrollRef = useRef<HTMLDivElement>(null)
  const source = slots[0]?.source

  const upcoming = slots.filter(s => new Date(s.time).getHours() >= nowHour)
  if (!upcoming.length) return null

  const currentSlot = upcoming[0]
  const condLabel = currentSlot?.weatherCode != null ? TMD_COND_LABEL[currentSlot.weatherCode] ?? "" : ""
  const hasWarning = warnings.length > 0

  return (
    <Card className="shadow-sm border overflow-hidden col-span-full bg-sky-50 border-sky-100">
      <CardContent className="p-0">
        <div className="flex flex-col md:flex-row md:items-stretch">

          {/* Left panel — current conditions (desktop: fixed width, mobile: full width top) */}
          <div className="flex flex-col justify-center items-center text-center px-5 pt-4 pb-3 md:w-44 md:shrink-0 md:border-r md:border-sky-100 gap-0.5">
            <div className="text-7xl font-thin leading-none tracking-tighter text-sky-600">
              {currentSlot?.temperature != null ? `${currentSlot.temperature}°` : "—"}
            </div>
            <div className="text-sm font-normal text-slate-500 mt-2">
              {condIcon(currentSlot?.weatherCode ?? null, source)} {condLabel || "พยากรณ์"}
            </div>
            {(tempMax != null || tempMin != null) && (
              <div className="text-xs text-slate-400 flex gap-2 mt-0.5">
                {tempMax != null && <span>H:{tempMax}°</span>}
                {tempMin != null && <span>L:{tempMin}°</span>}
              </div>
            )}
            <div className="text-[9px] text-slate-300 font-mono mt-0.5">
              {source === "tmd" ? "กรมอุตุฯ" : "Open-Meteo"}
            </div>

            {/* Warning banner — inline on desktop */}
            {hasWarning && (
              <div className="mt-2 w-full bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 text-left">
                <div className="flex items-start gap-1.5">
                  <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[10px] font-semibold text-amber-700">เตือนภัย</div>
                    {warnings.map((w, i) => (
                      <div key={i} className="text-[10px] text-amber-600 leading-tight">{w.text}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Divider — horizontal on mobile, vertical handled by border-r above on desktop */}
          <div className="border-t border-sky-100 md:hidden" />

          {/* Right panel — hourly scroll */}
          <div ref={scrollRef} className="overflow-x-auto scrollbar-none flex-1">
            <div className="flex min-w-max px-2 py-2 gap-0.5 h-full items-center">
              {upcoming.map((s, idx) => {
                const hour = new Date(s.time).getHours()
                const isCurrent = idx === 0
                const rainProb = s.precipitationProbability ?? 0
                const probColor = rainProb >= 70 ? "text-blue-600 font-semibold" : rainProb >= 40 ? "text-blue-400" : "text-slate-300"
                return (
                  <div
                    key={s.time}
                    className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg min-w-[46px] text-center ${
                      isCurrent ? "bg-white shadow-sm border border-sky-100" : "hover:bg-white/60"
                    }`}
                  >
                    <span className={`text-[10px] font-semibold ${isCurrent ? "text-sky-600" : "text-slate-400"}`}>
                      {isCurrent ? "ตอนนี้" : `${String(hour).padStart(2, "0")}:00`}
                    </span>
                    <span className="text-base leading-none">{condIcon(s.weatherCode, source)}</span>
                    <span className={`text-[11px] font-bold ${isCurrent ? "text-slate-700" : "text-slate-600"}`}>
                      {s.temperature != null ? `${s.temperature}°` : "—"}
                    </span>
                    <span className={`text-[9px] ${probColor}`}>
                      {rainProb > 0 ? `${rainProb}%` : "—"}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </CardContent>
    </Card>
  )
}

function TodayForecastCard({ tmd }: { tmd: TmdForecastDay[] }) {
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayFc = tmd.find(d => d.date === todayStr) ?? tmd[0]

  return (
    <Card className="bg-sensor-rain-bg border-sensor-rain-border shadow-sm border">
      <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3 px-3">
        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide leading-none">
          พยากรณ์วันนี้ <span className="font-normal opacity-50">(กรมอุตุฯ)</span>
        </CardTitle>
        <CloudRain className="h-4 w-4 text-blue-600 opacity-80" aria-hidden="true" />
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {todayFc ? (
          <div className="flex flex-col gap-1 text-xs">
            {[
              { icon: <Thermometer className="h-3 w-3 shrink-0" />, label: "อุณหภูมิ",
                value: todayFc.maxTemp != null
                  ? <><span className="text-red-500">{todayFc.maxTemp.toFixed(1)}</span><span className="text-muted-foreground mx-0.5">/</span><span className="text-blue-500">{todayFc.minTemp?.toFixed(1) ?? "—"}</span><span className="text-muted-foreground">°C</span></>
                  : <span>{todayFc.avgTemp?.toFixed(1) ?? "—"}°C</span> },
              { icon: <CloudRain className="h-3 w-3 shrink-0" />, label: "ฝนสะสม",    value: <span>{todayFc.totalRain?.toFixed(1) ?? "—"} mm</span> },
              { icon: <Droplets  className="h-3 w-3 shrink-0" />, label: "ความชื้น",  value: <span>{todayFc.avgHumidity?.toFixed(0) ?? "—"}%</span> },
              { icon: <Wind      className="h-3 w-3 shrink-0" />, label: "ลม",        value: <span>{todayFc.avgWindSpeed?.toFixed(1) ?? "—"} m/s</span> },
            ].map(({ icon, label, value }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className="text-muted-foreground">{icon}</span>
                <span className="text-muted-foreground">{label}</span>
                <span className="ml-auto font-medium text-foreground whitespace-nowrap">{value}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-2xl font-black text-muted-foreground">—</div>
        )}
      </CardContent>
    </Card>
  )
}

function getVPDStatus(vpd: number | null | undefined, low: number, high: number): string | null {
  if (vpd == null) return null
  if (vpd < low) return "ต่ำ"
  if (vpd <= high) return "เหมาะสม"
  return "สูง"
}


export default function DashboardPage() {
  const { selectedStation, selectedStationId, setSelectedStationId, permittedStations, isLoading: stationLoading } = useStation()
  const searchParams = useSearchParams()

  useEffect(() => {
    const stationParam = searchParams.get("station")
    if (stationParam && !stationLoading) {
      setSelectedStationId(stationParam)
    }
  }, [searchParams, stationLoading, setSelectedStationId])
  const [live, setLive] = useState<LiveData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState(POLL_INTERVAL)
  const [showAlertPanel] = useState(false)
  const [imageFullscreen, setImageFullscreen] = useState(false)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  const [todayImages, setTodayImages] = useState<HourlyImage[]>([])
  const [tmdForecast, setTmdForecast] = useState<TmdForecastDay[]>([])
  const [tmdNoKey, setTmdNoKey] = useState(false)
  const [hourlyForecast, setHourlyForecast] = useState<HourlyForecastSlot[]>([])
  const [tmdWarnings, setTmdWarnings] = useState<TmdWarning[]>([])
  const [pollingPulse, setPollingPulse] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  const [pollInterval, setPollInterval] = useState(POLL_INTERVAL)
  const [sysConfig, setSysConfig] = useState<SystemConfig>(() => defaultSystem())

  useEffect(() => {
    loadSystemConfig().then(c => {
      setSysConfig(c)
      if (c.dashboardRefreshSeconds !== null) setPollInterval(c.dashboardRefreshSeconds)
    })
  }, [])

  const pingAgo = useSecondsAgo(live?.lastPing ?? null)
  const sensorAgo = useSecondsAgo(live?.sensorTime ?? null)
  const imageAgo = useSecondsAgo(live?.imageTime ?? null)

  const fetchLive = useCallback(async (showSpinner = false) => {
    if (!selectedStationId) return
    if (showSpinner) setIsLoading(true)
    else setPollingPulse(true)
    try {
      // Weather station: also fetch sister soil station so soil cards have values
      const isWeather = !selectedStationId.endsWith("c")
      const soilId = isWeather ? `${selectedStationId}c` : null
      const [data, soilData] = await Promise.all([
        getLiveData(selectedStationId),
        soilId ? getLiveData(soilId).catch(() => null) : Promise.resolve(null),
      ])
      const merged: LiveData = soilData
        ? {
            ...data,
            soilMoisture1: data.soilMoisture1 ?? soilData.soilMoisture1,
            soilMoisture2: data.soilMoisture2 ?? soilData.soilMoisture2,
            soilTemperature1: data.soilTemperature1 ?? soilData.soilTemperature1,
            soilTemperature2: data.soilTemperature2 ?? soilData.soilTemperature2,
          }
        : data
      setLive(merged)
      setRefreshedAt(new Date())
      setCountdown(pollInterval)
    } catch {
      // silent
    } finally {
      if (showSpinner) setIsLoading(false)
      else setTimeout(() => setPollingPulse(false), 500)
    }
  }, [selectedStationId])

  useEffect(() => {
    if (!selectedStationId) return
    fetchLive(true)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => fetchLive(false), pollInterval * 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [selectedStationId, fetchLive, pollInterval])

  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current)
    countdownRef.current = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : pollInterval))
    }, 1000)
    return () => { if (countdownRef.current) clearInterval(countdownRef.current) }
  }, [refreshedAt])

  useEffect(() => {
    if (!selectedStationId || selectedStation?.type !== "weather") { setTmdForecast([]); setHourlyForecast([]); setTmdWarnings([]); return }
    getTmdForecast(selectedStationId).then(r => { setTmdNoKey(r.noKey); setTmdForecast(r.forecasts) }).catch(() => {})
    getHourlyForecast(selectedStationId).then(setHourlyForecast).catch(() => {})
    getTmdWarnings(selectedStationId).then(setTmdWarnings).catch(() => {})
  }, [selectedStationId, selectedStation?.type])

  useEffect(() => {
    if (!selectedStationId) return
    getTodayImages(selectedStationId).then(setTodayImages).catch(() => {})
  }, [selectedStationId])

  useEffect(() => {
    if (!imageFullscreen && !fullscreenImage) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setImageFullscreen(false); setFullscreenImage(null) }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [imageFullscreen, fullscreenImage])

  if (stationLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    )
  }

  if (permittedStations.length === 0) {
    return (
      <Alert>
        <AlertDescription>คุณไม่มีสิทธิ์เข้าถึงสถานีใดๆ กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์การเข้าถึง</AlertDescription>
      </Alert>
    )
  }

  const isWeatherStation = selectedStation?.type === "weather"
  const isOnline = live?.lastPing ? pingAgo < 300 : false
  const vpdStatus = getVPDStatus(live?.vpd, sysConfig.vpdLow, sysConfig.vpdHigh)

  const tooltipStyle = {
    backgroundColor: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "var(--radius)",
  }

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto pb-8">
      {/* 1. Header Row */}
      <div className="flex items-end justify-between border-b pb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">แดชบอร์ดสภาวะแวดล้อม</h1>
          {SHOW_TOR ? (
            <p className="text-xs text-muted-foreground font-mono">TOR 4.5.3 • {selectedStationId || "no-station"}</p>
          ) : (
            <p className="text-xs text-muted-foreground">{selectedStation?.name ?? selectedStationId ?? ""}</p>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div
            className="hidden md:flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1 rounded-full border border-green-100 text-xs font-bold"
            role="status"
            aria-live="polite"
          >
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Real-time
            {pollingPulse && <RefreshCw className="h-3 w-3 animate-spin opacity-60" aria-hidden="true" />}
          </div>
          <div
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
            aria-label={`อัปเดตอัตโนมัติในอีก ${countdown} วินาที`}
            role="timer"
          >
            <RefreshCw className={`h-3 w-3 ${isLoading || pollingPulse ? "animate-spin text-primary" : ""}`} aria-hidden="true" />
            <span className="font-mono tabular-nums">{countdown}s</span>
          </div>
        </div>
      </div>


      {!selectedStation ? (
        <Alert><AlertDescription>กรุณาเลือกสถานี</AlertDescription></Alert>
      ) : (
        <>
          {/* 3. Status Bar */}
          <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between flex-wrap gap-4 border shadow-sm text-sm">
            <div className="flex items-center gap-3">
              <span className="font-bold text-muted-foreground text-xs uppercase">สถานี:</span>
              <span className="font-bold">{selectedStation.name}</span>
              <div className="flex items-center gap-1.5 ml-2">
                <div className={`h-2.5 w-2.5 rounded-full ${isOnline ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500"}`}></div>
                <span className={`text-xs font-bold ${isOnline ? "text-green-600" : "text-red-600"}`}>
                  {isOnline ? "ออนไลน์" : "ออฟไลน์"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-6 text-[12px] text-muted-foreground font-medium">
              <div>อัปเดต: <span className="text-foreground font-mono">{live?.sensorTime ? formatThaiDateTimeSeconds(live.sensorTime) : "--"}</span></div>
              <div className="hidden sm:block text-[10px] opacity-60">เซ็นเซอร์: {secondsLabel(sensorAgo)}</div>
              {SHOW_TOR && <span className="text-[10px] font-mono text-muted-foreground/50 hidden sm:block">TOR 4.5.8.1</span>}
            </div>
          </div>

          {/* 4. Sensor Grid */}
          {SHOW_TOR && (
            <div className="text-[10px] font-mono text-muted-foreground/50 -mb-1">
              TOR 4.5.3.1 — ดึงข้อมูลเซนเซอร์ + คำนวณ VPD &nbsp;|&nbsp; TOR 4.5.3.4 — แสดงหน้าจอรวมค่าต่างๆ
            </div>
          )}
          {isWeatherStation && hourlyForecast.length > 0 && (() => {
            const todayStr = new Date().toISOString().slice(0, 10)
            const todayTmd = tmdForecast.find(d => d.date === todayStr) ?? tmdForecast[0]
            return (
              <HourlyForecastCard
                slots={hourlyForecast}
                tempMax={todayTmd?.maxTemp ?? null}
                tempMin={todayTmd?.minTemp ?? null}
                warnings={tmdWarnings}
              />
            )
          })()}

          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            {isWeatherStation ? (
              <>
                <SensorCard title="อุณหภูมิ"   value={live?.airTemperature}     unit={sysConfig.conversions.airTemp.unit}    icon={Thermometer} type="temp"     dbField="CAM_main.B"  chartKey="airTemperature" />
                <SensorCard title="ความชื้น" value={live?.relativeHumidity}   unit={sysConfig.conversions.humidity.unit}   icon={Droplets}    type="humid"    dbField="CAM_main.A"  chartKey="relativeHumidity" />
                <SensorCard title="ความเข้มแสง"      value={live?.lightIntensity}     unit={sysConfig.conversions.light.unit}      icon={Sun}         type="light"    dbField="CAM_main.C"  chartKey="lightIntensity" />
                <SensorCard title="ปริมาณน้ำฝน"        value={live?.rainfall}           unit={sysConfig.conversions.rain.unit}       icon={CloudRain}   type="rain"     dbField="CAM_main.D"  chartKey="rainfall" />
                <WindCombinedCard speed={live?.windSpeed} deg={live?.windDirection} dbField="CAM_main.F/H" />
                <SensorCard title="ความกดอากาศ"      value={live?.atmosphericPressure} unit={sysConfig.conversions.pressure.unit}   icon={Gauge}       type="pressure" dbField="CAM_main.E"  chartKey="atmosphericPressure" />
                <SensorCard title="VPD (ทุเรียน)"    value={live?.vpd}                unit="kPa" icon={Activity}    type="vpd"      dbField="Calculated"  chartKey="vpd" />
                <TodayForecastCard tmd={tmdForecast} />
              </>
            ) : (
              <>
                <SensorCard title="ความชื้นดิน 15cm" value={live?.soilMoisture1}     unit={sysConfig.conversions.soilMoist1.unit}  icon={Droplets}    type="soil" dbField="CAM_client.A" chartKey="soilMoisture1" />
                <SensorCard title="อุณหภูมิดิน 15cm"  value={live?.soilTemperature1}  unit={sysConfig.conversions.soilTemp1.unit}   icon={Thermometer} type="temp" dbField="CAM_client.B" chartKey="soilTemperature1" />
                <SensorCard title="ความชื้นดิน 30cm" value={live?.soilMoisture2}     unit={sysConfig.conversions.soilMoist2.unit}  icon={Droplets}    type="soil" dbField="CAM_client.C" chartKey="soilMoisture2" />
                <SensorCard title="อุณหภูมิดิน 30cm"  value={live?.soilTemperature2}  unit={sysConfig.conversions.soilTemp2.unit}   icon={Thermometer} type="temp" dbField="CAM_client.D" chartKey="soilTemperature2" />
              </>
            )}
          </div>

          {/* 5. Camera & Hourly History */}
          <Card className="overflow-hidden border shadow-md">
            <div className="bg-muted px-4 py-2 border-b flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-tight flex items-center gap-1">
                <ImageIcon className="h-3 w-3" /> ภาพกล้องสถานี
                {SHOW_TOR && <span className="font-normal text-muted-foreground/50 ml-2">TOR 4.5.3.2</span>}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono opacity-50">{selectedStationId}/cam1</span>
                {live?.imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageFullscreen(true)}
                    className="bg-muted-foreground/10 hover:bg-muted-foreground/20 text-muted-foreground p-1 rounded transition-colors"
                    aria-label="ขยายภาพ"
                  >
                    <Maximize2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
            <CardContent className="p-3">
              <div className="flex gap-4 flex-col md:flex-row">
                {/* Left: Current image */}
                <div className="md:w-1/2 shrink-0">
                  {live?.imageUrl ? (
                    <div className="relative group">
                      <img
                        src={`${live.imageUrl}?t=${live.imageTime?.getTime() ?? 0}`}
                        alt="Station view"
                        className="w-full aspect-video rounded-md object-cover cursor-zoom-in"
                        onClick={() => setImageFullscreen(true)}
                      />
                      <button
                        type="button"
                        onClick={() => setImageFullscreen(true)}
                        className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded transition-opacity opacity-60 group-hover:opacity-100"
                        aria-label="ขยายภาพ"
                      >
                        <Maximize2 className="h-4 w-4" />
                      </button>
                      <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded font-mono">
                        📸 {live.imageTime ? formatThaiDateTimeSeconds(live.imageTime) : "LIVE"}
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-video bg-muted flex items-center justify-center rounded-md">
                      <ImageIcon className="h-10 w-10 text-muted-foreground/20" />
                    </div>
                  )}
                </div>

                {/* Right: Hourly history — daytime only (05:00–18:00), latest 6 */}
                <div className="md:w-1/2 flex flex-col">
                  {(() => {
                    const daytime = todayImages
                      .filter(img => {
                        const h = img.timestamp.getHours()
                        return h >= 5 && h < 18
                      })
                      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                      .slice(0, 6)
                    return (
                      <>
                        <div className="text-[11px] font-semibold text-muted-foreground uppercase mb-2">
                          ประวัติรูป ({daytime.length} ชั่วโมงล่าสุด)
                        </div>
                        {daytime.length === 0 ? (
                          <div className="flex-1 flex items-center justify-center bg-muted/40 rounded-md text-xs text-muted-foreground">
                            ยังไม่มีรูปช่วงกลางวัน
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-1.5 overflow-y-auto max-h-[320px] pr-1">
                            {daytime.map((img, i) => (
                              <div
                                key={i}
                                className="relative group cursor-pointer rounded overflow-hidden"
                                onClick={() => setFullscreenImage(img.imageUrl)}
                              >
                                <img
                                  src={img.imageUrl}
                                  alt={`ชั่วโมง ${img.timestamp.getHours()}:00`}
                                  className="w-full aspect-video object-cover hover:opacity-90 transition-opacity"
                                />
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] text-center py-0.5 font-mono">
                                  {img.timestamp.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 6. TMD Forecast */}
          {isWeatherStation && (
            <Card className="shadow-md border-t-4 border-t-blue-600 overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 border-b flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase tracking-tight flex items-center gap-2">
                  <CloudRain className="h-3.5 w-3.5 text-blue-600" />
                  พยากรณ์อากาศ — กรมอุตุนิยมวิทยา
                  <span className="font-normal opacity-50 ml-1">TOR 4.5.3.3</span>
                </h3>
                <span className="text-[10px] text-muted-foreground italic">data.tmd.go.th</span>
              </div>
              <CardContent className="p-0">
                {tmdForecast.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">ไม่มีข้อมูลพยากรณ์</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/40 border-b text-muted-foreground uppercase text-[10px] font-bold">
                          <th className="p-3 text-left">วันที่</th>
                          <th className="p-3 text-center">สูงสุด/ต่ำสุด (°C)</th>
                          <th className="p-3 text-center">ความชื้น (%)</th>
                          <th className="p-3 text-center normal-case">ฝนรวม (mm)</th>
                          <th className="p-3 text-center normal-case">ลม (m/s)</th>
                          <th className="p-3 text-center">ทิศลม</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {tmdForecast.map((d) => {
                          const wd = degToCompass(d.avgWindDir)
                          return (
                            <tr key={d.date} className="hover:bg-muted/20">
                              <td className="p-3 font-mono font-bold">
                                {new Date(d.date).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}
                              </td>
                              <td className="p-3 text-center font-bold text-orange-600">
                                {d.maxTemp != null
                                  ? <><span className="text-red-500">{d.maxTemp.toFixed(1)}</span><span className="text-muted-foreground mx-0.5">/</span><span className="text-blue-500">{d.minTemp?.toFixed(1) ?? "—"}</span></>
                                  : (d.avgTemp?.toFixed(1) ?? "—")
                                }
                              </td>
                              <td className="p-3 text-center text-blue-600">{d.avgHumidity?.toFixed(0) ?? "—"}</td>
                              <td className="p-3 text-center text-indigo-600 font-bold">{d.totalRain?.toFixed(1) ?? "—"}</td>
                              <td className="p-3 text-center text-slate-600">{d.avgWindSpeed?.toFixed(1) ?? "—"}</td>
                              <td className="p-3 text-center text-slate-700">
                                {d.avgWindDir != null ? (
                                  <span className="inline-flex items-center gap-1">
                                    <svg viewBox="0 0 24 24" className="h-3 w-3"
                                         style={{ transform: `rotate(${d.avgWindDir}deg)` }} aria-hidden="true">
                                      <path d="M12 2 L17 12 L12 9 L7 12 Z" fill="currentColor" />
                                    </svg>
                                    {Math.round(d.avgWindDir)}° {wd.label}
                                  </span>
                                ) : "—"}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 8. Navigation Grid */}
          <div className="pt-2 pb-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-2 px-0.5">ไปยัง</div>
            <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-8 gap-2">
              {/* Google Maps — external link with station coordinates */}
              {(() => {
                const gmapsHref = selectedStation?.latitude != null && selectedStation?.longitude != null
                  ? `https://www.google.com/maps?q=${selectedStation.latitude},${selectedStation.longitude}`
                  : "https://www.google.com/maps"
                return (
                  <a
                    href={gmapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border border-border bg-card hover:bg-muted/60 hover:border-primary/20 transition-colors group"
                  >
                    <Map className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground leading-none text-center">แผนที่</span>
                  </a>
                )
              })()}
              {/* Internal nav links */}
              {[
                { href: "/historical", icon: BarChart2,   label: "ย้อนหลัง" },
                { href: "/daily",      icon: CalendarDays,label: "รายวัน" },
                { href: "/compare",    icon: GitCompare,  label: "เปรียบเทียบ" },
                { href: "/activities", icon: Sprout,      label: "กิจกรรม" },
                { href: "/calendar",   icon: Calendar,    label: "ปฏิทิน" },
                { href: "/download",   icon: Download,    label: "ดาวน์โหลด" },
                { href: "/admin/system-status", icon: Settings, label: "ระบบ" },
              ].map(({ href, icon: Icon, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border border-border bg-card hover:bg-muted/60 hover:border-primary/20 transition-colors group"
                >
                  <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground leading-none text-center">{label}</span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Fullscreen image overlay — live */}
      {imageFullscreen && live?.imageUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setImageFullscreen(false)}
        >
          <button type="button" onClick={() => setImageFullscreen(false)} className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white p-2 rounded-full" aria-label="ปิด">
            <X className="h-6 w-6" />
          </button>
          <img src={`${live.imageUrl}?t=${live.imageTime?.getTime() ?? 0}`} alt="Station view fullscreen" className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1.5 rounded font-mono">
            📸 {live.imageTime ? formatThaiDateTimeSeconds(live.imageTime) : "LIVE"} • {selectedStationId}
          </div>
        </div>
      )}

      {/* Fullscreen image overlay — history */}
      {fullscreenImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setFullscreenImage(null)}
        >
          <button type="button" onClick={() => setFullscreenImage(null)} className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white p-2 rounded-full" aria-label="ปิด">
            <X className="h-6 w-6" />
          </button>
          <img src={fullscreenImage} alt="History view" className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}