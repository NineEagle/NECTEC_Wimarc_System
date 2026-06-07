// components/overview/overviewUtils.ts
import {
  Thermometer, Droplets, Sun, Wind, CloudRain, Gauge, Activity,
  Navigation, type LucideIcon,
} from "lucide-react"
import type {
  OverviewStation, PairStatus, MainSensors, ClientSensors, SensorDef,
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
export function getVPDStatus(vpd: number | null | undefined, low = 0.8, high = 1.6): string | null {
  if (vpd == null) return null
  if (vpd < low) return "ต่ำ"
  if (vpd <= high) return "เหมาะสม"
  return "สูง"
}
export function isAlertStation(s: OverviewStation, vpdEnabled = true, low = 0.8, high = 1.6): boolean {
  if (!vpdEnabled) return false
  if (s.mainStatus === "offline") return false
  const v = getVPDStatus(s.main.sensors.vpd, low, high)
  return v != null && v !== "เหมาะสม"
}

// ---- status meta → Tailwind utility classes ----
export const STATUS_META: Record<PairStatus, { label: string; dot: string; text: string; bg: string; animate?: boolean }> = {
  "both-online":  { label: "ออนไลน์ทั้งคู่",          dot: "bg-green-500",  text: "text-green-600",  bg: "bg-green-50 dark:bg-green-950",  animate: true },
  "both-offline": { label: "ออฟไลน์ทั้งคู่",          dot: "bg-red-500",    text: "text-red-600",    bg: "bg-red-50 dark:bg-red-950"                      },
  "main-only":    { label: "อากาศ Online · ดิน Offline", dot: "bg-yellow-500", text: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950"               },
  "client-only":  { label: "อากาศ Offline · ดิน Online", dot: "bg-orange-500", text: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950"               },
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

export function formatValue(key: string, value: number | null, unit?: string): string {
  if (value == null) return "—"
  if (key === "lightIntensity") {
    if (unit === "lux") return Math.round(value * 1000).toLocaleString()
    return value.toFixed(2).replace(/\.?0+$/, "") || "0"
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
