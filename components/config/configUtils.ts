// components/config/configUtils.ts
import {
  Thermometer, Droplets, Sun, Wind, Gauge, CloudRain, type LucideIcon,
} from "lucide-react"
import {
  SENSORS, ALERT_ROWS,
  type SensorKey, type SensorType, type Conversion,
  type SystemConfig, type StationConfig,
} from "./configTypes"

// ---- lucide icon resolver (same vocabulary as the dashboard) ----
export const SENSOR_ICON: Record<string, LucideIcon> = {
  thermometer: Thermometer,
  droplets: Droplets,
  sun: Sun,
  wind: Wind,
  gauge: Gauge,
  "cloud-rain": CloudRain,
}

// ---- sensor token classes (from globals.css --sensor-*) ----
export const SENSOR_STYLE: Record<SensorType, { bg: string; border: string; fg: string }> = {
  temp:     { bg: "bg-sensor-temp-bg",     border: "border-sensor-temp-border",     fg: "text-sensor-temp-fg" },
  humid:    { bg: "bg-sensor-humid-bg",    border: "border-sensor-humid-border",    fg: "text-sensor-humid-fg" },
  light:    { bg: "bg-sensor-light-bg",    border: "border-sensor-light-border",    fg: "text-sensor-light-fg" },
  wind:     { bg: "bg-sensor-wind-bg",     border: "border-sensor-wind-border",     fg: "text-sensor-wind-fg" },
  pressure: { bg: "bg-sensor-pressure-bg", border: "border-sensor-pressure-border", fg: "text-sensor-pressure-fg" },
  rain:     { bg: "bg-sensor-rain-bg",     border: "border-sensor-rain-border",     fg: "text-sensor-rain-fg" },
  soil:     { bg: "bg-sensor-soil-bg",     border: "border-sensor-soil-border",     fg: "text-sensor-soil-fg" },
}

// alert-row sensor type (the alert key list is a subset that needs a swatch color)
export function alertSensorType(key: string): SensorType {
  if (key.startsWith("soil")) return "soil"
  if (key === "airTemp") return "temp"
  if (key === "humidity") return "humid"
  if (key === "rain") return "rain"
  return "wind"
}

// ---- number formatting ----
export function fmtNum(v: number, dec: number): string {
  if (!isFinite(v)) return "—"
  return v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

// ---- safe formula evaluation for the custom-conversion editor ----
// Only allows numbers, x/X, and basic arithmetic — no identifiers or calls.
export function evalFormula(expr: string, x: number): number {
  if (expr == null || expr === "") return NaN
  if (!/^[-+*/().0-9xX\s]+$/.test(expr)) return NaN
  try {
    // eslint-disable-next-line no-new-func
    const f = new Function("x", `"use strict"; return (${expr});`)
    const r = f(x)
    return typeof r === "number" && isFinite(r) ? r : NaN
  } catch {
    return NaN
  }
}

// apply a conversion to a raw reading
export function convert(conv: Conversion, x: number): number {
  if (conv.mode === "custom") return evalFormula(conv.customFormula, x)
  return conv.a * x + conv.b
}

// ---- factory defaults ----
export function defaultSystem(): SystemConfig {
  const conversions = {} as SystemConfig["conversions"]
  const limits = {} as SystemConfig["limits"]
  for (const s of SENSORS) {
    conversions[s.key] = {
      mode: "linear",
      a: s.a,
      b: s.b,
      customFormula: s.customFormula ?? "(x - 500) * 0.1 + 20",
      unit: s.unit,
    }
    limits[s.key] = { min: s.min, max: s.max }
  }
  return { conversions, limits, gapThresholdMinutes: 25, dashboardRefreshSeconds: 60, vpdLow: 0.8, vpdHigh: 1.6 }
}

export function defaultStation(): StationConfig {
  const alerts = {} as StationConfig["alerts"]
  for (const r of ALERT_ROWS) {
    alerts[r.key] = { min: r.min, max: r.max, enabled: r.key !== "windSpeed" }
  }
  return { vpdLow: 0.8, vpdHigh: 1.6, alerts, configured: false }
}

// ---- validation: returns the first error message, or null when valid ----
export function validateSystem(system: SystemConfig): string | null {
  for (const s of SENSORS) {
    const lim = system.limits[s.key]
    if (lim.min >= lim.max) return `ช่วงค่า ${s.label}: Min ต้องน้อยกว่า Max`
    const conv = system.conversions[s.key]
    if (conv.mode === "custom" && !isFinite(evalFormula(conv.customFormula, 500))) {
      return `สูตรของ ${s.label} ไม่ถูกต้อง`
    }
  }
  return null
}

// stable signature for dirty-state detection
export function configSignature(system: SystemConfig, stations: Record<string, StationConfig>): string {
  return JSON.stringify({ system, stations })
}

// thai short timestamp e.g. "2 มิ.ย. 14:32"
const TH_MON = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
export function thaiStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getDate()} ${TH_MON[d.getMonth()]} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export type { SensorKey }
