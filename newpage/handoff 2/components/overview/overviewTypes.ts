// components/overview/overviewTypes.ts
// Types for the multi-station overview. Extends the existing LiveData shape
// with the two fields the overview needs (windDirection, batteryVoltage) and a
// per-unit camera (main + client).

export type StationStatus = "online" | "weak" | "offline"
export type LayoutMode = "cards" | "table" | "board"
export type SensorType =
  | "temp" | "humid" | "light" | "rain" | "wind" | "pressure" | "vpd" | "soil"

export interface MainSensors {
  airTemperature: number | null
  relativeHumidity: number | null
  lightIntensity: number | null
  rainfall: number | null
  windSpeed: number | null
  windDirection: number | null   // degrees 0–359  ← NEW (add to backend/LiveData)
  atmosphericPressure: number | null
  vpd: number | null
}

export interface ClientSensors {
  soilMoisture1: number | null
  soilTemperature1: number | null
  soilMoisture2: number | null
  soilTemperature2: number | null
}

export interface CamUnit {
  imageUrl?: string | null
  imageTime?: Date | null
}

export interface OverviewStation {
  id: string
  name: string
  province: string
  status: StationStatus
  batteryVoltage: number | null  // VOLTS, not %  ← NEW (add to backend/LiveData)
  main: CamUnit & { sensors: MainSensors }
  client: CamUnit & { sensors: ClientSensors }
  lat?: number
  lng?: number
}

// A single sensor definition used to render tiles/cells uniformly.
export interface SensorDef {
  key: keyof MainSensors | keyof ClientSensors
  label: string
  short: string
  unit: string
  icon: string        // lucide icon name resolved in overviewUtils.SENSOR_ICON
  type: SensorType
  unit_in_main?: boolean
}

// 6 headline sensors shown across the overview (from the MAIN unit), same order everywhere.
export const HEADLINE: SensorDef[] = [
  { key: "airTemperature",    label: "อุณหภูมิอากาศ",  short: "อุณหภูมิ", unit: "°C",  icon: "thermometer", type: "temp" },
  { key: "relativeHumidity",  label: "ความชื้นสัมพัทธ์", short: "ความชื้น", unit: "%",   icon: "droplets",    type: "humid" },
  { key: "vpd",               label: "VPD (ทุเรียน)",   short: "VPD",      unit: "kPa", icon: "activity",    type: "vpd" },
  { key: "rainfall",          label: "ปริมาณน้ำฝน",     short: "ฝน",       unit: "mm",  icon: "cloud-rain",  type: "rain" },
  { key: "windSpeed",         label: "ความเร็วลม",      short: "ลม",       unit: "m/s", icon: "wind",        type: "wind" },
  { key: "lightIntensity",    label: "ความเข้มแสง",     short: "แสง",      unit: "lux", icon: "sun",         type: "light" },
]

// Full sensor list for the MAIN unit in the detail modal (includes windDirection + pressure).
export const MAIN_SENSORS: SensorDef[] = [
  { key: "airTemperature",    label: "อุณหภูมิอากาศ",   short: "อุณหภูมิ", unit: "°C",  icon: "thermometer", type: "temp" },
  { key: "relativeHumidity",  label: "ความชื้นสัมพัทธ์", short: "ความชื้น", unit: "%",   icon: "droplets",    type: "humid" },
  { key: "lightIntensity",    label: "ความเข้มแสง",      short: "แสง",      unit: "lux", icon: "sun",         type: "light" },
  { key: "rainfall",          label: "ปริมาณน้ำฝน",      short: "ฝน",       unit: "mm",  icon: "cloud-rain",  type: "rain" },
  { key: "windSpeed",         label: "ความเร็วลม",       short: "ลม",       unit: "m/s", icon: "wind",        type: "wind" },
  { key: "windDirection",     label: "ทิศทางลม",         short: "ทิศลม",    unit: "",    icon: "navigation",  type: "wind" },
  { key: "atmosphericPressure", label: "ความกดอากาศ",    short: "ความกด",   unit: "hPa", icon: "gauge",       type: "pressure" },
  { key: "vpd",               label: "VPD (ทุเรียน)",    short: "VPD",      unit: "kPa", icon: "activity",    type: "vpd" },
]

// Full sensor list for the CLIENT unit (soil) in the detail modal — 4 sensors.
export const CLIENT_SENSORS: SensorDef[] = [
  { key: "soilMoisture1",    label: "ความชื้นดิน 15cm", short: "ดิน 15", unit: "%",  icon: "droplets",    type: "soil" },
  { key: "soilTemperature1", label: "อุณหภูมิดิน 15cm",  short: "ดิน 15", unit: "°C", icon: "thermometer", type: "temp" },
  { key: "soilMoisture2",    label: "ความชื้นดิน 30cm", short: "ดิน 30", unit: "%",  icon: "droplets",    type: "soil" },
  { key: "soilTemperature2", label: "อุณหภูมิดิน 30cm",  short: "ดิน 30", unit: "°C", icon: "thermometer", type: "temp" },
]
