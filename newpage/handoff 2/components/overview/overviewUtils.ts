// components/overview/overviewUtils.ts
import {
  Thermometer, Droplets, Sun, Wind, CloudRain, Gauge, Activity,
  Navigation, type LucideIcon,
} from "lucide-react"
import type {
  OverviewStation, StationStatus, MainSensors, ClientSensors, SensorDef,
} from "./overviewTypes"

// ---- lucide icon resolver (matches the dashboard's icon vocabulary) ----
export const SENSOR_ICON: Record<string, LucideIcon> = {
  thermometer: Thermometer,
  droplets: Droplets,
  sun: Sun,
  wind: Wind,
  "cloud-rain": CloudRain,
  gauge: Gauge,
  activity: Activity,
  navigation: Navigation,
}

// ---- VPD status (same thresholds as dashboard/page.tsx) ----
export function getVPDStatus(vpd: number | null | undefined): string | null {
  if (vpd == null) return null
  if (vpd < 0.8) return "ต่ำ"
  if (vpd <= 1.6) return "เหมาะสม"
  return "สูง"
}
export function isAlertStation(s: OverviewStation): boolean {
  if (s.status === "offline") return false
  const v = getVPDStatus(s.main.sensors.vpd)
  return v != null && v !== "เหมาะสม"
}

// ---- status meta → Tailwind utility classes ----
export const STATUS_META: Record<StationStatus, { label: string; dot: string; text: string; bg: string }> = {
  online:  { label: "ออนไลน์",   dot: "bg-green-500", text: "text-green-600", bg: "bg-green-50" },
  weak:    { label: "สัญญาณอ่อน", dot: "bg-orange-500", text: "text-orange-600", bg: "bg-orange-50" },
  offline: { label: "ออฟไลน์",   dot: "bg-red-500",   text: "text-red-600",   bg: "bg-red-50" },
}

// ---- sensor token classes (from globals.css --sensor-*) ----
export const SENSOR_STYLE: Record<string, { bg: string; border: string; fg: string }> = {
  temp:     { bg: "bg-sensor-temp-bg",     border: "border-sensor-temp-border",     fg: "text-sensor-temp-fg" },
  humid:    { bg: "bg-sensor-humid-bg",    border: "border-sensor-humid-border",    fg: "text-sensor-humid-fg" },
  light:    { bg: "bg-sensor-light-bg",    border: "border-sensor-light-border",    fg: "text-sensor-light-fg" },
  rain:     { bg: "bg-sensor-rain-bg",     border: "border-sensor-rain-border",     fg: "text-sensor-rain-fg" },
  wind:     { bg: "bg-sensor-wind-bg",     border: "border-sensor-wind-border",     fg: "text-sensor-wind-fg" },
  pressure: { bg: "bg-sensor-pressure-bg", border: "border-sensor-pressure-border", fg: "text-sensor-pressure-fg" },
  vpd:      { bg: "bg-sensor-vpd-bg",      border: "border-sensor-vpd-border",      fg: "text-sensor-vpd-fg" },
  soil:     { bg: "bg-sensor-soil-bg",     border: "border-sensor-soil-border",     fg: "text-sensor-soil-fg" },
}

// ---- 8-point compass ----
export function compass(deg: number | null): string {
  if (deg == null) return "—"
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
  return dirs[Math.round(deg / 45) % 8]
}

// ---- unified value formatter ----
export function readSensor(
  s: OverviewStation,
  def: SensorDef,
): number | null {
  const k = def.key as string
  if (k in s.main.sensors) return (s.main.sensors as Record<string, number | null>)[k]
  if (k in s.client.sensors) return (s.client.sensors as Record<string, number | null>)[k]
  return null
}

export function formatValue(key: string, value: number | null): string {
  if (value == null) return "—"
  if (key === "lightIntensity") {
    return value >= 1000 ? `${(value / 1000).toFixed(1).replace(/\.0$/, "")}k` : `${Math.round(value)}`
  }
  if (key === "vpd") return value.toFixed(2)
  if (key === "windDirection") return compass(value)
  return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1)
}

export function batteryColor(v: number | null): string {
  if (v == null) return "text-muted-foreground"
  if (v < 11.6) return "text-red-600"
  if (v < 12.0) return "text-orange-600"
  return "text-muted-foreground"
}
