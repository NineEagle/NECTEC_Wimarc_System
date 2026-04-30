"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useStation } from "@/contexts/StationContext"
import { StationsService } from "@/services/stationsService"
import type { Station } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Printer, Save, Camera, CheckCircle2, XCircle, FileText, ClipboardCheck } from "lucide-react"
import { formatThaiDate } from "@/utils/dateUtils"

const CHECKS_M = [
  { group: "ระบบไฟฟ้า", items: ["ไฟเลี้ยงระบบ 12Vdc (Voltage)", "ไฟเลี้ยงเซ็นเซอร์ 5Vdc"] },
  { group: "เซ็นเซอร์อากาศ (CAM_main)", items: [
    "ความเร็วลม (WindSpeed)", "ทิศทางลม (WindDir)", "ปริมาณน้ำฝน (Rain)", 
    "อุณหภูมิอากาศ (Temp)", "ความชื้นอากาศ (RH)", "ความเข้มแสง (Lux)", "ความกดอากาศ (Pressure)"
  ]},
  { group: "อุปกรณ์อื่น & การส่งข้อมูล", items: [
    "บอร์ดประมวลผล (Arduino Nano)", "อุปกรณ์เก็บภาพ (img_path)", "แผงโซลาร์เซลล์ & แบตเตอรี่", 
    "ทดสอบส่งข้อมูลไปยัง Server (TOR 4.3.4)", "API /Insertdata ทำงานปกติ (TOR 4.4.4)"
  ]}
]

const CHECKS_C = [
  { group: "ระบบไฟฟ้า", items: ["ไฟเลี้ยงระบบ 12Vdc", "ไฟเลี้ยงเซ็นเซอร์ 5Vdc"] },
  { group: "เซ็นเซอร์ดิน (CAM_client)", items: [
    "ความชื้นดิน 15cm", "อุณหภูมิดิน 15cm", "ความชื้นดิน 30cm", "อุณหภูมิดิน 30cm"
  ]},
  { group: "อุปกรณ์อื่น & การส่งข้อมูล", items: [
    "บอร์ดประมวลผล", "แผงโซลาร์เซลล์ & แบตเตอรี่", "ทดสอบส่งข้อมูลไปยัง Server"
  ]}
]

export default function MaintenancePage() {
  const { user } = useAuth()
  const { permittedStations } = useStation()
  const [selectedStationId, setSelectedStationId] = useState<string>("")
  const [stationData, setStationData] = useState<Station | null>(null)
  const [maintType, setMaintType] = useState("maint1")
  const [results, setResults] = useState<Record<string, "ok" | "fail">>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  
  useEffect(() => {
    if (selectedStationId) {
      const s = permittedStations.find(x => x.id === selectedStationId)
      setStationData(s || null)
    }
  }, [selectedStationId, permittedStations])

  const toggleResult = (id: string, status: "ok" | "fail") => {
    setResults(prev => ({ ...prev, [id]: status }))
  }

  const handlePrint = () => { window.print() }

  return (
    <div className="space-y-4 max-w-[1000px] mx-auto pb-12 print:max-w-full print:p-0 print:space-y-8">
      {/* Header Row */}
      <div className="flex items-end justify-between border-b pb-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            บันทึกการบำรุงรักษา <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase">TOR 4.7</span>
          </h1>
          <p className="text-xs text-muted-foreground font-mono">แบบรายการตรวจสอบ ภาคผนวก 3 & 4 (Checklist Form)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2"><Printer className="h-4 w-4" /> พิมพ์รายงาน</Button>
          <Button size="sm" className="bg-teal-600 hover:bg-teal-700 gap-2"><Save className="h-4 w-4" /> บันทึกรายงาน</Button>
        </div>
      </div>

      {/* Report View for Printing */}
      <div className="hidden print:block text-center border-b-2 border-teal-900 pb-4 mb-8">
        <h1 className="text-2xl font-black uppercase">WiMaRC System Maintenance Report</h1>
        <p className="text-sm font-bold">โครงการติดตั้งระบบตรวจวัดสภาพแวดล้อมเพื่อเพิ่มประสิทธิภาพการผลิตทุเรียนน้ำกร่อย</p>
        <p className="text-xs mt-2">อ้างอิง: TOR 4.7 · ภาคผนวกที่ 3 และ 4</p>
      </div>

      {/* Section 1: Basic Info */}
      <Card className="shadow-md border-t-4 border-t-teal-500 overflow-hidden">
        <CardHeader className="py-3 bg-muted/30 border-b">
          <CardTitle className="text-xs font-bold uppercase flex items-center gap-2 text-teal-800">
            <ClipboardCheck className="h-4 w-4" /> ส่วนที่ 1 — ข้อมูลพื้นฐาน
          </CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">สถานี (wimarc_id)</Label>
              <Select value={selectedStationId} onValueChange={setSelectedStationId}>
                <SelectTrigger className="print:border-none print:p-0 print:h-auto"><SelectValue placeholder="-- เลือกสถานี --" /></SelectTrigger>
                <SelectContent className="print:hidden">
                  {permittedStations.map(s => <SelectItem key={s.id} value={s.id}>{s.id} — {s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">ประเภทรายงาน</Label>
              <Select value={maintType} onValueChange={setMaintType}>
                <SelectTrigger className="print:border-none print:p-0 print:h-auto"><SelectValue /></SelectTrigger>
                <SelectContent className="print:hidden">
                  <SelectItem value="install">ทดสอบหลังติดตั้ง (ภาคผนวก 3)</SelectItem>
                  <SelectItem value="maint1">บำรุงรักษาครั้งที่ 1 (TOR 4.7.1)</SelectItem>
                  <SelectItem value="maint2">บำรุงรักษาครั้งที่ 2 (TOR 4.7.2)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">เกษตรกร / เจ้าของสวน</Label>
              <Input value={stationData?.ownerName || ""} className="print:border-none print:p-0 h-9 text-sm" readOnly />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">วันที่ตรวจสอบ</Label>
              <Input type="date" defaultValue={new Date().toISOString().split("T")[0]} className="print:border-none print:p-0 h-9 text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Checklist M */}
      <Card className="shadow-md overflow-hidden">
        <CardHeader className="py-3 bg-muted/30 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-bold uppercase text-muted-foreground">ส่วนที่ 2 — รายการตรวจสอบสถานีที่ 1 (Type M)</CardTitle>
          <Badge variant="outline" className="text-[9px] bg-teal-50">ภาคผนวก 4 ส่วนที่ 2</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 border-b text-[10px] font-bold uppercase text-muted-foreground">
              <tr>
                <th className="p-3 text-left w-12">No.</th>
                <th className="p-3 text-left">รายการตรวจสอบ</th>
                <th className="p-3 text-center w-[180px]">สถานะ</th>
                <th className="p-3 text-left print:hidden">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {CHECKS_M.map((group, gIdx) => (
                <>
                  <tr key={`g-${gIdx}`} className="bg-muted/20"><td colSpan={4} className="p-2 px-4 font-bold text-teal-900">— {group.group} —</td></tr>
                  {group.items.map((item, iIdx) => {
                    const id = `M-${gIdx}-${iIdx}`
                    return (
                      <tr key={id} className="hover:bg-muted/10">
                        <td className="p-3 text-center font-bold text-muted-foreground">{iIdx + 1}</td>
                        <td className="p-3 font-medium">{item}</td>
                        <td className="p-3">
                          <div className="flex justify-center gap-2">
                            <Button 
                              variant={results[id] === "ok" ? "default" : "outline"} 
                              size="sm" className={`h-7 px-3 text-[10px] font-bold ${results[id] === "ok" ? "bg-green-600 hover:bg-green-700" : ""}`}
                              onClick={() => toggleResult(id, "ok")}
                            ><CheckCircle2 className="h-3 w-3 mr-1" /> ปกติ</Button>
                            <Button 
                              variant={results[id] === "fail" ? "destructive" : "outline"} 
                              size="sm" className="h-7 px-3 text-[10px] font-bold"
                              onClick={() => toggleResult(id, "fail")}
                            ><XCircle className="h-3 w-3 mr-1" /> ผิดปกติ</Button>
                          </div>
                        </td>
                        <td className="p-3 print:hidden">
                          <Input className="h-7 text-[10px]" placeholder="..." value={notes[id]} onChange={e => setNotes(n => ({...n, [id]: e.target.value}))} />
                        </td>
                      </tr>
                    )
                  })}
                </>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Photo Section */}
      <Card className="shadow-md">
        <CardHeader className="py-3 bg-muted/30 border-b">
          <CardTitle className="text-xs font-bold uppercase text-muted-foreground">รูปภาพประกอบการบำรุงรักษา</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid gap-4 md:grid-cols-4 print:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="space-y-2">
                <Label className="text-[9px] uppercase font-bold text-muted-foreground leading-tight">
                  {i === 1 ? "แนวดิ่งและระดับน้ำ" : i === 2 ? "ภาพรวมสถานี" : i === 3 ? "ภายในกล่องวงจร" : "หน้าจอทดสอบ Server"}
                </Label>
                <div className="aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-muted-foreground/30 hover:border-teal-400 hover:text-teal-600 transition-all cursor-pointer bg-muted/10 print:border-solid">
                  <Camera className="h-8 w-8 mb-2" />
                  <span className="text-[8px] font-bold uppercase">อัปโหลดภาพ</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Signature */}
      <Card className="shadow-md overflow-hidden border-b-4 border-b-teal-900">
        <CardContent className="p-8">
          <div className="grid gap-12 md:grid-cols-2 print:grid-cols-2">
            <div className="text-center space-y-4">
              <div className="h-20 border-b border-dashed flex items-end justify-center pb-2 text-xs text-muted-foreground italic">ลายมือชื่อ</div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">ชื่อผู้ติดตั้ง/ตรวจสอบระบบ WiMaRC</p>
              <Input className="text-center h-8 text-sm max-w-[240px] mx-auto border-none focus:ring-0" placeholder="(..............................................)" />
            </div>
            <div className="text-center space-y-4">
              <div className="h-20 border-b border-dashed flex items-end justify-center pb-2 text-xs text-muted-foreground italic">ลายมือชื่อ</div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">ชื่อเกษตรกร / พยาน</p>
              <Input className="text-center h-8 text-sm max-w-[240px] mx-auto border-none focus:ring-0" placeholder="(..............................................)" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="text-center text-[10px] text-muted-foreground opacity-50 font-mono py-4">
        END OF DOCUMENT • WiMaRC-REPORT-v2
      </div>
    </div>
  )
}
