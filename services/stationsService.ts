/**
 * Stations service
 * Handles all station-related data operations
 */

import type { Station, StationImage } from "@/types"
import { apiRequest, ApiError } from "@/services/apiClient"
import { mapStation, mapStationImage } from "@/services/apiMappers"

/**
 * Get all stations
 */
export async function getAllStations(includeAll = false): Promise<Station[]> {
  const url = includeAll ? "/stations?include_all=true" : "/stations"
  const stations = await apiRequest<any[]>(url)
  return stations.map(mapStation)
}

/**
 * Get station by ID
 */
export async function getStationById(stationId: string): Promise<Station | null> {
  try {
    const station = await apiRequest<any>(`/stations/${stationId}`)
    return mapStation(station)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null
    }
    throw error
  }
}

/**
 * Get the single weather station nearest to a coordinate.
 * Used by Guest auto-location.
 */
export async function getNearestStation(lat: number, lon: number): Promise<Station | null> {
  try {
    const station = await apiRequest<any>("/stations/nearest", {
      query: { lat, lon },
    })
    return mapStation(station)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null
    }
    throw error
  }
}

/**
 * Get stations by owner
 */
export async function getStationsByOwner(userId: string): Promise<Station[]> {
  const stations = await apiRequest<any[]>("/stations", {
    query: { owner_id: userId },
  })
  return stations.map(mapStation)
}

/**
 * Get latest image for a station
 */
export async function getStationLatestImage(stationId: string): Promise<StationImage | null> {
  try {
    const image = await apiRequest<any>(`/stations/${stationId}/images/latest`)
    return mapStationImage(image)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null
    }
    throw error
  }
}

/**
 * Get station status summary for admin
 */
export async function getStationStatusSummary() {
  const stations = await getAllStations()
  return {
    total: stations.length,
    online: stations.filter((s) => s.status === "online").length,
    offline: stations.filter((s) => s.status === "offline").length,
  }
}

export class StationsService {
  static async getStationsByUser(user: any): Promise<Station[]> {
    if (user.role === "Admin") {
      return getAllStations()
    }
    const allStations = await getAllStations()
    return allStations.filter((s) => user.permittedStationIds.includes(s.id))
  }
}
