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
  const readings = await apiRequest<any[]>(`/stations/${stationId}/readings`, {
    query: { days: timeRange, limit: 1000 },
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
  const readings = await apiRequest<any[]>(`/stations/${stationId}/readings`, {
    query: { start_date: startDate, end_date: endDate, limit: 1000 },
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
