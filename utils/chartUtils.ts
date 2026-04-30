/**
 * Chart utility functions for data visualization
 * Handles data transformation for Recharts components
 */

import type { SensorReading, DailyAggregate } from "@/types"

/**
 * Format sensor readings for line chart display
 * Groups data by timestamp for multi-series charts
 */
export function formatSensorDataForChart(readings: SensorReading[], sensorKeys: string[]) {
  return readings.map((reading) => {
    const dataPoint: any = {
      timestamp: reading.timestamp,
      time: new Date(reading.timestamp).toLocaleString("th-TH", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    }

    sensorKeys.forEach((key) => {
      dataPoint[key] = reading[key as keyof SensorReading]
    })

    return dataPoint
  })
}

/**
 * Format daily aggregates for chart display
 */
export function formatDailyDataForChart(aggregates: DailyAggregate[]) {
  return aggregates.map((agg) => ({
    dateLabel: new Date(agg.date).toLocaleDateString("th-TH", {
      month: "short",
      day: "numeric",
    }),
    ...agg,
  }))
}

/**
 * Get sensor display name in Thai
 */
export function getSensorDisplayName(sensorKey: string): string {
  const names: Record<string, string> = {
    airTemperature: "อุณหภูมิอากาศ (°C)",
    relativeHumidity: "ความชื้นสัมพัทธ์ (%)",
    lightIntensity: "ความเข้มแสง (lux)",
    windDirection: "ทิศทางลม (°)",
    windSpeed: "ความเร็วลม (m/s)",
    rainfall: "ปริมาณน้ำฝน (mm)",
    atmosphericPressure: "ความกดอากาศ (hPa)",
    vpd: "VPD สำหรับทุเรียน (kPa)",
    soilMoisture1: "ความชื้นดิน 1 (%)",
    soilMoisture2: "ความชื้นดิน 2 (%)",
  }
  return names[sensorKey] || sensorKey
}

/**
 * Get chart color for a sensor
 */
export function getSensorColor(sensorKey: string): string {
  const colors: Record<string, string> = {
    airTemperature: "#ef4444",
    relativeHumidity: "#3b82f6",
    lightIntensity: "#fbbf24",
    windSpeed: "#06b6d4",
    rainfall: "#0ea5e9",
    atmosphericPressure: "#8b5cf6",
    vpd: "#ec4899",
    soilMoisture1: "#84cc16",
    soilMoisture2: "#22c55e",
  }
  return colors[sensorKey] || "#6b7280"
}
