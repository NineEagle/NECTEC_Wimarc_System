"use client"

import { useState, useEffect } from "react"
import { useStation } from "@/contexts/StationContext"
import { getSensorReadings, getLiveData } from "@/services/sensorService"
import { exportSensorDataToCSV } from "@/services/exportService"
import type { Station, SensorReading, TimeRange, LiveData } from "@/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Download, Activity, Thermometer, Droplets, CloudRain, Wind, Sun } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { formatThaiDateTime } from "@/utils/dateUtils"

const METRICS = [
  { value: "airTemperature", label: "อุณหภูมิ (°C)", icon: Thermometer, color1: "#14b8a6", color2: "#f97316" },
  { value: "relativeHumidity", label: "ความชื้นสัมพัทธ์ (%)", icon: Droplets, color1: "#3b82f6", color2: "#ef4444" },
  { value: "vpd", label: "VPD (kPa)", icon: Activity, color1: "#10b981", color2: "#f59e0b" },
  { value: "rainfall", label: "ปริมาณฝน (mm)", icon: CloudRain, color1: "#6366f1", color2: "#ec4899" },
  { value: "lightIntensity", label: "ความเข้มแสง (lux)", icon: Sun, color1: "#eab308", color2: "#8b5cf6" },
  { value: "windSpeed", label: "ความเร็วลม (m/s)", icon: Wind, color1: "#64748b", color2: "#334155" },
]

function CompareSensorCard({ title, live1, live2, unit, dataKey }: { title: string; live1: LiveData | null; live2: LiveData | null; unit: string; dataKey: keyof LiveData }) {
  const v1 = live1 ? live1[dataKey] : null
  const v2 = live2 ? live2[dataKey] : null
  const renderVal = (v: any) => typeof v === "number" ? v.toFixed(1) : "—"
  
  return (
    <div className="grid grid-cols-2 gap-2 border-b py-2 last:border-0">
      <div className="flex flex-col">
        <span className="text-[10px] text-muted-foreground uppercase font-bold">{title}</span>
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-black text-teal-600">{renderVal(v1)}</span>
          <span className="text-[10px] text-muted-foreground">{unit}</span>
        </div>
      </div>
      <div className="flex flex-col text-right border-l pl-2">
        <span className="text-[10px] text-muted-foreground uppercase font-bold opacity-0 invisible">{title}</span>
        <div className="flex items-baseline gap-1 justify-end">
          <span className="text-sm font-black text-orange-600">{renderVal(v2)}</span>
          <span className="text-[10px] text-muted-foreground">{unit}</span>
        </div>
      </div>
    </div>
  )
}

export default function ComparePage() {
  const { selectedStation: station1, selectedStationId: station1Id, permittedStations, isLoading: stationLoading } = useStation()
  const [station2Id, setStation2Id] = useState<string | null>(null)
  const [metric, setMetric] = useState(METRICS[0].value)
  const [timeRange, setTimeRange] = useState<TimeRange>(7)
  const [readings1, setReadings1] = useState<SensorReading[]>([])
  const [readings2, setReadings2] = useState<SensorReading[]>([])
  const [live1, setLive1] = useState<LiveData | null>(null)
  const [live2, setLive2] = useState<LiveData | null>(null)
  const [isLoadingData, setIsLoadingData] = useState(false)

  useEffect(() => {
    if (permittedStations.length >= 2 && station1Id) {
      const second = permittedStations.find((s) => s.id !== station1Id)
      if (second && !station2Id) setStation2Id(second.id)
    }
  }, [permittedStations, station1Id])

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

  const currentMetric = METRICS.find(m => m.value === metric) || METRICS[0]
  const station2 = permittedStations.find(s => s.id === station2Id)

  // Merge data for overlay chart
  const mergedData = readings1.map((r1) => {
    const r2 = readings2.find(x => new Date(x.timestamp).getTime() === new Date(r1.timestamp).getTime())
    return {
      time: new Date(r1.timestamp).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
      val1: r1[metric as keyof SensorReading],
      val2: r2 ? r2[metric as keyof SensorReading] : null,
    }
  })

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

  const stats1 = calculateStats(readings1, metric)
  const stats2 = calculateStats(readings2, metric)

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto pb-8">
      {/* 1. Header Row */}
      <div className="flex items-end justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            เปรียบเทียบ 2 สถานี <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase">TOR 4.5.7</span>
          </h1>
          <p className="text-xs text-muted-foreground font-mono">Table: CAM_main • CAM_client — Side-by-side comparison</p>
        </div>
      </div>

      {!station1 ? (
        <Alert><AlertDescription>กรุณาเลือกสถานี</AlertDescription></Alert>
      ) : (
        <>
          {/* 2. Selector Bar */}
          <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between flex-wrap gap-4 border shadow-sm text-sm">
            <div className="flex items-center gap-4 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-muted-foreground text-xs uppercase">สถานี 1:</span>
                <Badge variant="outline" className="h-8 px-3 border-teal-200 bg-teal-50 text-teal-700">{station1.name}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-muted-foreground text-xs uppercase">สถานี 2:</span>
                <Select value={station2Id || ""} onValueChange={setStation2Id}>
                  <SelectTrigger className="h-8 bg-background border-orange-200 focus:ring-orange-500">
                    <SelectValue placeholder="เลือกสถานี" />
                  </SelectTrigger>
                  <SelectContent>
                    {permittedStations.filter(s => s.id !== station1Id).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 ml-4 border-l pl-4">
                <span className="font-bold text-muted-foreground text-xs uppercase">เซ็นเซอร์:</span>
                <Select value={metric} onValueChange={setMetric}>
                  <SelectTrigger className="h-8 bg-background w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METRICS.map(m => (
                      <SelectItem key={m.value} value={m.value}><div className="flex items-center gap-2"><m.icon className="h-3.5 w-3.5" /> {m.label}</div></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-background border rounded-md p-0.5 mr-2">
                {[3, 7, 15].map((d) => (
                  <button key={d} onClick={() => setTimeRange(d as TimeRange)} className={`px-3 py-1 text-xs font-bold rounded-sm transition-all ${timeRange === d ? "bg-teal-500 text-white shadow-sm" : "hover:bg-muted text-muted-foreground"}`}>{d} วัน</button>
                ))}
              </div>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => exportSensorDataToCSV(`compare_${station1Id}_vs_${station2Id}`, readings1, [metric], timeRange)}>
                <Download className="h-3 w-3" /> CSV
              </Button>
            </div>
          </div>

          {/* 3. Realtime Info Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="shadow-sm border-t-4 border-t-teal-500">
              <CardHeader className="py-2.5 bg-teal-50/50 border-b flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold uppercase text-teal-800">{station1.name}</CardTitle>
                <Badge className={live1?.lastPing ? "bg-green-500" : "bg-red-500"}>{live1?.lastPing ? "ONLINE" : "OFFLINE"}</Badge>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-x-4">
                  <div className="space-y-0">
                    <CompareSensorCard title="Temp" live1={live1} live2={null} unit="°C" dataKey="airTemperature" />
                    <CompareSensorCard title="RH" live1={live1} live2={null} unit="%" dataKey="relativeHumidity" />
                  </div>
                  <div className="space-y-0 border-l pl-4">
                    <CompareSensorCard title="VPD" live1={live1} live2={null} unit="kPa" dataKey="vpd" />
                    <CompareSensorCard title="Rain" live1={live1} live2={null} unit="mm" dataKey="rainfall" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-t-4 border-t-orange-500">
              <CardHeader className="py-2.5 bg-orange-50/50 border-b flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold uppercase text-orange-800">{station2?.name || "ยังไม่ได้เลือก"}</CardTitle>
                <Badge className={live2?.lastPing ? "bg-green-500" : "bg-red-500"}>{live2?.lastPing ? "ONLINE" : "OFFLINE"}</Badge>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-x-4">
                  <div className="space-y-0">
                    <CompareSensorCard title="Temp" live1={null} live2={live2} unit="°C" dataKey="airTemperature" />
                    <CompareSensorCard title="RH" live1={null} live2={live2} unit="%" dataKey="relativeHumidity" />
                  </div>
                  <div className="space-y-0 border-l pl-4">
                    <CompareSensorCard title="VPD" live1={null} live2={live2} unit="kPa" dataKey="vpd" />
                    <CompareSensorCard title="Rain" live1={null} live2={live2} unit="mm" dataKey="rainfall" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 4. Overlay Comparison Chart (TOR 4.5.7.2) */}
          <Card className="shadow-md border overflow-hidden">
            <CardHeader className="py-3 bg-muted/20 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Activity className="h-4 w-4" /> กราฟเปรียบเทียบ <span className="font-normal opacity-50 ml-2">{currentMetric.label}</span>
              </CardTitle>
              <span className="text-[10px] font-mono text-muted-foreground">TOR 4.5.7.2</span>
            </CardHeader>
            <CardContent className="pt-6">
              {isLoadingData ? (
                <Skeleton className="h-64" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={mergedData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                    <XAxis dataKey="time" className="text-[10px]" />
                    <YAxis className="text-[10px]" />
                    <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "8px" }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                    <Line type="monotone" dataKey="val1" name={station1.name} stroke={currentMetric.color1} strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="val2" name={station2?.name || "Station 2"} stroke={currentMetric.color2} strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* 5. Difference Table (TOR 4.5.7.1) */}
          <Card className="shadow-md overflow-hidden border-t-4 border-t-teal-500">
            <CardHeader className="py-3 bg-muted/30 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase tracking-tight flex items-center gap-2">
                ตารางเปรียบเทียบ Ave/Max/Min
              </CardTitle>
              <span className="text-[10px] text-muted-foreground uppercase font-mono">TOR 4.5.7.1</span>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b text-muted-foreground uppercase font-bold">
                    <th className="p-3 text-left">ค่า ({currentMetric.label})</th>
                    <th className="p-3 text-right text-teal-700">{station1.name}</th>
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
        </>
      )}
    </div>
  )
}
