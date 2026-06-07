// components/overview/StationBoard.tsx
"use client"

import { Leaf, Battery, AlertTriangle } from "lucide-react"
import type { OverviewStation, SensorDef } from "./overviewTypes"
import { HEADLINE } from "./overviewTypes"
import {
  SENSOR_ICON, SENSOR_STYLE, STATUS_META, getVPDStatus, readSensor, formatValue, batteryColor,
} from "./overviewUtils"

function HeatChip({ station, def, vpdEnabled = true, vpdLow = 0.8, vpdHigh = 1.6 }: {
  station: OverviewStation; def: SensorDef; vpdEnabled?: boolean; vpdLow?: number; vpdHigh?: number
}) {
  const style = SENSOR_STYLE[def.type]
  const Icon = SENSOR_ICON[def.icon]
  const off = station.mainStatus === "offline"
  const raw = readSensor(station, def)
  const alert = vpdEnabled && def.key === "vpd" && !off && getVPDStatus(raw, vpdLow, vpdHigh) !== "เหมาะสม"
  return (
    <div
      title={def.short}
      className={`flex flex-col items-center gap-0.5 rounded-md border px-0.5 py-1.5 ${off ? "border-transparent bg-muted" : `border-transparent ${style.bg}`} ${alert ? "!border-orange-500" : ""}`}
    >
      {Icon && <Icon className={`h-3 w-3 ${off ? "text-muted-foreground" : style.fg} opacity-80`} />}
      <span className={`text-xs font-bold leading-none tabular-nums ${off ? "text-muted-foreground" : alert ? "text-orange-600" : style.fg}`}>
        {off ? "—" : formatValue(def.key as string, raw)}
      </span>
    </div>
  )
}

function Tile({ station, onOpen, vpdEnabled = true, vpdLow = 0.8, vpdHigh = 1.6 }: {
  station: OverviewStation; onOpen: (s: OverviewStation) => void
  vpdEnabled?: boolean; vpdLow?: number; vpdHigh?: number
}) {
  const meta = STATUS_META[station.status]
  const off = station.mainStatus === "offline"
  const vpdStatus = !vpdEnabled || off ? null : getVPDStatus(station.main.sensors.vpd, vpdLow, vpdHigh)
  const hasAlert = vpdStatus != null && vpdStatus !== "เหมาะสม"
  const c = station.client.sensors
  return (
    <button
      onClick={() => onOpen(station)}
      className={`flex flex-col gap-2.5 rounded-2xl border bg-card p-3 text-left shadow-sm transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${hasAlert ? "border-orange-500" : ""}`}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
        <span className="font-mono text-[0.55rem] font-bold text-muted-foreground">{station.id}</span>
        {hasAlert && (
          <span className="ml-auto inline-flex items-center gap-0.5 text-[0.475rem] font-bold text-orange-600">
            <AlertTriangle className="h-3 w-3" /> VPD {vpdStatus}
          </span>
        )}
      </div>
      <div className="truncate text-[0.625rem] font-semibold leading-tight">{station.name}</div>
      <div className="grid grid-cols-6 gap-1">
        {HEADLINE.map((def) => <HeatChip key={def.key} station={station} def={def} vpdEnabled={vpdEnabled} vpdLow={vpdLow} vpdHigh={vpdHigh} />)}
      </div>
      <div className="flex items-center justify-between text-[0.525rem] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Leaf className="h-3 w-3 text-sensor-soil-fg" /> ดิน {station.clientStatus === "offline" || c.soilMoisture1 == null ? "—" : `${c.soilMoisture1}%`}
        </span>
        <span className={`inline-flex items-center gap-1 font-mono font-semibold ${batteryColor(station.batteryVoltage)}`}>
          <Battery className="h-3 w-3" /> {station.batteryVoltage != null ? `${station.batteryVoltage.toFixed(1)} V` : "—"}
        </span>
      </div>
    </button>
  )
}

export function StationBoard({
  stations, onOpen, vpdEnabled = true, vpdLow = 0.8, vpdHigh = 1.6,
}: {
  stations: OverviewStation[]; onOpen: (s: OverviewStation) => void
  vpdEnabled?: boolean; vpdLow?: number; vpdHigh?: number
}) {
  const score = (s: OverviewStation) => {
    if (s.status === "both-offline") return 0
    const v = vpdEnabled ? getVPDStatus(s.main.sensors.vpd, vpdLow, vpdHigh) : null
    if (s.mainStatus === "online" && v != null && v !== "เหมาะสม") return 1
    if (s.status === "main-only" || s.status === "client-only") return 2
    return 3
  }
  const ordered = [...stations].sort((a, b) => score(a) - score(b) || a.id.localeCompare(b.id))
  return (
    <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(186px, 1fr))" }}>
      {ordered.map((s) => <Tile key={s.id} station={s} onOpen={onOpen} vpdEnabled={vpdEnabled} vpdLow={vpdLow} vpdHigh={vpdHigh} />)}
    </div>
  )
}
