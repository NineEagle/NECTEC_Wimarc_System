export type ConvMode = "linear" | "custom"

export type SensorKey =
  | "airTemp" | "humidity" | "light" | "windSpeed" | "pressure" | "rain"
  | "soilMoist1" | "soilMoist2" | "soilTemp1" | "soilTemp2"

export type SensorType = "temp" | "humid" | "light" | "wind" | "pressure" | "rain" | "soil"

export interface SensorDef {
  key: SensorKey
  label: string
  group: "weather" | "soil"
  rawUnit: string
  a: number
  b: number
  unit: string
  type: SensorType
  min: number
  max: number
  domain: [number, number]
  dec: number
  customFormula?: string
}

// Default formulas pre-filled from existing backend conversions:
// - sensor table columns (Temp/Humid/Rain/WindS/Lux/Pressure) are already decoded
//   by the sensor firmware → stored as real units → a=1, b=0
// - CAM_client.A/C (soil moisture ADC) → _adc_to_moisture:
//     (3800 - x) / (3800 - 1200) * 100  =  (3800 - x) / 2600 * 100
//   pre-filled as custom formula; linear approx: a=-0.0385, b=146.15
// - CAM_client.B/D (soil temp raw count) → raw / _SOIL_TEMP_SCALE:
//     x / 40  →  a=0.025, b=0
export const SENSORS: SensorDef[] = [
  { key: "airTemp",    label: "อุณหภูมิอากาศ",    group: "weather", rawUnit: "°C",  a: 1,      b: 0,      unit: "°C",  type: "temp",     min: 0,   max: 60,     domain: [-10, 80],   dec: 1 },
  { key: "humidity",   label: "ความชื้นสัมพัทธ์", group: "weather", rawUnit: "%",   a: 1,      b: 0,      unit: "%",   type: "humid",    min: 0,   max: 100,    domain: [-10, 110],  dec: 0 },
  { key: "light",      label: "ความเข้มแสง",      group: "weather", rawUnit: "lux", a: 1,      b: 0,      unit: "lux", type: "light",    min: 0,   max: 200000, domain: [0, 240000], dec: 0 },
  { key: "windSpeed",  label: "ความเร็วลม",       group: "weather", rawUnit: "m/s", a: 1,      b: 0,      unit: "m/s", type: "wind",     min: 0,   max: 50,     domain: [0, 60],     dec: 1 },
  { key: "pressure",   label: "ความกดอากาศ",      group: "weather", rawUnit: "hPa", a: 1,      b: 0,      unit: "hPa", type: "pressure", min: 900, max: 1100,   domain: [850, 1150], dec: 0 },
  { key: "rain",       label: "ปริมาณน้ำฝน",      group: "weather", rawUnit: "mm",  a: 1,      b: 0,      unit: "mm",  type: "rain",     min: 0,   max: 200,    domain: [0, 240],    dec: 1 },
  // soil moisture: CAM_client column A/C → raw ADC → (3800-x)/2600*100
  // backend: _SOIL_DRY_ADC=3800, _SOIL_WET_ADC=1200, formula=(dry-x)/(dry-wet)*100
  { key: "soilMoist1", label: "ความชื้นดิน 15cm", group: "soil",    rawUnit: "ADC", a: -0.0385, b: 146.15, unit: "%",  type: "soil",     min: 0,   max: 100,    domain: [-10, 110],  dec: 0,
    customFormula: "(3800 - x) / 2600 * 100" },
  { key: "soilMoist2", label: "ความชื้นดิน 30cm", group: "soil",    rawUnit: "ADC", a: -0.0385, b: 146.15, unit: "%",  type: "soil",     min: 0,   max: 100,    domain: [-10, 110],  dec: 0,
    customFormula: "(3800 - x) / 2600 * 100" },
  // soil temperature: CAM_client column B/D → raw count / 40 → °C
  // backend: _SOIL_TEMP_SCALE=40, formula=raw/40
  { key: "soilTemp1",  label: "อุณหภูมิดิน 15cm", group: "soil",    rawUnit: "raw", a: 0.025,  b: 0,      unit: "°C",  type: "temp",     min: 0,   max: 60,     domain: [-10, 80],   dec: 1 },
  { key: "soilTemp2",  label: "อุณหภูมิดิน 30cm", group: "soil",    rawUnit: "raw", a: 0.025,  b: 0,      unit: "°C",  type: "temp",     min: 0,   max: 60,     domain: [-10, 80],   dec: 1 },
]

export const SENSOR_ICON_NAME: Record<SensorKey, string> = {
  airTemp: "thermometer", humidity: "droplets", light: "sun", windSpeed: "wind",
  pressure: "gauge", rain: "cloud-rain", soilMoist1: "droplets", soilMoist2: "droplets",
  soilTemp1: "thermometer", soilTemp2: "thermometer",
}

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
  gapThresholdMinutes: number
  dashboardRefreshSeconds: number | null
  vpdLow: number
  vpdHigh: number
  vpdColorEnabled: boolean
}

export type AlertKey = "airTemp" | "humidity" | "rain" | "windSpeed" | "soilMoist1" | "soilMoist2"

export interface AlertRule {
  min: number | null
  max: number | null
  enabled: boolean
}
export interface StationConfig {
  vpdLow: number
  vpdHigh: number
  alerts: Record<AlertKey, AlertRule>
  configured: boolean
}

export interface AlertRowDef {
  key: AlertKey
  label: string
  group: "weather" | "soil"
  unit: string
  min: number | null
  max: number | null
}

export const ALERT_ROWS: AlertRowDef[] = [
  { key: "airTemp",    label: "อุณหภูมิ",          group: "weather", unit: "°C",  min: 15,   max: 42 },
  { key: "humidity",   label: "ความชื้น",          group: "weather", unit: "%",   min: 40,   max: 95 },
  { key: "rain",       label: "ฝน",                group: "weather", unit: "mm",  min: null, max: 50 },
  { key: "windSpeed",  label: "ลม",                group: "weather", unit: "m/s", min: null, max: 25 },
  { key: "soilMoist1", label: "ความชื้นดิน 15cm",  group: "soil",    unit: "%",   min: 30,   max: 80 },
  { key: "soilMoist2", label: "ความชื้นดิน 30cm",  group: "soil",    unit: "%",   min: 30,   max: 80 },
]

export interface StationMeta {
  id: string
  name: string
  province: string
  status: "online" | "weak" | "offline"
}
