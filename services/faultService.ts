/**
 * Station hardware fault log service
 *
 * Admin-only CRUD over manually recorded hardware failures. Nothing here is
 * derived from telemetry — a station going quiet says the data stopped, not
 * which physical part broke, so every row is operator-entered.
 */

import type { FaultDeviceKey, StationFault } from "@/types"
import { apiRequest, ApiError } from "@/services/apiClient"
import { mapStationFault } from "@/services/apiMappers"

/**
 * Devices are grouped only for readability in the picker — every group is
 * offered for every station. wimarc{N} and wimarc{N}c are two halves of one
 * physical mast, so a single site really does have both the rain gauge and
 * the soil probes.
 */
export type FaultDeviceGroup = "weather" | "soil" | "hardware"

export const FAULT_DEVICE_GROUP_LABELS: Record<FaultDeviceGroup, string> = {
  weather: "เซนเซอร์อากาศ",
  soil: "เซนเซอร์ดิน",
  hardware: "ฮาร์ดแวร์ / ระบบ",
}

export interface FaultDevice {
  key: FaultDeviceKey
  label: string
  group: FaultDeviceGroup
}

/**
 * Device catalog. Keys must stay in sync with FAULT_DEVICE_KEYS in
 * backend/app/schemas.py — the backend rejects anything outside that set so a
 * stray key cannot fragment the per-device occurrence counts.
 */
export const FAULT_DEVICES: FaultDevice[] = [
  { key: "rain", label: "น้ำฝน", group: "weather" },
  { key: "air_temp", label: "อุณหภูมิอากาศ", group: "weather" },
  { key: "humidity", label: "ความชื้นสัมพัทธ์", group: "weather" },
  { key: "wind_speed", label: "ความเร็วลม", group: "weather" },
  { key: "wind_direction", label: "ทิศทางลม", group: "weather" },
  { key: "light", label: "ความเข้มแสง", group: "weather" },
  { key: "pressure", label: "ความกดอากาศ", group: "weather" },
  { key: "soil_moist1", label: "ความชื้นดิน 15 ซม.", group: "soil" },
  { key: "soil_moist2", label: "ความชื้นดิน 30 ซม.", group: "soil" },
  { key: "soil_temp1", label: "อุณหภูมิดิน 15 ซม.", group: "soil" },
  { key: "soil_temp2", label: "อุณหภูมิดิน 30 ซม.", group: "soil" },
  { key: "battery", label: "แบตเตอรี่", group: "hardware" },
  { key: "solar_panel", label: "แผงโซลาร์", group: "hardware" },
  { key: "sim_signal", label: "SIM / สัญญาณ", group: "hardware" },
  { key: "datalogger", label: "กล่องควบคุม (datalogger)", group: "hardware" },
  { key: "camera", label: "กล้อง", group: "hardware" },
  { key: "structure", label: "เสา / โครงสร้าง", group: "hardware" },
  { key: "other", label: "อื่นๆ", group: "hardware" },
]

const DEVICE_LABELS: Record<string, string> = Object.fromEntries(
  FAULT_DEVICES.map((d) => [d.key, d.label]),
)

/** Catalog split into display groups, preserving catalog order within each. */
export function getGroupedDevices(): { group: FaultDeviceGroup; devices: FaultDevice[] }[] {
  const groups: FaultDeviceGroup[] = ["weather", "soil", "hardware"]
  return groups.map((group) => ({
    group,
    devices: FAULT_DEVICES.filter((d) => d.group === group),
  }))
}

/** Display name for a fault row — "อื่นๆ" shows the operator's own wording. */
export function faultDeviceLabel(fault: Pick<StationFault, "device" | "deviceOther">): string {
  if (fault.device === "other") return fault.deviceOther?.trim() || "อื่นๆ"
  return DEVICE_LABELS[fault.device] || fault.device
}

export interface FaultFilters {
  stationId?: string
  device?: FaultDeviceKey
}

export async function getFaults(filters: FaultFilters = {}): Promise<StationFault[]> {
  const query: Record<string, string> = {}
  if (filters.stationId) query.station_id = filters.stationId
  if (filters.device) query.device = filters.device

  const faults = await apiRequest<any[]>("/faults", { query })
  return faults.map(mapStationFault)
}

export type FaultInput = {
  stationId: string
  device: FaultDeviceKey
  deviceOther?: string | null
  symptom: string
  note?: string | null
}

function toPayload(input: Partial<FaultInput>): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  if (input.stationId !== undefined) payload.station_id = input.stationId
  if (input.device !== undefined) payload.device = input.device
  if (input.deviceOther !== undefined) payload.device_other = input.deviceOther || null
  if (input.symptom !== undefined) payload.symptom = input.symptom
  if (input.note !== undefined) payload.note = input.note || null
  return payload
}

export async function createFault(input: FaultInput): Promise<StationFault> {
  const created = await apiRequest<any>("/faults", { method: "POST", body: toPayload(input) })
  return mapStationFault(created)
}

export async function updateFault(
  faultId: string,
  updates: Partial<FaultInput>,
): Promise<StationFault | null> {
  try {
    const updated = await apiRequest<any>(`/faults/${faultId}`, {
      method: "PUT",
      body: toPayload(updates),
    })
    return mapStationFault(updated)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}

export async function deleteFault(faultId: string): Promise<boolean> {
  try {
    await apiRequest<void>(`/faults/${faultId}`, { method: "DELETE" })
    return true
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return false
    throw error
  }
}
