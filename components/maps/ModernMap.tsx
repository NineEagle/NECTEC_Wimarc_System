"use client"

import { useEffect, useMemo, useState } from "react"
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  InfoWindow,
  useMap,
  useAdvancedMarkerRef,
} from "@vis.gl/react-google-maps"
import type { Station, LiveData } from "@/types"
import { getLiveData } from "@/services/sensorService"
import { formatThaiDateTimeSeconds } from "@/utils/dateUtils"
import { Loader2, Navigation2, Map as MapIcon, Layers, ChevronRight, Lock, LockOpen, Thermometer, Droplets, CloudRain, Wind } from "lucide-react"
import { VpdInfoButton } from "@/components/ui/VpdInfoButton"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { StationPopup, type StationPopupData, type Metric } from "@/components/map/StationPopup"

// --- CONFIG ---

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || "DEMO_MAP_ID"

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

// --- PIN (HTML content for AdvancedMarker) ---

function PinSvg({ color, isOnline, hasBoth, label }: { color: string; isOnline: boolean; hasBoth: boolean; label: string }) {
  return (
    <div className={`pin-wrapper ${isOnline ? "pulse" : ""}`}>
      <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 0C7.16344 0 0 7.16344 0 16C0 28 16 42 16 42C16 42 32 28 32 16C32 7.16344 24.8366 0 16 0Z" fill={color} stroke="white" strokeWidth="1" />
        <circle cx="16" cy="16" r="7" fill="white" fillOpacity="0.85" />
        <text x="16" y={label.length > 1 ? "19" : "20"} textAnchor="middle" fontSize={label.length > 1 ? "7.5" : "9"} fontWeight="800" fontFamily="monospace" fill={color}>{label}</text>
        {hasBoth && (
          <>
            <circle cx="26" cy="7" r="4.5" fill="white" stroke={color} strokeWidth="1.2" />
            <text x="26" y="9.5" textAnchor="middle" fontSize="4.5" fontWeight="900" fontFamily="monospace" fill={color}>MC</text>
          </>
        )}
      </svg>
      {isOnline && <div className="pin-ring" style={{ borderColor: color }} />}
    </div>
  )
}

// --- FIT BOUNDS ---

function FitBounds({ groups }: { groups: StationGroup[] }) {
  const map = useMap()
  useEffect(() => {
    if (!map || groups.length === 0) return
    const bounds = new google.maps.LatLngBounds()
    groups.forEach(g => {
      const s = g.main ?? g.client!
      bounds.extend({ lat: s.latitude, lng: s.longitude })
    })
    map.fitBounds(bounds, 60)
    // Cap zoom so a single station doesn't zoom in too far
    const listener = google.maps.event.addListenerOnce(map, "idle", () => {
      if ((map.getZoom() ?? 0) > 14) map.setZoom(14)
    })
    return () => google.maps.event.removeListener(listener)
  }, [map, groups])
  return null
}

// --- MERGED MARKER ---

function MergedMarker({
  group,
  selected,
  onSelect,
  onClick,
  permittedIds,
}: {
  group: StationGroup
  selected: boolean
  onSelect: (id: string | null) => void
  onClick?: (id: string) => void
  permittedIds?: Set<string>
}) {
  const [markerRef, marker] = useAdvancedMarkerRef()
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

  const handleOpen = async () => {
    onSelect(group.id)
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

  const isPermitted = !permittedIds || permittedIds.has(primary.id) || permittedIds.has(primary.id.replace(/c$/, ""))

  const popupData: StationPopupData | null = useMemo(() => {
    if (!mainLive && !clientLive) return null
    const f = (n: number | null | undefined, d = 1) => n != null ? n.toFixed(d) : "—"
    const weather: Metric[] = [
      { label: "อุณหภูมิ", value: f(mainLive?.airTemperature),  unit: "°C",  tone: "temp",  icon: Thermometer },
      { label: "ความชื้น", value: f(mainLive?.relativeHumidity), unit: "%",   tone: "humid", icon: Droplets   },
      { label: "ฝน",       value: f(mainLive?.rainfall),         unit: "mm",  tone: "rain",  icon: CloudRain  },
      { label: "ลม",       value: f(mainLive?.windSpeed),        unit: "m/s", tone: "wind",  icon: Wind       },
    ]
    const soil: Metric[] = [
      { label: "ชื้น 15cm",      value: f(clientLive?.soilMoisture1),    unit: "%",  tone: "soil", icon: Droplets    },
      { label: "อุณหภูมิ 15cm",  value: f(clientLive?.soilTemperature1), unit: "°C", tone: "soil", icon: Thermometer },
      { label: "ชื้น 30cm",      value: f(clientLive?.soilMoisture2),    unit: "%",  tone: "soil", icon: Droplets    },
      { label: "อุณหภูมิ 30cm",  value: f(clientLive?.soilTemperature2), unit: "°C", tone: "soil", icon: Thermometer },
    ]
    return {
      name:     primary.name.split("—")[1]?.trim() ?? primary.name,
      place:    primary.area,
      kind:     hasBoth ? "อากาศ+ดิน" : group.main ? "อากาศ" : "ดิน",
      main:     mainOnline ? "online" : "offline",
      client:   clientOnline ? "online" : "offline",
      vpd:      mainLive?.vpd ?? 0,
      weather,
      soil,
      photoUrl: isPermitted && mainLive?.imageUrl ? mainLive.imageUrl : undefined,
      time:     mainLive?.imageTime ? formatThaiDateTimeSeconds(mainLive.imageTime) : "",
    }
  }, [mainLive, clientLive, mainOnline, clientOnline, hasBoth, primary, group, isPermitted])

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: primary.latitude, lng: primary.longitude }}
        onClick={handleOpen}
        title={fmtStationId(group.id)}
      >
        <PinSvg color={color} isOnline={isOnline} hasBoth={hasBoth} label={pinLabel} />
      </AdvancedMarker>

      {selected && (
        <InfoWindow anchor={marker} onCloseClick={() => onSelect(null)} maxWidth={320} headerDisabled>
          <div className="relative overflow-hidden rounded-xl font-sans">
            <button
              type="button"
              onClick={() => onSelect(null)}
              aria-label="ปิด"
              className="absolute right-2 top-2 z-10 grid h-[26px] w-[26px] place-items-center rounded-md bg-white/90 text-slate-500 shadow backdrop-blur transition hover:bg-slate-100 hover:text-slate-700"
            >
              ✕
            </button>
            {loading && !popupData ? (
              <div className="flex items-center justify-center gap-2 py-8 px-6 text-slate-400 text-xs min-w-[200px]">
                <Loader2 className="h-4 w-4 animate-spin" />กำลังโหลด...
              </div>
            ) : popupData ? (
              <>
                <StationPopup station={popupData} />
                <div className={`gap-1.5 p-2 ${isPermitted ? "grid grid-cols-2" : "flex"}`}>
                  {isPermitted && (
                    <button
                      className="h-8 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
                      onClick={() => { window.location.href = `/dashboard?station=${primary.id}` }}
                    >
                      แดชบอร์ด <ChevronRight className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    className="h-8 w-full rounded-md border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
                    onClick={() => window.open(googleNavUrl, "_blank")}
                  >
                    <Navigation2 className="h-3 w-3" /> นำทาง
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </InfoWindow>
      )}
    </>
  )
}

// --- MAIN COMPONENT ---

interface ModernMapProps {
  stations: Station[]
  onMarkerClick?: (stationId: string) => void
  permittedIds?: Set<string>
  className?: string
}

export default function ModernMap({ stations, onMarkerClick, permittedIds, className }: ModernMapProps) {
  const [mapType, setMapType] = useState<"roadmap" | "hybrid">("roadmap")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [locked, setLocked] = useState(true)

  const groups = useMemo(() => groupStations(stations), [stations])

  const center = useMemo(() => {
    if (groups.length === 0) return { lat: 13.736717, lng: 100.523186 }
    const sum = groups.reduce((acc, g) => {
      const s = g.main ?? g.client!
      return { lat: acc.lat + s.latitude, lng: acc.lng + s.longitude }
    }, { lat: 0, lng: 0 })
    return { lat: sum.lat / groups.length, lng: sum.lng / groups.length }
  }, [groups])

  if (groups.length === 0) {
    return (
      <div className="flex h-[500px] items-center justify-center rounded-xl border bg-muted/30 text-sm text-muted-foreground border-dashed">
        ไม่มีสถานีสำหรับแสดงบนแผนที่
      </div>
    )
  }

  if (!API_KEY) {
    return (
      <div className="flex h-[500px] items-center justify-center rounded-xl border bg-muted/30 text-sm text-muted-foreground border-dashed">
        ยังไม่ได้ตั้งค่า Google Maps API key
      </div>
    )
  }

  return (
    <div className={`relative group h-full ${className || ""}`}>

      {/* Map controls */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2 pointer-events-auto">
        <Button
          size="icon"
          variant="secondary"
          className="bg-white/90 backdrop-blur shadow-lg border-white/50 h-10 w-10 hover:bg-white"
          onClick={() => setMapType(mapType === "roadmap" ? "hybrid" : "roadmap")}
          title="สลับโหมดแผนที่"
        >
          {mapType === "roadmap" ? <Layers className="h-5 w-5 text-slate-700" /> : <MapIcon className="h-5 w-5 text-slate-700" />}
        </Button>
        <Button
          size="icon"
          variant="secondary"
          className={`backdrop-blur shadow-lg h-10 w-10 transition-colors ${
            locked
              ? "bg-amber-50/90 border-amber-200 hover:bg-amber-100 text-amber-600"
              : "bg-green-50/90 border-green-200 hover:bg-green-100 text-green-600"
          }`}
          onClick={() => setLocked(l => !l)}
          title={locked ? "แผนที่ล็อกอยู่ — แตะเพื่อปลดล็อก" : "ปลดล็อกแล้ว — แตะเพื่อล็อก"}
        >
          {locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
        </Button>
      </div>

      <div className="h-full min-h-[500px] w-full rounded-xl overflow-hidden shadow-inner border relative bg-slate-100">
        <APIProvider apiKey={API_KEY}>
          <GoogleMap
            defaultCenter={center}
            defaultZoom={9}
            mapId={MAP_ID}
            mapTypeId={mapType}
            gestureHandling={locked ? "cooperative" : "greedy"}
            disableDefaultUI={false}
            mapTypeControl={false}
            streetViewControl={false}
            fullscreenControl={false}
            className="h-full w-full"
          >
            <FitBounds groups={groups} />
            {groups.map(g => (
              <MergedMarker
                key={g.id}
                group={g}
                selected={selectedId === g.id}
                onSelect={setSelectedId}
                onClick={onMarkerClick}
                permittedIds={permittedIds}
              />
            ))}
          </GoogleMap>
        </APIProvider>
      </div>

      <style jsx global>{`
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
        .gm-style .gm-style-iw-c {
          border-radius: 12px;
          padding: 0 !important;
          box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
        }
        .gm-style .gm-style-iw-d {
          overflow: auto !important;
        }
      `}</style>
    </div>
  )
}
