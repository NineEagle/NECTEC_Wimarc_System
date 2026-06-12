// components/config/configTypes.ts
//
// Types + static config for the WiMaRC system-settings page (route /config).
// Two scopes:
//   • SystemConfig  — global, applies to every station (conversion formulas,
//                     valid ranges, display/refresh settings).
//   • StationConfig — per-station VPD thresholds + sensor alert limits.
//
// All numeric config values are the "human" values shown in the UI; the page
// only persists them via services/configService.ts — see that file to wire the
// backend.

export type ConvMode = "linear" | "custom"

export type SensorKey =
  | "airTemp" | "humidity" | "light" | "windSpeed" | "pressure" | "rain"
  | "soilMoist1" | "soilMoist2" | "soilTemp1" | "soilTemp2"

export type SensorType = "temp" | "humid" | "light" | "wind" | "pressure" | "rain" | "soil"

// ---- static sensor catalogue (conversion defaults + valid-range domain) ----
export interface SensorDef {
  key: SensorKey
  label: string
  group: "weather" | "soil"
  rawUnit: string                 // unit of the raw signal (mV, Hz, raw, tip…)
  a: number                       // default linear slope
  b: number                       // default linear offset
  unit: string                    // converted unit
  type: SensorType                // drives sensor token colors
  min: number                     // default valid-range min (converted unit)
  max: number                     // default valid-range max
  domain: [number, number]        // axis range for the visual range bar
  dec: number                     // decimals when formatting the converted value
  customFormula?: string          // seed for the custom-formula editor
}

export const SENSORS: SensorDef[] = [
  { key: "airTemp",    label: "อุณหภูมิอากาศ",    group: "weather", rawUnit: "mV",  a: 0.05,  b: 7.5,  unit: "°C",  type: "temp",     min: 0,    max: 60,     domain: [-10, 80],     dec: 1 },
  { key: "humidity",   label: "ความชื้นสัมพัทธ์", group: "weather", rawUnit: "mV",  a: 0.025, b: 0,    unit: "%",   type: "humid",    min: 0,    max: 100,    domain: [-10, 110],    dec: 0 },
  { key: "light",      label: "ความเข้มแสง",      group: "weather", rawUnit: "raw", a: 50,    b: 0,    unit: "lux", type: "light",    min: 0,    max: 200000, domain: [0, 240000],   dec: 0 },
  { key: "windSpeed",  label: "ความเร็วลม",       group: "weather", rawUnit: "Hz",  a: 0.098, b: 0,    unit: "m/s", type: "wind",     min: 0,    max: 50,     domain: [0, 60],       dec: 1 },
  { key: "pressure",   label: "ความกดอากาศ",      group: "weather", rawUnit: "raw", a: 0.04,  b: 900,  unit: "hPa", type: "pressure", min: 900,  max: 1100,   domain: [850, 1150],   dec: 0 },
  { key: "rain",       label: "ปริมาณน้ำฝน",      group: "weather", rawUnit: "tip", a: 0.2,   b: 0,    unit: "mm",  type: "rain",     min: 0,    max: 200,    domain: [0, 240],      dec: 1 },
  { key: "soilMoist1", label: "ความชื้นดิน 15cm", group: "soil",    rawUnit: "raw", a: 0.024, b: -10,  unit: "%",   type: "soil",     min: 0,    max: 100,    domain: [-10, 110],    dec: 0, customFormula: "(x - 500) * 0.1 + 20" },
  { key: "soilMoist2", label: "ความชื้นดิน 30cm", group: "soil",    rawUnit: "raw", a: 0.024, b: -10,  unit: "%",   type: "soil",     min: 0,    max: 100,    domain: [-10, 110],    dec: 0 },
  { key: "soilTemp1",  label: "อุณหภูมิดิน 15cm", group: "soil",    rawUnit: "mV",  a: 0.05,  b: 7.5,  unit: "°C",  type: "temp",     min: 0,    max: 60,     domain: [-10, 80],     dec: 1 },
  { key: "soilTemp2",  label: "อุณหภูมิดิน 30cm", group: "soil",    rawUnit: "mV",  a: 0.05,  b: 7.5,  unit: "°C",  type: "temp",     min: 0,    max: 60,     domain: [-10, 80],     dec: 1 },
]

// lucide icon name per sensor (resolved in configUtils.SENSOR_ICON)
export const SENSOR_ICON_NAME: Record<SensorKey, string> = {
  airTemp: "thermometer", humidity: "droplets", light: "sun", windSpeed: "wind",
  pressure: "gauge", rain: "cloud-rain", soilMoist1: "droplets", soilMoist2: "droplets",
  soilTemp1: "thermometer", soilTemp2: "thermometer",
}

// ---- global (system) config ----
export interface Conversion {
  mode: ConvMode
  a: number
  b: number
  customFormula: string
  unit: string
}
export interface Limit { min: number; max: number }

export interface SystemConfig {
  conversions: Record<SensorKey, Conversion>
  limits: Record<SensorKey, Limit>
  gapThresholdMinutes: number               // chart gap when data is missing
  dashboardRefreshSeconds: number | null    // null = auto-refresh off
}

// ---- per-station config ----
export type AlertKey = "airTemp" | "humidity" | "rain" | "windSpeed" | "soilMoist1" | "soilMoist2"

export interface AlertRule {
  min: number | null
  max: number | null
  enabled: boolean
}
export interface StationConfig {
  vpdLow: number       // Low → Optimal boundary (kPa)
  vpdHigh: number      // Optimal → High boundary (kPa)
  alerts: Record<AlertKey, AlertRule>
  configured: boolean  // false = still on system defaults
}

export interface AlertRowDef {
  key: AlertKey
  label: string
  group: "weather" | "soil"
  unit: string
  min: number | null
  max: number | null
}

// alert rows rendered in the per-station accordion (Section 4b)
export const ALERT_ROWS: AlertRowDef[] = [
  { key: "airTemp",    label: "อุณหภูมิ",         group: "weather", unit: "°C",  min: 15,   max: 42 },
  { key: "humidity",   label: "ความชื้น",         group: "weather", unit: "%",   min: 40,   max: 95 },
  { key: "rain",       label: "ฝน",               group: "weather", unit: "mm",  min: null, max: 50 },
  { key: "windSpeed",  label: "ลม",               group: "weather", unit: "m/s", min: null, max: 25 },
  { key: "soilMoist1", label: "ความชื้นดิน 15cm", group: "soil",    unit: "%",   min: 30,   max: 80 },
  { key: "soilMoist2", label: "ความชื้นดิน 30cm", group: "soil",    unit: "%",   min: 30,   max: 80 },
]

// station identity the page needs (pull from StationContext.permittedStations)
export interface StationMeta {
  id: string
  name: string
  province: string
  status: "online" | "weak" | "offline"
}
