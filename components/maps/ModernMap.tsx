"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import type { Station, LiveData } from "@/types"
import { getLiveData } from "@/services/sensorService"
import { formatThaiDateTimeSeconds } from "@/utils/dateUtils"
import { Loader2, Navigation2, Activity, Wifi, WifiOff, Map as MapIcon, Layers, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"

// --- STYLES & CONFIG ---

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

// Create a custom DivIcon that looks like a modern Pin
const createPinIcon = (color: string, isOnline: boolean, isClient: boolean) => {
  return L.divIcon({
    className: "custom-pin-container",
    html: `
      <div class="pin-wrapper ${isOnline ? "pulse" : ""}">
        <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 0C7.16344 0 0 7.16344 0 16C0 28 16 42 16 42C16 42 32 28 32 16C32 7.16344 24.8366 0 16 0Z" fill="${color}" stroke="white" stroke-width="1"/>
          <circle cx="16" cy="16" r="6" fill="white" fill-opacity="0.8"/>
          ${isClient ? '<circle cx="16" cy="16" r="3" fill="#b45309"/>' : ""}
        </svg>
        ${isOnline ? `<div class="pin-ring" style="border-color: ${color}"></div>` : ""}
      </div>
    `,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -40],
  })
}

// --- UTILS ---

function offsetForClient(lat: number, lng: number): [number, number] {
  // Minor offset to prevent overlap
  return [lat + 0.00015, lng + 0.00015]
}

// --- LEAFLET COMPONENTS ---

function FitBounds({ stations }: { stations: Station[] }) {
  const map = useMap()
  useEffect(() => {
    if (stations.length === 0) return
    const bounds = stations.map((s) => [s.latitude, s.longitude]) as [number, number][]
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 })
  }, [stations, map])
  return null
}

function LeafletMarker({
  station,
  onClick,
}: {
  station: Station
  onClick?: (id: string) => void
}) {
  const [live, setLive] = useState<LiveData | null>(null)
  const [loading, setLoading] = useState(false)

  const isClient = station.type !== "weather"
  const [lat, lng] = isClient
    ? offsetForClient(station.latitude, station.longitude)
    : [station.latitude, station.longitude]

  const isOnline = useMemo(() => {
    if (live?.lastPing) return Date.now() - live.lastPing.getTime() < 5 * 60 * 1000
    return station.status === "online"
  }, [live, station.status])

  const color = isOnline ? "#16a34a" : "#dc2626"
  const pinColor = isClient ? "#f59e0b" : color // Gold for Soil, Status color for Weather

  const pinIcon = useMemo(() => createPinIcon(pinColor, isOnline, isClient), [pinColor, isOnline, isClient])

  const handleOpen = async () => {
    onClick?.(station.id)
    if (live || loading) return
    setLoading(true)
    try {
      const data = await getLiveData(station.id)
      setLive(data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  const googleNavUrl = `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`

  return (
    <Marker
      position={[lat, lng]}
      icon={pinIcon}
      eventHandlers={{ click: handleOpen, popupopen: handleOpen }}
    >
      <Popup minWidth={260} maxWidth={320} className="modern-popup">
        <div className="space-y-3 p-1">
          <div className="border-b pb-2">
            <div className="flex justify-between items-start mb-1">
              <Badge variant="outline" className="text-[9px] h-4 px-1 font-mono uppercase opacity-70">
                {station.id}
              </Badge>
              <div className={`flex items-center gap-1 text-[10px] font-bold ${isOnline ? "text-green-600" : "text-red-600"}`}>
                {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {isOnline ? "ONLINE" : "OFFLINE"}
              </div>
            </div>
            <div className="font-black text-base leading-tight text-slate-800">{station.name}</div>
            <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1 uppercase font-semibold tracking-wider">
               <Activity className="h-2.5 w-2.5" />
               {isClient ? "Soil Client" : "Weather Main"} • {station.area}
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-4 text-slate-400 text-xs">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> กำลังเรียกข้อมูลสด...
            </div>
          )}

          {live && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                {!isClient ? (
                  <>
                    <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
                       <span className="text-slate-400 block mb-0.5">Temp</span>
                       <span className="font-bold text-slate-700">{live.airTemperature?.toFixed(1) ?? "--"}°C</span>
                    </div>
                    <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
                       <span className="text-slate-400 block mb-0.5">Humidity</span>
                       <span className="font-bold text-slate-700">{live.relativeHumidity?.toFixed(1) ?? "--"}%</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
                       <span className="text-slate-400 block mb-0.5">Soil (15cm)</span>
                       <span className="font-bold text-slate-700">{live.soilMoisture1?.toFixed(1) ?? "--"}%</span>
                    </div>
                    <div className="bg-slate-50 p-1.5 rounded border border-slate-100">
                       <span className="text-slate-400 block mb-0.5">Soil (30cm)</span>
                       <span className="font-bold text-slate-700">{live.soilMoisture2?.toFixed(1) ?? "--"}%</span>
                    </div>
                  </>
                )}
              </div>

              {live.imageUrl && (
                <div className="relative group overflow-hidden rounded-md border border-slate-200">
                  <img
                    src={`${live.imageUrl}?t=${live.imageTime?.getTime() ?? 0}`}
                    alt={station.name}
                    className="w-full h-28 object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                    <span className="text-[9px] text-white/90 font-mono">
                      {live.imageTime ? formatThaiDateTimeSeconds(live.imageTime) : "LIVE"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              size="sm"
              variant="default"
              className="h-8 text-[11px] font-bold bg-teal-600 hover:bg-teal-700 shadow-sm"
              asChild
            >
              <a href={`/dashboard?station=${station.id}`}>
                แดชบอร์ด <ChevronRight className="h-3 w-3 ml-1" />
              </a>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-[11px] font-bold border-slate-200 hover:bg-slate-50"
              onClick={() => window.open(googleNavUrl, "_blank")}
            >
              <Navigation2 className="h-3 w-3 mr-1" /> นำทาง
            </Button>
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

  const center = useMemo(() => {
    if (stations.length === 0) return [13.736717, 100.523186] as [number, number]
    const sum = stations.reduce(
      (acc, s) => ({ lat: acc.lat + s.latitude, lng: acc.lng + s.longitude }),
      { lat: 0, lng: 0 },
    )
    return [sum.lat / stations.length, sum.lng / stations.length] as [number, number]
  }, [stations])

  if (stations.length === 0) {
    return (
      <div className="flex h-[500px] items-center justify-center rounded-xl border bg-muted/30 text-sm text-muted-foreground border-dashed">
        ไม่มีสถานีสำหรับแสดงบนแผนที่
      </div>
    )
  }

  return (
    <div className={`relative group ${className || ""}`}>
      {/* Floating Overlays */}
      <div className="absolute top-4 left-4 z-[1000] space-y-2 pointer-events-none">
        <Card className="p-3 bg-white/90 backdrop-blur shadow-xl border-white/50 pointer-events-auto">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">System Monitoring</span>
          </div>
          <div className="flex flex-col gap-1.5">
             <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <span className="h-3 w-3 rounded-full bg-green-500 border border-white shadow-sm" />
                สถานีพร้อมทำงาน ({stations.filter(s => s.status === 'online').length})
             </div>
             <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <span className="h-3 w-3 rounded-full bg-red-500 border border-white shadow-sm" />
                สถานีออฟไลน์ ({stations.filter(s => s.status !== 'online').length})
             </div>
          </div>
        </Card>
      </div>

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

      {/* Leaflet Map (Styled) */}
      <div className="h-[500px] w-full rounded-xl overflow-hidden shadow-inner border relative bg-slate-100">
        <MapContainer
          center={center}
          zoom={9}
          className="h-full w-full z-0"
          scrollWheelZoom
        >
          {mapType === "standard" ? (
            <TileLayer
              attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
          ) : (
            <TileLayer
              attribution='&copy; Google'
              url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
            />
          )}

          <FitBounds stations={stations} />

          {stations.map((s) => (
            <LeafletMarker key={s.id} station={s} onClick={onMarkerClick} />
          ))}
        </MapContainer>
      </div>

      <style jsx global>{`
        .modern-popup .leaflet-popup-content-wrapper {
          border-radius: 12px;
          padding: 0;
          overflow: hidden;
          box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
        }
        .modern-popup .leaflet-popup-content {
          margin: 12px;
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
