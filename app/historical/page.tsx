"use client"

import { useState, useEffect } from "react"
import { useStation } from "@/contexts/StationContext"
import { getSensorReadings } from "@/services/sensorService"
import { exportSensorDataToCSV } from "@/services/exportService"
import type { SensorReading, TimeRange } from "@/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Download, Activity, Thermometer, Droplets, Sun, Wind, CloudRain, Gauge } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from "recharts"
import { formatThaiDateTime } from "@/utils/dateUtils"

function MiniStat({ label, value, icon: Icon, colorClass }: { label: string; value: string; icon: React.ElementType; colorClass: string }) {
  return (
    <Card className="shadow-sm border">
      <CardContent className="p-4 text-center">
        <div className={`mx-auto mb-1 w-8 h-8 rounded-full flex items-center justify-center bg-muted/50 ${colorClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-xl font-black font-mono tracking-tight">{value}</div>
        <div className="text-[10px] uppercase font-bold text-muted-foreground mt-1 tracking-wider">{label}</div>
      </CardContent>
    </Card>
  )
}

function HistoricalChart({ title, data, dataKey, unit, color, icon: Icon, type = "line" }: { title: string; data: any[]; dataKey: string; unit: string; color: string; icon: React.ElementType; type?: "line" | "bar" | "area" }) {
  const tooltipStyle = { backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", fontSize: "10px" }
  return (
    <Card className="shadow-sm overflow-hidden border">
      <CardHeader className="py-2.5 bg-muted/20 border-b flex flex-row items-center justify-between">
        <CardTitle className="text-[11px] font-bold uppercase tracking-tight flex items-center gap-1.5 text-muted-foreground">
          <Icon className="h-3.5 w-3.5" /> {title}
        </CardTitle>
        <span className="text-[10px] font-mono opacity-50 lowercase">{unit}</span>
      </CardHeader>
      <CardContent className="pt-5 px-1">
        <ResponsiveContainer width="100%" height={180}>
          {type === "bar" ? (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
              <XAxis dataKey="timeLabel" hide />
              <YAxis className="text-[10px]" unit={unit} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey={dataKey} fill={color} radius={[2, 2, 0, 0]} />
            </BarChart>
          ) : type === "area" ? (
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
              <XAxis dataKey="timeLabel" hide />
              <YAxis className="text-[10px]" unit={unit} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey={dataKey} stroke={color} fill={color} fillOpacity={0.1} strokeWidth={2} />
            </AreaChart>
          ) : (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
              <XAxis dataKey="timeLabel" hide />
              <YAxis className="text-[10px]" unit={unit} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export default function HistoricalDataPage() {
  const { selectedStation, selectedStationId, isLoading: stationLoading } = useStation()
  const [timeRange, setTimeRange] = useState<TimeRange>(7)
  const [readings, setReadings] = useState<SensorReading[]>([])
  const [isLoadingData, setIsLoadingData] = useState(false)

  useEffect(() => {
    if (!selectedStationId) return
    const loadData = async () => {
      setIsLoadingData(true)
      const data = await getSensorReadings(selectedStationId, timeRange)
      setReadings(data)
      setIsLoadingData(false)
    }
    loadData()
  }, [selectedStationId, timeRange])

  const handleExport = () => {
    if (!selectedStation) return
    exportSensorDataToCSV(selectedStation.name, readings, ["airTemperature", "relativeHumidity", "vpd", "rainfall", "lightIntensity", "windSpeed", "atmosphericPressure"], timeRange)
  }

  if (stationLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  const chartData = readings.map(r => ({
    ...r,
    timeLabel: new Date(r.timestamp).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
  }))

  const isWeatherStation = selectedStation?.type === "weather"
  
  // Calculate averages for Mini Stats
  const avg = (key: keyof SensorReading) => {
    const vals = readings.map(r => r[key]).filter(v => typeof v === "number") as number[]
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : 0
  }
  const sum = (key: keyof SensorReading) => {
    const vals = readings.map(r => r[key]).filter(v => typeof v === "number") as number[]
    return vals.reduce((a, b) => a + b, 0)
  }

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto pb-8">
      {/* 1. Header */}
      <div className="flex items-end justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            ข้อมูลย้อนหลัง <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase">TOR 4.5.4</span>
          </h1>
          <p className="text-xs text-muted-foreground font-mono">Table: CAM_main • CAM_client • sensor</p>
        </div>
      </div>

      {!selectedStation ? (
        <Alert><AlertDescription>กรุณาเลือกสถานี</AlertDescription></Alert>
      ) : (
        <>
          {/* 2. Selector Bar */}
          <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between flex-wrap gap-4 border shadow-sm text-sm">
            <div className="flex items-center gap-3">
              <span className="font-bold text-muted-foreground text-xs uppercase">สถานี:</span>
              <span className="font-bold">{selectedStation.name}</span>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="font-bold text-muted-foreground text-xs uppercase">ช่วงเวลา:</span>
                <div className="flex bg-background border rounded-md p-0.5">
                  {[3, 7, 15, 30].map((d) => (
                    <button
                      key={d}
                      onClick={() => setTimeRange(d as TimeRange)}
                      className={`px-3 py-1 text-xs font-bold rounded-sm transition-all ${
                        timeRange === d ? "bg-teal-500 text-white shadow-sm" : "hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      {d} วัน
                    </button>
                  ))}
                </div>
              </div>
              <Button size="sm" variant="outline" className="h-8 text-xs font-bold gap-2" onClick={handleExport} disabled={readings.length === 0}>
                <Download className="h-3 w-3" /> ⬇ CSV
              </Button>
            </div>
          </div>

          {/* 3. Mini Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MiniStat label="Temp เฉลี่ย" value={`${avg("airTemperature").toFixed(1)}°C`} icon={Thermometer} colorClass="text-orange-600" />
            <MiniStat label="RH เฉลี่ย" value={`${avg("relativeHumidity").toFixed(1)}%`} icon={Droplets} colorClass="text-blue-600" />
            <MiniStat label="ฝนรวม" value={`${sum("rainfall").toFixed(1)} mm`} icon={CloudRain} colorClass="text-indigo-600" />
            <MiniStat label="VPD เฉลี่ย" value={`${avg("vpd").toFixed(2)} kPa`} icon={Activity} colorClass="text-emerald-600" />
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
                  <span className="text-[10px] text-muted-foreground font-mono">Last 100 rows</span>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="bg-muted/50 border-b text-muted-foreground uppercase font-bold">
                          <th className="p-3 text-left border-r">วัน / เวลา</th>
                          <th className="p-3 text-right">Temp</th>
                          <th className="p-3 text-right">RH</th>
                          <th className="p-3 text-right">Lux</th>
                          <th className="p-3 text-right">Wind</th>
                          <th className="p-3 text-right">Rain</th>
                          <th className="p-3 text-right">hPa/V</th>
                          <th className="p-3 text-right">VPD</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y font-medium">
                        {readings.slice(0, 100).map((r, idx) => {
                          const vpdVal = r.vpd
                          const vpdClass = vpdVal == null ? "" : vpdVal < 0.8 ? "text-blue-600 bg-blue-50/50" : vpdVal <= 1.6 ? "text-green-600 bg-green-50/50" : "text-red-600 bg-red-50/50"
                          return (
                            <tr key={idx} className="hover:bg-muted/30 transition-colors">
                              <td className="p-3 border-r font-mono whitespace-nowrap">
                                {formatThaiDateTime(r.timestamp)}
                              </td>
                              <td className="p-3 text-right text-orange-700">{r.airTemperature?.toFixed(1) || "-"}</td>
                              <td className="p-3 text-right text-blue-700">{r.relativeHumidity?.toFixed(1) || "-"}</td>
                              <td className="p-3 text-right text-yellow-700">{(r.lightIntensity || 0).toLocaleString()}</td>
                              <td className="p-3 text-right">{r.windSpeed?.toFixed(1) || "-"}</td>
                              <td className="p-3 text-right text-indigo-700">{r.rainfall?.toFixed(1) || "-"}</td>
                              <td className="p-3 text-right opacity-60">{r.atmosphericPressure?.toFixed(2) || "-"}</td>
                              <td className={`p-3 text-right font-bold ${vpdClass}`}>{r.vpd?.toFixed(2) || "-"}</td>
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
