import type { SystemConfig, StationConfig } from "@/components/config/configTypes"
import { defaultSystem, defaultStation } from "@/components/config/configUtils"
import { apiRequest } from "@/services/apiClient"

/**
 * Per-key merge for a nested config record (limits / conversions).
 * A payload that is missing one sensor key must fall back to that key's default
 * instead of wiping the whole sub-object. Arrays are replaced wholesale — never
 * merged element-wise.
 */
function mergeNested<T extends Record<string, any>>(def: T, incoming: unknown): T {
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) return { ...def }
  const out: Record<string, any> = { ...def }
  for (const [key, value] of Object.entries(incoming as Record<string, unknown>)) {
    if (value === undefined) continue
    const base = (def as Record<string, any>)[key]
    const bothPlainObjects =
      !!base && typeof base === "object" && !Array.isArray(base) &&
      !!value && typeof value === "object" && !Array.isArray(value)
    out[key] = bothPlainObjects ? { ...base, ...(value as Record<string, unknown>) } : value
  }
  return out as T
}

export async function getSystemConfig(): Promise<SystemConfig> {
  try {
    const data = await apiRequest<Record<string, unknown>>("/config/system")
    if (data && Object.keys(data).length > 0) {
      const def = defaultSystem()
      const merged = { ...def, ...(data as any) } as SystemConfig
      // Deep-merge nested objects so new keys added later always have defaults
      merged.conversions = mergeNested(def.conversions, (data as any).conversions)
      merged.limits = mergeNested(def.limits, (data as any).limits)
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
