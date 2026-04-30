"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet"
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

const MAP_STYLES = {
  silver: [
    { "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }] },
    { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
    { "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
    { "elementType": "labels.text.stroke", "stylers": [{ "color": "#f5f5f5" }] },
    { "featureType": "administrative.land_parcel", "elementType": "labels.text.fill", "stylers": [{ "color": "#bdbdbd" }] },
    { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
    { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
    { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#e5e5e5" }] },
    { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
    { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
    { "featureType": "road.arterial", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
    { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#dadada" }] },
    { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
    { "featureType": "road.local", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
    { "featureType": "transit.line", "elementType": "geometry", "stylers": [{ "color": "#e5e5e5" }] },
    { "featureType": "transit.station", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#c9c9c9" }] },
    { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] }
  ]
}

// --- UTILS ---

function offsetForClient(lat: number, lng: number): [number, number] {
  return [lat + 0.00035, lng + 0.00035]
}

// --- LEAFLET COMPONENTS ---

function FitBounds({ stations }: { stations: Station[] }) {
  const map = useMap()
  useEffect(() => {
    if (stations.length === 0) return
    const bounds = stations.map((s) => [s.latitude, s.longitude]) as [number, number][]
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 })
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
  const fill = isClient ? "#fbbf24" : color

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
    <CircleMarker
      center={[lat, lng]}
      radius={isClient ? 7 : 9}
      pathOptions={{
        color,
        fillColor: fill,
        fillOpacity: 0.85,
        weight: 2,
      }}
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
    </CircleMarker>
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
      `}</style>
    </div>
  )
}
