// components/overview/StationOverviewCard.tsx
"use client"

import { Leaf, Battery } from "lucide-react"
import { Card } from "@/components/ui/card"
import { StationCameraThumb } from "./StationCameraThumb"
import type { OverviewStation, SensorDef } from "./overviewTypes"
import { HEADLINE } from "./overviewTypes"
import {
  SENSOR_ICON, SENSOR_STYLE, STATUS_META, getVPDStatus, readSensor, formatValue, batteryColor,
} from "./overviewUtils"

function Metric({ station, def }: { station: OverviewStation; def: SensorDef }) {
  const style = SENSOR_STYLE[def.type]
  const Icon = SENSOR_ICON[def.icon]
  const off = station.status === "offline"
  const raw = readSensor(station, def)
  const alert = def.key === "vpd" && !off && getVPDStatus(raw) !== "เหมาะสม"
  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
        {Icon && <Icon className={`h-3 w-3 ${style.fg} opacity-85`} />}
        {def.short}
      </span>
      <span className="flex items-baseline gap-0.5">
        <span className={`text-[17px] font-bold leading-none tabular-nums ${off ? "text-muted-foreground" : alert ? "text-orange-600" : "text-foreground"}`}>
          {off ? "—" : formatValue(def.key as string, raw)}
        </span>
        <span className="text-[9.5px] text-muted-foreground">{def.unit}</span>
      </span>
    </div>
  )
}

export function StationOverviewCard({
  station, onOpen,
}: {
  station: OverviewStation; onOpen: (s: OverviewStation) => void
}) {
  const meta = STATUS_META[station.status]
  const off = station.status === "offline"
  const c = station.client.sensors
  return (
    <button
      onClick={() => onOpen(station)}
      className="flex flex-col overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative">
        <StationCameraThumb station={station} variant="main" />
        <span className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/50 px-2 py-0.5 text-[10.5px] font-semibold text-white">
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} /> {meta.label}
        </span>
      </div>

      <div className="px-3.5 pb-3.5 pt-3">
        <div className="mb-3 min-w-0">
          <div className="truncate text-sm font-bold">{station.name}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="font-mono">{station.id}</span><span>·</span><span>{station.province}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-x-2.5 gap-y-3">
          {HEADLINE.map((def) => <Metric key={def.key} station={station} def={def} />)}
        </div>

        <div className="mt-3.5 flex items-center justify-between gap-2 border-t pt-2.5">
          <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground" title="หน่วยลูกข่าย · เซนเซอร์ดิน">
            <Leaf className="h-3 w-3 text-sensor-soil-fg" />
            ดิน <span className="font-semibold text-foreground tabular-nums">{off || c.soilMoisture1 == null ? "—" : `${c.soilMoisture1}%`}</span>
            <span className="opacity-50">·</span>
            <span className="tabular-nums">{off || c.soilTemperature1 == null ? "—" : `${c.soilTemperature1.toFixed(1)}°`}</span>
          </span>
          <span className={`flex items-center gap-1 font-mono text-[11.5px] font-semibold ${batteryColor(station.batteryVoltage)}`}>
            <Battery className="h-3 w-3" /> {station.batteryVoltage != null ? `${station.batteryVoltage.toFixed(1)} V` : "—"}
          </span>
        </div>
      </div>
    </button>
  )
}

export function StationCardGrid({
  stations, onOpen,
}: {
  stations: OverviewStation[]; onOpen: (s: OverviewStation) => void
}) {
  return (
    <div
      className="grid gap-3.5"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))" }}
    >
      {stations.map((s) => <StationOverviewCard key={s.id} station={s} onOpen={onOpen} />)}
    </div>
  )
}
