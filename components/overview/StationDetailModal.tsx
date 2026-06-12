"use client"

import { useEffect } from "react"
import { X, MapPin, Battery, AlertTriangle, CheckCircle2, ArrowDown, ArrowUp, Wind, Leaf, ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { StationCameraThumb } from "./StationCameraThumb"
import type { OverviewStation, SensorDef } from "./overviewTypes"
import { MAIN_SENSORS, CLIENT_SENSORS } from "./overviewTypes"
import { SENSOR_ICON, SENSOR_STYLE, STATUS_META, getVPDStatus, readSensor, formatValue, batteryColor } from "./overviewUtils"
import { applyUnitConversion } from "@/components/config/configUtils"
import type { SensorKey } from "@/components/config/configTypes"

const SENSOR_TO_CONFIG: Partial<Record<string, SensorKey>> = {
  airTemperature:      "airTemp",
  relativeHumidity:    "humidity",
  lightIntensity:      "light",
  rainfall:            "rain",
  windSpeed:           "windSpeed",
  atmosphericPressure: "pressure",
  soilMoisture1:       "soilMoist1",
  soilMoisture2:       "soilMoist2",
  soilTemperature1:    "soilTemp1",
  soilTemperature2:    "soilTemp2",
}

function SensorTile({ station, def, unitMap, off, vpdEnabled = true, vpdLow = 0.8, vpdHigh = 1.6 }: {
  station: OverviewStation; def: SensorDef; unitMap?: Record<string, string>; off: boolean
  vpdEnabled?: boolean; vpdLow?: number; vpdHigh?: number
}) {
  const style = SENSOR_STYLE[def.type]
  const Icon = SENSOR_ICON[def.icon]
  const raw = readSensor(station, def)
  const isDir = def.key === "windDirection"
  const vpdStatus = vpdEnabled && def.key === "vpd" && !off ? getVPDStatus(raw, vpdLow, vpdHigh) : null
  const unit = unitMap?.[def.key as string] ?? def.unit
  const sKey = SENSOR_TO_CONFIG[def.key as string]
  const converted = raw != null && sKey ? applyUnitConversion(sKey, raw, unit) : raw

  return (
    <div className={`rounded-xl border ${style.border} bg-card p-3`}>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[0.5rem] font-medium text-muted-foreground">{def.label}</span>
        {Icon && (
          <Icon
            className={`h-3.5 w-3.5 ${style.fg} opacity-70`}
            style={isDir && raw != null ? { transform: `rotate(${raw}deg)`, transition: "transform .4s" } : undefined}
          />
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-lg font-bold tabular-nums leading-none ${off ? "text-muted-foreground" : style.fg}`}>
          {off ? "—" : formatValue(def.key as string, converted, unit)}
        </span>
        <span className="text-[0.5rem] text-muted-foreground">{isDir && raw != null ? `${raw}°` : unit}</span>
        {vpdStatus && (
          <Badge className={`ml-auto h-5 gap-1 border-none px-1.5 text-[0.5rem] text-white ${
            vpdStatus === "เหมาะสม" ? "bg-green-600" : vpdStatus === "ต่ำ" ? "bg-blue-600" : "bg-red-600"
          }`}>
            {vpdStatus === "เหมาะสม" && <CheckCircle2 className="h-3 w-3" />}
            {vpdStatus === "ต่ำ" && <ArrowDown className="h-3 w-3" />}
            {vpdStatus === "สูง" && <ArrowUp className="h-3 w-3" />}
            {vpdStatus}
          </Badge>
        )}
      </div>
    </div>
  )
}

function Unit({ station, variant, list, unitMap, vpdEnabled, vpdLow, vpdHigh }: {
  station: OverviewStation; variant: "main" | "client"; list: SensorDef[]; unitMap?: Record<string, string>
  vpdEnabled?: boolean; vpdLow?: number; vpdHigh?: number
}) {
  const isMain = variant === "main"
  const off = isMain ? station.mainStatus === "offline" : station.clientStatus === "offline"
  return (
    <div className={off ? "opacity-60" : ""}>
      <div className="mb-3 flex items-center gap-2">
        <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${
          isMain ? "bg-sensor-humid-bg text-sensor-humid-fg" : "bg-sensor-soil-bg text-sensor-soil-fg"
        }`}>
          {isMain ? <Wind className="h-3.5 w-3.5" /> : <Leaf className="h-3.5 w-3.5" />}
        </span>
        <span className="text-sm font-bold">{isMain ? "สถานีอากาศ" : "สถานีดิน"}</span>
        <span className="font-mono text-[0.5rem] text-muted-foreground">{isMain ? "Main" : "Client"}</span>
        <span className={`ml-1 text-[0.5rem] font-semibold ${off ? "text-red-500" : "text-green-600"}`}>
          {off ? "Offline" : "Online"}
        </span>
      </div>
      <div className="grid grid-cols-[minmax(0,0.92fr)_minmax(0,1.4fr)] gap-3.5 max-sm:grid-cols-1">
        <StationCameraThumb station={station} variant={variant} aspect="aspect-[4/3]" rounded="rounded-xl" />
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {list.map(def => (
            <SensorTile key={`${variant}-${def.key}`} station={station} def={def} unitMap={unitMap} off={off} vpdEnabled={vpdEnabled} vpdLow={vpdLow} vpdHigh={vpdHigh} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function StationDetailModal({ station, onClose, unitMap, onGoToDashboard, vpdEnabled = true, vpdLow = 0.8, vpdHigh = 1.6 }: {
  station: OverviewStation | null
  onClose: () => void
  unitMap?: Record<string, string>
  onGoToDashboard?: (s: OverviewStation) => void
  vpdEnabled?: boolean
  vpdLow?: number
  vpdHigh?: number
}) {
  useEffect(() => {
    if (!station) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = "" }
  }, [station, onClose])

  if (!station) return null
  const meta = STATUS_META[station.status]
  const vpdStatus = !vpdEnabled || station.mainStatus === "offline" ? null : getVPDStatus(station.main.sensors.vpd, vpdLow, vpdHigh)
  const hasAlert = vpdStatus != null && vpdStatus !== "เหมาะสม"

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-[860px] overflow-y-auto rounded-2xl border bg-background shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-t-2xl border-b bg-background px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${meta.dot}${meta.animate ? " animate-pulse" : ""}`} />
              <h2 className="truncate text-base font-bold">{station.name}</h2>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.55rem] text-muted-foreground">
              <span className="font-mono">{station.id}</span>
              {station.province && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{station.province}</span>}
              <span className={`font-semibold ${meta.text}`}>{meta.label}</span>
              <span className={`flex items-center gap-1 font-mono ${batteryColor(station.batteryVoltage)}`}>
                <Battery className="h-3 w-3" />
                {station.batteryVoltage != null ? `${station.batteryVoltage.toFixed(1)} V` : "—"}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {onGoToDashboard && (
              <button
                onClick={() => onGoToDashboard(station)}
                className="inline-flex items-center gap-1.5 rounded-lg border bg-primary px-3 py-1.5 text-[0.6rem] font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Dashboard
              </button>
            )}
            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-lg border bg-secondary text-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid gap-5 p-5">
          {hasAlert && (
            <div className="flex items-center gap-2.5 rounded-xl border border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/50 px-3.5 py-2.5 text-sm font-medium text-orange-700 dark:text-orange-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                VPD {vpdStatus} ({station.main.sensors.vpd?.toFixed(2)} kPa) —{" "}
                {vpdStatus === "สูง" ? "พืชคายน้ำมากเกินไป เสี่ยงขาดน้ำ" : "พืชอาจหยุดคายน้ำ เสี่ยงโรครา"}
              </span>
            </div>
          )}
          <Unit station={station} variant="main" list={MAIN_SENSORS} unitMap={unitMap} vpdEnabled={vpdEnabled} vpdLow={vpdLow} vpdHigh={vpdHigh} />
          <div className="h-px bg-border" />
          <Unit station={station} variant="client" list={CLIENT_SENSORS} unitMap={unitMap} />
        </div>
      </div>
    </div>
  )
}
