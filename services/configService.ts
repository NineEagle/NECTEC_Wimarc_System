import type { SystemConfig, StationConfig } from "@/components/config/configTypes"
import { defaultSystem, defaultStation } from "@/components/config/configUtils"
import { apiRequest } from "@/services/apiClient"

export async function getSystemConfig(): Promise<SystemConfig> {
  try {
    const data = await apiRequest<Record<string, unknown>>("/config/system")
    // Merge with defaults so any new fields added to SystemConfig are always present
    // even when the DB was saved before those fields existed.
    if (data && Object.keys(data).length > 0) {
      return { ...defaultSystem(), ...(data as any) } as SystemConfig
    }
  } catch { /* fall through to defaults */ }
  return defaultSystem()
}

export async function getStationConfigs(
  stationIds: string[],
): Promise<Record<string, StationConfig>> {
  const map: Record<string, StationConfig> = {}
  for (const id of stationIds) map[id] = defaultStation()
  try {
    const data = await apiRequest<Record<string, StationConfig>>("/config/stations")
    for (const id of stationIds) {
      if (data[id]) map[id] = { ...defaultStation(), ...data[id] }
    }
  } catch { /* keep defaults */ }
  return map
}

export async function saveConfig(payload: {
  system: SystemConfig
  stations: Record<string, StationConfig>
}): Promise<void> {
  await apiRequest("/config", {
    method: "PUT",
    body: payload,
  })
}
