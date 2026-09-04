"use client"

/**
 * Station map on Leaflet + OpenStreetMap.
 *
 * Drop-in replacement for ModernMap (same props), on free tiles that need no
 * API key and no Google Cloud billing. Feature parity is deliberate: the pair
 * grouping, the four status colours, the numbered pin with its MC badge, the
 * live-data popup, the satellite toggle and the gesture lock all behave the
 * way the Google version did, so the page around it did not have to change.
 */

import { useEffect, useMemo, useState } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import type { Station, LiveData } from "@/types"
import { getLiveData } from "@/services/sensorService"
import { formatThaiDateTimeSeconds } from "@/utils/dateUtils"
import {
  Loader2, Navigation2, Map as MapIcon, Layers, ChevronRight, Lock, LockOpen,
  Thermometer, Droplets, CloudRain, Wind,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { StationPopup, type StationPopupData, type Metric } from "@/components/map/StationPopup"

// --- TILE SOURCES (both free, neither needs a key) ---

const TILES = {
  roadmap: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
  hybrid: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics",
    maxZoom: 18,
  },
} as const

type MapType = keyof typeof TILES

// --- TYPES ---

type StationGroup = {
  main?: Station   // wimarcN  — weather
  client?: Station // wimarcNc — soil
  id: string
}

type PairStatus = "both-online" | "both-offline" | "main-only" | "client-only"

const PIN_WIDTH = 32
const PIN_HEIGHT = 42

const PIN_COLORS: Record<PairStatus, string> = {
  "both-online": "#16a34a",
  "both-offline": "#dc2626",
  "main-only": "#ca8a04",
  "client-only": "#ea580c",
}

// --- UTILS ---

const fmtStationId = (id: string) => {
  const m = id.match(/^wimarc(\d+)(c?)$/i)
  if (!m) return id
  return `Wimarc${String(m[1]).padStart(2, "0")}${m[2]}`
}

function groupStations(stations: Station[]): StationGroup[] {
  const weatherStations = stations.filter((s) => s.type === "weather")
  const soilMap = new Map(stations.filter((s) => s.type !== "weather").map((s) => [s.id, s]))
  const pairedIds = new Set<string>()
  const groups: StationGroup[] = []

  for (const main of weatherStations) {
    const client = soilMap.get(main.id + "c")
    if (client) pairedIds.add(client.id)
    groups.push({ main, client, id: main.id })
  }

  // Soil stations with no matching weather station still get their own pin.
  for (const [id, soil] of soilMap) {
    if (!pairedIds.has(id)) groups.push({ client: soil, id })
  }

  const wimarcNum = (id: string) => {
    const m = id.match(/^wimarc(\d+)/i)
    return m ? parseInt(m[1], 10) : 9999
  }
  return groups.sort((a, b) => wimarcNum(a.id) - wimarcNum(b.id))
}

/**
 * Pin markup for L.divIcon.
 *
 * Leaflet takes an HTML string rather than a React node here, so the SVG is
 * built by hand instead of being rendered through react-dom/server — which
 * would drag the whole server renderer into the browser bundle for one icon.
 */
function pinHtml(color: string, isOnline: boolean, hasBoth: boolean, label: string): string {
  const badge = hasBoth
    ? `<circle cx="26" cy="7" r="4.5" fill="white" stroke="${color}" stroke-width="1.2" />
       <text x="26" y="9.5" text-anchor="middle" font-size="4.5" font-weight="900" font-family="monospace" fill="${color}">MC</text>`
    : ""
  const ring = isOnline ? `<div class="pin-ring" style="border-color:${color}"></div>` : ""
  return `
    <div class="pin-wrapper ${isOnline ? "pulse" : ""}">
      <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 0C7.16344 0 0 7.16344 0 16C0 28 16 42 16 42C16 42 32 28 32 16C32 7.16344 24.8366 0 16 0Z" fill="${color}" stroke="white" stroke-width="1" />
        <circle cx="16" cy="16" r="7" fill="white" fill-opacity="0.85" />
        <text x="16" y="${label.length > 1 ? "19" : "20"}" text-anchor="middle" font-size="${label.length > 1 ? "7.5" : "9"}" font-weight="800" font-family="monospace" fill="${color}">${label}</text>
        ${badge}
      </svg>
      ${ring}
    </div>`
}

// --- FIT BOUNDS ---

function FitBounds({ groups }: { groups: StationGroup[] }) {
  const map = useMap()
  useEffect(() => {
    if (groups.length === 0) return
    const points = groups.map((g) => {
      const s = g.main ?? g.client!
      return [s.latitude, s.longitude] as [number, number]
    })
    // maxZoom keeps a lone station from zooming to street level.
    map.fitBounds(L.latLngBounds(points), { padding: [60, 60], maxZoom: 14 })
  }, [groups, map])
  return null
}

/** Applies the lock without remounting the map, which would reset the view. */
function GestureLock({ locked }: { locked: boolean }) {
  const map = useMap()
  useEffect(() => {
    if (locked) map.scrollWheelZoom.disable()
    else map.scrollWheelZoom.enable()
  }, [locked, map])
  return null
}

// --- MARKER ---

function MergedMarker({
  group,
  onClick,
  permittedIds,
}: {
  group: StationGroup
  onClick?: (id: string) => void
  permittedIds?: Set<string>
}) {
  const map = useMap()
  const [mainLive, setMainLive] = useState<LiveData | null>(null)
  const [clientLive, setClientLive] = useState<LiveData | null>(null)
  const [loading, setLoading] = useState(false)

  const primary = group.main ?? group.client!
  const hasBoth = !!(group.main && group.client)

  // A fresh ping beats the stored status; fall back to it before any load.
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

  const pairStatus: PairStatus = useMemo(() => {
    if (!group.client) return mainOnline ? "both-online" : "both-offline"
    if (!group.main) return clientOnline ? "both-online" : "both-offline"
    if (mainOnline && clientOnline) return "both-online"
    if (!mainOnline && !clientOnline) return "both-offline"
    return mainOnline ? "main-only" : "client-only"
  }, [mainOnline, clientOnline, group.main, group.client])

  const pinLabel = useMemo(() => {
    const m = group.id.match(/^wimarc(\d+)/)
    return m ? m[1] : group.id
  }, [group.id])

  const icon = useMemo(
    () =>
      L.divIcon({
        html: pinHtml(PIN_COLORS[pairStatus], pairStatus !== "both-offline", hasBoth, pinLabel),
        className: "wimarc-pin", // blanks Leaflet's own divIcon chrome
        iconSize: [PIN_WIDTH, PIN_HEIGHT],
        iconAnchor: [PIN_WIDTH / 2, PIN_HEIGHT], // tip of the pin sits on the coordinate
        popupAnchor: [0, -PIN_HEIGHT],
      }),
    [pairStatus, hasBoth, pinLabel],
  )

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

  /**
   * Put the popup in the middle of the map, not the pin.
   *
   * Leaflet's own autoPan only nudges the bubble just far enough to be
   * visible, which leaves it clinging to an edge. The bubble hangs above its
   * anchor, so centring means shifting the view up by half the bubble plus
   * the pin height — measured after open, since the content decides the
   * height.
   */
  const centerOnPopup = (e: L.PopupEvent) => {
    const el = e.popup.getElement()
    const latlng = e.popup.getLatLng()
    if (!latlng) return
    const height = el?.offsetHeight ?? 320
    const zoom = map.getZoom()
    const point = map.project(latlng, zoom)
    point.y -= height / 2 + PIN_HEIGHT / 2
    map.panTo(map.unproject(point, zoom), { animate: true, duration: 0.4 })
  }

  const googleNavUrl = `https://www.google.com/maps/dir/?api=1&destination=${primary.latitude},${primary.longitude}`
  const isPermitted =
    !permittedIds || permittedIds.has(primary.id) || permittedIds.has(primary.id.replace(/c$/, ""))

  const popupData: StationPopupData | null = useMemo(() => {
    if (!mainLive && !clientLive) return null
    const f = (n: number | null | undefined, d = 1) => (n != null ? n.toFixed(d) : "—")
    const weather: Metric[] = [
      { label: "อุณหภูมิ", value: f(mainLive?.airTemperature), unit: "°C", tone: "temp", icon: Thermometer },
      { label: "ความชื้น", value: f(mainLive?.relativeHumidity), unit: "%", tone: "humid", icon: Droplets },
      { label: "ฝน", value: f(mainLive?.rainfall), unit: "mm", tone: "rain", icon: CloudRain },
      { label: "ลม", value: f(mainLive?.windSpeed), unit: "m/s", tone: "wind", icon: Wind },
    ]
    const soil: Metric[] = [
      { label: "ชื้น 15cm", value: f(clientLive?.soilMoisture1), unit: "%", tone: "soil", icon: Droplets },
      { label: "อุณหภูมิ 15cm", value: f(clientLive?.soilTemperature1), unit: "°C", tone: "soil", icon: Thermometer },
      { label: "ชื้น 30cm", value: f(clientLive?.soilMoisture2), unit: "%", tone: "soil", icon: Droplets },
      { label: "อุณหภูมิ 30cm", value: f(clientLive?.soilTemperature2), unit: "°C", tone: "soil", icon: Thermometer },
    ]
    return {
      name: primary.name.split("—")[1]?.trim() ?? primary.name,
      place: primary.area,
      kind: hasBoth ? "อากาศ+ดิน" : group.main ? "อากาศ" : "ดิน",
      main: mainOnline ? "online" : "offline",
      client: clientOnline ? "online" : "offline",
      vpd: mainLive?.vpd ?? 0,
      weather,
      soil,
      photoUrl: isPermitted && mainLive?.imageUrl ? mainLive.imageUrl : undefined,
      time: mainLive?.imageTime ? formatThaiDateTimeSeconds(mainLive.imageTime) : "",
    }
  }, [mainLive, clientLive, mainOnline, clientOnline, hasBoth, primary, group, isPermitted])

  return (
    <Marker
      position={[primary.latitude, primary.longitude]}
      icon={icon}
      title={fmtStationId(group.id)}
      eventHandlers={{ click: handleOpen, popupopen: centerOnPopup }}
    >
      {/* autoPan off: centerOnPopup does the panning, and the two fight. */}
      <Popup autoPan={false} maxWidth={338} minWidth={260} className="wimarc-popup">
        {loading && !popupData ? (
          <div className="flex items-center justify-center gap-2 py-8 px-6 text-slate-400 text-xs">
            <Loader2 className="h-4 w-4 animate-spin" />
            กำลังโหลด...
          </div>
        ) : popupData ? (
          <div className="flex flex-col overflow-hidden rounded-xl font-sans">
            <div className="wimarc-popup-scroll">
              <StationPopup station={popupData} />
            </div>
            <div className={`shrink-0 gap-1.5 p-2 ${isPermitted ? "grid grid-cols-2" : "flex"}`}>
              {isPermitted && (
                <button
                  className="h-8 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
                  onClick={() => {
                    window.location.href = `/dashboard?station=${primary.id}`
                  }}
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
          </div>
        ) : (
          <div className="py-6 px-4 text-center text-xs text-slate-400">ไม่มีข้อมูลล่าสุด</div>
        )}
      </Popup>
    </Marker>
  )
}

// --- MAIN COMPONENT ---

interface StationMapProps {
  stations: Station[]
  onMarkerClick?: (stationId: string) => void
  permittedIds?: Set<string>
  className?: string
}

export default function StationMapLeaflet({
  stations,
  onMarkerClick,
  permittedIds,
  className,
}: StationMapProps) {
  const [mapType, setMapType] = useState<MapType>("roadmap")
  const [locked, setLocked] = useState(true)

  const groups = useMemo(() => groupStations(stations), [stations])

  const center = useMemo((): [number, number] => {
    if (groups.length === 0) return [13.736717, 100.523186]
    const sum = groups.reduce(
      (acc, g) => {
        const s = g.main ?? g.client!
        return { lat: acc.lat + s.latitude, lng: acc.lng + s.longitude }
      },
      { lat: 0, lng: 0 },
    )
    return [sum.lat / groups.length, sum.lng / groups.length]
  }, [groups])

  if (groups.length === 0) {
    return (
      <div className="flex h-[500px] items-center justify-center rounded-xl border bg-muted/30 text-sm text-muted-foreground border-dashed">
        ไม่มีสถานีสำหรับแสดงบนแผนที่
      </div>
    )
  }

  const tiles = TILES[mapType]

  return (
    <div className={`relative group h-full ${className || ""}`}>
      {/* Map controls */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2 pointer-events-auto">
        <Button
          size="icon"
          variant="secondary"
          className="bg-white/90 backdrop-blur shadow-lg border-white/50 h-10 w-10 hover:bg-white"
          onClick={() => setMapType(mapType === "roadmap" ? "hybrid" : "roadmap")}
          title={mapType === "roadmap" ? "สลับเป็นภาพดาวเทียม" : "สลับเป็นแผนที่ถนน"}
        >
          {mapType === "roadmap" ? (
            <Layers className="h-5 w-5 text-slate-700" />
          ) : (
            <MapIcon className="h-5 w-5 text-slate-700" />
          )}
        </Button>
        <Button
          size="icon"
          variant="secondary"
          className={`backdrop-blur shadow-lg h-10 w-10 transition-colors ${
            locked
              ? "bg-amber-50/90 border-amber-200 hover:bg-amber-100 text-amber-600"
              : "bg-green-50/90 border-green-200 hover:bg-green-100 text-green-600"
          }`}
          onClick={() => setLocked((l) => !l)}
          title={locked ? "แผนที่ล็อกอยู่ — แตะเพื่อปลดล็อก" : "ปลดล็อกแล้ว — แตะเพื่อล็อก"}
        >
          {locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
        </Button>
      </div>

      <div className="h-full min-h-[500px] w-full rounded-xl overflow-hidden shadow-inner border relative bg-slate-100">
        <MapContainer
          center={center}
          zoom={9}
          scrollWheelZoom={false}
          className="h-full w-full min-h-[500px]"
        >
          {/* key forces the layer to swap rather than mutate in place */}
          <TileLayer
            key={mapType}
            url={tiles.url}
            attribution={tiles.attribution}
            maxZoom={tiles.maxZoom}
          />
          <FitBounds groups={groups} />
          <GestureLock locked={locked} />
          {groups.map((g) => (
            <MergedMarker
              key={g.id}
              group={g}
              onClick={onMarkerClick}
              permittedIds={permittedIds}
            />
          ))}
        </MapContainer>
      </div>

      <style jsx global>{`
        /* Leaflet gives divIcon a white box and border by default. */
        .wimarc-pin {
          background: transparent;
          border: none;
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
        /* Strip the default popup chrome so StationPopup fills the bubble. */
        .wimarc-popup .leaflet-popup-content-wrapper {
          border-radius: 12px;
          padding: 0;
          overflow: hidden;
          box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
        }
        .wimarc-popup .leaflet-popup-content {
          margin: 0;
          width: auto !important;
          /* On a narrow phone the fixed 338px would run off both edges. */
          max-width: min(338px, calc(100vw - 32px));
        }
        /*
         * The card is ~460px tall — nearly the whole map — so the readings
         * scroll while the buttons below stay put. Capped against the
         * viewport too, so a short window cannot push it off-screen.
         */
        .wimarc-popup-scroll {
          overflow-y: auto;
          min-height: 0;
          max-height: min(52vh, 340px);
          /* Stop a scroll that hits the end from zooming the map underneath. */
          overscroll-behavior: contain;
        }
        .wimarc-popup .leaflet-popup-close-button {
          top: 8px;
          right: 8px;
          width: 26px;
          height: 26px;
          display: grid;
          place-items: center;
          border-radius: 6px;
          background: rgb(255 255 255 / 0.85);
          backdrop-filter: blur(4px);
          color: #64748b;
          font-size: 17px;
          font-weight: 700;
          padding: 0;
        }
        .wimarc-popup .leaflet-popup-close-button:hover {
          background: #f1f5f9;
          color: #334155;
        }
      `}</style>
    </div>
  )
}
