"use client"

import { useState, useEffect, useMemo } from "react"
import { useStation } from "@/contexts/StationContext"
import { getDailyAggregates } from "@/services/sensorService"
import { exportDailyDataToCSV } from "@/services/exportService"
import type { DailyAggregate, TimeRange } from "@/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, Calendar, Activity, Thermometer, Droplets } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ComposedChart, Area
} from "recharts"
import { formatThaiDate } from "@/utils/dateUtils"
import { VpdInfoButton } from "@/components/ui/VpdInfoButton"

export default function DailyAveragesPage() {
  const { permittedStations, clients, selectedStationId, isLoading: stationLoading } = useStation()

  const stationGroups = useMemo(() => {
    const map: Record<string, { hasMain: boolean; hasClient: boolean; label: string }> = {}
    for (const s of permittedStations) {
      const baseId = s.id.replace(/c$/, "")
      if (!map[baseId]) {
        const owner = clients.find(c => c.id === s.ownerId)
        map[baseId] = { hasMain: false, hasClient: false, label: owner?.fullName ? `${baseId} — ${owner.fullName}` : baseId }
      }
      if (s.id.endsWith("c")) map[baseId].hasClient = true
      else map[baseId].hasMain = true
    }
    return Object.entries(map)
      .map(([baseId, info]) => ({ baseId, ...info }))
      .sort((a, b) => (parseInt(a.baseId.replace(/^wimarc/, ""), 10) || 0) - (parseInt(b.baseId.replace(/^wimarc/, ""), 10) || 0))
  }, [permittedStations, clients])

  const [localBase, setLocalBase] = useState<string | null>(null)
  const [sensorType, setSensorType] = useState<"main" | "client">("main")

  useEffect(() => {
    if (!localBase && selectedStationId) {
      const base = selectedStationId.replace(/c$/, "")
      setLocalBase(base)
      setSensorType(selectedStationId.endsWith("c") ? "client" : "main")
    }
  }, [selectedStationId])

  const localStationId = localBase
    ? sensorType === "client" ? `${localBase}c` : localBase
    : null
  const localStation = permittedStations.find(s => s.id === localStationId) ?? null
  const currentGroup = stationGroups.find(g => g.baseId === localBase)
  const isWeatherStation = sensorType === "main"

  const [timeRange, setTimeRange] = useState<TimeRange>(15)
  const [aggregates, setAggregates] = useState<DailyAggregate[]>([])
  const [isLoadingData, setIsLoadingData] = useState(false)

  useEffect(() => {
    if (!localStationId) return
    const loadData = async () => {
      setIsLoadingData(true)
      const data = await getDailyAggregates(localStationId, timeRange)
      setAggregates(data)
      setIsLoadingData(false)
    }
    loadData()
  }, [localStationId, timeRange])

  const handleExport = () => {
    if (!localStation) return
    exportDailyDataToCSV(localStation.name, aggregates, timeRange)
  }

  if (stationLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  const chartData = aggregates.map(agg => ({
    ...agg,
    dateLabel: (() => { const d = new Date(agg.date as any); return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" }) })()
  }))

  const tooltipStyle = {
    backgroundColor: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "var(--radius)",
  }

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto pb-8">
      {/* 1. Header */}
      <div className="flex items-end justify-between border-b pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            ค่าเฉลี่ยรายวัน <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase">TOR 4.5.5</span>
          </h1>
          <p className="text-xs text-muted-foreground font-mono">Table: weather (TempAve/Max/Min • HumidAve • Rain)</p>
        </div>
      </div>

      {!localStation ? (
        <Alert><AlertDescription>กรุณาเลือกสถานี</AlertDescription></Alert>
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
                  {currentGroup?.hasMain && <SelectItem value="main" className="text-xs">สถานีอากาศ</SelectItem>}
                  {currentGroup?.hasClient && <SelectItem value="client" className="text-xs">สถานีดิน</SelectItem>}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <span className="font-bold text-muted-foreground text-xs uppercase">ช่วงเวลา:</span>
                <div className="flex bg-background border rounded-md p-0.5">
                  {[7, 15, 30].map((d) => (
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
            </div>
            <Button size="sm" variant="outline" className="h-8 text-xs font-bold gap-2" onClick={handleExport} disabled={aggregates.length === 0}>
              <Download className="h-3 w-3" /> ดาวน์โหลด CSV
            </Button>
          </div>

          {isLoadingData ? (
            <div className="space-y-4">
              <Skeleton className="h-64" />
              <div className="grid grid-cols-2 gap-4"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>
            </div>
          ) : aggregates.length > 0 ? (
            <div className="space-y-4">
              {isWeatherStation ? (
                <>
                  {/* Main Daily Chart (Temp + Rain) */}
                  <Card className="shadow-sm">
                    <CardHeader className="py-3 border-b bg-muted/20">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Thermometer className="h-4 w-4 text-orange-500" /> อุณหภูมิ & ฝนรายวัน
                        <span className="text-[10px] font-mono font-normal text-muted-foreground/50 ml-auto">TOR 4.5.5.1-4.5.5.3</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <ResponsiveContainer width="100%" height={280}>
                        <ComposedChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
                          <XAxis dataKey="dateLabel" className="text-[10px]" />
                          <YAxis yAxisId="left" className="text-[10px]" unit="°C"
                            label={{ value: "อุณหภูมิ (°C)", angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 10, fill: "#64748b", textAnchor: "middle" } }} />
                          <YAxis yAxisId="right" orientation="right" className="text-[10px]" unit="mm"
                            label={{ value: "ฝน (mm)", angle: 90, position: "insideRight", offset: 10, style: { fontSize: 10, fill: "#64748b", textAnchor: "middle" } }} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: "10px", paddingTop: "10px" }} />
                          <Bar yAxisId="right" dataKey="totalRainfall" name="ฝนรวม (mm)" fill="#6366f1" opacity={0.3} radius={[2, 2, 0, 0]} />
                          <Line yAxisId="left" type="monotone" dataKey="maxTemperature" name="สูงสุด" stroke="#ef4444" strokeWidth={2} dot={{ r: 2 }} />
                          <Line yAxisId="left" type="monotone" dataKey="avgTemperature" name="เฉลี่ย" stroke="#3b82f6" strokeWidth={3} dot={{ r: 3 }} />
                          <Line yAxisId="left" type="monotone" dataKey="minTemperature" name="ต่ำสุด" stroke="#06b6d4" strokeWidth={2} dot={{ r: 2 }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Humid Chart */}
                    <Card className="shadow-sm">
                      <CardHeader className="py-3 border-b bg-muted/20">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                          <Droplets className="h-4 w-4 text-blue-500" /> ความชื้นรายวัน
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
                            <XAxis dataKey="dateLabel" tick={{ fontSize: 9, angle: -35, textAnchor: "end", dy: 4 }} height={65} label={{ value: "วันที่", position: "insideBottomRight", offset: 0, style: { fontSize: 10, fill: "#94a3b8", textAnchor: "end" } }} />
                            <YAxis className="text-[10px]" unit="%"
                              label={{ value: "ความชื้น (%)", angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 10, fill: "#64748b", textAnchor: "middle" } }} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Line type="monotone" dataKey="avgHumidity" name="ความชื้นเฉลี่ย" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* VPD Chart */}
                    <Card className="shadow-sm">
                      <CardHeader className="py-3 border-b bg-muted/20">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                          <Activity className="h-4 w-4 text-emerald-500" /> VPD รายวัน <VpdInfoButton />
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6">
                        <ResponsiveContainer width="100%" height={200}>
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
                            <XAxis dataKey="dateLabel" tick={{ fontSize: 9, angle: -35, textAnchor: "end", dy: 4 }} height={65} label={{ value: "วันที่", position: "insideBottomRight", offset: 0, style: { fontSize: 10, fill: "#94a3b8", textAnchor: "end" } }} />
                            <YAxis className="text-[10px]" unit="kPa"
                              label={{ value: "VPD (kPa)", angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 10, fill: "#64748b", textAnchor: "middle" } }} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Line type="monotone" dataKey="avgVpd" name="VPD เฉลี่ย" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="shadow-sm">
                    <CardHeader className="py-3 border-b bg-muted/20">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Droplets className="h-4 w-4 text-lime-600" /> ความชื้นดินรายวัน
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
                          <XAxis dataKey="dateLabel" className="text-[10px]" />
                          <YAxis className="text-[10px]" unit="%"
                            label={{ value: "ความชื้นดิน (%)", angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 10, fill: "#64748b", textAnchor: "middle" } }} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: "10px" }} />
                          <Line type="monotone" dataKey="avgSoilMoisture1" name="15cm" stroke="#84cc16" strokeWidth={2} dot={{ r: 2 }} />
                          <Line type="monotone" dataKey="avgSoilMoisture2" name="30cm" stroke="#22c55e" strokeWidth={2} dot={{ r: 2 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                  <Card className="shadow-sm">
                    <CardHeader className="py-3 border-b bg-muted/20">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Thermometer className="h-4 w-4 text-amber-600" /> อุณหภูมิดินรายวัน
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
                          <XAxis dataKey="dateLabel" className="text-[10px]" />
                          <YAxis className="text-[10px]" unit="°C"
                            label={{ value: "อุณหภูมิดิน (°C)", angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 10, fill: "#64748b", textAnchor: "middle" } }} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Legend wrapperStyle={{ fontSize: "10px" }} />
                          <Line type="monotone" dataKey="avgSoilTemperature1" name="15cm" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
                          <Line type="monotone" dataKey="avgSoilTemperature2" name="30cm" stroke="#d97706" strokeWidth={2} dot={{ r: 2 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          ) : (
            <Card><CardContent className="py-12 text-center text-muted-foreground">ไม่มีข้อมูลในช่วงเวลาที่เลือก</CardContent></Card>
          )}

          {/* 4. Table Section (TOR 4.5.5.5) */}
          <Card className="shadow-md overflow-hidden border-t-4 border-t-teal-500">
            <CardHeader className="py-3 bg-muted/30 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Calendar className="h-4 w-4" /> ตารางค่าเฉลี่ยรายวัน
              </CardTitle>
              <span className="text-[10px] text-muted-foreground uppercase font-mono">TOR 4.5.5.5</span>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 border-b text-muted-foreground uppercase">
                      <th className="p-3 text-left font-bold border-r">วันที่</th>
                      {isWeatherStation ? (
                        <>
                          <th className="p-3 text-right font-bold">อุณหภูมิเฉลี่ย (°C)</th>
                          <th className="p-3 text-right font-bold">ต่ำสุด/สูงสุด (°C)</th>
                          <th className="p-3 text-right font-bold">ความชื้นเฉลี่ย (%)</th>
                          <th className="p-3 text-right font-bold">ฝนรวม (mm)</th>
                          <th className="p-3 text-right font-bold">ลมเฉลี่ย (m/s)</th>
                          <th className="p-3 text-right font-bold"><span className="inline-flex items-center gap-1">VPD เฉลี่ย (kPa) <VpdInfoButton /></span></th>
                          <th className="p-3 text-right font-bold">แสงเฉลี่ย (lux)</th>
                          <th className="p-3 text-right font-bold">ช่วงกลางวัน (ชม.)</th>
                          <th className="p-3 text-right font-bold">พระอาทิตย์ขึ้น/ตก</th>
                        </>
                      ) : (
                        <>
                          <th className="p-3 text-right font-bold">ชื้นดิน 15cm (%)</th>
                          <th className="p-3 text-right font-bold">อุณหภูมิดิน 15cm (°C)</th>
                          <th className="p-3 text-right font-bold">ชื้นดิน 30cm (%)</th>
                          <th className="p-3 text-right font-bold">อุณหภูมิดิน 30cm (°C)</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y font-medium">
                    {aggregates.map((agg, idx) => {
                      const vpdVal = agg.avgVpd
                      const vpdClass = vpdVal == null ? "" : vpdVal < 0.8 ? "text-blue-600 bg-blue-50" : vpdVal <= 1.6 ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"
                      return (
                        <tr key={idx} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3 border-r font-mono whitespace-nowrap">{formatThaiDate(agg.date)}</td>
                          {isWeatherStation ? (
                            <>
                              <td className="p-3 text-right font-bold text-orange-700">{agg.avgTemperature?.toFixed(1) || "-"}</td>
                              <td className="p-3 text-right text-muted-foreground">{agg.minTemperature?.toFixed(1) || "-"}/{agg.maxTemperature?.toFixed(1) || "-"}</td>
                              <td className="p-3 text-right text-blue-700">{agg.avgHumidity?.toFixed(1) || "-"}</td>
                              <td className="p-3 text-right font-bold text-indigo-700">{agg.totalRainfall?.toFixed(1) || "-"}</td>
                              <td className="p-3 text-right">{agg.avgWindSpeed?.toFixed(1) || "-"}</td>
                              <td className={`p-3 text-right font-bold ${vpdClass}`}>{agg.avgVpd?.toFixed(2) || "-"}</td>
                              <td className="p-3 text-right">{(agg.avgLightIntensity || 0).toLocaleString()}</td>
                              <td className="p-3 text-right">{agg.avgDaylength || "12:00"}</td>
                              <td className="p-3 text-right font-mono opacity-60">{"06:15 / 18:30"}</td>
                            </>
                          ) : (
                            <>
                              <td className="p-3 text-right text-lime-700 font-bold">{agg.avgSoilMoisture1?.toFixed(1) || "-"}</td>
                              <td className="p-3 text-right text-amber-700">{agg.avgSoilTemperature1?.toFixed(1) || "-"}</td>
                              <td className="p-3 text-right text-lime-700 font-bold">{agg.avgSoilMoisture2?.toFixed(1) || "-"}</td>
                              <td className="p-3 text-right text-amber-700">{agg.avgSoilTemperature2?.toFixed(1) || "-"}</td>
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
    </div>
  )
}
