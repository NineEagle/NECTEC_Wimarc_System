"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useStation } from "@/contexts/StationContext"
import { getLiveData, getWeatherForecast } from "@/services/sensorService"
import type { LiveData, WeatherForecast } from "@/types"
import { StatusBadge } from "@/components/dashboard/StatusBadge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { formatThaiDateTime } from "@/utils/dateUtils"
import {
  Thermometer, Droplets, Sun, Wind, CloudRain, Gauge,
  Activity, ImageIcon, RefreshCw, Wifi, WifiOff, Bell, AlertTriangle
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

const POLL_INTERVAL = 60 // seconds

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

function SensorCard({
  title, value, unit, icon: Icon, className = "", vpdStatus = null, type = "default", dbField = ""
}: {
  title: string; value?: number | null; unit: string; icon: React.ElementType; className?: string; vpdStatus?: string | null; type?: string; dbField?: string
}) {
  const bgColors: Record<string, string> = {
    temp: "bg-orange-50 border-orange-100",
    humid: "bg-blue-50 border-blue-100",
    light: "bg-yellow-50 border-yellow-100",
    rain: "bg-indigo-50 border-indigo-100",
    wind: "bg-slate-50 border-slate-200",
    pressure: "bg-cyan-50 border-cyan-100",
    vpd: "bg-emerald-50 border-emerald-100",
    soil: "bg-orange-50/30 border-orange-200",
    default: "bg-card"
  }

  return (
    <Card className={`${bgColors[type] || bgColors.default} ${className} shadow-sm border`}>
      <CardHeader className="flex flex-row items-center justify-between pb-1 pt-2 px-3">
        <div className="flex flex-col">
          <CardTitle className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-none">{title}</CardTitle>
          {dbField && <span className="text-[8px] font-mono text-muted-foreground/60 mt-1 uppercase">{dbField}</span>}
        </div>
        <Icon className="h-3.5 w-3.5 text-muted-foreground/70" />
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <div className="flex items-baseline gap-2 flex-wrap">
          <div className="text-2xl font-black">
            {value != null ? `${typeof value === "number" && !Number.isInteger(value) ? value.toFixed(1) : value}` : "—"}
            <span className="text-sm font-normal ml-1 text-muted-foreground">{unit}</span>
          </div>
          {vpdStatus && (
            <Badge className={
              vpdStatus === "เหมาะสม" ? "bg-green-500 text-white hover:bg-green-600 border-none px-1 h-5 text-[10px]" :
              vpdStatus === "ต่ำ" ? "bg-blue-500 text-white hover:bg-blue-600 border-none px-1 h-5 text-[10px]" :
              "bg-red-500 text-white hover:bg-red-600 border-none px-1 h-5 text-[10px]"
            }>
              {vpdStatus}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function getVPDStatus(vpd: number | null | undefined): string | null {
  if (vpd == null) return null
  if (vpd < 0.8) return "ต่ำ"
  if (vpd <= 1.6) return "เหมาะสม"
  return "สูง"
}

export default function DashboardPage() {
  const { selectedStation, selectedStationId, permittedStations, isLoading: stationLoading } = useStation()
  const [live, setLive] = useState<LiveData | null>(null)
  const [forecast, setForecast] = useState<WeatherForecast[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState(POLL_INTERVAL)
  const [showAlertPanel, setShowAlertPanel] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)

  const pingAgo = useSecondsAgo(live?.lastPing ?? null)
  const sensorAgo = useSecondsAgo(live?.sensorTime ?? null)
  const imageAgo = useSecondsAgo(live?.imageTime ?? null)

  const fetchLive = useCallback(async () => {
    if (!selectedStationId) return
    setIsLoading(true)
    try {
      const data = await getLiveData(selectedStationId)
      setLive(data)
      setRefreshedAt(new Date())
      setCountdown(POLL_INTERVAL)
      if (data.vpd != null && (data.vpd < 0.8 || data.vpd > 1.6)) {
        setShowAlertPanel(true)
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false)
    }
  }, [selectedStationId])

  useEffect(() => {
    if (!selectedStationId) return
    fetchLive()
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(fetchLive, POLL_INTERVAL * 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [selectedStationId, fetchLive])

  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current)
    countdownRef.current = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : POLL_INTERVAL))
    }, 1000)
    return () => { if (countdownRef.current) clearInterval(countdownRef.current) }
  }, [refreshedAt])

  useEffect(() => {
    if (!selectedStationId || selectedStation?.type !== "weather") { setForecast([]); return }
    getWeatherForecast(selectedStationId).then(setForecast).catch(() => {})
  }, [selectedStationId, selectedStation?.type])

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
  const vpdStatus = getVPDStatus(live?.vpd)

  const tooltipStyle = {
    backgroundColor: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "var(--radius)",
  }

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto pb-8">
      {/* 1. Header Row */}
      <div className="flex items-end justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">แดชบอร์ดสภาวะแวดล้อม</h1>
          <p className="text-xs text-muted-foreground font-mono">TOR 4.5.3 • {selectedStationId || "no-station"}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1 rounded-full border border-green-100 text-xs font-bold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Real-time
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className={`relative rounded-full h-9 w-9 ${showAlertPanel ? "bg-orange-100" : "bg-secondary"}`}
            onClick={() => setShowAlertPanel(!showAlertPanel)}
          >
            <Bell className={`h-5 w-5 ${vpdStatus && vpdStatus !== "เหมาะสม" ? "text-orange-500 animate-bounce" : ""}`} />
          </Button>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
            <span>{countdown}s</span>
          </div>
        </div>
      </div>

      {/* 2. Alert Panel */}
      {showAlertPanel && (
        <Card className="bg-orange-50 border-orange-200 shadow-sm overflow-hidden">
          <div className="bg-orange-100 px-4 py-1 flex justify-between items-center border-b border-orange-200">
            <h3 className="text-[11px] font-bold text-orange-800 uppercase flex items-center gap-1">
              <Bell className="h-3 w-3" /> การแจ้งเตือน <span className="font-normal opacity-60 ml-2">TOR 4.5.3.1</span>
            </h3>
            <Button variant="ghost" size="sm" className="h-5 text-[10px] p-0 px-2" onClick={() => setShowAlertPanel(false)}>ปิด</Button>
          </div>
          <CardContent className="p-4 flex gap-3 items-start">
            <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0" />
            <div className="text-sm text-orange-900 leading-relaxed">
              {vpdStatus === "ต่ำ" && <strong>⚠️ สภาวะ VPD ต่ำเกินไป ({live?.vpd?.toFixed(2)} kPa)</strong>}
              {vpdStatus === "สูง" && <strong>⚠️ สภาวะ VPD สูงเกินไป ({live?.vpd?.toFixed(2)} kPa)</strong>}
              {vpdStatus === "ต่ำ" && " - พืชอาจหยุดการคายน้ำ เสี่ยงต่อโรคราและความชื้นสะสมเกินไป"}
              {vpdStatus === "สูง" && " - พืชคายน้ำมากเกินไป เสี่ยงต่อการชะงักการเจริญเติบโตเนื่องจากขาดน้ำ"}
              {!vpdStatus && "ระบบทำงานปกติ ไม่พบความผิดปกติของสภาวะแวดล้อม"}
            </div>
          </CardContent>
        </Card>
      )}

      {!selectedStation ? (
        <Alert><AlertDescription>กรุณาเลือกสถานี</AlertDescription></Alert>
      ) : (
        <>
          {/* 3. Status Bar (Old wm-selector style) */}
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
              <div>อัปเดต: <span className="text-foreground font-mono">{live?.sensorTime ? formatThaiDateTime(live.sensorTime).split(" ")[1] : "--:--:--"}</span></div>
              <div className="hidden sm:block text-[10px] opacity-60">เซ็นเซอร์: {secondsLabel(sensorAgo)}</div>
            </div>
          </div>

          {/* 4. Sensor Grid (4x2) */}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            {isWeatherStation ? (
              <>
                <SensorCard title="อุณหภูมิอากาศ"   value={live?.airTemperature}     unit="°C"  icon={Thermometer} type="temp"     dbField="CAM_main.B" />
                <SensorCard title="ความชื้นสัมพัทธ์" value={live?.relativeHumidity}   unit="%"   icon={Droplets}    type="humid"    dbField="CAM_main.A" />
                <SensorCard title="ความเข้มแสง"      value={live?.lightIntensity}     unit="lux" icon={Sun}         type="light"    dbField="CAM_main.C" />
                <SensorCard title="ปริมาณน้ำฝน"        value={live?.rainfall}           unit="mm"  icon={CloudRain}   type="rain"     dbField="CAM_main.D" />
                <SensorCard title="ความเร็วลม"         value={live?.windSpeed}          unit="m/s" icon={Wind}        type="wind"     dbField="CAM_main.F" />
                <SensorCard title="ความกดอากาศ"      value={live?.atmosphericPressure} unit="hPa" icon={Gauge}       type="pressure" dbField="CAM_main.E" />
                <SensorCard title="VPD (ทุเรียน)"    value={live?.vpd}                unit="kPa" icon={Activity}    type="vpd"      dbField="Calculated" vpdStatus={vpdStatus} />
                <SensorCard title="ความชื้นดิน (15cm)" value={live?.soilMoisture1}     unit="%"   icon={Droplets}    type="soil"     dbField="CAM_client.B" />
              </>
            ) : (
              <>
                <SensorCard title="ความชื้นดิน 1" value={live?.soilMoisture1} unit="%" icon={Droplets} type="soil" dbField="CAM_client.B" />
                <SensorCard title="ความชื้นดิน 2" value={live?.soilMoisture2} unit="%" icon={Droplets} type="soil" dbField="CAM_client.D" />
              </>
            )}
          </div>

          {/* 5. Placeholder for Charts & Camera Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Left Col: Placeholder for Future Chart */}
            <Card className="min-h-[200px] flex items-center justify-center bg-muted/20 border-dashed">
              <div className="text-center p-6 text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-xs uppercase tracking-widest font-bold opacity-30">Charts Section (Coming Soon)</p>
              </div>
            </Card>

            {/* Right Col: Station Camera */}
            <Card className="overflow-hidden border shadow-md">
              <div className="bg-muted px-4 py-2 border-b flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase tracking-tight flex items-center gap-1">
                  <ImageIcon className="h-3 w-3" /> ภาพกล้องสถานี
                </h3>
                <span className="text-[10px] font-mono opacity-50">{selectedStationId}/cam1</span>
              </div>
              <CardContent className="p-2">
                {live?.imageUrl ? (
                  <div className="relative group">
                    <img
                      key={`${live.imageUrl}-${Math.floor((refreshedAt?.getTime() ?? 0) / 1000)}`}
                      src={`${live.imageUrl}?t=${Math.floor(Date.now() / 60000)}`}
                      alt="Station view"
                      className="w-full aspect-video rounded-md object-cover"
                    />
                    <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[9px] px-2 py-0.5 rounded font-mono">
                      📸 {live.imageTime ? formatThaiDateTime(live.imageTime) : "LIVE"}
                    </div>
                  </div>
                ) : (
                  <div className="aspect-video bg-muted flex items-center justify-center rounded-md">
                    <ImageIcon className="h-10 w-10 text-muted-foreground/20" />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 6. Weather Forecast (Full width grid) */}
          {isWeatherStation && forecast.length > 0 && (
            <Card className="shadow-md border-t-4 border-t-teal-500 overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 border-b flex justify-between items-center">
                <h3 className="text-xs font-bold uppercase tracking-tight">พยากรณ์อากาศ 7 วัน <span className="font-normal opacity-50 ml-2">TOR 4.5.3.3</span></h3>
                <span className="text-[10px] text-muted-foreground italic">7timer.info / TMD</span>
              </div>
              <CardContent className="p-0">
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 divide-x divide-y md:divide-y-0">
                  {forecast.slice(0, 7).map((f, idx) => (
                    <div key={idx} className="p-4 text-center hover:bg-muted/30 transition-colors">
                      <div className="text-xs font-bold text-muted-foreground uppercase mb-2">
                        {new Date(f.forecastDate).toLocaleDateString("th-TH", { weekday: "short" })}
                      </div>
                      <div className="text-3xl my-3 drop-shadow-sm">
                        {f.description.includes("ฝน") ? "🌧️" : f.description.includes("แดด") ? "☀️" : f.description.includes("แจ่มใส") ? "🌤️" : "☁️"}
                      </div>
                      <div className="text-xs text-muted-foreground mb-1">
                        {new Date(f.forecastDate).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                      </div>
                      <div className="text-xl font-black text-teal-800">
                        {f.temperature.toFixed(0)}°C
                      </div>
                      <div className="mt-2 flex flex-col gap-0.5">
                        <div className="text-[10px] text-blue-600 font-bold flex items-center justify-center gap-1">
                          🌧 {f.rainProbability}%
                        </div>
                        <div className="text-[9px] text-muted-foreground">
                          {f.rainfall.toFixed(1)} mm
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 7. Quick Links Bar */}
          <div className="flex flex-wrap gap-2 pt-4">
            <Button asChild variant="outline" size="sm" className="bg-white"><Link href="/historical">ดูข้อมูลย้อนหลัง</Link></Button>
            <Button asChild variant="outline" size="sm" className="bg-white"><Link href="/daily">ค่าเฉลี่ยรายวัน</Link></Button>
            <Button asChild variant="outline" size="sm" className="bg-white"><Link href="/download">ดาวน์โหลดข้อมูล</Link></Button>
          </div>
        </>
      )}
    </div>
  )
}
