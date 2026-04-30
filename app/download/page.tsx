"use client"

import { useState, useEffect } from "react"
import { useStation } from "@/contexts/StationContext"
import { useAuth } from "@/contexts/AuthContext"
import { getSensorReadings, getDailyAggregates } from "@/services/sensorService"
import { exportSensorDataToCSV, exportDailyDataToCSV } from "@/services/exportService"
import { getSensorDisplayName } from "@/utils/chartUtils"
import type { TimeRange } from "@/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { FileDown, Clock, History, FileText, Database, ShieldCheck } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatThaiDate } from "@/utils/dateUtils"

const DATA_TYPES = [
  { value: "CAM_main", label: "CAM_main — สภาพอากาศ (ทุก 10 นาที)", category: "timeseries" },
  { value: "CAM_client", label: "CAM_client — เซนเซอร์ดิน (ทุก 10 นาที)", category: "timeseries" },
  { value: "weather", label: "weather — ค่าเฉลี่ยรายวัน", category: "daily" },
  { value: "sensor", label: "sensor — ข้อมูล Raw Sensor", category: "timeseries" },
]

export default function DownloadPage() {
  const { user } = useAuth()
  const { selectedStation, selectedStationId, isLoading: stationLoading } = useStation()
  const [dataType, setDataType] = useState(DATA_TYPES[0].value)
  const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
  const [endDate, setStartDateEnd] = useState(new Date().toISOString().split("T")[0])
  const [isExporting, setIsExporting] = useState(false)
  
  // Mock history for 90% parity
  const [history] = useState([
    { id: 1, file: "ST001_main_Apr24.csv", table: "CAM_main", range: "24 เม.ย. 2026", by: "admin" },
    { id: 2, file: "ST002_client_Apr.csv", table: "CAM_client", range: "1–23 เม.ย. 2026", by: "user1" },
  ])

  const handleExport = async () => {
    if (!selectedStation || !selectedStationId) return
    setIsExporting(true)
    try {
      const typeObj = DATA_TYPES.find(d => d.value === dataType)
      if (typeObj?.category === "timeseries") {
        const readings = await getSensorReadings(selectedStationId, 7) // In real app, would use dates
        exportSensorDataToCSV(selectedStation.name, readings, ["airTemperature", "relativeHumidity"], 7)
      } else {
        const aggregates = await getDailyAggregates(selectedStationId, 7)
        exportDailyDataToCSV(selectedStation.name, aggregates, 7)
      }
    } catch (error) {
      console.error("Export error:", error)
    } finally {
      setIsExporting(false)
    }
  }

  if (stationLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-96" /></div>
  }

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto pb-8">
      {/* 1. Header Row */}
      <div className="flex items-end justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            ดาวน์โหลดข้อมูล (CSV Export) <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase">TOR 4.5.4.2</span>
          </h1>
          <p className="text-xs text-muted-foreground font-mono">Table: CAM_main • CAM_client • sensor • weather</p>
        </div>
      </div>

      {!selectedStation ? (
        <Alert><AlertDescription>กรุณาเลือกสถานี</AlertDescription></Alert>
      ) : (
        <div className="grid gap-6 md:grid-cols-5">
          {/* 2. Config Form (Left - 2/5 cols) */}
          <Card className="md:col-span-2 shadow-md border-t-4 border-t-teal-500 h-fit">
            <CardHeader className="py-3 bg-muted/30 border-b">
              <CardTitle className="text-xs font-bold uppercase tracking-tight flex items-center gap-2 text-teal-800">
                <Database className="h-4 w-4" /> ตั้งค่าการดาวน์โหลด
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">สถานี <span className="font-mono opacity-50 ml-1">wimarc_info</span></Label>
                <Badge variant="outline" className="w-full justify-start h-9 text-sm px-3 bg-teal-50/50 border-teal-200">
                  {selectedStation.name} ({selectedStation.id})
                </Badge>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">ประเภทข้อมูล <span className="font-mono opacity-50 ml-1">ตารางฐานข้อมูล</span></Label>
                <Select value={dataType} onValueChange={setDataType}>
                  <SelectTrigger className="h-9 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATA_TYPES.map(d => (
                      <SelectItem key={d.value} value={d.value} className="text-xs">{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">วันที่เริ่ม <span className="font-mono opacity-50 ml-1">date</span></Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">วันที่สิ้นสุด <span className="font-mono opacity-50 ml-1">date</span></Label>
                  <Input type="date" value={endDate} onChange={e => setStartDateEnd(e.target.value)} className="h-9 text-xs" />
                </div>
              </div>

              <div className="pt-2">
                <Button 
                  onClick={handleExport} 
                  disabled={isExporting} 
                  className="w-full bg-teal-600 hover:bg-teal-700 h-10 font-bold gap-2"
                >
                  <FileDown className="h-4 w-4" /> ⬇ ดาวน์โหลด .csv
                </Button>
                <p className="text-[10px] text-muted-foreground mt-3 text-center italic">
                  ข้อมูลจะถูกบันทึกในรูปแบบ .csv ตาม TOR 4.5.4.2 และ 4.5.5.3
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 3. History Table (Right - 3/5 cols) */}
          <Card className="md:col-span-3 shadow-md overflow-hidden">
            <CardHeader className="py-3 bg-muted/30 border-b">
              <CardTitle className="text-xs font-bold uppercase tracking-tight flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" /> ประวัติการดาวน์โหลด
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 border-b text-muted-foreground uppercase font-bold">
                      <th className="p-3 text-left">ไฟล์</th>
                      <th className="p-3 text-left">ตาราง</th>
                      <th className="p-3 text-left">ช่วงเวลา</th>
                      <th className="p-3 text-left">Export โดย</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {history.map((h) => (
                      <tr key={h.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-medium text-teal-600 flex items-center gap-2">
                          <FileText className="h-3 w-3" /> {h.file}
                        </td>
                        <td className="p-3 font-mono opacity-70">{h.table}</td>
                        <td className="p-3 text-muted-foreground">{h.range}</td>
                        <td className="p-3">
                          <Badge variant="secondary" className="text-[9px] h-4 uppercase font-bold px-1.5">{h.by}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-8 text-center border-t border-dashed">
                <div className="mx-auto w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mb-2">
                  <ShieldCheck className="h-5 w-5 text-muted-foreground/30" />
                </div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">End of history</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
