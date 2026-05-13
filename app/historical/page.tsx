"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useStation } from "@/contexts/StationContext"
import { getSensorReadings, getSensorReadingsByDateRange } from "@/services/sensorService"
import { exportSensorDataToCSV } from "@/services/exportService"
import type { SensorReading, TimeRange } from "@/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import type { DateRange } from "react-day-picker"
import { Download, Activity, Thermometer, Droplets, Sun, Wind, CloudRain, Gauge, CalendarRange } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import dynamic from "next/dynamic"
import { formatThaiDateTime } from "@/utils/dateUtils"

const HistoricalChart = dynamic(
  () => import("@/components/charts/HistoricalChart").then(m => ({ default: m.HistoricalChart })),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> }
)
const MiniStat = dynamic(
  () => import("@/components/charts/HistoricalChart").then(m => ({ default: m.MiniStat })),
  { ssr: false, loading: () => <Skeleton className="h-24 w-full" /> }
)

export default function HistoricalDataPage() {
  const { permittedStations, clients, selectedStationId, isLoading: stationLoading } = useStation()

  const stationGroups = useMemo(() => {
    const seen = new Set<string>()
    const groups: { baseId: string; label: string }[] = []
    for (const s of permittedStations) {
      const baseId = s.id.replace(/c$/, "")
      if (seen.has(baseId)) continue
      seen.add(baseId)
      const owner = clients.find(c => c.id === s.ownerId)
      const ownerName = owner?.fullName ?? ""
      groups.push({ baseId, label: ownerName ? `${baseId} — ${ownerName}` : baseId })
    }
    return groups
  }, [permittedStations, clients])

  const [localBase, setLocalBase] = useState<string | null>(null)
  const [sensorType, setSensorType] = useState<"main" | "client">("main")

  const localStationId = localBase
    ? sensorType === "client" ? `${localBase}c` : localBase
    : null
  const localStation = permittedStations.find(s => s.id === localStationId) ?? null

  useEffect(() => {
    if (!localBase && selectedStationId) setLocalBase(selectedStationId.replace(/c$/, ""))
  }, [selectedStationId])

  const [timeRange, setTimeRange] = useState<TimeRange>(7)
  const [readings, setReadings] = useState<SensorReading[]>([])
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [tableLimit, setTableLimit] = useState<number>(50)
  const [rangeMode, setRangeMode] = useState<"preset" | "custom">("preset")
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split("T")[0]
  })
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split("T")[0])
  const [calOpen, setCalOpen] = useState(false)
  const pickingEndRef = useRef(false)

  const dateRangeValue: DateRange = {
    from: customStart ? new Date(customStart + "T00:00:00") : undefined,
    to: customEnd ? new Date(customEnd + "T00:00:00") : undefined,
  }
  const handleRangeSelect = (range: DateRange | undefined) => {
    if (range?.from) setCustomStart(range.from.toISOString().split("T")[0])
    const sameDay = range?.from && range?.to &&
      range.from.toDateString() === range.to.toDateString()
    if (range?.to && !sameDay) {
      setCustomEnd(range.to.toISOString().split("T")[0])
      pickingEndRef.current = false
      setCalOpen(false)
    } else if (range?.from) {
      setCustomEnd("")
      pickingEndRef.current = true
    }
  }
  const handleCalOpenChange = (open: boolean) => {
    if (!open && pickingEndRef.current) return
    if (!open) pickingEndRef.current = false
    setCalOpen(open)
  }
  const fmtDate = (s: string) =>
    s ? new Date(s + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short" }) : "?"

  useEffect(() => {
    if (!localStationId) return
    if (rangeMode === "custom" && (!customStart || !customEnd)) return
    const loadData = async () => {
      setIsLoadingData(true)
      try {
        const data = rangeMode === "custom"
          ? await getSensorReadingsByDateRange(localStationId, customStart, customEnd)
          : await getSensorReadings(localStationId, timeRange)
        setReadings(data)
      } finally {
        setIsLoadingData(false)
      }
    }
    loadData()
  }, [localStationId, timeRange, rangeMode, customStart, customEnd])

  const handleExport = () => {
    if (!localStation) return
    exportSensorDataToCSV(localStation.name, readings, ["airTemperature", "relativeHumidity", "vpd", "rainfall", "lightIntensity", "windSpeed", "atmosphericPressure"], timeRange)
  }

  const OUTLIER_KEYS: (keyof SensorReading)[] = [
    "airTemperature", "relativeHumidity", "vpd", "lightIntensity",
    "windSpeed", "atmosphericPressure", "soilMoisture1", "soilMoisture2",
    "soilTemperature1", "soilTemperature2",
  ]

  const iqrFences = useMemo(() => {
    const fences: Partial<Record<keyof SensorReading, [number, number]>> = {}
    for (const k of OUTLIER_KEYS) {
      const vals = readings
        .map(r => r[k])
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v))
        .sort((a, b) => a - b)
      if (vals.length < 4) continue
      const q1 = vals[Math.floor(vals.length * 0.25)]
      const q3 = vals[Math.floor(vals.length * 0.75)]
      const iqr = q3 - q1
      fences[k] = [q1 - 5 * iqr, q3 + 5 * iqr]
    }
    return fences
  }, [readings])

  const sanitized = useMemo(() =>
    readings.map(r => {
      const out: any = { ...r }
      for (const k of OUTLIER_KEYS) {
        const v = out[k]
        const fence = iqrFences[k]
        if (typeof v === "number" && fence && (v < fence[0] || v > fence[1])) {
          out[k] = null
        }
      }
      return out as SensorReading
    }), [readings, iqrFences])

  const chartData = sanitized.map(r => ({
    ...r,
    timeLabel: new Date(r.timestamp).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
  }))

  const isWeatherStation = sensorType === "main"

  // Mini Stats use sanitized data so spikes don't skew averages
  const avg = (key: keyof SensorReading) => {
    const vals = sanitized.map(r => r[key]).filter(v => typeof v === "number") as number[]
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : 0
  }
  const sum = (key: keyof SensorReading) => {
    const vals = sanitized.map(r => r[key]).filter(v => typeof v === "number") as number[]
    return vals.reduce((a, b) => a + b, 0)
  }

  if (stationLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto pb-8">
      {/* 1. Header */}
      <div className="flex items-end justify-between border-b pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            ข้อมูลย้อนหลัง <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase">TOR 4.5.4</span>
          </h1>
          <p className="text-xs text-muted-foreground font-mono">Table: CAM_main • CAM_client • sensor</p>
        </div>
      </div>

      {permittedStations.length === 0 ? (
        <Alert><AlertDescription>ไม่มีสถานีที่เข้าถึงได้</AlertDescription></Alert>
      ) : (
        <>
          {/* 2. Selector Bar */}
          <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between flex-wrap gap-3 border shadow-sm text-sm">
            <div className="flex items-center gap-2 flex-wrap">
              {stationGroups.length > 1 && (
                <Select value={localBase ?? undefined} onValueChange={setLocalBase}>
                  <SelectTrigger className="h-8 w-[200px] text-xs bg-background"><SelectValue placeholder="เลือกสถานี" /></SelectTrigger>
                  <SelectContent>
                    {stationGroups.map(g => (
                      <SelectItem key={g.baseId} value={g.baseId} className="text-xs">{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={sensorType} onValueChange={v => setSensorType(v as "main" | "client")}>
                <SelectTrigger className="h-8 w-[130px] text-xs bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="main" className="text-xs">อากาศ (Main)</SelectItem>
                  <SelectItem value="client" className="text-xs">ดิน (Client)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-bold text-muted-foreground text-xs uppercase">ช่วงเวลา:</span>
              <div className="flex bg-background border rounded-md p-0.5">
                {([3, 7, 15, 30] as TimeRange[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => { setRangeMode("preset"); setTimeRange(d) }}
                    className={`px-3 py-1 text-xs font-bold rounded-sm transition-all ${
                      rangeMode === "preset" && timeRange === d ? "bg-teal-500 text-white shadow-sm" : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    {d} วัน
                  </button>
                ))}
                <Popover open={calOpen} onOpenChange={handleCalOpenChange}>
                  <PopoverTrigger asChild>
                    <button
                      onClick={() => { setRangeMode("custom"); setCustomStart(""); setCustomEnd(""); setCalOpen(true) }}
                      className={`px-3 py-1 text-xs font-bold rounded-sm transition-all flex items-center gap-1.5 ${
                        rangeMode === "custom" ? "bg-teal-500 text-white shadow-sm" : "hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      <CalendarRange className="h-3 w-3" />
                      {rangeMode === "custom" && customStart
                        ? `${fmtDate(customStart)}${customEnd ? ` — ${fmtDate(customEnd)}` : ""}`
                        : "กำหนดเอง"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-0"
                    align="end"
                    side="bottom"
                    onInteractOutside={(e) => { if (pickingEndRef.current) e.preventDefault() }}
                  >
                    <Calendar
                      mode="range"
                      selected={dateRangeValue}
                      onSelect={handleRangeSelect}
                      disabled={{ after: new Date() }}
                      numberOfMonths={1}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <Button size="sm" variant="outline" className="h-8 text-xs font-bold gap-2" onClick={handleExport} disabled={readings.length === 0 || !localStation}>
                <Download className="h-3 w-3" /> ⬇ CSV
              </Button>
            </div>
          </div>

          {/* 3. Mini Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {isWeatherStation ? (
              <>
                <MiniStat label="Temp เฉลี่ย" value={`${avg("airTemperature").toFixed(1)}°C`} icon={Thermometer} colorClass="text-orange-600" />
                <MiniStat label="RH เฉลี่ย" value={`${avg("relativeHumidity").toFixed(1)}%`} icon={Droplets} colorClass="text-blue-600" />
                <MiniStat label="ฝนรวม" value={`${sum("rainfall").toFixed(1)} mm`} icon={CloudRain} colorClass="text-indigo-600" />
                <MiniStat label="VPD เฉลี่ย" value={`${avg("vpd").toFixed(2)} kPa`} icon={Activity} colorClass="text-emerald-600" />
              </>
            ) : (
              <>
                <MiniStat label="ชื้นดิน 15cm เฉลี่ย" value={`${avg("soilMoisture1").toFixed(1)}%`} icon={Droplets} colorClass="text-lime-600" />
                <MiniStat label="อุณหภูมิดิน 15cm" value={`${avg("soilTemperature1").toFixed(1)}°C`} icon={Thermometer} colorClass="text-amber-600" />
                <MiniStat label="ชื้นดิน 30cm เฉลี่ย" value={`${avg("soilMoisture2").toFixed(1)}%`} icon={Droplets} colorClass="text-lime-600" />
                <MiniStat label="อุณหภูมิดิน 30cm" value={`${avg("soilTemperature2").toFixed(1)}°C`} icon={Thermometer} colorClass="text-amber-600" />
              </>
            )}
          </div>

          {isLoadingData ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64" />)}
            </div>
          ) : (
            <>
              {/* 4. Sensor Charts Grid */}
              <div className="grid gap-4 md:grid-cols-2">
                {isWeatherStation ? (
                  <>
                    <HistoricalChart title="อุณหภูมิอากาศ" data={chartData} dataKey="airTemperature" unit="°C" color="#f97316" icon={Thermometer} />
                    <HistoricalChart title="ความชื้นสัมพัทธ์" data={chartData} dataKey="relativeHumidity" unit="%" color="#3b82f6" icon={Droplets} />
                    <HistoricalChart title="VPD (เกณฑ์ทุเรียน)" data={chartData} dataKey="vpd" unit="kPa" color="#10b981" icon={Activity} type="area" />
                    <HistoricalChart title="ปริมาณน้ำฝน" data={chartData} dataKey="rainfall" unit="mm" color="#6366f1" icon={CloudRain} type="bar" />
                    <HistoricalChart title="ความเข้มแสง" data={chartData} dataKey="lightIntensity" unit="lux" color="#eab308" icon={Sun} type="area" />
                    <HistoricalChart title="ความกดอากาศ / แรงดันบอร์ด" data={chartData} dataKey="atmosphericPressure" unit="hPa/V" color="#06b6d4" icon={Gauge} />
                  </>
                ) : (
                  <>
                    <HistoricalChart title="ความชื้นดิน 1" data={chartData} dataKey="soilMoisture1" unit="%" color="#84cc16" icon={Droplets} type="area" />
                    <HistoricalChart title="ความชื้นดิน 2" data={chartData} dataKey="soilMoisture2" unit="%" color="#22c55e" icon={Droplets} type="area" />
                  </>
                )}
              </div>

              {/* 5. Raw Data Table (TOR 4.5.4.3) */}
              <Card className="shadow-md overflow-hidden border-t-4 border-t-teal-500">
                <CardHeader className="py-3 bg-muted/30 border-b flex flex-row items-center justify-between">
                  <CardTitle className="text-[11px] font-bold uppercase tracking-tight flex items-center gap-2">
                    ตารางข้อมูลดิบ <span className="font-normal opacity-50 ml-2">TOR 4.5.4.3</span>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">แสดง</span>
                    <div className="flex bg-background border rounded-md p-0.5">
                      {[10, 30, 50, 100].map((n) => (
                        <button
                          key={n}
                          onClick={() => setTableLimit(n)}
                          className={`px-2.5 py-0.5 text-[10px] font-bold rounded-sm transition-all ${tableLimit === n ? "bg-teal-500 text-white shadow-sm" : "hover:bg-muted text-muted-foreground"}`}
                        >{n}</button>
                      ))}
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono opacity-60">/ {readings.length} rows</span>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="bg-muted/50 border-b text-muted-foreground uppercase font-bold">
                          <th className="p-3 text-left border-r">วัน / เวลา</th>
                          {isWeatherStation ? (
                            <>
                              <th className="p-3 text-right">Temp</th>
                              <th className="p-3 text-right">RH</th>
                              <th className="p-3 text-right">Lux</th>
                              <th className="p-3 text-right">Wind</th>
                              <th className="p-3 text-right">Rain</th>
                              <th className="p-3 text-right">hPa/V</th>
                              <th className="p-3 text-right">VPD</th>
                            </>
                          ) : (
                            <>
                              <th className="p-3 text-right">ชื้นดิน 15cm</th>
                              <th className="p-3 text-right">อุณหภูมิดิน 15cm</th>
                              <th className="p-3 text-right">ชื้นดิน 30cm</th>
                              <th className="p-3 text-right">อุณหภูมิดิน 30cm</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y font-medium">
                        {[...readings].reverse().slice(0, tableLimit).map((r, idx) => {
                          const vpdVal = r.vpd
                          const vpdClass = vpdVal == null ? "" : vpdVal < 0.8 ? "text-blue-600 bg-blue-50/50" : vpdVal <= 1.6 ? "text-green-600 bg-green-50/50" : "text-red-600 bg-red-50/50"
                          return (
                            <tr key={idx} className="hover:bg-muted/30 transition-colors">
                              <td className="p-3 border-r font-mono whitespace-nowrap">
                                {formatThaiDateTime(r.timestamp)}
                              </td>
                              {isWeatherStation ? (
                                <>
                                  <td className="p-3 text-right text-orange-700">{r.airTemperature?.toFixed(1) || "-"}</td>
                                  <td className="p-3 text-right text-blue-700">{r.relativeHumidity?.toFixed(1) || "-"}</td>
                                  <td className="p-3 text-right text-yellow-700">{(r.lightIntensity || 0).toLocaleString()}</td>
                                  <td className="p-3 text-right">{r.windSpeed?.toFixed(1) || "-"}</td>
                                  <td className="p-3 text-right text-indigo-700">{r.rainfall?.toFixed(1) || "-"}</td>
                                  <td className="p-3 text-right opacity-60">{r.atmosphericPressure?.toFixed(2) || "-"}</td>
                                  <td className={`p-3 text-right font-bold ${vpdClass}`}>{r.vpd?.toFixed(2) || "-"}</td>
                                </>
                              ) : (
                                <>
                                  <td className="p-3 text-right text-lime-700">{r.soilMoisture1?.toFixed(1) || "-"}</td>
                                  <td className="p-3 text-right text-amber-700">{r.soilTemperature1?.toFixed(1) || "-"}</td>
                                  <td className="p-3 text-right text-lime-700">{r.soilMoisture2?.toFixed(1) || "-"}</td>
                                  <td className="p-3 text-right text-amber-700">{r.soilTemperature2?.toFixed(1) || "-"}</td>
                                </>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  )
}
