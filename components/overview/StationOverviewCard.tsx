"use client"

import { Battery } from "lucide-react"
import { StationCameraThumb } from "./StationCameraThumb"
import type { OverviewStation, SensorDef } from "./overviewTypes"
import { HEADLINE, CLIENT_HEADLINE } from "./overviewTypes"
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

type ViewMode = "main" | "client"

function Metric({ station, def, unitMap, off, vpdEnabled = true, vpdLow = 0.8, vpdHigh = 1.6 }: {
  station: OverviewStation; def: SensorDef; unitMap?: Record<string, string>; off: boolean
  vpdEnabled?: boolean; vpdLow?: number; vpdHigh?: number
}) {
  const style = SENSOR_STYLE[def.type]
  const Icon = SENSOR_ICON[def.icon]
  const raw = readSensor(station, def)
  const alert = vpdEnabled && def.key === "vpd" && !off && getVPDStatus(raw, vpdLow, vpdHigh) !== "เหมาะสม"
  const unit = unitMap?.[def.key as string] ?? def.unit
  const sKey = SENSOR_TO_CONFIG[def.key as string]
  const converted = raw != null && sKey ? applyUnitConversion(sKey, raw, unit) : raw
  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1 text-[0.45rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {Icon && <Icon className={`h-2.5 w-2.5 ${style.fg} opacity-70`} />}
        {def.short}
      </span>
      <span className="flex items-baseline gap-0.5">
        <span className={`text-lg leading-none tabular-nums ${
          off ? "text-muted-foreground/40" : alert ? "text-orange-500" : style.fg
        }`}>
          {off ? "—" : formatValue(def.key as string, converted, unit)}
        </span>
        {!off && <span className="text-[0.45rem] text-muted-foreground/50">{unit}</span>}
      </span>
    </div>
  )
}

export function StationOverviewCard({ station, onOpen, unitMap, viewMode = "main", vpdEnabled = true, vpdLow = 0.8, vpdHigh = 1.6 }: {
  station: OverviewStation
  onOpen: (s: OverviewStation) => void
  unitMap?: Record<string, string>
  viewMode?: ViewMode
  vpdEnabled?: boolean
  vpdLow?: number
  vpdHigh?: number
}) {
  const meta = STATUS_META[station.status]
  const isClient = viewMode === "client"
  const off = isClient ? station.clientStatus === "offline" : station.mainStatus === "offline"
  const c = station.client.sensors
  const vpdS = !vpdEnabled || station.mainStatus === "offline" ? null : getVPDStatus(station.main.sensors.vpd, vpdLow, vpdHigh)
  const hasAlert = vpdS !== null && vpdS !== "เหมาะสม"

  const sensors = isClient ? CLIENT_HEADLINE : HEADLINE

  return (
    <button
      onClick={() => onOpen(station)}
      className={`flex flex-col overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-all duration-150 hover:shadow-md hover:-translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        hasAlert ? "border-orange-400/60" : "border-border"
      } ${off ? "opacity-60" : ""}`}
    >
      {/* Camera */}
      <StationCameraThumb
        station={station}
        variant={isClient ? "client" : "main"}
        aspect="aspect-[16/9]"
        showBadge={false}
      />

      <div className="flex flex-col gap-3 p-3.5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${meta.dot}${meta.animate ? " animate-pulse" : ""}`} />
              <span className="truncate text-[0.65rem]">{station.name}</span>
            </div>
            <div className="mt-0.5 font-mono text-[0.5rem] text-muted-foreground/60">{station.id}</div>
          </div>
          <span className={`shrink-0 text-[0.45rem] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${meta.bg} ${meta.text}`}>
            {meta.label}
          </span>
        </div>

        {/* Sensor grid */}
        <div className={`grid gap-x-3 gap-y-2.5 ${isClient ? "grid-cols-2" : "grid-cols-3"}`}>
          {sensors.map(def => (
            <Metric key={def.key} station={station} def={def} unitMap={unitMap} off={off} vpdEnabled={vpdEnabled} vpdLow={vpdLow} vpdHigh={vpdHigh} />
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/50 pt-2.5 text-[0.5rem] text-muted-foreground">
          {isClient ? (
            <span className="text-[0.45rem] uppercase tracking-wide font-semibold text-sensor-soil-fg opacity-60">สถานีดิน</span>
          ) : (
            <span className="flex items-center gap-1">
              <span className={`h-1.5 w-1.5 rounded-full ${
                station.clientStatus === "online" ? "bg-green-500" : "bg-red-400"
              }`} />
              <span className="uppercase tracking-wide text-[0.45rem] font-semibold">ดิน</span>
              <span className="tabular-nums ml-0.5">
                {station.clientStatus === "offline" || c.soilMoisture1 == null ? "—" : `${c.soilMoisture1}%`}
              </span>
              <span className="opacity-40 mx-0.5">·</span>
              <span className="tabular-nums">
                {station.clientStatus === "offline" || c.soilTemperature1 == null ? "—" : `${c.soilTemperature1.toFixed(1)}°`}
              </span>
            </span>
          )}
          <span className={`flex items-center gap-1 font-mono ${batteryColor(station.batteryVoltage)}`}>
            <Battery className="h-2.5 w-2.5" />
            {station.batteryVoltage != null ? `${station.batteryVoltage.toFixed(1)}V` : "—"}
          </span>
        </div>
      </div>
    </button>
  )
}

export function StationCardGrid({ stations, onOpen, unitMap, viewMode, vpdEnabled, vpdLow, vpdHigh }: {
  stations: OverviewStation[]
  onOpen: (s: OverviewStation) => void
  unitMap?: Record<string, string>
  viewMode?: ViewMode
  vpdEnabled?: boolean
  vpdLow?: number
  vpdHigh?: number
}) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
      {stations.map(s => (
        <StationOverviewCard key={s.id} station={s} onOpen={onOpen} unitMap={unitMap} viewMode={viewMode} vpdEnabled={vpdEnabled} vpdLow={vpdLow} vpdHigh={vpdHigh} />
      ))}
    </div>
  )
}
