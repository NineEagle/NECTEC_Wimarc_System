"use client"

import { useEffect, useMemo, useState } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import type { Station, LiveData } from "@/types"
import { getLiveData } from "@/services/sensorService"
import { formatThaiDateTimeSeconds } from "@/utils/dateUtils"
import { Loader2, Navigation2, Activity, Wifi, WifiOff, Map as MapIcon, Layers, ChevronRight } from "lucide-react"
import { VpdInfoButton } from "@/components/ui/VpdInfoButton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"

// --- TYPES ---

type StationGroup = {
  main?: Station   // wimarcN  — weather
  client?: Station // wimarcNc — soil
  id: string
}

// --- UTILS ---

const fmtStationId = (id: string) => {
  const m = id.match(/^wimarc(\d+)(c?)$/i)
  if (!m) return id
  return `Wimarc${String(m[1]).padStart(2, "0")}${m[2]}`
}

function groupStations(stations: Station[]): StationGroup[] {
  const weatherStations = stations.filter(s => s.type === "weather")
  const soilMap = new Map(stations.filter(s => s.type !== "weather").map(s => [s.id, s]))
  const pairedIds = new Set<string>()
  const groups: StationGroup[] = []

  for (const main of weatherStations) {
    const client = soilMap.get(main.id + "c")
    if (client) pairedIds.add(client.id)
    groups.push({ main, client, id: main.id })
  }

  // Soil stations that have no matching weather station
  for (const [id, soil] of soilMap) {
    if (!pairedIds.has(id)) groups.push({ client: soil, id })
  }

  const wimarcNum = (id: string) => {
    const m = id.match(/^wimarc(\d+)/i)
    return m ? parseInt(m[1], 10) : 9999
  }
  return groups.sort((a, b) => wimarcNum(a.id) - wimarcNum(b.id))
}

const createPinIcon = (color: string, isOnline: boolean, hasBoth: boolean, label: string) =>
  L.divIcon({
    className: "custom-pin-container",
    html: `
      <div class="pin-wrapper ${isOnline ? "pulse" : ""}">
        <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 0C7.16344 0 0 7.16344 0 16C0 28 16 42 16 42C16 42 32 28 32 16C32 7.16344 24.8366 0 16 0Z" fill="${color}" stroke="white" stroke-width="1"/>
          <circle cx="16" cy="16" r="7" fill="white" fill-opacity="0.85"/>
          <text x="16" y="${label.length > 1 ? "19" : "20"}" text-anchor="middle" font-size="${label.length > 1 ? "7.5" : "9"}" font-weight="800" font-family="monospace" fill="${color}">${label}</text>
          ${hasBoth ? `<circle cx="26" cy="7" r="4.5" fill="white" stroke="${color}" stroke-width="1.2"/><text x="26" y="9.5" text-anchor="middle" font-size="4.5" font-weight="900" font-family="monospace" fill="${color}">MC</text>` : ""}
        </svg>
        ${isOnline ? `<div class="pin-ring" style="border-color: ${color}"></div>` : ""}
      </div>
    `,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -40],
  })

// --- LEAFLET HELPERS ---

function FitBounds({ groups }: { groups: StationGroup[] }) {
  const map = useMap()
  useEffect(() => {
    if (groups.length === 0) return
    const bounds = groups.map(g => {
      const s = g.main ?? g.client!
      return [s.latitude, s.longitude] as [number, number]
    })
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 })
  }, [groups, map])
  return null
}

// --- MERGED MARKER ---

function MergedMarker({
  group,
  onClick,
}: {
  group: StationGroup
  onClick?: (id: string) => void
}) {
  const [mainLive, setMainLive] = useState<LiveData | null>(null)
  const [clientLive, setClientLive] = useState<LiveData | null>(null)
  const [loading, setLoading] = useState(false)

  const primary = group.main ?? group.client!
  const hasBoth = !!(group.main && group.client)

  const mainOnline = useMemo(() => {
    if (!group.main) return false
    if (mainLive?.lastPing) return Date.now() - mainLive.lastPing.getTime() < 5 * 60 * 1000
    return group.main.status === "online"
  }, [mainLive, group.main])

  const clientOnline = useMemo(() => {
    if (!group.client) return false
    if (clientLive?.lastPing) return Date.now() - clientLive.lastPing.getTime() < 5 * 60 * 1000
    return group.client.status === "online"
  }, [clientLive, group.client])

  const pairStatus = useMemo(() => {
    if (!group.client) return mainOnline ? "both-online" : "both-offline"
    if (!group.main) return clientOnline ? "both-online" : "both-offline"
    if (mainOnline && clientOnline) return "both-online"
    if (!mainOnline && !clientOnline) return "both-offline"
    return mainOnline ? "main-only" : "client-only"
  }, [mainOnline, clientOnline, group.main, group.client])

  const PIN_COLORS = { "both-online": "#16a34a", "both-offline": "#dc2626", "main-only": "#ca8a04", "client-only": "#ea580c" }
  const color = PIN_COLORS[pairStatus]
  const isOnline = pairStatus !== "both-offline"
  const pinLabel = useMemo(() => {
    const m = group.id.match(/^wimarc(\d+)/)
    return m ? m[1] : group.id
  }, [group.id])
  const pinIcon = useMemo(() => createPinIcon(color, isOnline, hasBoth, pinLabel), [color, isOnline, hasBoth, pinLabel])

  const handleOpen = async () => {
    onClick?.(primary.id)
    if (mainLive || clientLive || loading) return
    setLoading(true)
    try {
      await Promise.all([
        group.main ? getLiveData(group.main.id).then(setMainLive).catch(() => {}) : Promise.resolve(),
        group.client ? getLiveData(group.client.id).then(setClientLive).catch(() => {}) : Promise.resolve(),
      ])
    } finally {
      setLoading(false)
    }
  }

  const googleNavUrl = `https://www.google.com/maps/dir/?api=1&destination=${primary.latitude},${primary.longitude}`

  return (
    <Marker
      position={[primary.latitude, primary.longitude]}
      icon={pinIcon}
      eventHandlers={{ click: handleOpen, popupopen: handleOpen }}
    >
      <Popup minWidth={200} maxWidth={260} maxHeight={440} autoPanPadding={[20, 80]} className="modern-popup">
        <div className="p-1 max-h-[420px] overflow-y-auto overscroll-contain space-y-2">

          {/* Header */}
          <div className="flex items-start justify-between gap-2 border-b pb-2">
            <div className="min-w-0">
              <div className="font-bold text-[13px] leading-snug text-slate-800 truncate">{primary.name.split("—")[1]?.trim() ?? primary.name}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{primary.area} · {hasBoth ? "อากาศ+ดิน" : group.main ? "อากาศ" : "ดิน"}</div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0 text-[10px] font-bold">
              {hasBoth ? (
                <>
                  <span className={`flex items-center gap-1 ${mainOnline ? "text-green-600" : "text-red-500"}`}><span className={`h-1.5 w-1.5 rounded-full ${mainOnline ? "bg-green-500" : "bg-red-500"}`} />M</span>
                  <span className={`flex items-center gap-1 ${clientOnline ? "text-green-600" : "text-red-500"}`}><span className={`h-1.5 w-1.5 rounded-full ${clientOnline ? "bg-green-500" : "bg-red-500"}`} />C</span>
                </>
              ) : (
                <span className={`flex items-center gap-1 ${isOnline ? "text-green-600" : "text-red-500"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-green-500" : "bg-red-500"}`} />{isOnline ? "Online" : "Offline"}
                </span>
              )}
            </div>
          </div>

          {loading && <div className="flex justify-center py-3 text-slate-400 text-xs"><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />กำลังโหลด...</div>}

          {/* Weather */}
          {mainLive && group.main && (
            <div className="space-y-1 text-[11px]">
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">🌤 อากาศ</div>
              {[
                { label: "อุณหภูมิ", value: mainLive.airTemperature != null ? `${mainLive.airTemperature.toFixed(1)} °C` : null },
                { label: "ความชื้น", value: mainLive.relativeHumidity != null ? `${mainLive.relativeHumidity.toFixed(1)} %` : null },
                { label: "ฝน", value: mainLive.rainfall != null ? `${mainLive.rainfall.toFixed(1)} mm` : null },
                { label: "ลม", value: mainLive.windSpeed != null ? `${mainLive.windSpeed.toFixed(1)} m/s` : null },
              ].filter(r => r.value).map(r => (
                <div key={r.label} className="flex justify-between items-center">
                  <span className="text-slate-400">{r.label}</span>
                  <span className="font-semibold text-slate-700">{r.value}</span>
                </div>
              ))}
              {mainLive.vpd != null && (
                <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                  <span className="text-slate-400 flex items-center gap-1">VPD <VpdInfoButton /></span>
                  <span className={`font-bold text-[11px] ${mainLive.vpd < 0.8 ? "text-blue-600" : mainLive.vpd <= 1.6 ? "text-green-600" : "text-red-600"}`}>
                    {mainLive.vpd.toFixed(2)} kPa
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Soil */}
          {clientLive && group.client && (
            <div className="space-y-1 text-[11px]">
              <div className="text-[9px] font-bold text-amber-500 uppercase tracking-widest mb-1">🌱 ดิน</div>
              {[
                { label: "ชื้น 15cm", value: clientLive.soilMoisture1 != null ? `${clientLive.soilMoisture1.toFixed(1)} %` : null },
                { label: "Temp 15cm", value: clientLive.soilTemperature1 != null ? `${clientLive.soilTemperature1.toFixed(1)} °C` : null },
                { label: "ชื้น 30cm", value: clientLive.soilMoisture2 != null ? `${clientLive.soilMoisture2.toFixed(1)} %` : null },
                { label: "Temp 30cm", value: clientLive.soilTemperature2 != null ? `${clientLive.soilTemperature2.toFixed(1)} °C` : null },
              ].filter(r => r.value).map(r => (
                <div key={r.label} className="flex justify-between items-center">
                  <span className="text-slate-400">{r.label}</span>
                  <span className="font-semibold text-slate-700">{r.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Camera image */}
          {mainLive?.imageUrl && (
            <div className="relative overflow-hidden rounded border border-slate-100">
              <img
                src={`${mainLive.imageUrl}?t=${mainLive.imageTime?.getTime() ?? 0}`}
                alt={primary.name}
                className="w-full h-24 object-cover"
              />
              <div className="absolute bottom-0 inset-x-0 bg-black/50 px-1.5 py-0.5">
                <span className="text-[8px] text-white/80 font-mono">
                  {mainLive.imageTime ? formatThaiDateTimeSeconds(mainLive.imageTime) : "LIVE"}
                </span>
              </div>
            </div>
          )}

          {/* Actions — use onClick so Leaflet doesn't swallow the navigation */}
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <button
              className="h-8 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
              onClick={() => { window.location.href = `/dashboard?station=${primary.id}` }}
            >
              แดชบอร์ด <ChevronRight className="h-3 w-3" />
            </button>
            <button
              className="h-8 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
              onClick={() => window.open(googleNavUrl, "_blank")}
            >
              <Navigation2 className="h-3 w-3" /> นำทาง
            </button>
          </div>
        </div>
      </Popup>
    </Marker>
  )
}

// --- MAIN COMPONENT ---

interface ModernMapProps {
  stations: Station[]
  onMarkerClick?: (stationId: string) => void
  className?: string
}

export default function ModernMap({ stations, onMarkerClick, className }: ModernMapProps) {
  const [mapType, setMapType] = useState<"standard" | "satellite">("standard")

  const groups = useMemo(() => groupStations(stations), [stations])

  const center = useMemo(() => {
    if (groups.length === 0) return [13.736717, 100.523186] as [number, number]
    const sum = groups.reduce((acc, g) => {
      const s = g.main ?? g.client!
      return { lat: acc.lat + s.latitude, lng: acc.lng + s.longitude }
    }, { lat: 0, lng: 0 })
    return [sum.lat / groups.length, sum.lng / groups.length] as [number, number]
  }, [groups])

  if (groups.length === 0) {
    return (
      <div className="flex h-[500px] items-center justify-center rounded-xl border bg-muted/30 text-sm text-muted-foreground border-dashed">
        ไม่มีสถานีสำหรับแสดงบนแผนที่
      </div>
    )
  }

  return (
    <div className={`relative group ${className || ""}`}>
      {/* Floating legend */}
      <div className="absolute top-4 left-4 z-[1000] space-y-2 pointer-events-none">
        <Card className="p-3 bg-white/90 backdrop-blur shadow-xl border-white/50 pointer-events-auto">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">สถานะหมุด</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
              <span className="h-3 w-3 rounded-full bg-green-500 border border-white shadow-sm shrink-0" />
              อากาศ + ดิน ออนไลน์ทั้งคู่
            </div>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
              <span className="h-3 w-3 rounded-full bg-red-500 border border-white shadow-sm shrink-0" />
              ออฟไลน์ทั้งคู่
            </div>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
              <span className="h-3 w-3 rounded-full bg-yellow-500 border border-white shadow-sm shrink-0" />
              สถานีอากาศ Online, สถานีดิน Offline
            </div>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
              <span className="h-3 w-3 rounded-full bg-orange-500 border border-white shadow-sm shrink-0" />
              สถานีอากาศ Offline, สถานีดิน Online
            </div>
          </div>
        </Card>
      </div>

      {/* Map type toggle */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2 pointer-events-auto">
        <Button
          size="icon"
          variant="secondary"
          className="bg-white/90 backdrop-blur shadow-lg border-white/50 h-10 w-10 hover:bg-white"
          onClick={() => setMapType(mapType === "standard" ? "satellite" : "standard")}
          title="สลับโหมดแผนที่"
        >
          {mapType === "standard" ? <Layers className="h-5 w-5 text-slate-700" /> : <MapIcon className="h-5 w-5 text-slate-700" />}
        </Button>
      </div>

      <div className="h-[500px] w-full rounded-xl overflow-hidden shadow-inner border relative bg-slate-100">
        <MapContainer
          center={center}
          zoom={9}
          className="h-full w-full z-0"
          scrollWheelZoom
        >
          {mapType === "standard" ? (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          ) : (
            <TileLayer
              attribution='&copy; Google'
              url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
            />
          )}

          <FitBounds groups={groups} />

          {groups.map(g => (
            <MergedMarker key={g.id} group={g} onClick={onMarkerClick} />
          ))}
        </MapContainer>
      </div>

      <style jsx global>{`
        .leaflet-control-zoom a {
          width: 2rem;
          height: 2rem;
          line-height: 2rem;
          font-size: 1.25rem;
        }
        .leaflet-control-zoom {
          border-radius: 0.5rem;
          overflow: hidden;
        }
        .leaflet-control-attribution {
          font-size: 0.6rem;
        }
        .modern-popup .leaflet-popup-content-wrapper {
          border-radius: 12px;
          padding: 0;
          overflow: hidden;
          box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
        }
        .modern-popup .leaflet-popup-content {
          margin: 0;
          overflow: hidden;
        }
        .modern-popup .leaflet-popup-scrolled {
          border: none;
        }
        .modern-popup .leaflet-popup-tip-container {
          display: none;
        }
        .pin-wrapper {
          position: relative;
          width: 32px;
          height: 42px;
          filter: drop-shadow(0 4px 3px rgb(0 0 0 / 0.2));
        }
        .pin-wrapper.pulse svg {
          animation: pin-bounce 2s infinite ease-in-out;
        }
        @keyframes pin-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .pin-ring {
          position: absolute;
          top: 36px;
          left: 6px;
          width: 20px;
          height: 10px;
          border: 2px solid;
          border-radius: 50%;
          transform: rotateX(60deg);
          opacity: 0;
          animation: ring-pulse 2s infinite ease-out;
        }
        @keyframes ring-pulse {
          0% { transform: rotateX(60deg) scale(0.5); opacity: 0.8; }
          100% { transform: rotateX(60deg) scale(2); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
