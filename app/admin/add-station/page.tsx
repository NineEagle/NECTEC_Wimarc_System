"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useStation } from "@/contexts/StationContext"
import { getAllStations } from "@/services/stationsService"
import type { Station } from "@/types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  PlusCircle, LayoutDashboard, MapPin, Smartphone, 
  Settings, CheckCircle2, CloudSun, Droplets, Camera,
  Database, Info, ArrowRight, RotateCcw
} from "lucide-react"
import { StatusBadge } from "@/components/dashboard/StatusBadge"
import { useToast } from "@/hooks/use-toast"

export default function AddStationPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [allStations, setAllStations] = useState<Station[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Form State
  const [stationId, setStationId] = useState("wimarc31")
  const [stationNum, setStationNum] = useState(31)
  const [stationType, setStationType] = useState<"weather" | "soil">("weather")
  const [ownerName, setOwnerName] = useState("")
  const [farmName, setFarmName] = useState("")
  const [area, setArea] = useState("")
  const [simNumber, setSimNumber] = useState("")
  const [lat, setLat] = useState("")
  const [lng, setLng] = useState("")
  const [mqttTopic, setMqttTopic] = useState("wimarc/station/31")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const loadStations = async () => {
      const data = await getAllStations()
      setAllStations(data)
      setIsLoading(false)
    }
    loadStations()
  }, [])

  const handleNumChange = (val: string) => {
    const num = parseInt(val) || 0
    setStationNum(num)
    const id = `wimarc${num.toString().padStart(2, '0')}`
    setStationId(id)
    setMqttTopic(`wimarc/station/${num}`)
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    // Simulate API Call
    setTimeout(() => {
      setIsSubmitting(false)
      toast({ title: "เพิ่มสถานีสำเร็จ", description: `เพิ่มสถานี ${stationId} เข้าสู่ระบบเรียบร้อยแล้ว` })
    }, 1000)
  }

  const resetForm = () => {
    setOwnerName(""); setFarmName(""); setArea(""); setSimNumber(""); setLat(""); setLng("");
  }

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto pb-12">
      {/* Header */}
      <div className="flex items-end justify-between border-b pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            เพิ่มสถานีใหม่ <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase">TOR 4.3 • 4.4.3</span>
          </h1>
          <p className="text-xs text-muted-foreground font-mono">Table: wimarc_info + user_info (เกษตรกร)</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT: FORM (Steps) */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* STEP 1: WiMaRC ID */}
          <Card className="shadow-md border-l-4 border-l-teal-500">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-teal-500 text-white flex items-center justify-center font-bold text-sm">1</div>
                <div>
                  <h3 className="font-bold text-teal-900">รหัสชุดอุปกรณ์ (wimarc_id)</h3>
                  <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-tighter">wimarc_info.id • TOR 4.4.3</p>
                </div>
              </div>
              <div className="flex flex-col items-center justify-center p-6 bg-teal-900 rounded-lg text-teal-400 mb-4">
                <span className="text-3xl font-black font-mono tracking-widest">{stationId}</span>
                <span className="text-[10px] uppercase font-bold opacity-60 mt-1">ID Preview</span>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold text-muted-foreground">ระบุเลขรหัส (เช่น 31)</Label>
                <Input type="number" value={stationNum} onChange={(e) => handleNumChange(e.target.value)} className="font-mono" />
              </div>
            </CardContent>
          </Card>

          {/* STEP 2: Station Type */}
          <Card className="shadow-md border-l-4 border-l-teal-500">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-teal-500 text-white flex items-center justify-center font-bold text-sm">2</div>
                <div>
                  <h3 className="font-bold text-teal-900">ประเภทสถานี</h3>
                  <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-tighter">wimarc_info.type (M / C)</p>
                </div>
              </div>
              <div className="grid gap-3 grid-cols-2">
                <div 
                  className={`p-4 border-2 rounded-xl cursor-pointer transition-all text-center space-y-2 ${stationType === "weather" ? "border-teal-500 bg-teal-50" : "border-muted hover:border-teal-200"}`}
                  onClick={() => setStationType("weather")}
                >
                  <CloudSun className={`h-8 w-8 mx-auto ${stationType === "weather" ? "text-teal-600" : "text-muted-foreground"}`} />
                  <div className="font-black text-xs uppercase">สถานีที่ 1 (Type M)</div>
                  <div className="text-[9px] text-muted-foreground">ตรวจวัดสภาพอากาศ (8 เซนเซอร์)</div>
                </div>
                <div 
                  className={`p-4 border-2 rounded-xl cursor-pointer transition-all text-center space-y-2 ${stationType === "soil" ? "border-teal-500 bg-teal-50" : "border-muted hover:border-teal-200"}`}
                  onClick={() => setStationType("soil")}
                >
                  <Droplets className={`h-8 w-8 mx-auto ${stationType === "soil" ? "text-teal-600" : "text-muted-foreground"}`} />
                  <div className="font-black text-xs uppercase">สถานีที่ 2 (Type C)</div>
                  <div className="text-[9px] text-muted-foreground">ตรวจวัดความชื้นดิน (4 เซนเซอร์)</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* STEP 3: Info */}
          <Card className="shadow-md border-l-4 border-l-teal-500">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-teal-500 text-white flex items-center justify-center font-bold text-sm">3</div>
                <div>
                  <h3 className="font-bold text-teal-900">ข้อมูลเกษตรกรและสวน</h3>
                  <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-tighter">user_info.fullname • wimarc_info.set_name</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold">ชื่อ-สกุลเกษตรกร</Label>
                  <Input placeholder="เช่น นายสมชาย ใจดี" value={ownerName} onChange={e => setOwnerName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold">ชื่อสวนทุเรียน</Label>
                  <Input placeholder="เช่น สวนทุเรียนน้ำกร่อย" value={farmName} onChange={e => setFarmName(e.target.value)} />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <Label className="text-[11px] font-bold">ที่ตั้งสวน (พื้นที่ติดตั้ง)</Label>
                  <Input placeholder="ต.xxx อ.xxx จ.xxx" value={area} onChange={e => setArea(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold">เบอร์ซิมการ์ด</Label>
                  <Input placeholder="0X-XXXXXXX" value={simNumber} onChange={e => setSimNumber(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* STEP 4: GPS */}
          <Card className="shadow-md border-l-4 border-l-teal-500">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-teal-500 text-white flex items-center justify-center font-bold text-sm">4</div>
                <h3 className="font-bold text-teal-900">พิกัด GPS (Google Maps)</h3>
              </div>
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold">Latitude</Label>
                  <Input type="number" placeholder="13.xxxx" value={lat} onChange={e => setLat(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold">Longitude</Label>
                  <Input type="number" placeholder="101.xxxx" value={lng} onChange={e => setLng(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* STEP 5: Summary & Submit */}
          <Card className="shadow-lg border-t-4 border-t-teal-600 bg-teal-50/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-sm">5</div>
                <h3 className="font-bold text-teal-900 uppercase">สรุปข้อมูลและบันทึกสถานี</h3>
              </div>

              <div className="bg-white border rounded-xl overflow-hidden shadow-sm mb-6">
                <div className="p-4 bg-muted/30 border-b flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-teal-900 tracking-widest">Configuration Summary</span>
                  <Badge className="bg-teal-600">{stationId}</Badge>
                </div>
                <div className="p-0 text-xs">
                  <div className="flex justify-between p-3 border-b border-dashed"><span className="text-muted-foreground">Type:</span><span className="font-bold">{stationType === "weather" ? "สถานีที่ 1 (M — อากาศ)" : "สถานีที่ 2 (C — ดิน)"}</span></div>
                  <div className="flex justify-between p-3 border-b border-dashed"><span className="text-muted-foreground">Owner:</span><span className="font-bold">{ownerName || "—"}</span></div>
                  <div className="flex justify-between p-3 border-b border-dashed"><span className="text-muted-foreground">Location:</span><span className="font-bold text-right max-w-[200px]">{area || "—"}</span></div>
                  <div className="flex justify-between p-3 border-b border-dashed"><span className="text-muted-foreground">API Endpoint:</span><span className="font-mono text-[10px]">{stationType === "weather" ? "/InsertdataW32_main.php" : "/InsertdataW32_client.php"}</span></div>
                  <div className="flex justify-between p-3"><span className="text-muted-foreground">MQTT Topic:</span><span className="font-mono text-[10px] text-teal-600 font-bold">{mqttTopic}</span></div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button className="flex-1 bg-teal-600 hover:bg-teal-700 h-12 text-sm font-black uppercase tracking-widest" disabled={isSubmitting} onClick={handleSubmit}>
                  {isSubmitting ? "กำลังบันทึก..." : "✅ บันทึกสถานีใหม่ (INSERT)"}
                </Button>
                <Button variant="outline" className="h-12 px-6" onClick={resetForm}><RotateCcw className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: CURRENT STATIONS */}
        <div className="space-y-4">
          <Card className="shadow-md">
            <CardHeader className="py-3 bg-muted/30 border-b">
              <CardTitle className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">สถานีปัจจุบัน (30 จุด)</CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              <div className="grid grid-cols-2 gap-2 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
                {allStations.map(s => (
                  <div key={s.id} className="p-2 border rounded-md bg-white flex flex-col gap-1 shadow-sm border-l-4 border-l-teal-400">
                    <span className="text-[10px] font-black font-mono text-teal-700 leading-none">{s.id}</span>
                    <span className="text-[9px] font-bold text-teal-900 truncate leading-tight uppercase">{s.name.replace(/^สวนทุเรียน|^สวน/,'')}</span>
                    <span className="text-[8px] text-muted-foreground truncate">{s.area}</span>
                  </div>
                ))}
                {/* NEW PLACEHOLDER */}
                <div className="p-2 border-2 border-dashed border-teal-200 rounded-md bg-teal-50/50 flex flex-col items-center justify-center gap-1 animate-pulse">
                  <span className="text-[10px] font-black font-mono text-teal-700">{stationId}</span>
                  <span className="text-[8px] font-bold uppercase text-teal-600">+ สถานีใหม่</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* TOR INFOGRAPHIC */}
          <Card className="bg-teal-900 text-teal-100 shadow-md">
            <CardHeader className="py-3 border-b border-teal-800">
              <CardTitle className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-2">
                <Info className="h-3 w-3" /> TOR อ้างอิง
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 text-[10px] space-y-3 leading-relaxed opacity-80 font-medium">
              <div className="flex gap-2"><strong>4.3.1</strong> <span>ติดตั้งสถานีที่ 1 (M) พร้อม 8 เซ็นเซอร์</span></div>
              <div className="flex gap-2"><strong>4.3.2</strong> <span>ติดตั้งสถานีที่ 2 (C) พร้อมเซ็นเซอร์ดิน</span></div>
              <div className="flex gap-2"><strong>4.4.3</strong> <span>สร้างตาราง wimarc_info + Folder เก็บภาพ</span></div>
              <div className="flex gap-2"><strong>4.4.4</strong> <span>API รับส่งข้อมูลทุก 10 นาที</span></div>
              <div className="flex gap-2"><strong>4.5.6</strong> <span>แสดงจุดติดตั้งบน Google Maps</span></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
