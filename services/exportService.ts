/**
 * Export service for CSV generation
 * Handles data export to CSV format with Thai column headers
 */

import type { SensorReading, DailyAggregate, PlotActivity, TimeRange } from "@/types"
import { formatThaiDateTime, formatThaiDate } from "@/utils/dateUtils"

/**
 * Convert array of objects to CSV string
 */
function convertToCSV(data: any[], headers: Record<string, string>): string {
  if (data.length === 0) return ""

  // Create header row
  const headerKeys = Object.keys(headers)
  const headerRow = headerKeys.map((key) => headers[key]).join(",")

  // Create data rows
  const dataRows = data.map((row) => {
    return headerKeys
      .map((key) => {
        const value = row[key]
        if (value === null || value === undefined) return ""
        // Escape commas and quotes in values
        const stringValue = String(value)
        if (stringValue.includes(",") || stringValue.includes('"')) {
          return `"${stringValue.replace(/"/g, '""')}"`
        }
        return stringValue
      })
      .join(",")
  })

  return [headerRow, ...dataRows].join("\n")
}

/**
 * Download CSV file
 */
function downloadCSV(filename: string, csvContent: string) {
  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)

  link.setAttribute("href", url)
  link.setAttribute("download", filename)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Export time-series sensor data to CSV
 */
export function exportSensorDataToCSV(
  stationName: string,
  readings: SensorReading[],
  selectedSensors: string[],
  timeRange: TimeRange,
) {
  const fmtDate = (d: Date) =>
    d.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" })
  const fmtTime = (d: Date) =>
    d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false })

  // Prepare data for export
  const exportData = readings.map((reading) => {
    const row: any = {
      _date: fmtDate(reading.timestamp),
      _time: fmtTime(reading.timestamp),
    }

    // Add selected sensor values
    selectedSensors.forEach((sensor) => {
      row[sensor] = reading[sensor as keyof SensorReading] || ""
    })

    return row
  })

  // Define headers
  const headers: Record<string, string> = {
    _date: "วันที่",
    _time: "เวลา",
  }

  selectedSensors.forEach((sensor) => {
    switch (sensor) {
      case "airTemperature":
        headers[sensor] = "อุณหภูมิอากาศ (°C)"
        break
      case "relativeHumidity":
        headers[sensor] = "ความชื้นสัมพัทธ์ (%)"
        break
      case "lightIntensity":
        headers[sensor] = "ความเข้มแสง (lux)"
        break
      case "windSpeed":
        headers[sensor] = "ความเร็วลม (m/s)"
        break
      case "windDirection":
        headers[sensor] = "ทิศทางลม (°)"
        break
      case "rainfall":
        headers[sensor] = "ปริมาณน้ำฝน (mm)"
        break
      case "atmosphericPressure":
        headers[sensor] = "ความกดอากาศ (hPa)"
        break
      case "vpd":
        headers[sensor] = "VPD (kPa)"
        break
      case "soilMoisture1":
        headers[sensor] = "ความชื้นดิน 15cm (%)"
        break
      case "soilMoisture2":
        headers[sensor] = "ความชื้นดิน 30cm (%)"
        break
      case "soilTemperature1":
        headers[sensor] = "อุณหภูมิดิน 15cm (°C)"
        break
      case "soilTemperature2":
        headers[sensor] = "อุณหภูมิดิน 30cm (°C)"
        break
    }
  })

  const csv = convertToCSV(exportData, headers)
  const fullFilename = `${stationName}_รายเวลา_${timeRange}วัน_${new Date().toISOString().split("T")[0]}.csv`

  downloadCSV(fullFilename, csv)
}

/**
 * Export daily aggregates to CSV
 */
export function exportDailyDataToCSV(stationName: string, aggregates: DailyAggregate[], timeRange: TimeRange) {
  const exportData = aggregates.map((agg) => ({
    date: formatThaiDate(agg.date),
    avgTemp: agg.avgTemperature || "",
    minTemp: agg.minTemperature || "",
    maxTemp: agg.maxTemperature || "",
    avgHumidity: agg.avgHumidity || "",
    minHumidity: agg.minHumidity || "",
    maxHumidity: agg.maxHumidity || "",
    avgLight: agg.avgLightIntensity || "",
    avgWind: agg.avgWindSpeed || "",
    avgPressure: agg.avgPressure || "",
    minPressure: agg.minPressure || "",
    maxPressure: agg.maxPressure || "",
    totalRainfall: agg.totalRainfall || "",
    avgVpd: agg.avgVpd || "",
    avgSoil1: agg.avgSoilMoisture1 || "",
    avgSoil2: agg.avgSoilMoisture2 || "",
  }))

  const headers = {
    date: "วันที่",
    avgTemp: "อุณหภูมิเฉลี่ย (°C)",
    minTemp: "อุณหภูมิต่ำสุด (°C)",
    maxTemp: "อุณหภูมิสูงสุด (°C)",
    avgHumidity: "ความชื้นเฉลี่ย (%)",
    minHumidity: "ความชื้นต่ำสุด (%)",
    maxHumidity: "ความชื้นสูงสุด (%)",
    avgLight: "ความเข้มแสงเฉลี่ย (lux)",
    avgWind: "ความเร็วลมเฉลี่ย (m/s)",
    avgPressure: "ความกดอากาศเฉลี่ย (hPa)",
    minPressure: "ความกดอากาศต่ำสุด (hPa)",
    maxPressure: "ความกดอากาศสูงสุด (hPa)",
    totalRainfall: "ปริมาณน้ำฝนรวม (mm)",
    avgVpd: "VPD เฉลี่ย (kPa)",
    avgSoil1: "ความชื้นดิน 15cm เฉลี่ย (%)",
    avgSoil2: "ความชื้นดิน 30cm เฉลี่ย (%)",
  }

  const csv = convertToCSV(exportData, headers)
  const fullFilename = `${stationName}_รายวัน_${timeRange}วัน_${new Date().toISOString().split("T")[0]}.csv`

  downloadCSV(fullFilename, csv)
}

/**
 * Export plot activities to CSV
 */
export function exportActivitiesToCSV(activities: PlotActivity[]) {
  const exportData = activities.map((activity) => ({
    date: formatThaiDate(activity.date),
    type: activity.activityType,
    description: activity.description,
    createdBy: activity.createdByName,
    createdAt: formatThaiDateTime(activity.createdAt),
    imageCount: activity.images.length,
  }))

  const headers = {
    date: "วันที่",
    type: "ประเภทกิจกรรม",
    description: "รายละเอียด",
    createdBy: "บันทึกโดย",
    createdAt: "วันที่บันทึก",
    imageCount: "จำนวนรูปภาพ",
  }

  const csv = convertToCSV(exportData, headers)
  const fullFilename = `กิจกรรมแปลง_${new Date().toISOString().split("T")[0]}.csv`

  downloadCSV(fullFilename, csv)
}

/**
 * Generic CSV export function for any data structure
 */
export function exportToCSV(data: any[], filename: string) {
  if (data.length === 0) return

  // Auto-generate headers from first row keys
  const keys = Object.keys(data[0])
  const headers: Record<string, string> = {}
  keys.forEach((key) => {
    headers[key] = key
  })

  const csv = convertToCSV(data, headers)
  const fullFilename = `${filename}_${new Date().toISOString().split("T")[0]}.csv`

  downloadCSV(fullFilename, csv)
}
