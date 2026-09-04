/**
 * Station Map Page (แผนที่จุดติดตั้งอุปกรณ์)
 * Interactive map showing all permitted station locations
 * Click markers to view station details and navigate to dashboard
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import {
  getAllStations,
  getStationLatestImage,
} from "@/services/stationsService";
import { getAllUsers } from "@/services/userService";
import { getLatestSensorReading } from "@/services/sensorService";
import { getPermittedStations, canAccessAdminPages } from "@/utils/permissions";
import { clearApiCache } from "@/services/apiClient";
import type { Station, SensorReading, StationImage } from "@/types";

type PairStatus = "both-online" | "both-offline" | "main-only" | "client-only";

function getPairStatus(
  baseId: string,
  stationMap: Map<string, Station>,
): PairStatus {
  const main = stationMap.get(baseId);
  const client = stationMap.get(baseId + "c");
  const mainOn = main?.status === "online";
  const clientOn = client?.status === "online";
  if (!client) return mainOn ? "both-online" : "both-offline";
  if (!main) return clientOn ? "both-online" : "both-offline";
  if (mainOn && clientOn) return "both-online";
  if (!mainOn && !clientOn) return "both-offline";
  return mainOn ? "main-only" : "client-only";
}

const STATUS_CFG: Record<
  PairStatus,
  { dot: string; text: string; label: string; animate?: boolean }
> = {
  "both-online": {
    dot: "bg-green-500",
    text: "text-green-700",
    label: "ออนไลน์ทั้งคู่",
    animate: true,
  },
  "both-offline": {
    dot: "bg-red-500",
    text: "text-red-700",
    label: "ออฟไลน์ทั้งคู่",
  },
  "main-only": {
    dot: "bg-yellow-500",
    text: "text-yellow-700",
    label: "สถานีอากาศ Online, สถานีดิน Offline",
  },
  "client-only": {
    dot: "bg-orange-500",
    text: "text-orange-700",
    label: "สถานีอากาศ Offline, สถานีดิน Online",
  },
};

const fmtStationId = (id: string) => {
  const m = id.match(/^wimarc(\d+)(c?)$/i);
  if (!m) return id;
  return `Wimarc${String(m[1]).padStart(2, "0")}${m[2]}`;
};
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatThaiDateTime } from "@/utils/dateUtils";
import { Navigation, Table, Phone, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  StationPopup,
  type StationPopupData,
  type Metric,
} from "@/components/map/StationPopup";
import { Thermometer, Droplets, CloudRain, Wind } from "lucide-react";

// Leaflet + OpenStreetMap: free tiles, no API key, no Google Cloud billing.
// Same props as the old ModernMap, so only this import line changed.
const ModernMap = dynamic(() => import("@/components/maps/StationMapLeaflet"), {
  ssr: false,
  loading: function MapLoading() {
    return (
      <div className="h-[500px] flex items-center justify-center bg-muted/20 rounded-xl text-sm text-muted-foreground animate-pulse">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xs font-bold uppercase tracking-widest opacity-50">
            กำลังเตรียมแผนที่...
          </p>
        </div>
      </div>
    );
  },
});

export default function MapPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [allStations, setAllStations] = useState<Station[]>([]);
  const [permittedStations, setPermittedStations] = useState<Station[]>([]);
  const [userMap, setUserMap] = useState<
    Map<string, { name: string; phone?: string }>
  >(new Map());
  const [selectedStationId, setSelectedStationId] = useState<string | null>(
    null,
  );
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [selectedMainReading, setSelectedMainReading] =
    useState<SensorReading | null>(null);
  const [selectedClientReading, setSelectedClientReading] =
    useState<SensorReading | null>(null);
  const [selectedImage, setSelectedImage] = useState<StationImage | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      clearApiCache("/stations");
      const [allStationsData, permittedStationsData, users] = await Promise.all(
        [
          getAllStations(true), // backend gates this by mapShareLocations for non-admins
          getAllStations(false), // always returns only permitted
          getAllUsers().catch(() => []),
        ],
      );
      setAllStations(allStationsData);
      setUserMap(
        new Map(
          users.map((u) => [
            String(u.id),
            { name: u.fullName, phone: u.phone },
          ]),
        ),
      );
      setPermittedStations(permittedStationsData);
      if (permittedStationsData.length > 0)
        setSelectedStationId(permittedStationsData[0].id);
      setIsLoading(false);
    };
    loadData();
  }, [user]);

  useEffect(() => {
    if (!selectedStationId) return;
    const baseId = selectedStationId.replace(/c$/, "");
    const station =
      allStations.find((s) => s.id === baseId) ??
      allStations.find((s) => s.id === selectedStationId);
    if (!station) return;
    setSelectedStation(station);
    let isCancelled = false;
    const loadDetails = async () => {
      const [mainReading, clientReading, image] = await Promise.all([
        getLatestSensorReading(baseId),
        getLatestSensorReading(baseId + "c").catch(() => null),
        getStationLatestImage(baseId),
      ]);
      if (isCancelled) return;
      setSelectedMainReading(mainReading);
      setSelectedClientReading(clientReading);
      setSelectedImage(image);
    };
    loadDetails();
    return () => {
      isCancelled = true;
    };
  }, [selectedStationId, allStations]);

  const isAdmin = canAccessAdminPages(user);
  const permittedIdSet = useMemo(
    () => new Set(permittedStations.map((s) => s.id)),
    [permittedStations],
  );

  const tableStations = useMemo(() => {
    const seen = new Set<string>();
    const wimarcNum = (id: string) => {
      const m = id.match(/^wimarc(\d+)/i);
      return m ? parseInt(m[1], 10) : 9999;
    };
    return permittedStations
      .filter((s) => {
        const baseId = s.id.replace(/c$/, "");
        if (seen.has(baseId)) return false;
        seen.add(baseId);
        return true;
      })
      .sort((a, b) => wimarcNum(a.id) - wimarcNum(b.id));
  }, [permittedStations]);

  const stationByIdMap = useMemo(() => {
    const map = new Map<string, Station>();
    for (const s of allStations) map.set(s.id, s);
    return map;
  }, [allStations]);

  const groupCounts = useMemo(() => {
    const c = {
      "both-online": 0,
      "both-offline": 0,
      "main-only": 0,
      "client-only": 0,
    } as Record<PairStatus, number>;
    for (const s of tableStations)
      c[getPairStatus(s.id.replace(/c$/, ""), stationByIdMap)]++;
    return c;
  }, [tableStations, stationByIdMap]);

  const popupData: StationPopupData | null = useMemo(() => {
    if (!selectedStation) return null;
    const baseId = selectedStation.id.replace(/c$/, "");
    const mainStation = stationByIdMap.get(baseId);
    const clientStation = stationByIdMap.get(baseId + "c");
    const f = (n: number | null | undefined, d = 1) =>
      n != null ? n.toFixed(d) : "—";
    const weather: Metric[] = [
      {
        label: "อุณหภูมิ",
        value: f(selectedMainReading?.airTemperature),
        unit: "°C",
        tone: "temp",
        icon: Thermometer,
      },
      {
        label: "ความชื้น",
        value: f(selectedMainReading?.relativeHumidity),
        unit: "%",
        tone: "humid",
        icon: Droplets,
      },
      {
        label: "ฝน",
        value: f(selectedMainReading?.rainfall),
        unit: "mm",
        tone: "rain",
        icon: CloudRain,
      },
      {
        label: "ลม",
        value: f(selectedMainReading?.windSpeed),
        unit: "m/s",
        tone: "wind",
        icon: Wind,
      },
    ];
    const soil: Metric[] = [
      {
        label: "ความชื้นลึก 15 cm",
        value: f(selectedClientReading?.soilMoisture1),
        unit: "%",
        tone: "soil",
        icon: Droplets,
      },
      {
        label: "อุณหภูมิ 15 cm",
        value: f(selectedClientReading?.soilTemperature1),
        unit: "°C",
        tone: "soil",
        icon: Thermometer,
      },
      {
        label: "ความชื้นลึก 30 cm",
        value: f(selectedClientReading?.soilMoisture2),
        unit: "%",
        tone: "soil",
        icon: Droplets,
      },
      {
        label: "อุณหภูมิ 30 cm",
        value: f(selectedClientReading?.soilTemperature2),
        unit: "°C",
        tone: "soil",
        icon: Thermometer,
      },
    ];
    return {
      name: selectedStation.ownerName
        ? `${selectedStation.name} — ${selectedStation.ownerName}`
        : selectedStation.name,
      place: selectedStation.area,
      kind:
        mainStation && clientStation
          ? "อากาศ+ดิน"
          : mainStation
            ? "อากาศ"
            : "ดิน",
      main: mainStation?.status === "online" ? "online" : "offline",
      client: clientStation?.status === "online" ? "online" : "offline",
      vpd: selectedMainReading?.vpd ?? 0,
      weather,
      soil,
      photoUrl:
        isAdmin ||
        permittedIdSet.has(selectedStation.id) ||
        permittedIdSet.has(selectedStation.id.replace(/c$/, ""))
          ? selectedImage?.imageUrl
          : undefined,
      time: selectedImage ? formatThaiDateTime(selectedImage.timestamp) : "",
    };
  }, [
    selectedStation,
    selectedMainReading,
    selectedClientReading,
    selectedImage,
    stationByIdMap,
  ]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto pb-8">
      {/* 1. Header Row */}
      <div className="flex items-end justify-between border-b pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            แผนที่จุดติดตั้งอุปกรณ์{" "}
            {/* <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase">
              TOR 4.5.6
            </span> */}
          </h1>
          {/* <p className="text-xs text-muted-foreground font-mono">
            Table: wimarc_info + heartbeat + google maps
          </p> */}
        </div>
      </div>

      {/* 2. Status Bar */}
      <div className="bg-muted/50 rounded-lg p-3 border shadow-sm">
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-4 gap-y-2 sm:gap-4">
          {(
            [
              "both-online",
              "both-offline",
              "main-only",
              "client-only",
            ] as PairStatus[]
          ).map((k) => (
            <div key={k} className="flex items-center gap-1.5 min-w-0">
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_CFG[k].dot} ${k === "both-online" ? "animate-pulse" : ""}`}
              />
              <span
                className={`font-bold uppercase text-xs sm:text-sm leading-tight ${STATUS_CFG[k].text}`}
              >
                {STATUS_CFG[k].label}: {groupCounts[k]}
              </span>
            </div>
          ))}
        </div>
        {/* <div className="text-[11px] text-muted-foreground font-medium italic flex items-center gap-3">
          TOR ภาคผนวก 5 — จ.จันทบุรี · จ.ระยอง · จ.ตราด (30 จุดติดตั้ง)
          <span className="font-mono text-[10px] text-muted-foreground/50">
            TOR 4.5.6.1 ดึงข้อมูล | 4.5.6.2 จุดติดตั้ง | 4.5.6.3 แผนที่+นำทาง
          </span>
        </div> */}
      </div>

      {/* 3. Map & Side Detail */}
      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-3 shadow-xl border-0 overflow-hidden min-h-[500px] relative rounded-xl bg-slate-100">
          <ModernMap
            stations={allStations}
            onMarkerClick={setSelectedStationId}
            permittedIds={permittedIdSet}
          />
        </Card>

        {/* Selected Station Panel — new StationPopup card */}
        <div className="space-y-2 min-w-0">
          {popupData ? (
            <>
              <StationPopup station={popupData} />
              {(isAdmin || permittedIdSet.has(selectedStation!.id)) && (
                <Button
                  size="sm"
                  className="w-full bg-teal-600 hover:bg-teal-700 gap-2"
                  asChild
                >
                  <Link href={`/dashboard?station=${selectedStation!.id}`}>
                    <ExternalLink className="h-3 w-3" /> เปิดหน้าแดชบอร์ด
                  </Link>
                </Button>
              )}
            </>
          ) : (
            <Card className="h-64 border-dashed flex items-center justify-center text-center p-6 text-muted-foreground/40 italic">
              เลือกสถานีบนแผนที่เพื่อดูข้อมูลรายละเอียด
            </Card>
          )}
        </div>
      </div>

      {/* 4. Comprehensive Station Table (TOR ภาคผนวก 5) */}
      <Card className="shadow-md overflow-hidden">
        <CardHeader className="py-3 bg-muted/30 border-b flex flex-row items-center justify-between">
          <CardTitle className="font-bold uppercase tracking-tight flex items-center gap-2">
            <Table className="h-4 w-4" /> รายการสถานีทั้งหมด (
            {tableStations.length} สถานี)
          </CardTitle>
          {/* <span className="text-muted-foreground uppercase">
            wimarc_info
          </span> */}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 border-b text-muted-foreground uppercase font-bold">
                  <th className="p-3 text-left">ชื่อสถานี</th>
                  <th className="p-3 text-left">เกษตรกร</th>
                  <th className="p-3 text-left">พื้นที่</th>
                  <th className="p-3 text-center">สถานะ</th>
                  <th className="p-3 text-center">อัปเดตล่าสุด</th>
                  <th className="p-3 text-center">โทร</th>
                  <th className="p-3 text-right">ลิงก์ภายนอก</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {tableStations.map((s) => (
                  <tr
                    key={s.id}
                    className={`hover:bg-muted/30 transition-colors ${selectedStationId === s.id ? "bg-teal-50/50" : ""}`}
                    onClick={() => setSelectedStationId(s.id)}
                  >
                    <td className="p-3 font-bold text-teal-700">
                      {fmtStationId(s.id)}
                    </td>
                    <td className="p-3 font-medium">
                      {userMap.get(String(s.ownerId))?.name || "-"}
                    </td>
                    <td className="p-3 text-muted-foreground">{s.area}</td>
                    <td className="p-3 text-center">
                      {(() => {
                        const ps = getPairStatus(
                          s.id.replace(/c$/, ""),
                          stationByIdMap,
                        );
                        const cfg = STATUS_CFG[ps];
                        return (
                          <div className="flex items-center justify-center gap-1.5">
                            <span
                              className={`h-2.5 w-2.5 rounded-full ${cfg.dot} ${cfg.animate ? "animate-pulse" : ""}`}
                            />
                            <span className={`font-bold ${cfg.text}`}>
                              {cfg.label}
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="p-3 text-center text-muted-foreground">
                      {s.lastDataTime
                        ? formatThaiDateTime(s.lastDataTime)
                        : "—"}
                    </td>
                    <td
                      className="p-3 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {(() => {
                        const phone = userMap.get(String(s.ownerId))?.phone;
                        return phone ? (
                          <a
                            href={`tel:${phone}`}
                            className="inline-flex items-center gap-1 text-green-600 hover:text-green-700 font-medium"
                          >
                            <Phone className="h-3 w-3" />
                            {phone}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        );
                      })()}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(
                            `https://www.google.com/maps/dir/?api=1&destination=${s.latitude},${s.longitude}`,
                            "_blank",
                          );
                        }}
                      >
                        <Navigation className="h-3 w-3 mr-1" /> Maps
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
