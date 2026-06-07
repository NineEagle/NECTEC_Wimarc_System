import type { OverviewStation, PairStatus } from "@/components/overview/overviewTypes"
import { getLiveData } from "@/services/sensorService"

function pingOnline(liveData: any): boolean {
  const ago = liveData?.lastPing
    ? (Date.now() - new Date(liveData.lastPing).getTime()) / 1000
    : Infinity
  return ago <= 600
}

export function toOverviewStation(
  meta: { id: string; name: string; province: string; lat?: number; lng?: number },
  mainLive: any,
  clientLive: any,
): OverviewStation {
  const mainOnline = pingOnline(mainLive)
  const clientOnline = pingOnline(clientLive)
  const mainStatus: "online" | "offline" = mainOnline ? "online" : "offline"
  const clientStatus: "online" | "offline" = clientOnline ? "online" : "offline"
  const status: PairStatus =
    mainOnline && clientOnline   ? "both-online"  :
    !mainOnline && !clientOnline ? "both-offline" :
    mainOnline                   ? "main-only"    : "client-only"

  return {
    id: meta.id,
    name: meta.name,
    province: meta.province,
    status,
    mainStatus,
    clientStatus,
    batteryVoltage: mainLive?.batteryVoltage ?? null,
    lat: meta.lat,
    lng: meta.lng,
    main: {
      imageUrl: mainLive?.imageUrl ?? null,
      imageTime: mainLive?.imageTime ?? null,
      sensors: {
        airTemperature: mainLive?.airTemperature ?? null,
        relativeHumidity: mainLive?.relativeHumidity ?? null,
        lightIntensity: mainLive?.lightIntensity ?? null,
        rainfall: mainLive?.rainfall ?? null,
        windSpeed: mainLive?.windSpeed ?? null,
        windDirection: mainLive?.windDirection ?? null,
        atmosphericPressure: mainLive?.atmosphericPressure ?? null,
        vpd: mainLive?.vpd ?? null,
      },
    },
    client: {
      imageUrl: clientLive?.imageUrl ?? null,
      imageTime: clientLive?.imageTime ?? null,
      sensors: {
        soilMoisture1: clientLive?.soilMoisture1 ?? null,
        soilTemperature1: clientLive?.soilTemperature1 ?? null,
        soilMoisture2: clientLive?.soilMoisture2 ?? null,
        soilTemperature2: clientLive?.soilTemperature2 ?? null,
      },
    },
  }
}

export async function getOverviewData(
  stations: { id: string; name: string; province?: string; lat?: number; lng?: number }[],
): Promise<OverviewStation[]> {
  const bases = stations.filter(s => !s.id.endsWith("c"))

  const results = await Promise.all(
    bases.map(async (st) => {
      const [mainLive, clientLive] = await Promise.allSettled([
        getLiveData(st.id),
        getLiveData(`${st.id}c`),
      ])
      return toOverviewStation(
        { ...st, province: st.province ?? "" },
        mainLive.status === "fulfilled" ? mainLive.value : null,
        clientLive.status === "fulfilled" ? clientLive.value : null,
      )
    }),
  )
  return results
}
