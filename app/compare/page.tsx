"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useStation } from "@/contexts/StationContext"
import { loadSystemConfig } from "@/services/systemConfigCache"
import { defaultSystem, applyUnitConversion } from "@/components/config/configUtils"
import type { SystemConfig, SensorKey } from "@/components/config/configTypes"

const READING_TO_SENSOR: Partial<Record<string, SensorKey>> = {
  airTemperature: "airTemp", relativeHumidity: "humidity", lightIntensity: "light",
  windSpeed: "windSpeed", atmosphericPressure: "pressure", rainfall: "rain",
  soilTemperature1: "soilTemp1", soilTemperature2: "soilTemp2",
}
import { getAllStations } from "@/services/stationsService"
import { getAllUsers } from "@/services/userService"
import { getSensorReadings, getLiveData } from "@/services/sensorService"
import { exportCompareDataToCSV } from "@/services/exportService"
import type { Station, SensorReading, TimeRange, LiveData } from "@/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Download, Activity, Thermometer, Droplets, CloudRain, Wind, Sun } from "lucide-react"
import { VpdInfoButton } from "@/components/ui/VpdInfoButton"
import dynamic from "next/dynamic"
const CompareLineChart = dynamic(
  () => import("@/components/charts/CompareLineChart").then(m => ({ default: m.CompareLineChart })),
  { ssr: false, loading: () => <div className="h-[300px] bg-muted/20 animate-pulse rounded" /> }
)
import { formatThaiDateTime } from "@/utils/dateUtils"

function buildWeatherMetrics(c: SystemConfig) {
  const u = c.conversions
  const lightUnit = c.conversions.light.unit ?? "klux"
  return [
    { value: "airTemperature",   label: `อุณหภูมิ (${u.airTemp.unit})`,           icon: Thermometer, color1: "#14b8a6", color2: "#f97316", sensorType: "main",   unit: u.airTemp.unit },
    { value: "relativeHumidity", label: `ความชื้นสัมพัทธ์ (${u.humidity.unit})`,  icon: Droplets,    color1: "#14b8a6", color2: "#f97316", sensorType: "main",   unit: u.humidity.unit },
    { value: "vpd",              label: "VPD (kPa)",                               icon: Activity,    color1: "#14b8a6", color2: "#f97316", sensorType: "main",   unit: "kPa" },
    { value: "rainfall",         label: `ปริมาณฝน (${u.rain.unit})`,              icon: CloudRain,   color1: "#14b8a6", color2: "#f97316", sensorType: "main",   unit: u.rain.unit },
    { value: "lightIntensity",   label: `ความเข้มแสง (${lightUnit})`,             icon: Sun,         color1: "#14b8a6", color2: "#f97316", sensorType: "main",   unit: lightUnit },
    { value: "windSpeed",        label: `ความเร็วลม (${u.windSpeed.unit})`,        icon: Wind,        color1: "#14b8a6", color2: "#f97316", sensorType: "main",   unit: u.windSpeed.unit },
    { value: "windDirection",    label: "ทิศทางลม (°)",                            icon: Wind,        color1: "#14b8a6", color2: "#f97316", sensorType: "main",   unit: "°" },
    { value: "soilMoisture1",    label: `ความชื้นดิน 15cm (${u.soilMoist1.unit})`, icon: Droplets,    color1: "#14b8a6", color2: "#f97316", sensorType: "client", unit: u.soilMoist1.unit },
    { value: "soilMoisture2",    label: `ความชื้นดิน 30cm (${u.soilMoist2.unit})`, icon: Droplets,    color1: "#14b8a6", color2: "#f97316", sensorType: "client", unit: u.soilMoist2.unit },
    { value: "soilTemperature1", label: `อุณหภูมิดิน 15cm (${u.soilTemp1.unit})`, icon: Thermometer, color1: "#14b8a6", color2: "#f97316", sensorType: "client", unit: u.soilTemp1.unit },
    { value: "soilTemperature2", label: `อุณหภูมิดิน 30cm (${u.soilTemp2.unit})`, icon: Thermometer, color1: "#14b8a6", color2: "#f97316", sensorType: "client", unit: u.soilTemp2.unit },
  ]
}

function CompareSensorCard({ title, live1, live2, unit, dataKey }: {
  title: string; live1: LiveData | null; live2: LiveData | null; unit: string; dataKey: keyof LiveData
}) {
  const live = live1 ?? live2
  const isTeal = live1 != null
  const val = live ? live[dataKey] : null
  const fmt = (v: any) => typeof v === "number" ? v.toFixed(1) : "—"
  return (
    <div className="border-b py-2.5 last:border-0">
      <span className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
        {title}{title === "VPD" && <VpdInfoButton />}
      </span>
      <div className="flex items-baseline gap-1 mt-0.5">
        <span className={`text-sm font-black ${isTeal ? "text-teal-700" : "text-orange-600"}`}>{fmt(val)}</span>
        <span className="text-[10px] text-muted-foreground">{unit}</span>
      </div>
    </div>
  )
}

export default function ComparePage() {
  const { selectedStationId, permittedStations, clients, isLoading: stationLoading } = useStation()
  const [allStations, setAllStations] = useState<Station[]>([])
  const [allUsersList, setAllUsersList] = useState<any[]>([])
  const wimarcNum = (id: string) => parseInt(id.replace(/^wimarc/, ""), 10) || 0

  // Fetch ALL stations + users system-wide (for cross-user comparison)
  useEffect(() => {
    Promise.all([
      getAllStations(true).catch(() => [] as Station[]),
      getAllUsers().catch(() => [] as any[]),
    ]).then(([s, u]) => { setAllStations(s); setAllUsersList(u) })
  }, [])

  const buildGroups = (stations: Station[]) => {
    const map: Record<string, { hasMain: boolean; hasClient: boolean; label: string }> = {}
    for (const s of stations) {
      const base = s.id.replace(/c$/, "")
      if (!map[base]) {
        const name = s.ownerName || clients.find(c => c.id === s.ownerId)?.fullName
        map[base] = { hasMain: false, hasClient: false, label: name ? `${base} — ${name}` : base }
      }
      if (s.id.endsWith("c")) map[base].hasClient = true
      else map[base].hasMain = true
    }
    return Object.entries(map).map(([base, info]) => ({ base, ...info })).sort((a, b) => wimarcNum(a.base) - wimarcNum(b.base))
  }

  // Permitted groups (user's own access) — used for station 1
  const permittedGroups = useMemo(() => buildGroups(permittedStations), [permittedStations, clients])
  // All groups system-wide — used for station 2 picker (everyone can compare against anyone)
  const allGroups = useMemo(() => buildGroups(allStations), [allStations, clients])

  const isSingleAccess = permittedGroups.length === 1
  const stationGroups = isSingleAccess ? permittedGroups : allGroups
  const s1Options = isSingleAccess ? permittedGroups : allGroups
  const lockedS1 = isSingleAccess ? permittedGroups[0]?.base : null

  const [sysConfig, setSysConfig] = useState<SystemConfig>(() => defaultSystem())
  const WEATHER_METRICS = buildWeatherMetrics(sysConfig)
  const METRICS = WEATHER_METRICS

  const [s1Base, setS1Base] = useState<string>("")
  const [s2Base, setS2Base] = useState<string>("")
  const [sensorType, setSensorType] = useState<"main" | "client">("main")
  const [metric, setMetric] = useState(METRICS[0].value)
  const [timeRange, setTimeRange] = useState<TimeRange>(7)
  const [readings1, setReadings1] = useState<SensorReading[]>([])
  const [readings2, setReadings2] = useState<SensorReading[]>([])
  const [live1, setLive1] = useState<LiveData | null>(null)
  const [live2, setLive2] = useState<LiveData | null>(null)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [gapMs, setGapMs] = useState(25 * 60 * 1000)

  useEffect(() => {
    loadSystemConfig().then(c => {
      setSysConfig(c)
      setGapMs(c.gapThresholdMinutes * 60 * 1000)
    })
  }, [])

  // Auto-pick defaults
  useEffect(() => {
    // Single-access user → lock s1 to their station
    if (lockedS1 && s1Base !== lockedS1) {
      setS1Base(lockedS1)
      return
    }
    if (!s1Base && selectedStationId) {
      const base = selectedStationId.replace(/c$/, "")
      setS1Base(base)
      setSensorType(selectedStationId.endsWith("c") ? "client" : "main")
    }
  }, [selectedStationId, lockedS1])

  useEffect(() => {
    if (!s2Base && allGroups.length >= 2 && s1Base) {
      const other = allGroups.find(g => g.base !== s1Base)
      if (other) setS2Base(other.base)
    }
  }, [allGroups, s1Base])

  // Available sensor types = intersection of both stations' capabilities
  const s1Group = allGroups.find(g => g.base === s1Base) || permittedGroups.find(g => g.base === s1Base)
  const s2Group = allGroups.find(g => g.base === s2Base)
  const bothHaveMain = !!s1Group?.hasMain && !!s2Group?.hasMain
  const bothHaveClient = !!s1Group?.hasClient && !!s2Group?.hasClient

  // Auto-fallback if selected sensorType not available on both stations
  useEffect(() => {
    if (sensorType === "main" && !bothHaveMain && bothHaveClient) setSensorType("client")
    if (sensorType === "client" && !bothHaveClient && bothHaveMain) setSensorType("main")
  }, [bothHaveMain, bothHaveClient, sensorType])

  // Filter metrics by sensorType; reset metric when switching sensor type
  const visibleMetrics = WEATHER_METRICS.filter(m => m.sensorType === sensorType)
  useEffect(() => {
    if (!visibleMetrics.find(m => m.value === metric)) {
      setMetric(visibleMetrics[0]?.value ?? METRICS[0].value)
    }
  }, [sensorType])

  const station1Id = s1Base ? (sensorType === "client" ? `${s1Base}c` : s1Base) : null
  const station2Id = s2Base ? (sensorType === "client" ? `${s2Base}c` : s2Base) : null
  // Look up in allStations first (covers cross-user comparison), fallback to permitted
  const station1 = allStations.find(s => s.id === station1Id) || permittedStations.find(s => s.id === station1Id)
  const station2 = allStations.find(s => s.id === station2Id) || permittedStations.find(s => s.id === station2Id)

  useEffect(() => {
    if (!station1Id || !station2Id) return
    const loadData = async () => {
      setIsLoadingData(true)
      const [r1, r2, l1, l2] = await Promise.all([
        getSensorReadings(station1Id, timeRange),
        getSensorReadings(station2Id, timeRange),
        getLiveData(station1Id),
        getLiveData(station2Id),
      ])
      setReadings1(r1)
      setReadings2(r2)
      setLive1(l1)
      setLive2(l2)
      setIsLoadingData(false)
    }
    loadData()
  }, [station1Id, station2Id, timeRange])

  const currentMetric = WEATHER_METRICS.find(m => m.value === metric) || visibleMetrics[0] || WEATHER_METRICS[0]

  // Apply config limits — null out readings outside [min,max] before charting
  const CONFIG_KEY_MAP: Record<string, keyof SensorReading> = {
    airTemp: "airTemperature", humidity: "relativeHumidity", light: "lightIntensity",
    windSpeed: "windSpeed", pressure: "atmosphericPressure", rain: "rainfall", windDirection: "windDirection" as any,
    soilMoist1: "soilMoisture1", soilMoist2: "soilMoisture2",
    soilTemp1: "soilTemperature1", soilTemp2: "soilTemperature2",
  }
  const applyLimits = useCallback((rows: SensorReading[]) =>
    rows.map(r => {
      const out: any = { ...r }
      for (const [cfgKey, field] of Object.entries(CONFIG_KEY_MAP)) {
        const v = out[field]
        const lim = sysConfig.limits[cfgKey as keyof typeof sysConfig.limits]
        if (typeof v === "number" && lim && (v < lim.min || v > lim.max)) out[field] = null
      }
      for (const [field, sKey] of Object.entries(READING_TO_SENSOR)) {
        const v = out[field]
        if (typeof v === "number") {
          out[field] = applyUnitConversion(sKey, v, sysConfig.conversions[sKey].unit)
        }
      }
      const vpdLim = sysConfig.vpdLimit
      if (vpdLim && typeof out.vpd === "number" && (out.vpd < vpdLim.min || out.vpd > vpdLim.max)) {
        out.vpd = null
      }
      return out as SensorReading
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [sysConfig.limits, sysConfig.vpdLimit, JSON.stringify(Object.fromEntries(Object.entries(sysConfig.conversions).map(([k,v]) => [k, v.unit])))])

  const sanitized1 = useMemo(() => applyLimits(readings1), [readings1, applyLimits])
  const sanitized2 = useMemo(() => applyLimits(readings2), [readings2, applyLimits])

  // Merge data — align by minute (1-min cadence varies in seconds between stations)
  const mergedData = useMemo(() => {
    const minuteKey = (ts: any) => {
      const t = new Date(ts)
      t.setSeconds(0, 0)
      return t.getTime()
    }
    const map2 = new Map<number, SensorReading>()
    for (const r of sanitized2) map2.set(minuteKey(r.timestamp), r)
    const map1 = new Map<number, SensorReading>()
    for (const r of sanitized1) map1.set(minuteKey(r.timestamp), r)
    const allKeys = Array.from(new Set([...map1.keys(), ...map2.keys()])).sort((a, b) => a - b)
    const points = allKeys.map(k => {
      const r1 = map1.get(k)
      const r2 = map2.get(k)
      return {
        ts: k,
        val1: r1 ? r1[metric as keyof SensorReading] : null,
        val2: r2 ? r2[metric as keyof SensorReading] : null,
      }
    })
    // Insert null markers at gap midpoints so lines break instead of connecting
    const GAP_MS = gapMs
    const out: any[] = []
    for (let i = 0; i < points.length; i++) {
      if (i > 0 && points[i].ts - points[i - 1].ts > GAP_MS) {
        out.push({ ts: Math.round((points[i - 1].ts + points[i].ts) / 2), val1: null, val2: null })
      }
      out.push(points[i])
    }
    return out
  }, [sanitized1, sanitized2, metric])

  // Diff stats (TOR 4.5.7.1)
  const calculateStats = (data: SensorReading[], key: string) => {
    const vals = data.map(r => r[key as keyof SensorReading]).filter(v => typeof v === "number") as number[]
    if (!vals.length) return { ave: 0, max: 0, min: 0 }
    return {
      ave: vals.reduce((a, b) => a + b, 0) / vals.length,
      max: Math.max(...vals),
      min: Math.min(...vals)
    }
  }

  const stats1 = calculateStats(sanitized1, metric)
  const stats2 = calculateStats(sanitized2, metric)

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto pb-8">
      {/* 1. Header Row */}
      <div className="flex items-end justify-between border-b pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            เปรียบเทียบ 2 สถานี <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase">TOR 4.5.7</span>
          </h1>
          <p className="text-xs text-muted-foreground font-mono">Table: CAM_main • CAM_client — Side-by-side comparison</p>
        </div>
      </div>

      {allGroups.length < 2 ? (
        <Alert><AlertDescription>ต้องมีสถานีอย่างน้อย 2 จุด ในระบบเพื่อเปรียบเทียบ</AlertDescription></Alert>
      ) : (
        <>
          {/* 2. Selector Bar */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-4 border shadow-sm" style={{ fontSize: 13 }}>
            {/* Row 1: Two station dropdowns + time range + CSV */}
            <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto_auto] items-end">
              <div>
                <Label className="text-[10px] uppercase font-bold text-teal-700">
                  สถานีที่ 1 {isSingleAccess && <span className="text-muted-foreground font-normal">(ของคุณ)</span>}
                </Label>
                <Select value={s1Base} onValueChange={setS1Base} disabled={isSingleAccess}>
                  <SelectTrigger className="bg-background border-teal-200 text-xs mt-1" style={{ height: 32 }}>
                    <SelectValue placeholder="เลือกสถานี" />
                  </SelectTrigger>
                  <SelectContent>
                    {s1Options.map(g => (
                      <SelectItem key={g.base} value={g.base} className="text-xs">{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] uppercase font-bold text-orange-700">สถานีที่ 2</Label>
                <Select value={s2Base} onValueChange={setS2Base}>
                  <SelectTrigger className="bg-background border-orange-200 text-xs mt-1" style={{ height: 32 }}>
                    <SelectValue placeholder="เลือกสถานี" />
                  </SelectTrigger>
                  <SelectContent>
                    {allGroups.filter(g => g.base !== s1Base).map(g => (
                      <SelectItem key={g.base} value={g.base} className="text-xs">{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex bg-background border rounded-md p-0.5">
                {[3, 7, 15].map((d) => (
                  <button key={d} onClick={() => setTimeRange(d as TimeRange)} style={{ padding: "5px 10px", fontSize: 12 }} className={`font-bold rounded-sm transition-all ${timeRange === d ? "bg-teal-500 text-white shadow-sm" : "hover:bg-muted text-muted-foreground"}`}>{d} วัน</button>
                ))}
              </div>
              <Button size="sm" variant="outline" className="h-9 text-xs gap-1" onClick={() => exportCompareDataToCSV(
                station1?.name ?? station1Id,
                station2?.name ?? station2Id,
                currentMetric?.label ?? metric,
                mergedData,
              )}>
                <Download className="h-3 w-3" /> CSV
              </Button>
            </div>

            {/* Row 2: Shared sensor type toggle */}
            <div className="flex items-center gap-4 border-t pt-3">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground shrink-0">ประเภท</Label>
              {(bothHaveMain || bothHaveClient) ? (
                <div className="flex bg-background border rounded-md p-0.5">
                  {bothHaveMain && (
                    <button onClick={() => setSensorType("main")}
                      style={{ padding: "5px 10px", fontSize: 12 }}
                      className={`font-bold rounded-sm transition-all ${sensorType === "main" ? "bg-teal-500 text-white shadow-sm" : "hover:bg-muted text-muted-foreground"}`}>
                      สถานีอากาศ
                    </button>
                  )}
                  {bothHaveClient && (
                    <button onClick={() => setSensorType("client")}
                      style={{ padding: "5px 10px", fontSize: 12 }}
                      className={`font-bold rounded-sm transition-all ${sensorType === "client" ? "bg-teal-500 text-white shadow-sm" : "hover:bg-muted text-muted-foreground"}`}>
                      สถานีดิน
                    </button>
                  )}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground italic">ทั้ง 2 สถานีต้องมี sensor ประเภทเดียวกัน</span>
              )}
            </div>

            {/* Row 3: Metric checkboxes — single row */}
            <div className="border-t pt-3 flex items-center gap-x-4 gap-y-1 flex-wrap">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground shrink-0">เซ็นเซอร์</Label>
              {visibleMetrics.map(m => (
                <label key={m.value} className="flex items-center gap-1.5 cursor-pointer text-xs whitespace-nowrap">
                  <Checkbox checked={metric === m.value} onCheckedChange={(c) => { if (c) setMetric(m.value) }} />
                  <m.icon className="h-3 w-3" />
                  <span className="flex items-center gap-1">{m.label}{m.value === "vpd" && <VpdInfoButton />}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 3. Realtime Info — 1 card, 2 columns (original style) */}
          <div className="text-[10px] font-mono text-muted-foreground/50 -mb-1 px-0.5">TOR 4.5.7.1 — ค่าปัจจุบันเปรียบเทียบ 2 สถานี</div>
          <Card className="shadow-sm overflow-hidden">
            {/* Station headers */}
            <div className="grid grid-cols-2 divide-x border-b">
              <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-teal-50/60">
                <span className="text-xs font-bold text-teal-800 truncate">{station1?.name ?? "—"}</span>
                <Badge className={`shrink-0 text-[9px] px-1.5 py-0 h-4 ${live1?.lastPing ? "bg-green-500" : "bg-red-500"}`}>{live1?.lastPing ? "ONLINE" : "OFFLINE"}</Badge>
              </div>
              <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-orange-50/60">
                <span className="text-xs font-bold text-orange-800 truncate">{station2?.name ?? "—"}</span>
                <Badge className={`shrink-0 text-[9px] px-1.5 py-0 h-4 ${live2?.lastPing ? "bg-green-500" : "bg-red-500"}`}>{live2?.lastPing ? "ONLINE" : "OFFLINE"}</Badge>
              </div>
            </div>
            {/* Sensor values — 2 stations side by side, original card style */}
            <div className="grid grid-cols-2 divide-x">
              {([live1, live2] as const).map((live, idx) => {
                const isFirst = idx === 0
                return (
                  <div key={idx} className="grid grid-cols-2 divide-x p-4 gap-x-4">
                    {sensorType === "main" ? (
                      <>
                        <div>
                          <CompareSensorCard title="อุณหภูมิ" live1={isFirst ? live : null} live2={isFirst ? null : live} unit={sysConfig.conversions.airTemp.unit} dataKey="airTemperature" />
                          <CompareSensorCard title="ความชื้น" live1={isFirst ? live : null} live2={isFirst ? null : live} unit="%" dataKey="relativeHumidity" />
                        </div>
                        <div className="pl-4">
                          <CompareSensorCard title="VPD" live1={isFirst ? live : null} live2={isFirst ? null : live} unit="kPa" dataKey="vpd" />
                          <CompareSensorCard title="ฝน" live1={isFirst ? live : null} live2={isFirst ? null : live} unit={sysConfig.conversions.rain.unit} dataKey="rainfall" />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <CompareSensorCard title="ชื้นดิน 15cm" live1={isFirst ? live : null} live2={isFirst ? null : live} unit="%" dataKey="soilMoisture1" />
                          <CompareSensorCard title="ชื้นดิน 30cm" live1={isFirst ? live : null} live2={isFirst ? null : live} unit="%" dataKey="soilMoisture2" />
                        </div>
                        <div className="pl-4">
                          <CompareSensorCard title="อุณหภูมิดิน 15cm" live1={isFirst ? live : null} live2={isFirst ? null : live} unit={sysConfig.conversions.soilTemp1.unit} dataKey="soilTemperature1" />
                          <CompareSensorCard title="อุณหภูมิดิน 30cm" live1={isFirst ? live : null} live2={isFirst ? null : live} unit={sysConfig.conversions.soilTemp2.unit} dataKey="soilTemperature2" />
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>

          {/* 4. Overlay Comparison Chart (TOR 4.5.7.2) */}
          {isLoadingData ? (
            <Skeleton className="h-64 w-full" />
          ) : mergedData.length > 0 ? (
            <Card className="shadow-md border overflow-hidden">
              <CardHeader className="py-3 bg-muted/20 border-b flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Activity className="h-4 w-4" /> กราฟเปรียบเทียบ <span className="font-normal opacity-50 ml-2">{currentMetric.label}</span>
                </CardTitle>
                <span className="text-[10px] font-mono text-muted-foreground">TOR 4.5.7.2</span>
              </CardHeader>
              <CardContent className="pt-6">
                <CompareLineChart
                  data={mergedData}
                  name1={station1?.name ?? "Station 1"}
                  name2={station2?.name ?? "Station 2"}
                  color1={currentMetric.color1}
                  color2={currentMetric.color2}
                  timeRange={timeRange}
                />
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-10 text-muted-foreground text-sm border rounded-lg bg-muted/20">
              ไม่มีข้อมูลกราฟในช่วงเวลาที่เลือก
            </div>
          )}

          {/* 5. Difference Table (TOR 4.5.7.1) */}
          {!isLoadingData && (readings1.length > 0 || readings2.length > 0) && (
          <Card className="shadow-md overflow-hidden border-t-4 border-t-teal-500">
            <CardHeader className="py-3 bg-muted/30 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase tracking-tight flex items-center gap-2">
                ตารางเปรียบเทียบ Ave/Max/Min
                <span className="font-normal normal-case text-muted-foreground bg-muted px-1.5 py-0.5 rounded text-[10px]">{timeRange} วันล่าสุด</span>
              </CardTitle>
              <span className="text-[10px] text-muted-foreground uppercase font-mono">TOR 4.5.7.1</span>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b text-muted-foreground uppercase font-bold">
                    <th className="p-3 text-left">ค่า ({currentMetric.label})</th>
                    <th className="p-3 text-right text-teal-700">{station1?.name ?? "—"}</th>
                    <th className="p-3 text-right text-orange-700">{station2?.name || "—"}</th>
                    <th className="p-3 text-right border-l">ผลต่าง (Diff)</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-medium">
                  {[
                    { label: "ค่าเฉลี่ย", v1: stats1.ave, v2: stats2.ave },
                    { label: "ค่าสูงสุด", v1: stats1.max, v2: stats2.max },
                    { label: "ค่าต่ำสุด", v1: stats1.min, v2: stats2.min },
                  ].map((row, idx) => {
                    const diff = row.v1 - row.v2
                    return (
                      <tr key={idx} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-bold">{row.label}</td>
                        <td className="p-3 text-right text-teal-800">{row.v1.toFixed(2)}</td>
                        <td className="p-3 text-right text-orange-800">{row.v2.toFixed(2)}</td>
                        <td className={`p-3 text-right border-l font-black ${Math.abs(diff) > 2 ? "text-red-600 bg-red-50" : "text-slate-600"}`}>
                          {diff > 0 ? "+" : ""}{diff.toFixed(2)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
          )}
        </>
      )}
    </div>
  )
}
