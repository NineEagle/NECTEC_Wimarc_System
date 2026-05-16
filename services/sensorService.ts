/**
 * Sensor data service
 * Handles sensor reading operations and calculations
 */

import type { LiveData, SensorReading, TimeRange, DailyAggregate, WeatherForecast } from "@/types"
import { apiRequest } from "@/services/apiClient"
import { mapLiveData, mapSensorReading, mapWeatherForecast } from "@/services/apiMappers"

/**
 * Get sensor readings for a station within a time range
 */
export async function getSensorReadings(stationId: string, timeRange: TimeRange): Promise<SensorReading[]> {
  // 1-min cadence → days × 1440 rows; cap 50000 for safety
  const limit = Math.min(timeRange * 1440 + 100, 50000)
  const readings = await apiRequest<any[]>(`/stations/${stationId}/readings`, {
    query: { days: timeRange, limit },
  })
  return readings
    .map(mapSensorReading)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
}

export async function getSensorReadingsByDateRange(
  stationId: string,
  startDate: string,
  endDate: string,
): Promise<SensorReading[]> {
  // Estimate days, scale limit; cap 50000
  const days = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000))
  const limit = Math.min(days * 1440 + 100, 50000)
  const readings = await apiRequest<any[]>(`/stations/${stationId}/readings`, {
    query: { start_date: startDate, end_date: endDate, limit },
  })
  return readings
    .map(mapSensorReading)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
}

/**
 * Get latest sensor reading for a station
 */
export async function getLatestSensorReading(stationId: string): Promise<SensorReading | null> {
  const readings = await apiRequest<any[]>(`/stations/${stationId}/readings`, {
    query: { limit: 1 },
  })

  if (readings.length === 0) return null
  return mapSensorReading(readings[0])
}

/**
 * Calculate daily aggregates from sensor readings
 */
export async function getDailyAggregates(stationId: string, timeRange: TimeRange): Promise<DailyAggregate[]> {
  const readings = await getSensorReadings(stationId, timeRange)

  // Group readings by date
  const dailyGroups = new Map<string, SensorReading[]>()

  readings.forEach((reading) => {
    const date = new Date(reading.timestamp)
    date.setHours(0, 0, 0, 0)
    const dateKey = date.toISOString()

    if (!dailyGroups.has(dateKey)) {
      dailyGroups.set(dateKey, [])
    }
    dailyGroups.get(dateKey)!.push(reading)
  })

  // Calculate aggregates for each day
  const aggregates: DailyAggregate[] = []

  dailyGroups.forEach((dayReadings, dateKey) => {
    const date = new Date(dateKey)

    // Calculate averages
    const temps = dayReadings.map((r) => r.airTemperature).filter((v) => v !== undefined) as number[]
    const humidity = dayReadings.map((r) => r.relativeHumidity).filter((v) => v !== undefined) as number[]
    const light = dayReadings.map((r) => r.lightIntensity).filter((v) => v !== undefined) as number[]
    const wind = dayReadings.map((r) => r.windSpeed).filter((v) => v !== undefined) as number[]
    const pressure = dayReadings.map((r) => r.atmosphericPressure).filter((v) => v !== undefined) as number[]
    const soil1 = dayReadings.map((r) => r.soilMoisture1).filter((v) => v !== undefined) as number[]
    const soil2 = dayReadings.map((r) => r.soilMoisture2).filter((v) => v !== undefined) as number[]
    const soilTemp1 = dayReadings.map((r) => r.soilTemperature1).filter((v) => v !== undefined) as number[]
    const soilTemp2 = dayReadings.map((r) => r.soilTemperature2).filter((v) => v !== undefined) as number[]
    const vpdValues = dayReadings.map((r) => r.vpd).filter((v) => v !== undefined) as number[]
    const rainfall = dayReadings.map((r) => r.rainfall).filter((v) => v !== undefined) as number[]

    const aggregate: DailyAggregate = {
      date,
      stationId,
    }

    if (temps.length > 0) {
      aggregate.avgTemperature = Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10
      aggregate.minTemperature = Math.min(...temps)
      aggregate.maxTemperature = Math.max(...temps)
    }

    if (humidity.length > 0) {
      aggregate.avgHumidity = Math.round((humidity.reduce((a, b) => a + b, 0) / humidity.length) * 10) / 10
      aggregate.minHumidity = Math.min(...humidity)
      aggregate.maxHumidity = Math.max(...humidity)
    }

    if (light.length > 0) {
      aggregate.avgLightIntensity = Math.round(light.reduce((a, b) => a + b, 0) / light.length)
    }

    if (wind.length > 0) {
      aggregate.avgWindSpeed = Math.round((wind.reduce((a, b) => a + b, 0) / wind.length) * 10) / 10
    }

    if (pressure.length > 0) {
      aggregate.avgPressure = Math.round((pressure.reduce((a, b) => a + b, 0) / pressure.length) * 10) / 10
      aggregate.minPressure = Math.min(...pressure)
      aggregate.maxPressure = Math.max(...pressure)
    }

    if (soil1.length > 0) {
      aggregate.avgSoilMoisture1 = Math.round((soil1.reduce((a, b) => a + b, 0) / soil1.length) * 10) / 10
    }

    if (soil2.length > 0) {
      aggregate.avgSoilMoisture2 = Math.round((soil2.reduce((a, b) => a + b, 0) / soil2.length) * 10) / 10
    }

    if (soilTemp1.length > 0) {
      aggregate.avgSoilTemperature1 = Math.round((soilTemp1.reduce((a, b) => a + b, 0) / soilTemp1.length) * 10) / 10
    }

    if (soilTemp2.length > 0) {
      aggregate.avgSoilTemperature2 = Math.round((soilTemp2.reduce((a, b) => a + b, 0) / soilTemp2.length) * 10) / 10
    }

    if (vpdValues.length > 0) {
      aggregate.avgVpd = Math.round((vpdValues.reduce((a, b) => a + b, 0) / vpdValues.length) * 100) / 100
    }

    if (rainfall.length > 0) {
      aggregate.totalRainfall = Math.round(rainfall.reduce((a, b) => a + b, 0) * 10) / 10
    }

    aggregates.push(aggregate)
  })

  // Sort by date
  return aggregates.sort((a, b) => a.date.getTime() - b.date.getTime())
}

/**
 * Get real-time live snapshot for a station
 * last_ping  — device heartbeat (~1 min cadence, from updatedata)
 * sensor_time — last saved decoded sensor value (~10 min cadence)
 * image_url  — latest image file (~1 hour cadence)
 */
export async function getLiveData(stationId: string): Promise<LiveData> {
  const data = await apiRequest<any>(`/stations/${stationId}/live`)
  return mapLiveData(data)
}

export interface HourlyImage {
  imageUrl: string
  timestamp: Date
}

export async function getTodayImages(stationId: string): Promise<HourlyImage[]> {
  const data = await apiRequest<{ image_url: string; timestamp: string }[]>(
    `/stations/${stationId}/images/today`
  )
  return data.map((d) => ({ imageUrl: d.image_url, timestamp: new Date(d.timestamp) }))
}

/**
 * Get weather forecast for a station
 */
export async function getWeatherForecast(stationId: string): Promise<WeatherForecast[]> {
  const forecasts = await apiRequest<any[]>(`/stations/${stationId}/forecast`)
  return forecasts.map(mapWeatherForecast)
}

/**
 * Get TMD (กรมอุตุนิยมวิทยา) daily forecast for a station
 */
export async function getTmdForecast(stationId: string): Promise<{ noKey: boolean; forecasts: import("@/types").TmdForecastDay[] }> {
  const data = await apiRequest<any>(`/stations/${stationId}/tmd-forecast`)
  return { noKey: data.no_key ?? false, forecasts: data.forecasts ?? [] }
}

export interface ForecastHistoryDay {
  date: string
  temperature: number
  rainfall: number
  rainProbability: number
  description: string
  snapshotAt: string | null
}

/**
 * Historical forecasts for past N days (latest snapshot per past day)
 */
export async function getForecastHistory(stationId: string, days: number): Promise<ForecastHistoryDay[]> {
  const data = await apiRequest<any[]>(`/stations/${stationId}/forecast/history`, {
    query: { days },
  })
  return data.map(d => ({
    date: d.date,
    temperature: d.temperature,
    rainfall: d.rainfall,
    rainProbability: d.rain_probability,
    description: d.description,
    snapshotAt: d.snapshot_at,
  }))
}
