import type {
  LiveData,
  PlotActivity,
  SensorReading,
  SimPayment,
  Station,
  StationFault,
  StationImage,
  User,
  WeatherForecast,
} from "@/types"

interface StationApi {
  id: string
  name: string
  type: string
  owner_id: string | null
  owner_name?: string | null
  latitude: number
  longitude: number
  status: string
  last_data_time: string | null
  area: string
  description: string
}

interface StationImageApi {
  id: string
  station_id: string
  image_url: string
  timestamp: string
}

interface SensorReadingApi {
  id: string
  station_id: string
  timestamp: string
  air_temperature?: number | null
  relative_humidity?: number | null
  light_intensity?: number | null
  wind_direction?: number | null
  wind_speed?: number | null
  rainfall?: number | null
  atmospheric_pressure?: number | null
  vpd?: number | null
  soil_moisture1?: number | null
  soil_moisture2?: number | null
  soil_temperature1?: number | null
  soil_temperature2?: number | null
}

interface WeatherForecastApi {
  id: string
  station_id: string
  forecast_date: string
  temperature: number
  rain_probability: number
  rainfall: number
  description: string
}

interface PlotActivityApi {
  id: string
  station_id: string
  date: string
  activity_type: string
  description: string
  created_by: string
  created_by_name: string
  images: string[]
  created_at: string
}

interface StationFaultApi {
  id: string
  station_id: string
  device: string
  device_other: string | null
  symptom: string
  note: string | null
  images: string[]
  created_by: string
  created_by_name: string
  created_at: string
  occurrence_no: number
}

interface UserApi {
  id: string
  username: string
  password: string
  role: string
  full_name: string
  email: string
  is_enabled: boolean
  permitted_station_ids: string[]
  phone?: string
  created_at: string
}

interface SimPaymentApi {
  id: string
  station_id: string
  station_name: string | null
  sim_number: string
  provider: string
  amount: number
  due_date: string
  status: string
  paid_date: string | null
  notes: string | null
}

export function parseDateOnly(value?: string | null) {
  if (!value) return null
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

export function formatDateOnly(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function mapStation(api: StationApi): Station {
  return {
    id: api.id,
    name: api.name,
    type: api.type as Station["type"],
    ownerId: api.owner_id || "",
    latitude: api.latitude,
    longitude: api.longitude,
    status: api.status as Station["status"],
    lastDataTime: api.last_data_time ? new Date(api.last_data_time) : null,
    area: api.area,
    description: api.description,
    ownerName: api.owner_name ?? undefined,
  }
}

export function mapStationImage(api: StationImageApi): StationImage {
  return {
    stationId: api.station_id,
    imageUrl: api.image_url,
    timestamp: new Date(api.timestamp),
  }
}

export function mapSensorReading(api: SensorReadingApi): SensorReading {
  return {
    stationId: api.station_id,
    timestamp: api.timestamp ? new Date(api.timestamp) : new Date(),
    airTemperature: api.air_temperature ?? undefined,
    relativeHumidity: api.relative_humidity ?? undefined,
    lightIntensity: api.light_intensity ?? undefined,
    windDirection: api.wind_direction ?? undefined,
    windSpeed: api.wind_speed ?? undefined,
    rainfall: api.rainfall ?? undefined,
    atmosphericPressure: api.atmospheric_pressure ?? undefined,
    vpd: api.vpd ?? undefined,
    soilMoisture1: api.soil_moisture1 ?? undefined,
    soilMoisture2: api.soil_moisture2 ?? undefined,
    soilTemperature1: api.soil_temperature1 ?? undefined,
    soilTemperature2: api.soil_temperature2 ?? undefined,
  }
}

export function mapWeatherForecast(api: WeatherForecastApi): WeatherForecast {
  return {
    stationId: api.station_id,
    forecastDate: parseDateOnly(api.forecast_date) || new Date(),
    temperature: api.temperature,
    rainProbability: api.rain_probability,
    rainfall: api.rainfall,
    description: api.description,
  }
}

export function mapPlotActivity(api: PlotActivityApi): PlotActivity {
  return {
    id: api.id,
    stationId: api.station_id,
    date: parseDateOnly(api.date) || new Date(),
    activityType: api.activity_type,
    description: api.description,
    createdBy: api.created_by,
    createdByName: api.created_by_name,
    images: api.images || [],
    createdAt: new Date(api.created_at),
  }
}

export function mapStationFault(api: StationFaultApi): StationFault {
  return {
    id: api.id,
    stationId: api.station_id,
    device: api.device as StationFault["device"],
    deviceOther: api.device_other ?? null,
    symptom: api.symptom,
    note: api.note ?? null,
    images: api.images || [],
    createdBy: api.created_by,
    createdByName: api.created_by_name,
    createdAt: new Date(api.created_at),
    occurrenceNo: api.occurrence_no,
  }
}

export function mapUser(api: UserApi): User {
  return {
    id: api.id,
    username: api.username,
    password: api.password,
    role: api.role as User["role"],
    fullName: api.full_name,
    email: api.email,
    isEnabled: api.is_enabled,
    permittedStationIds: api.permitted_station_ids || [],
    phone: api.phone ?? undefined,
    createdAt: new Date(api.created_at),
  }
}

interface LiveDataApi {
  last_ping?: string | null
  sensor_time?: string | null
  air_temperature?: number | null
  relative_humidity?: number | null
  light_intensity?: number | null
  wind_direction?: number | null
  wind_speed?: number | null
  rainfall?: number | null
  atmospheric_pressure?: number | null
  battery_voltage?: number | null
  vpd?: number | null
  soil_moisture1?: number | null
  soil_moisture2?: number | null
  soil_temperature1?: number | null
  soil_temperature2?: number | null
  image_url?: string | null
  image_time?: string | null
}

export function mapLiveData(api: LiveDataApi): LiveData {
  return {
    lastPing: api.last_ping ? new Date(api.last_ping) : null,
    sensorTime: api.sensor_time ? new Date(api.sensor_time) : null,
    airTemperature: api.air_temperature ?? undefined,
    relativeHumidity: api.relative_humidity ?? undefined,
    lightIntensity: api.light_intensity ?? undefined,
    windDirection: api.wind_direction ?? undefined,
    windSpeed: api.wind_speed ?? undefined,
    rainfall: api.rainfall ?? undefined,
    atmosphericPressure: api.atmospheric_pressure ?? undefined,
    batteryVoltage: api.battery_voltage ?? undefined,
    vpd: api.vpd ?? undefined,
    soilMoisture1: api.soil_moisture1 ?? undefined,
    soilMoisture2: api.soil_moisture2 ?? undefined,
    soilTemperature1: api.soil_temperature1 ?? undefined,
    soilTemperature2: api.soil_temperature2 ?? undefined,
    imageUrl: api.image_url ?? undefined,
    imageTime: api.image_time ? new Date(api.image_time) : null,
  }
}

export function mapSimPayment(api: SimPaymentApi): SimPayment {
  return {
    id: api.id,
    stationId: api.station_id,
    stationName: api.station_name || undefined,
    simNumber: api.sim_number,
    provider: api.provider,
    amount: api.amount,
    dueDate: parseDateOnly(api.due_date) || new Date(),
    status: api.status as SimPayment["status"],
    paidDate: api.paid_date ? parseDateOnly(api.paid_date) : null,
    notes: api.notes || undefined,
  }
}
