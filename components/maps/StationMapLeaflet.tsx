"use client"

import { useEffect, useMemo, useState } from "react"
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import type { Station, LiveData } from "@/types"
import { getLiveData } from "@/services/sensorService"
import { formatThaiDateTimeSeconds } from "@/utils/dateUtils"
import { Loader2 } from "lucide-react"

interface StationMapProps {
  stations: Station[]
  selectedStationId?: string | null
  onMarkerClick?: (stationId: string) => void
}

function FitBounds({ stations }: { stations: Station[] }) {
  const map = useMap()
  useEffect(() => {
    if (stations.length === 0) return
    const bounds = stations.map((s) => [s.latitude, s.longitude]) as [number, number][]
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 })
  }, [stations, map])
  return null
}

function offsetForClient(lat: number, lng: number): [number, number] {
  // Tiny offset so client and main markers at same coords don't overlap
  return [lat + 0.00035, lng + 0.00035]
}

function MarkerWithPopup({
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

  // Determine "fresh" state from last_ping age (<5min = online)
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
      <Popup minWidth={240} maxWidth={300}>
        <div className="space-y-2 text-xs">
          <div className="border-b pb-1.5">
            <div className="font-mono text-[9px] text-gray-500 uppercase">{station.id}</div>
            <div className="font-bold text-sm leading-tight">{station.name}</div>
            <div className="text-[10px] text-gray-600 mt-0.5">
              {isClient ? "สถานีดิน" : "สถานีอากาศ"} • {station.area}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="font-bold" style={{ color }}>
              {isOnline ? "ออนไลน์" : "ออฟไลน์"}
            </span>
            {live?.lastPing && (
              <span className="text-[10px] text-gray-500 font-mono">
                {formatThaiDateTimeSeconds(live.lastPing)}
              </span>
            )}
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-gray-500 text-[10px]">
              <Loader2 className="h-3 w-3 animate-spin" /> กำลังโหลด...
            </div>
          )}

          {live && !isClient && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] pt-1 border-t">
              {live.airTemperature != null && (
                <div>🌡 {live.airTemperature.toFixed(1)} °C</div>
              )}
              {live.relativeHumidity != null && (
                <div>💧 {live.relativeHumidity.toFixed(1)} %</div>
              )}
              {live.lightIntensity != null && (
                <div>☀ {live.lightIntensity.toFixed(2)} klux</div>
              )}
              {live.windSpeed != null && (
                <div>💨 {live.windSpeed.toFixed(1)} m/s</div>
              )}
              {live.rainfall != null && (
                <div>🌧 {live.rainfall.toFixed(1)} mm</div>
              )}
              {live.vpd != null && (
                <div>VPD {live.vpd.toFixed(2)} kPa</div>
              )}
            </div>
          )}

          {live && isClient && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] pt-1 border-t">
              {live.soilMoisture1 != null && (
                <div>💧15cm {live.soilMoisture1.toFixed(1)}%</div>
              )}
              {live.soilTemperature1 != null && (
                <div>🌡15cm {live.soilTemperature1.toFixed(1)}°C</div>
              )}
              {live.soilMoisture2 != null && (
                <div>💧30cm {live.soilMoisture2.toFixed(1)}%</div>
              )}
              {live.soilTemperature2 != null && (
                <div>🌡30cm {live.soilTemperature2.toFixed(1)}°C</div>
              )}
            </div>
          )}

          {live?.imageUrl && (
            <img
              src={`${live.imageUrl}?t=${live.imageTime?.getTime() ?? 0}`}
              alt={station.name}
              className="w-full h-24 object-cover rounded mt-1 border"
            />
          )}

          <a
            href={`/dashboard?station=${station.id}`}
            className="block text-center bg-teal-600 text-white text-[11px] font-bold py-1 rounded hover:bg-teal-700"
          >
            เปิดแดชบอร์ด →
          </a>
        </div>
      </Popup>
    </CircleMarker>
  )
}

export default function StationMapLeaflet({ stations, onMarkerClick }: StationMapProps) {
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
      <div className="flex h-[500px] items-center justify-center rounded-lg border bg-muted text-sm text-muted-foreground">
        ไม่มีสถานีสำหรับแสดงบนแผนที่
      </div>
    )
  }

  return (
    <MapContainer
      center={center}
      zoom={9}
      className="h-[500px] w-full rounded-lg"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds stations={stations} />
      {stations.map((s) => (
        <MarkerWithPopup key={s.id} station={s} onClick={onMarkerClick} />
      ))}
    </MapContainer>
  )
}
