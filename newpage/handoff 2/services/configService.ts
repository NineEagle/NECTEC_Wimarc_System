// services/configService.ts
//
// Load + persist WiMaRC system settings (route /config).
//
// The page calls:
//   getSystemConfig()                    → global conversion/range/display config
//   getStationConfigs(stationIds)        → per-station VPD + alert config
//   saveConfig({ system, stations })     → persist both (admin only)
//
// Replace the bodies below with your real API calls. Until then they return the
// factory defaults so the page renders. `defaultSystem` / `defaultStation` are
// the same shapes the UI edits, so a missing station simply falls back to
// defaults (badge shows "ค่าเริ่มต้น").

import type { SystemConfig, StationConfig } from "@/components/config/configTypes"
import { defaultSystem, defaultStation } from "@/components/config/configUtils"

// ---- READ: global system config ----
export async function getSystemConfig(): Promise<SystemConfig> {
  // const res = await fetch("/api/config/system")
  // return (await res.json()) as SystemConfig
  return defaultSystem()
}

// ---- READ: per-station configs (keyed by station id) ----
export async function getStationConfigs(
  stationIds: string[],
): Promise<Record<string, StationConfig>> {
  // const res = await fetch("/api/config/stations")
  // const rows: { stationId: string; config: StationConfig }[] = await res.json()
  // const map: Record<string, StationConfig> = {}
  // for (const id of stationIds) map[id] = defaultStation()
  // for (const r of rows) map[r.stationId] = r.config
  // return map

  // placeholder: every station starts on defaults
  const map: Record<string, StationConfig> = {}
  for (const id of stationIds) map[id] = defaultStation()
  return map
}

// ---- WRITE: persist everything in one transaction (admin only) ----
export async function saveConfig(payload: {
  system: SystemConfig
  stations: Record<string, StationConfig>
}): Promise<void> {
  // await fetch("/api/config", {
  //   method: "PUT",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify(payload),
  // })
  // if (!res.ok) throw new Error("save failed")

  // placeholder: pretend the round-trip took ~900ms
  await new Promise((r) => setTimeout(r, 900))
  // eslint-disable-next-line no-console
  console.info("[configService] saveConfig payload", payload)
}
