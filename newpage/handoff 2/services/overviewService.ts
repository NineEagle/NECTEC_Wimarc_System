// services/overviewService.ts
//
// Supplies live data for ALL permitted stations to the overview page.
//
// You have two ways to wire this up:
//
//  A) If your backend already returns every station in one call, replace the
//     body of getOverviewData() with that fetch and map it to OverviewStation[].
//
//  B) If you only have getLiveData(stationId) (one station at a time), keep the
//     fan-out version below — it calls the existing service for each permitted
//     station in parallel.
//
// Either way the page just awaits getOverviewData(stationIds).

import type { OverviewStation, StationStatus } from "@/components/overview/overviewTypes"
// import { getLiveData } from "@/services/sensorService"  // ← your existing service
// import type { LiveData } from "@/types"

// Map one station's raw LiveData (+ static meta) into an OverviewStation.
// NOTE: windDirection and batteryVoltage must be added to your LiveData payload.
export function toOverviewStation(
  meta: { id: string; name: string; province: string; lat?: number; lng?: number },
  live: any /* LiveData & { windDirection, batteryVoltage, clientImageUrl } */,
): OverviewStation {
  const pingAgoSec = live?.lastPing ? (Date.now() - new Date(live.lastPing).getTime()) / 1000 : Infinity
  const status: StationStatus =
    pingAgoSec === Infinity || pingAgoSec > 600 ? "offline" : pingAgoSec > 180 ? "weak" : "online"

  return {
    id: meta.id,
    name: meta.name,
    province: meta.province,
    status,
    batteryVoltage: live?.batteryVoltage ?? null,
    lat: meta.lat,
    lng: meta.lng,
    main: {
      imageUrl: live?.imageUrl ?? null,
      imageTime: live?.imageTime ? new Date(live.imageTime) : null,
      sensors: {
        airTemperature: live?.airTemperature ?? null,
        relativeHumidity: live?.relativeHumidity ?? null,
        lightIntensity: live?.lightIntensity ?? null,
        rainfall: live?.rainfall ?? null,
        windSpeed: live?.windSpeed ?? null,
        windDirection: live?.windDirection ?? null,
        atmosphericPressure: live?.atmosphericPressure ?? null,
        vpd: live?.vpd ?? null,
      },
    },
    client: {
      imageUrl: live?.clientImageUrl ?? null,
      imageTime: live?.clientImageTime ? new Date(live.clientImageTime) : null,
      sensors: {
        soilMoisture1: live?.soilMoisture1 ?? null,
        soilTemperature1: live?.soilTemperature1 ?? null,
        soilMoisture2: live?.soilMoisture2 ?? null,
        soilTemperature2: live?.soilTemperature2 ?? null,
      },
    },
  }
}

// Fan-out version (option B). Pass the permitted stations from StationContext.
export async function getOverviewData(
  stations: { id: string; name: string; province?: string; lat?: number; lng?: number }[],
): Promise<OverviewStation[]> {
  // --- Option B: fan-out over the existing single-station service ---
  // const results = await Promise.all(
  //   stations.map(async (st) => {
  //     const live = await getLiveData(st.id)
  //     return toOverviewStation({ ...st, province: st.province ?? "" }, live)
  //   }),
  // )
  // return results

  // --- Option A: one backend call ---
  // const res = await fetch("/api/stations/overview")
  // const rows = await res.json()
  // return rows.map((r) => toOverviewStation(r.meta, r.live))

  throw new Error("Wire getOverviewData() to your backend — see comments above.")
}
