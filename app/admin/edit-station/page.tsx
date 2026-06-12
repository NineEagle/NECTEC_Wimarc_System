"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { canAccessAdminPages } from "@/utils/permissions"
import { getAllStations } from "@/services/stationsService"
import { getAllUsers } from "@/services/userService"
import { apiRequest } from "@/services/apiClient"
import type { Station, User } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ArrowLeft, Save, MapPin, CloudSun, Droplets, Info, RotateCcw, Database
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { StatusBadge } from "@/components/dashboard/StatusBadge"

function StepCard({ step, title, sub, children }: { step: number; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <Card className="shadow-md border-l-4 border-l-teal-500">
      <CardContent className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-teal-500 text-white flex items-center justify-center font-bold text-sm shrink-0">{step}</div>
          <div>
            <h3 className="font-bold text-teal-900">{title}</h3>
            {sub && <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-tighter">{sub}</p>}
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

export default function EditStationPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useSearchParams()
  const { toast } = useToast()

  // baseId is the weather station id (without 'c')
  const rawId = params.get("id") ?? ""
  const baseId = rawId.endsWith("c") ? rawId.slice(0, -1) : rawId
  const clientId = baseId + "c"

  const [main, setMain] = useState<Station | null>(null)
  const [client, setClient] = useState<Station | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Shared fields
  const [area, setArea] = useState("")
  const [lat, setLat] = useState("")
  const [lng, setLng] = useState("")
  const [ownerId, setOwnerId] = useState("")

  // Main station
  const [mainName, setMainName] = useState("")
  const [mainDesc, setMainDesc] = useState("")

  // Client station
  const [clientName, setClientName] = useState("")
  const [clientDesc, setClientDesc] = useState("")

  useEffect(() => {
    if (!canAccessAdminPages(user)) { router.push("/dashboard"); return }
    if (!baseId) { router.push("/admin/system-status"); return }

    Promise.all([getAllStations(), getAllUsers()]).then(([stations, allUsers]) => {
      const m = stations.find(s => s.id === baseId)
      const c = stations.find(s => s.id === clientId)
      if (!m) { router.push("/admin/system-status"); return }

      setMain(m)
      setClient(c ?? null)
      setUsers(allUsers)

      setArea(m.area ?? "")
      setLat(m.latitude?.toString() ?? "")
      setLng(m.longitude?.toString() ?? "")
      setOwnerId(m.ownerId ?? "")
      setMainName(m.name ?? "")
      setMainDesc(m.description ?? "")
      setClientName(c?.name ?? "")
      setClientDesc(c?.description ?? "")
      setIsLoading(false)
    })
  }, [user, baseId])

  const handleSave = async () => {
    setIsSaving(true)
    const shared = {
      area,
      latitude: parseFloat(lat) || 0,
      longitude: parseFloat(lng) || 0,
      owner_id: ownerId || null,
    }
    try {
      await Promise.all([
        apiRequest(`/stations/${baseId}`, {
          method: "PUT",
          body: JSON.stringify({ ...shared, name: mainName, description: mainDesc }),
        }),
        ...(client ? [
          apiRequest(`/stations/${clientId}`, {
            method: "PUT",
            body: JSON.stringify({ ...shared, name: clientName, description: clientDesc }),
          }),
        ] : []),
      ])
      toast({ title: "บันทึกสำเร็จ", description: `อัปเดตสถานี ${baseId} เรียบร้อยแล้ว` })
      router.push("/admin/system-status")
    } catch {
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถบันทึกได้ กรุณาลองใหม่", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-[1400px] mx-auto space-y-4 p-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  if (!main) return null

  const ownerUser = users.find(u => u.id === ownerId)

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto pb-12">
      {/* Header */}
      <div className="flex items-end justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/admin/system-status")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
              แก้ไขสถานี <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase">TOR 4.3 • 4.4.3</span>
            </h1>
            <p className="text-xs text-muted-foreground font-mono">Table: wimarc_info — {baseId} / {clientId}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT: Form */}
        <div className="lg:col-span-2 space-y-4">

          {/* STEP 1: Station ID (read-only) */}
          <StepCard step={1} title="รหัสชุดอุปกรณ์ (wimarc_id)" sub="wimarc_info.id • TOR 4.4.3">
            <div className="flex flex-col items-center justify-center p-6 bg-teal-900 rounded-lg text-teal-400 mb-4">
              <span className="text-3xl font-black font-mono tracking-widest">{baseId}</span>
              <span className="text-[10px] uppercase font-bold opacity-60 mt-1">ID (แก้ไขไม่ได้)</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
                <CloudSun className="h-5 w-5 text-teal-600 shrink-0" />
                <div>
                  <div className="text-[10px] font-black uppercase text-teal-700">Main (M)</div>
                  <div className="font-mono text-xs text-muted-foreground">{baseId}</div>
                </div>
                <StatusBadge status={main.status} className="ml-auto" />
              </div>
              <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
                <Droplets className="h-5 w-5 text-orange-500 shrink-0" />
                <div>
                  <div className="text-[10px] font-black uppercase text-orange-700">Client (C)</div>
                  <div className="font-mono text-xs text-muted-foreground">{clientId}</div>
                </div>
                {client && <StatusBadge status={client.status} className="ml-auto" />}
              </div>
            </div>
          </StepCard>

          {/* STEP 2: Farmer & Farm info */}
          <StepCard step={2} title="ข้อมูลเกษตรกรและสวน" sub="wimarc_info.set_name • owner">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold">เจ้าของสถานี (User)</Label>
                <Select value={ownerId || "__none__"} onValueChange={v => setOwnerId(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="— ไม่ระบุ —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— ไม่ระบุ —</SelectItem>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.fullName ?? u.username} ({u.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold">ที่ตั้งสวน / พื้นที่ติดตั้ง</Label>
                <Input value={area} onChange={e => setArea(e.target.value)} placeholder="ต.xxx อ.xxx จ.xxx" />
              </div>
            </div>
          </StepCard>

          {/* STEP 3: GPS */}
          <StepCard step={3} title="พิกัด GPS (Google Maps)" sub="wimarc_info.latitude / longitude">
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold flex items-center gap-1"><MapPin className="h-3 w-3" /> Latitude</Label>
                <Input type="number" placeholder="13.xxxx" value={lat} onChange={e => setLat(e.target.value)} className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold flex items-center gap-1"><MapPin className="h-3 w-3" /> Longitude</Label>
                <Input type="number" placeholder="101.xxxx" value={lng} onChange={e => setLng(e.target.value)} className="font-mono" />
              </div>
            </div>
          </StepCard>

          {/* STEP 4: Station names */}
          <StepCard step={4} title="ชื่อสถานี (set_name)" sub="wimarc_info.set_name — M และ C">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold flex items-center gap-2">
                  <CloudSun className="h-3.5 w-3.5 text-teal-600" /> ชื่อสถานีอากาศ (M)
                </Label>
                <Input value={mainName} onChange={e => setMainName(e.target.value)} placeholder="wimarc01 (อากาศ) — คุณสมชาย สวนทุเรียน" />
              </div>
              {client && (
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold flex items-center gap-2">
                    <Droplets className="h-3.5 w-3.5 text-orange-500" /> ชื่อสถานีดิน (C)
                  </Label>
                  <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="wimarc01c (ดิน) — คุณสมชาย สวนทุเรียน" />
                </div>
              )}
            </div>
          </StepCard>

          {/* STEP 5: Save */}
          <Card className="shadow-lg border-t-4 border-t-teal-600 bg-teal-50/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-sm">5</div>
                <h3 className="font-bold text-teal-900 uppercase">สรุปและบันทึก</h3>
              </div>
              <div className="bg-white border rounded-xl overflow-hidden shadow-sm mb-6">
                <div className="p-4 bg-muted/30 border-b flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-teal-900 tracking-widest">Update Summary</span>
                  <Badge className="bg-teal-600">{baseId}</Badge>
                </div>
                <div className="p-0 text-xs">
                  <div className="flex justify-between p-3 border-b border-dashed"><span className="text-muted-foreground">Owner:</span><span className="font-bold">{ownerUser?.fullName ?? ownerUser?.username ?? "—"}</span></div>
                  <div className="flex justify-between p-3 border-b border-dashed"><span className="text-muted-foreground">Area:</span><span className="font-bold text-right max-w-[200px]">{area || "—"}</span></div>
                  <div className="flex justify-between p-3 border-b border-dashed"><span className="text-muted-foreground">GPS:</span><span className="font-mono text-[10px]">{lat}, {lng}</span></div>
                  <div className="flex justify-between p-3 border-b border-dashed"><span className="text-muted-foreground">Main name:</span><span className="font-bold text-right max-w-[240px] truncate">{mainName || "—"}</span></div>
                  {client && <div className="flex justify-between p-3"><span className="text-muted-foreground">Client name:</span><span className="font-bold text-right max-w-[240px] truncate">{clientName || "—"}</span></div>}
                </div>
              </div>
              <div className="flex gap-3">
                <Button className="flex-1 bg-teal-600 hover:bg-teal-700 h-12 text-sm font-black uppercase tracking-widest gap-2" disabled={isSaving} onClick={handleSave}>
                  <Save className="h-4 w-4" />
                  {isSaving ? "กำลังบันทึก..." : "✅ บันทึกการเปลี่ยนแปลง (UPDATE)"}
                </Button>
                <Button variant="outline" className="h-12 px-6" onClick={() => router.push("/admin/system-status")}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Sidebar */}
        <div className="space-y-4">
          {/* Current data */}
          <Card className="shadow-md">
            <CardHeader className="py-3 bg-muted/30 border-b">
              <CardTitle className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">ข้อมูลปัจจุบัน</CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-dashed">
                <span className="text-muted-foreground">Main ID</span>
                <span className="font-mono font-bold text-teal-700">{baseId}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-dashed">
                <span className="text-muted-foreground">Client ID</span>
                <span className="font-mono font-bold text-orange-600">{clientId}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-dashed">
                <span className="text-muted-foreground">Status (M)</span>
                <StatusBadge status={main.status} />
              </div>
              {client && (
                <div className="flex justify-between py-1.5 border-b border-dashed">
                  <span className="text-muted-foreground">Status (C)</span>
                  <StatusBadge status={client.status} />
                </div>
              )}
              <div className="flex justify-between py-1.5 border-b border-dashed">
                <span className="text-muted-foreground">Area</span>
                <span className="font-bold text-right max-w-[160px]">{main.area || "—"}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">GPS</span>
                <span className="font-mono text-[10px]">{main.latitude?.toFixed(5)}, {main.longitude?.toFixed(5)}</span>
              </div>
            </CardContent>
          </Card>

          {/* TOR reference */}
          <Card className="bg-teal-900 text-teal-100 shadow-md">
            <CardHeader className="py-3 border-b border-teal-800">
              <CardTitle className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-2">
                <Info className="h-3 w-3" /> TOR อ้างอิง
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 text-[10px] space-y-3 leading-relaxed opacity-80 font-medium">
              <div className="flex gap-2"><strong>4.3.1</strong> <span>ติดตั้งสถานีอากาศ (Type M) พร้อม 8 เซ็นเซอร์</span></div>
              <div className="flex gap-2"><strong>4.3.2</strong> <span>ติดตั้งสถานีดิน (Type C) พร้อมเซ็นเซอร์ดิน</span></div>
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
