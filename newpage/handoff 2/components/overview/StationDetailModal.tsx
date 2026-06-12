// components/overview/StationDetailModal.tsx
"use client"

import { useEffect } from "react"
import { X, MapPin, Battery, AlertTriangle, CheckCircle2, ArrowDown, ArrowUp, Sun, Leaf } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { StationCameraThumb } from "./StationCameraThumb"
import type { OverviewStation, SensorDef } from "./overviewTypes"
import { MAIN_SENSORS, CLIENT_SENSORS } from "./overviewTypes"
import {
  SENSOR_ICON, SENSOR_STYLE, STATUS_META, getVPDStatus, readSensor, formatValue, batteryColor,
} from "./overviewUtils"

function SensorTile({ station, def }: { station: OverviewStation; def: SensorDef }) {
  const style = SENSOR_STYLE[def.type]
  const Icon = SENSOR_ICON[def.icon]
  const off = station.status === "offline"
  const raw = readSensor(station, def)
  const isDir = def.key === "windDirection"
  const vpdStatus = def.key === "vpd" && !off ? getVPDStatus(raw) : null

  return (
    <div className={`rounded-xl border ${style.border} bg-card p-3`}>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{def.label}</span>
        {Icon && (
          <Icon
            className={`h-4 w-4 ${style.fg} opacity-80`}
            style={isDir && raw != null ? { transform: `rotate(${raw}deg)`, transition: "transform .4s" } : undefined}
            aria-hidden="true"
          />
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-2xl font-bold tabular-nums leading-none ${off ? "text-muted-foreground" : style.fg}`}>
          {off ? "—" : formatValue(def.key as string, raw)}
        </span>
        <span className="text-xs text-muted-foreground">{isDir && raw != null ? `${raw}°` : def.unit}</span>
        {vpdStatus && (
          <Badge
            className={
              "ml-auto h-5 gap-1 border-none px-1.5 text-xs text-white " +
              (vpdStatus === "เหมาะสม" ? "bg-green-600" : vpdStatus === "ต่ำ" ? "bg-blue-600" : "bg-red-600")
            }
          >
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

function Unit({
  station, variant, title, sublabel, list,
}: {
  station: OverviewStation; variant: "main" | "client"; title: string; sublabel: string; list: SensorDef[]
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${variant === "main" ? "bg-sensor-humid-bg text-sensor-humid-fg" : "bg-sensor-soil-bg text-sensor-soil-fg"}`}>
          {variant === "main" ? <Sun className="h-3.5 w-3.5" /> : <Leaf className="h-3.5 w-3.5" />}
        </span>
        <div className="leading-tight">
          <div className="text-sm font-bold">{title}</div>
          <div className="font-mono text-[10.5px] text-muted-foreground">{sublabel}</div>
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,0.92fr)_minmax(0,1.4fr)] gap-3.5 max-sm:grid-cols-1">
        <StationCameraThumb station={station} variant={variant} aspect="aspect-[4/3]" rounded="rounded-xl" />
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {list.map((def) => <SensorTile key={`${variant}-${def.key}`} station={station} def={def} />)}
        </div>
      </div>
    </div>
  )
}

export function StationDetailModal({
  station, onClose,
}: {
  station: OverviewStation | null; onClose: () => void
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
  const off = station.status === "offline"
  const vpdStatus = off ? null : getVPDStatus(station.main.sensors.vpd)
  const hasAlert = vpdStatus != null && vpdStatus !== "เหมาะสม"

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-[860px] overflow-y-auto rounded-2xl border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-t-2xl border-b bg-background px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
              <h2 className="truncate text-lg font-bold">{station.name}</h2>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="font-mono">{station.id}</span>
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {station.province}</span>
              <span className={`font-bold ${meta.text}`}>{meta.label}</span>
              <span className={`flex items-center gap-1 font-mono ${batteryColor(station.batteryVoltage)}`}>
                <Battery className="h-3 w-3" /> {station.batteryVoltage != null ? `${station.batteryVoltage.toFixed(1)} V` : "—"}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="ปิด"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border bg-secondary text-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-5 p-5">
          {hasAlert && (
            <div className="flex items-center gap-2.5 rounded-xl border border-orange-200 bg-orange-50 px-3.5 py-2.5 text-sm font-semibold text-orange-700">
              <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
              <span>
                VPD {vpdStatus} ({station.main.sensors.vpd?.toFixed(2)} kPa) —{" "}
                {vpdStatus === "สูง" ? "พืชคายน้ำมากเกินไป เสี่ยงขาดน้ำ" : "พืชอาจหยุดคายน้ำ เสี่ยงโรครา"}
              </span>
            </div>
          )}

          <Unit station={station} variant="main" title="หน่วยหลัก · Main" sublabel="CAM_main · เซนเซอร์อากาศ" list={MAIN_SENSORS} />
          <div className="h-px bg-border" />
          <Unit station={station} variant="client" title="หน่วยลูกข่าย · Client" sublabel="CAM_client · เซนเซอร์ดิน" list={CLIENT_SENSORS} />
        </div>
      </div>
    </div>
  )
}
