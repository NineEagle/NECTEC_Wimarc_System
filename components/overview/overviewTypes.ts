export type PairStatus = "both-online" | "both-offline" | "main-only" | "client-only"
export type StationStatus = PairStatus
export type LayoutMode = "cards" | "table" | "board"
export type SensorType =
  | "temp" | "humid" | "light" | "rain" | "wind" | "pressure" | "vpd" | "soil"

export interface MainSensors {
  airTemperature: number | null
  relativeHumidity: number | null
  lightIntensity: number | null
  rainfall: number | null
  windSpeed: number | null
  windDirection: number | null
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
  status: PairStatus
  mainStatus: "online" | "offline"
  clientStatus: "online" | "offline"
  batteryVoltage: number | null
  main: CamUnit & { sensors: MainSensors }
  client: CamUnit & { sensors: ClientSensors }
  lat?: number
  lng?: number
}

export interface SensorDef {
  key: keyof MainSensors | keyof ClientSensors
  label: string
  short: string
  unit: string
  icon: string
  type: SensorType
  unit_in_main?: boolean
}

export const HEADLINE: SensorDef[] = [
  { key: "airTemperature",    label: "อุณหภูมิอากาศ",   short: "อุณหภูมิ", unit: "°C",  icon: "thermometer", type: "temp"  },
  { key: "relativeHumidity",  label: "ความชื้นสัมพัทธ์", short: "ความชื้น", unit: "%",   icon: "droplets",    type: "humid" },
  { key: "vpd",               label: "VPD",              short: "VPD",      unit: "kPa", icon: "activity",    type: "vpd"   },
  { key: "rainfall",          label: "ปริมาณน้ำฝน",      short: "ฝน",       unit: "mm",  icon: "cloud-rain",  type: "rain"  },
  { key: "windSpeed",         label: "ความเร็วลม",       short: "ลม",       unit: "m/s", icon: "wind",        type: "wind"  },
  { key: "lightIntensity",    label: "ความเข้มแสง",      short: "แสง",      unit: "klux", icon: "sun",        type: "light" },
]

export const CLIENT_HEADLINE: SensorDef[] = [
  { key: "soilMoisture1",    label: "ความชื้นดิน 15cm", short: "ชื้น 15cm", unit: "%",  icon: "droplets",    type: "soil" },
  { key: "soilTemperature1", label: "อุณหภูมิดิน 15cm", short: "ดิน 15cm",  unit: "°C", icon: "thermometer", type: "temp" },
  { key: "soilMoisture2",    label: "ความชื้นดิน 30cm", short: "ชื้น 30cm", unit: "%",  icon: "droplets",    type: "soil" },
  { key: "soilTemperature2", label: "อุณหภูมิดิน 30cm", short: "ดิน 30cm",  unit: "°C", icon: "thermometer", type: "temp" },
]

export const MAIN_SENSORS: SensorDef[] = [
  { key: "airTemperature",      label: "อุณหภูมิอากาศ",   short: "อุณหภูมิ", unit: "°C",  icon: "thermometer", type: "temp"     },
  { key: "relativeHumidity",    label: "ความชื้นสัมพัทธ์", short: "ความชื้น", unit: "%",   icon: "droplets",    type: "humid"    },
  { key: "lightIntensity",      label: "ความเข้มแสง",      short: "แสง",      unit: "klux", icon: "sun",        type: "light"    },
  { key: "rainfall",            label: "ปริมาณน้ำฝน",      short: "ฝน",       unit: "mm",  icon: "cloud-rain",  type: "rain"     },
  { key: "windSpeed",           label: "ความเร็วลม",       short: "ลม",       unit: "m/s", icon: "wind",        type: "wind"     },
  { key: "windDirection",       label: "ทิศทางลม",         short: "ทิศลม",    unit: "",    icon: "navigation",  type: "wind"     },
  { key: "atmosphericPressure", label: "ความกดอากาศ",      short: "ความกด",   unit: "hPa", icon: "gauge",       type: "pressure" },
  { key: "vpd",                 label: "VPD",              short: "VPD",      unit: "kPa", icon: "activity",    type: "vpd"      },
]

export const CLIENT_SENSORS: SensorDef[] = [
  { key: "soilMoisture1",    label: "ความชื้นดิน 15cm", short: "ชื้นดิน 15", unit: "%",  icon: "droplets",    type: "soil" },
  { key: "soilTemperature1", label: "อุณหภูมิดิน 15cm", short: "ดิน 15",     unit: "°C", icon: "thermometer", type: "temp" },
  { key: "soilMoisture2",    label: "ความชื้นดิน 30cm", short: "ชื้นดิน 30", unit: "%",  icon: "droplets",    type: "soil" },
  { key: "soilTemperature2", label: "อุณหภูมิดิน 30cm", short: "ดิน 30",     unit: "°C", icon: "thermometer", type: "temp" },
]
