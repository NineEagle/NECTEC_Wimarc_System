/**
 * Type definitions for WiMaRC (Wireless Monitoring and Recording of Environment Conditions)
 * Contains all TypeScript interfaces and types used throughout the application
 */

// User role enum
export type UserRole = "Admin" | "User" | "Guest"

// User interface - represents a system user with credentials and permissions
export interface User {
  id: string
  username: string
  password?: string // In production, this would be hashed
  role: UserRole
  fullName: string
  email: string
  isEnabled: boolean
  permittedStationIds: string[] // Station IDs this user can access
  createdAt: Date
}

// Station type enum
export type StationType = "weather" | "soil"

// Station status
export type StationStatus = "online" | "offline"

// Station interface - represents a physical monitoring station
export interface Station {
  id: string
  name: string
  type: StationType
  ownerId: string // User ID who owns this station
  latitude: number
  longitude: number
  status: StationStatus
  lastDataTime: Date | null
  area: string // Geographic area name in Thai
  description: string
}

// Sensor reading - time-series data point from a sensor
export interface SensorReading {
  stationId: string
  timestamp: Date
  // Station 1 (Weather) sensors
  airTemperature?: number // °C
  relativeHumidity?: number // %
  lightIntensity?: number // lux
  windDirection?: number // degrees
  windSpeed?: number // m/s
  rainfall?: number // mm
  atmosphericPressure?: number // hPa
  vpd?: number // kPa - calculated from temp and humidity
  // Station 2 (Soil) sensors
  soilMoisture1?: number // % at 15 cm
  soilMoisture2?: number // % at 30 cm
  soilTemperature1?: number // °C at 15 cm
  soilTemperature2?: number // °C at 30 cm
}

// Station image
export interface StationImage {
  stationId: string
  imageUrl: string
  timestamp: Date
}

// Weather forecast data from external API
export interface WeatherForecast {
  stationId: string
  forecastDate: Date
  temperature: number // °C
  rainProbability: number // %
  rainfall: number // mm
  description: string
}

// Plot activity - agricultural activities recorded by users
export interface PlotActivity {
  id: string
  stationId: string
  date: Date
  activityType: string // e.g., "รดน้ำ", "ใส่ปุ๋ย", "เก็บเกี่ยว"
  description: string
  createdBy: string // User ID
  createdByName: string
  createdAt: Date
  images: string[] // Array of image URLs, max 3
}

// SIM payment status
export type SimPaymentStatus = "pending" | "paid"

// SIM payment record - tracks payment due dates for SIM cards
export interface SimPayment {
  id: string
  stationId: string
  stationName?: string
  simNumber: string
  provider: string
  amount: number
  dueDate: Date
  status: SimPaymentStatus
  paidDate?: Date | null
  notes?: string
}

// Legacy SIM payment record used by mock data
export interface SimPaymentRecord {
  id: string
  simNumber: string
  stationId: string
  stationName: string
  paymentDueDate: Date
  paymentStatus: "normal" | "nearDue" | "overdue" // nearDue = within 7 days
}

// Daily aggregated data for analytics
export interface DailyAggregate {
  date: Date
  stationId: string
  // Average values
  avgTemperature?: number
  avgHumidity?: number
  avgLightIntensity?: number
  avgWindSpeed?: number
  avgPressure?: number
  avgSoilMoisture1?: number
  avgSoilMoisture2?: number
  avgVpd?: number
  // Min/Max values
  minTemperature?: number
  maxTemperature?: number
  minHumidity?: number
  maxHumidity?: number
  minPressure?: number
  maxPressure?: number
  // Total rainfall
  totalRainfall?: number
}

// Live real-time snapshot for a station
export interface LiveData {
  lastPing: Date | null        // device heartbeat from updatedata (~1 min)
  sensorTime: Date | null      // last saved sensor record (~10 min)
  airTemperature?: number
  relativeHumidity?: number
  lightIntensity?: number
  windDirection?: number
  windSpeed?: number
  rainfall?: number
  atmosphericPressure?: number
  vpd?: number
  soilMoisture1?: number
  soilMoisture2?: number
  soilTemperature1?: number
  soilTemperature2?: number
  imageUrl?: string
  imageTime: Date | null       // last saved image (~1 hour)
}

// Time range options for historical data
export type TimeRange = 3 | 7 | 15 | 30

// Auth context type
export interface AuthContextType {
  user: User | null
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  isAuthenticated: boolean
  isAuthLoading: boolean
}
