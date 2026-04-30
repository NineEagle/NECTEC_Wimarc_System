/**
 * Station Map Page (แผนที่จุดติดตั้งอุปกรณ์)
 * Interactive map showing all permitted station locations
 * Click markers to view station details and navigate to dashboard
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"
import { getAllStations, getStationLatestImage } from "@/services/stationsService"
import { getLatestSensorReading } from "@/services/sensorService"
import { getPermittedStations } from "@/utils/permissions"
import type { Station, SensorReading, StationImage } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/dashboard/StatusBadge"
import { formatThaiDateTime } from "@/utils/dateUtils"
import { MapPin, Navigation, Info, ExternalLink, Camera, Wifi, WifiOff, Users, Table } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import dynamic from "next/dynamic"
import Link from "next/link"

const StationMapLeaflet = dynamic(() => import("@/components/maps/StationMapLeaflet"), {
  ssr: false,
  loading: function MapLoading() {
    return (
      <div className="h-[500px] flex items-center justify-center bg-muted/30 rounded-lg text-sm text-muted-foreground">
        กำลังโหลดแผนที่...
      </div>
    )
  },
})

export default function MapPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [allStations, setAllStations] = useState<Station[]>([])
  const [permittedStations, setPermittedStations] = useState<Station[]>([])
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null)
  const [selectedStation, setSelectedStation] = useState<Station | null>(null)
  const [selectedReading, setSelectedReading] = useState<SensorReading | null>(null)
  const [selectedImage, setSelectedImage] = useState<StationImage | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      const stations = await getAllStations()
      setAllStations(stations)
      const permitted = getPermittedStations(user, stations)
      setPermittedStations(permitted)
      if (permitted.length > 0) setSelectedStationId(permitted[0].id)
      setIsLoading(false)
    }
    loadData()
  }, [user])

  useEffect(() => {
    if (!selectedStationId) return
    const station = allStations.find((s) => s.id === selectedStationId)
    if (!station) return
    setSelectedStation(station)
    let isCancelled = false
    const loadDetails = async () => {
      const [reading, image] = await Promise.all([
        getLatestSensorReading(station.id),
        getStationLatestImage(station.id),
      ])
      if (isCancelled) return
      setSelectedReading(reading)
      setSelectedImage(image)
    }
    loadDetails()
    return () => { isCancelled = true }
  }, [selectedStationId, allStations])

  const onlineCount = permittedStations.filter(s => s.status === "online").length
  const offlineCount = permittedStations.length - onlineCount

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-96" /></div>
  }

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto pb-8">
      {/* 1. Header Row */}
      <div className="flex items-end justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            แผนที่จุดติดตั้งอุปกรณ์ <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase">TOR 4.5.6</span>
          </h1>
          <p className="text-xs text-muted-foreground font-mono">Table: wimarc_info + heartbeat + google maps</p>
        </div>
      </div>

      {/* 2. Status Bar */}
      <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between flex-wrap gap-4 border shadow-sm text-sm">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse"></span>
            <span className="font-bold text-green-700 uppercase text-xs">Online: {onlineCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500"></span>
            <span className="font-bold text-red-700 uppercase text-xs">Offline: {offlineCount}</span>
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground font-medium italic">
          TOR ภาคผนวก 5 — จ.จันทบุรี · จ.ระยอง · จ.ตราด (30 จุดติดตั้ง)
        </div>
      </div>

      {/* 3. Map & Side Detail */}
      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-3 shadow-md border-0 overflow-hidden min-h-[500px] relative">
          <div className="absolute top-3 right-3 z-[400] bg-white/95 backdrop-blur p-2 rounded-md shadow border border-teal-100 text-[10px] leading-relaxed">
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-green-600"></span> Online</div>
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-red-600"></span> Offline</div>
            <div className="flex items-center gap-2 mt-1 border-t pt-1"><span className="h-2 w-2 rounded-full bg-green-600 inline-block"></span> Main (อากาศ)</div>
            <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-400 inline-block"></span> Client (ดิน)</div>
          </div>
          <StationMapLeaflet
            stations={permittedStations}
            selectedStationId={selectedStationId}
            onMarkerClick={setSelectedStationId}
          />
        </Card>

        {/* Selected Station Panel (Like detail-panel in old) */}
        <div className="space-y-4">
          {selectedStation ? (
            <Card className="shadow-md border-t-4 border-t-teal-500 h-full">
              <CardHeader className="py-3 bg-muted/30 border-b">
                <CardTitle className="text-sm font-bold flex flex-col gap-1">
                  <span className="text-[10px] text-muted-foreground uppercase font-mono">{selectedStation.id}</span>
                  {selectedStation.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="space-y-2 border-b pb-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground uppercase font-bold">เกษตรกร:</span>
                    <span className="font-bold text-teal-800">{selectedStation.ownerName || "นายสมชาย ใจดี"}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground uppercase font-bold">ที่ตั้ง:</span>
                    <span className="text-right">{selectedStation.area}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground uppercase font-bold">ประเภท:</span>
                    <Badge variant="outline" className="text-[9px] h-4 bg-teal-50">{selectedStation.type === "weather" ? "M — อากาศ" : "C — ดิน"}</Badge>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground uppercase font-bold">สถานะ:</span>
                    <StatusBadge status={selectedStation.status} />
                  </div>
                </div>

                {selectedReading && (
                  <div className="space-y-1.5 border-b pb-3">
                    <div className="flex justify-between text-xs">
                      <span>อุณหภูมิ:</span>
                      <span className="font-bold">{selectedReading.airTemperature?.toFixed(1)} °C</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span>ความชื้น:</span>
                      <span className="font-bold">{selectedReading.relativeHumidity?.toFixed(1)} %</span>
                    </div>
                    {selectedReading.vpd != null && (
                      <div className="flex justify-between text-xs">
                        <span>VPD:</span>
                        <span className={`font-bold ${selectedReading.vpd < 0.8 ? "text-blue-600" : selectedReading.vpd <= 1.6 ? "text-green-600" : "text-red-600"}`}>{selectedReading.vpd.toFixed(2)} kPa</span>
                      </div>
                    )}
                  </div>
                )}

                {selectedImage ? (
                  <div className="space-y-2">
                    <img src={selectedImage.imageUrl} alt="Station" className="w-full h-32 object-cover rounded-md border shadow-sm" />
                    <div className="text-[9px] text-muted-foreground font-mono flex items-center gap-1 justify-center italic">
                      <Camera className="h-3 w-3" /> {formatThaiDateTime(selectedImage.timestamp)}
                    </div>
                  </div>
                ) : (
                  <div className="h-32 bg-muted/30 rounded-md border border-dashed flex items-center justify-center text-muted-foreground/30"><Camera className="h-6 w-6" /></div>
                )}

                <div className="pt-2">
                  <Button size="sm" className="w-full bg-teal-600 hover:bg-teal-700 text-xs gap-2" asChild>
                    <Link href={`/dashboard?station=${selectedStation.id}`}><Info className="h-3 w-3" /> เปิดหน้าแดชบอร์ด</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full border-dashed flex items-center justify-center text-center p-6 text-muted-foreground/40 italic text-sm">
              เลือกสถานีบนแผนที่เพื่อดูข้อมูลรายละเอียดเชิงลึก
            </Card>
          )}
        </div>
      </div>

      {/* 4. Comprehensive Station Table (TOR ภาคผนวก 5) */}
      <Card className="shadow-md overflow-hidden">
        <CardHeader className="py-3 bg-muted/30 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-bold uppercase tracking-tight flex items-center gap-2">
            <Table className="h-4 w-4" /> ทุกสถานี — TOR ภาคผนวก 5 (30 จุดติดตั้ง)
          </CardTitle>
          <span className="text-[10px] text-muted-foreground uppercase font-mono">wimarc_info</span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-muted/50 border-b text-muted-foreground uppercase font-bold">
                  <th className="p-3 text-left">wimarc_id</th>
                  <th className="p-3 text-left">เกษตรกร</th>
                  <th className="p-3 text-left">พื้นที่</th>
                  <th className="p-3 text-left">ประเภท</th>
                  <th className="p-3 text-center">สถานะ</th>
                  <th className="p-3 text-center">อัปเดตล่าสุด</th>
                  <th className="p-3 text-right">ลิงก์ภายนอก</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {permittedStations.map((s) => (
                  <tr key={s.id} className={`hover:bg-muted/30 transition-colors ${selectedStationId === s.id ? "bg-teal-50/50" : ""}`} onClick={() => setSelectedStationId(s.id)}>
                    <td className="p-3 font-mono font-bold text-teal-700">{s.id}</td>
                    <td className="p-3 font-medium">{s.ownerName || "นายเกษตรกร พากเพียร"}</td>
                    <td className="p-3 text-muted-foreground">{s.area}</td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-[9px] h-4">{s.type === "weather" ? "M" : "C"}</Badge>
                    </td>
                    <td className="p-3 text-center">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="p-3 text-center font-mono text-muted-foreground">
                      {s.lastDataTime ? formatThaiDateTime(s.lastDataTime).split(" ")[1] : "—"}
                    </td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="sm" className="h-7 text-teal-600 hover:text-teal-700 hover:bg-teal-50" onClick={(e) => { e.stopPropagation(); window.open(`https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}`, "_blank") }}>
                        <Navigation className="h-3 w-3 mr-1" /> Maps
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
