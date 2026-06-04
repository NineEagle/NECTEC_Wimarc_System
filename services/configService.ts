import type { SystemConfig, StationConfig } from "@/components/config/configTypes"
import { defaultSystem, defaultStation } from "@/components/config/configUtils"
import { apiRequest } from "@/services/apiClient"

export async function getSystemConfig(): Promise<SystemConfig> {
  try {
    const data = await apiRequest<Record<string, unknown>>("/config/system")
    if (data && Object.keys(data).length > 0) {
      const def = defaultSystem()
      const merged = { ...def, ...(data as any) } as SystemConfig
      // Deep-merge nested objects so new keys added later always have defaults
      if (!merged.globalAlerts) merged.globalAlerts = def.globalAlerts
      else {
        for (const key of Object.keys(def.globalAlerts) as Array<keyof typeof def.globalAlerts>) {
          if (!merged.globalAlerts[key]) merged.globalAlerts[key] = def.globalAlerts[key]
        }
      }
      return merged
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
