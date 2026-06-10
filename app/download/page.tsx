"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useStation } from "@/contexts/StationContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  getSensorReadings,
  getDailyAggregates,
  getSensorReadingsByDateRange,
  getForecastHistory,
} from "@/services/sensorService";
import type { SensorReading, DailyAggregate, TimeRange } from "@/types";
import {
  exportSensorDataToCSV,
  exportDailyDataToCSV,
  exportToCSV,
} from "@/services/exportService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import type { DateRange } from "react-day-picker";
import {
  FileDown,
  Database,
  ShieldCheck,
  Loader2,
  Table2,
  CalendarRange,
  Clock,
  Download,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const DATA_TYPES = [
  {
    value: "CAM_main",
    label: "ข้อมูลสภาพอากาศ",
    category: "timeseries",
    sensor: "main",
  },
  {
    value: "CAM_client",
    label: "ข้อมูลเซ็นเซอร์ดิน",
    category: "timeseries",
    sensor: "client",
  },
  { value: "raw", label: "ข้อมูล Raw Data", category: "raw", sensor: "any" },
  {
    value: "forecast",
    label: "ข้อมูลพยากรณ์อากาศ",
    category: "forecast",
    sensor: "main",
  },
];

const WEATHER_FIELDS = [
  { key: "airTemperature", label: "อุณหภูมิอากาศ", unit: "°C" },
  { key: "relativeHumidity", label: "ความชื้นสัมพัทธ์", unit: "%" },
  { key: "vpd", label: "VPD", unit: "kPa" },
  { key: "rainfall", label: "ปริมาณน้ำฝน", unit: "mm" },
  { key: "lightIntensity", label: "ความเข้มแสง", unit: "klux" },
  { key: "windSpeed", label: "ความเร็วลม", unit: "m/s" },
  { key: "windDirection", label: "ทิศทางลม", unit: "°" },
  { key: "atmosphericPressure", label: "ความกดอากาศ", unit: "hPa" },
] as const;

const SOIL_FIELDS = [
  { key: "soilMoisture1", label: "ความชื้นดิน 15cm", unit: "%" },
  { key: "soilTemperature1", label: "อุณหภูมิดิน 15cm", unit: "°C" },
  { key: "soilMoisture2", label: "ความชื้นดิน 30cm", unit: "%" },
  { key: "soilTemperature2", label: "อุณหภูมิดิน 30cm", unit: "°C" },
] as const;

// Maps WEATHER_FIELDS key → DailyAggregate field
const DAILY_GETTER: Record<string, (d: DailyAggregate) => number | undefined> =
  {
    airTemperature: (d) => d.avgTemperature,
    relativeHumidity: (d) => d.avgHumidity,
    vpd: (d) => d.avgVpd,
    rainfall: (d) => d.totalRainfall,
    lightIntensity: (d) => d.avgLightIntensity,
    windSpeed: (d) => d.avgWindSpeed,
    atmosphericPressure: (d) => d.avgPressure,
    soilMoisture1: (d) => d.avgSoilMoisture1,
    soilMoisture2: (d) => d.avgSoilMoisture2,
    soilTemperature1: () => undefined,
    soilTemperature2: () => undefined,
  };

type PreviewRow = {
  dateLabel: string;
  values: Record<string, number | undefined>;
};

// Local-timezone safe date string (avoids UTC off-by-one for UTC+7)
function dateToLocalStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("th-TH", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

// Returns hours+minutes as total minutes since midnight
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function applyTimeFilter(
  readings: SensorReading[],
  timeFrom: string,
  timeTo: string,
): SensorReading[] {
  const from = timeToMinutes(timeFrom);
  const to = timeToMinutes(timeTo);
  return readings.filter((r) => {
    const mins = r.timestamp.getHours() * 60 + r.timestamp.getMinutes();
    if (from <= to) return mins >= from && mins <= to;
    // overnight range (e.g. 22:00 – 06:00)
    return mins >= from || mins <= to;
  });
}

export default function DownloadPage() {
  const { user } = useAuth();
  const {
    permittedStations,
    clients,
    selectedStationId,
    isLoading: stationLoading,
  } = useStation();

  const stationGroups = useMemo(() => {
    const map: Record<
      string,
      { hasMain: boolean; hasClient: boolean; label: string }
    > = {};
    for (const s of permittedStations) {
      const baseId = s.id.replace(/c$/, "");
      if (!map[baseId]) {
        const owner = clients.find((c) => c.id === s.ownerId);
        map[baseId] = {
          hasMain: false,
          hasClient: false,
          label: owner?.fullName ? `${baseId} — ${owner.fullName}` : baseId,
        };
      }
      if (s.id.endsWith("c")) map[baseId].hasClient = true;
      else map[baseId].hasMain = true;
    }
    return Object.entries(map)
      .map(([baseId, info]) => ({ baseId, ...info }))
      .sort(
        (a, b) =>
          (parseInt(a.baseId.replace(/^wimarc/, ""), 10) || 0) -
          (parseInt(b.baseId.replace(/^wimarc/, ""), 10) || 0),
      );
  }, [permittedStations, clients]);

  const [localBase, setLocalBase] = useState<string | null>(null);
  const [sensorType, setSensorType] = useState<"main" | "client">("main");
  const [dataType, setDataType] = useState(DATA_TYPES[0].value);
  const [startDate, setStartDate] = useState(
    dateToLocalStr(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
  );
  const [endDate, setEndDate] = useState(dateToLocalStr(new Date()));
  const [calOpen, setCalOpen] = useState(false);
  const pickingEndRef = useRef(false);
  const [timeFilterEnabled, setTimeFilterEnabled] = useState(false);
  const [timeFrom, setTimeFrom] = useState("09:00");
  const [timeTo, setTimeTo] = useState("17:00");
  const [isExporting, setIsExporting] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>(
    WEATHER_FIELDS.map((f) => f.key),
  );
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const currentGroup = stationGroups.find((g) => g.baseId === localBase);
  const isSoilType = sensorType === "client";
  const isWeatherType = dataType === "CAM_main" || dataType === "raw";
  const isDailyType = false;
  const isForecastType = dataType === "forecast";
  const isRawType = dataType === "raw";
  const availableFields = isSoilType ? SOIL_FIELDS : WEATHER_FIELDS;
  const filteredDataTypes = DATA_TYPES.filter(
    (d) => d.sensor === "any" || d.sensor === sensorType,
  );

  const dateRangeValue: DateRange = {
    from: startDate ? new Date(startDate + "T00:00:00") : undefined,
    to: endDate ? new Date(endDate + "T00:00:00") : undefined,
  };

  const handleRangeSelect = (range: DateRange | undefined) => {
    if (range?.from) setStartDate(dateToLocalStr(range.from));
    const sameDay =
      range?.from &&
      range?.to &&
      range.from.toDateString() === range.to.toDateString();
    if (range?.to && !sameDay) {
      setEndDate(dateToLocalStr(range.to));
      pickingEndRef.current = false;
      setCalOpen(false);
    } else if (range?.from) {
      setEndDate("");
      pickingEndRef.current = true;
    }
  };
  const handleCalOpenChange = (open: boolean) => {
    if (!open && pickingEndRef.current) return;
    if (!open) pickingEndRef.current = false;
    setCalOpen(open);
  };
  const fmtDisplayDate = (s: string) =>
    s
      ? new Date(s + "T00:00:00").toLocaleDateString("th-TH", {
          day: "numeric",
          month: "short",
        })
      : "?";

  useEffect(() => {
    if (!localBase && selectedStationId)
      setLocalBase(selectedStationId.replace(/c$/, ""));
  }, [selectedStationId]);

  // Auto-switch dataType when sensorType changes
  useEffect(() => {
    const allowed = DATA_TYPES.filter(
      (d) => d.sensor === "any" || d.sensor === sensorType,
    ).map((d) => d.value);
    if (!allowed.includes(dataType)) setDataType(allowed[0]);
  }, [sensorType]);

  // Reset field selection when switching between weather/soil
  useEffect(() => {
    setSelectedFields(
      isSoilType
        ? SOIL_FIELDS.map((f) => f.key)
        : WEATHER_FIELDS.map((f) => f.key),
    );
  }, [isSoilType]);

  // Fetch preview rows when settings change
  useEffect(() => {
    if (!localBase || !startDate || !endDate) return;
    let cancelled = false;
    const fetchId = sensorType === "client" ? `${localBase}c` : localBase;

    setPreviewRows([]);
    setPreviewLoading(true);

    const diffDays = Math.max(
      1,
      Math.ceil(
        (new Date(endDate).getTime() - new Date(startDate).getTime()) /
          86400000,
      ),
    );
    const timeRange: TimeRange =
      diffDays <= 3 ? 3 : diffDays <= 7 ? 7 : diffDays <= 15 ? 15 : 30;

    const toRows = (rows: PreviewRow[]) => {
      if (!cancelled) {
        setPreviewRows(rows);
        setPreviewLoading(false);
      }
    };
    const onErr = () => {
      if (!cancelled) {
        setPreviewRows([]);
        setPreviewLoading(false);
      }
    };

    if (isDailyType) {
      getDailyAggregates(fetchId, timeRange)
        .then((aggs) =>
          toRows(
            aggs.map((a) => ({
              dateLabel: fmtDate(a.date),
              values: Object.fromEntries(
                [...WEATHER_FIELDS, ...SOIL_FIELDS].map((f) => [
                  f.key,
                  DAILY_GETTER[f.key]?.(a),
                ]),
              ),
            })),
          ),
        )
        .catch(onErr);
    } else {
      getSensorReadingsByDateRange(fetchId, startDate, endDate)
        .then((readings) => {
          const filtered = timeFilterEnabled
            ? applyTimeFilter(readings, timeFrom, timeTo)
            : readings;
          // One reading per day: take first reading of each calendar day
          const byDay = new Map<string, SensorReading>();
          for (const r of filtered) {
            const key = dateToLocalStr(r.timestamp);
            if (!byDay.has(key)) byDay.set(key, r);
          }
          toRows(
            Array.from(byDay.values()).map((r) => ({
              dateLabel: fmtDate(r.timestamp),
              values: Object.fromEntries(
                [...WEATHER_FIELDS, ...SOIL_FIELDS].map((f) => [
                  f.key,
                  (r as any)[f.key],
                ]),
              ),
            })),
          );
        })
        .catch(onErr);
    }

    return () => {
      cancelled = true;
    };
  }, [
    localBase,
    sensorType,
    dataType,
    startDate,
    endDate,
    timeFilterEnabled,
    timeFrom,
    timeTo,
  ]);

  const toggleField = (key: string) =>
    setSelectedFields((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );

  const toggleAll = () => {
    const all = availableFields.map((f) => f.key);
    setSelectedFields((prev) => (prev.length === all.length ? [] : all));
  };

  const handleExport = async () => {
    if (!localBase) return;
    const exportId = isSoilType ? `${localBase}c` : localBase;
    const exportStation =
      permittedStations.find((s) => s.id === exportId) ??
      permittedStations.find((s) => s.id === localBase);
    if (!exportStation) return;
    setIsExporting(true);
    try {
      if (isForecastType) {
        const days =
          startDate && endDate
            ? Math.max(
                1,
                Math.ceil(
                  (new Date(endDate).getTime() -
                    new Date(startDate).getTime()) /
                    86400000,
                ),
              )
            : 7;
        const fc = await getForecastHistory(exportStation.id, days);
        const rows = fc.map((d) => ({
          วันที่: d.date,
          สภาพอากาศ: d.description,
          "อุณหภูมิ (°C)": d.temperature,
          "ฝนรวม (mm)": d.rainfall,
          "โอกาสฝน (%)": d.rainProbability,
          พยากรณ์เมื่อ: d.snapshotAt ?? "",
        }));
        exportToCSV(rows, `forecast-${exportStation.id}`);
      } else {
        const readings = await getSensorReadingsByDateRange(
          exportStation.id,
          startDate,
          endDate,
        );
        const filtered = timeFilterEnabled
          ? applyTimeFilter(readings, timeFrom, timeTo)
          : readings;
        const diffDays =
          startDate && endDate
            ? Math.max(
                1,
                Math.ceil(
                  (new Date(endDate).getTime() -
                    new Date(startDate).getTime()) /
                    86400000,
                ),
              )
            : 7;
        exportSensorDataToCSV(
          exportStation.name,
          filtered,
          selectedFields as any[],
          diffDays as any,
        );
      }
    } catch (error) {
      console.error("Export error:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const visibleFields = availableFields.filter((f) =>
    selectedFields.includes(f.key),
  );

  if (stationLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-4 mx-auto pb-8">
      <div className="flex items-end justify-between border-b pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            ดาวน์โหลดข้อมูล (CSV Export)
            {/* <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase">
              TOR 4.5.4.2
            </span> */}
          </h1>
          {/* <p className="text-xs text-muted-foreground font-mono">
            Table: CAM_main • CAM_client • sensor • weather
          </p> */}
        </div>
      </div>

      {permittedStations.length === 0 ? (
        <Alert>
          <AlertDescription>ไม่มีสถานีที่เข้าถึงได้</AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-6">
          {/* Config */}
          <Card className="shadow-md border-t-4 border-t-teal-500">
            <CardHeader className="py-3 bg-muted/30 border-b">
              <CardTitle className="font-bold uppercase tracking-tight flex items-center gap-2 text-teal-800">
                <Database className="h-4 w-4" /> ตั้งค่าการดาวน์โหลด
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {stationGroups.length > 1 && (
                <div className="space-y-1.5">
                  <Label className="uppercase font-bold text-muted-foreground">
                    สถานี{" "}
                    <span className="opacity-50 ml-1">
                      wimarc_info
                    </span>
                  </Label>
                  <Select
                    value={localBase ?? undefined}
                    onValueChange={setLocalBase}
                  >
                    <SelectTrigger className="h-9 bg-background">
                      <SelectValue placeholder="เลือกสถานี" />
                    </SelectTrigger>
                    <SelectContent>
                      {stationGroups.map((g) => (
                        <SelectItem
                          key={g.baseId}
                          value={g.baseId}
                          className="text-xs"
                        >
                          {g.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="uppercase font-bold text-muted-foreground">
                  ประเภทเซนเซอร์
                </Label>
                <div className={`grid rounded-lg border overflow-hidden font-medium ${currentGroup?.hasMain !== false && currentGroup?.hasClient ? "grid-cols-2" : "grid-cols-1"}`}>
                  {currentGroup?.hasMain !== false && (
                    <button
                      style={{ padding: "6px 12px", fontSize: 12 }}
                      className={`flex-1 text-center transition-colors ${sensorType === "main" ? "bg-teal-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
                      onClick={() => setSensorType("main")}
                    >
                      สถานีอากาศ
                    </button>
                  )}
                  {currentGroup?.hasClient && (
                    <button
                      style={{ padding: "6px 12px", fontSize: 12 }}
                      className={`flex-1 text-center border-l transition-colors ${sensorType === "client" ? "bg-teal-600 text-white" : "bg-background text-muted-foreground hover:bg-muted"}`}
                      onClick={() => setSensorType("client")}
                    >
                      สถานีดิน
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="uppercase font-bold text-muted-foreground">
                  ประเภทข้อมูล
                </Label>
                <div className="flex flex-col gap-1.5 pt-1">
                  {filteredDataTypes.map((d) => (
                    <label
                      key={d.value}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={dataType === d.value}
                        onCheckedChange={(c) => {
                          if (c) setDataType(d.value);
                        }}
                      />
                      <span>{d.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Date range */}
              <div className="space-y-1.5">
                <Label className="uppercase font-bold text-muted-foreground">
                  ช่วงวันที่
                </Label>
                <Popover open={calOpen} onOpenChange={handleCalOpenChange}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full h-9 justify-start font-normal gap-2"
                      onClick={() => {
                        setStartDate("");
                        setEndDate("");
                        setCalOpen(true);
                      }}
                    >
                      <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
                      {startDate && endDate
                        ? `${fmtDisplayDate(startDate)} — ${fmtDisplayDate(endDate)}`
                        : startDate
                          ? `${fmtDisplayDate(startDate)} — เลือกวันสิ้นสุด`
                          : "เลือกช่วงวันที่"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-auto p-0"
                    align="start"
                    onInteractOutside={(e) => {
                      if (pickingEndRef.current) e.preventDefault();
                    }}
                  >
                    <Calendar
                      mode="range"
                      selected={dateRangeValue}
                      onSelect={handleRangeSelect}
                      disabled={{ after: new Date() }}
                      numberOfMonths={1}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Time range filter */}
              {!isForecastType && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={timeFilterEnabled}
                      onCheckedChange={(c) => setTimeFilterEnabled(!!c)}
                    />
                    <span className="uppercase font-bold text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3 w-3" /> กรองตามช่วงเวลา
                    </span>
                  </label>
                  {timeFilterEnabled && (
                    <div className="flex items-center gap-2 pl-6">
                      <div className="flex flex-col gap-0.5 flex-1">
                        <span className="font-bold text-muted-foreground uppercase">
                          เริ่ม
                        </span>
                        <input
                          type="time"
                          value={timeFrom}
                          onChange={(e) => setTimeFrom(e.target.value)}
                          className="h-8 w-full rounded-lg border border-input bg-background px-2 text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
                        />
                      </div>
                      <span className="text-muted-foreground mt-4">—</span>
                      <div className="flex flex-col gap-0.5 flex-1">
                        <span className="font-bold text-muted-foreground uppercase">
                          สิ้นสุด
                        </span>
                        <input
                          type="time"
                          value={timeTo}
                          onChange={(e) => setTimeTo(e.target.value)}
                          className="h-8 w-full rounded-lg border border-input bg-background px-2 text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
                        />
                      </div>
                    </div>
                  )}
                  {timeFilterEnabled && (
                    <p className="text-[14px] text-muted-foreground pl-6">
                      เฉพาะข้อมูลระหว่าง {timeFrom} — {timeTo} น.
                      ของทุกวันที่เลือก
                    </p>
                  )}
                </div>
              )}

              {(isWeatherType || isSoilType || isDailyType) && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="uppercase font-bold text-muted-foreground">
                      เลือกฟิลด์ข้อมูล
                    </Label>
                    <button
                      onClick={toggleAll}
                      className="text-[14px] text-teal-600 font-bold hover:underline"
                    >
                      {selectedFields.length === availableFields.length
                        ? "ยกเลิกทั้งหมด"
                        : "เลือกทั้งหมด"}
                    </button>
                  </div>
                  <div className="border rounded-md p-3 space-y-2 bg-background">
                    {availableFields.map((f) => (
                      <div key={f.key} className="flex items-center gap-2">
                        <Checkbox
                          id={f.key}
                          checked={selectedFields.includes(f.key)}
                          onCheckedChange={() => toggleField(f.key)}
                        />
                        <Label
                          htmlFor={f.key}
                          className="cursor-pointer flex-1 flex justify-between"
                        >
                          <span>{f.label}</span>
                          <span className="text-muted-foreground opacity-60">
                            {f.unit}
                          </span>
                        </Label>
                      </div>
                    ))}
                  </div>
                  <p className="text-[14px] text-muted-foreground">
                    เลือกแล้ว {selectedFields.length} / {availableFields.length}{" "}
                    ฟิลด์
                  </p>
                </div>
              )}

              <div className="pt-2">
                <Button
                  onClick={handleExport}
                  disabled={
                    isExporting || !localBase || selectedFields.length === 0
                  }
                  className="w-full bg-teal-600 hover:bg-teal-700 h-10 font-bold gap-2"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />{" "}
                      กำลังดาวน์โหลด...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" /> ดาวน์โหลด CSV
                    </>
                  )}
                </Button>
                <p className="text-[14px] text-muted-foreground mt-3 text-center italic">
                  ข้อมูลจะถูกบันทึกในรูปแบบ .csv 
                  {/* ตาม TOR 4.5.4.2 และ 4.5.5.3 */}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Preview Table */}
          <Card className="shadow-md rounded-2xl overflow-hidden">
            <CardHeader className="py-3 bg-muted/30 border-b">
              <CardTitle className="font-bold uppercase tracking-tight flex items-center gap-2">
                <Table2 className="h-4 w-4 text-muted-foreground" />
                ตัวอย่างข้อมูล
                {timeFilterEnabled && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2 py-0.5 text-[9px] font-bold text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                    <Clock className="h-2.5 w-2.5" /> {timeFrom}–{timeTo}
                  </span>
                )}
                {previewLoading && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />
                )}
                {!previewLoading && previewRows.length > 0 && (
                  <span className="ml-auto text-[14px] text-muted-foreground normal-case">
                    {previewRows.length} แถว × {visibleFields.length} ฟิลด์
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {previewLoading ? (
                <div className="p-6 space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : previewRows.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="mx-auto w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mb-2">
                    <ShieldCheck className="h-5 w-5 text-muted-foreground/30" />
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                    {localBase
                      ? "ไม่พบข้อมูลในช่วงเวลานี้"
                      : "เลือกสถานีเพื่อดูตัวอย่าง"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-muted/50 border-b text-muted-foreground font-bold">
                        <th className="px-5 py-3 text-left whitespace-nowrap sticky left-0 bg-muted/50">
                          วันที่
                        </th>
                        {visibleFields.map((f) => (
                          <th
                            key={f.key}
                            className="px-5 py-3 text-right whitespace-nowrap"
                          >
                            {f.label}
                            <span className="opacity-50 ml-1">
                              ({f.unit})
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {previewRows.map((row, i) => (
                        <tr
                          key={i}
                          className="hover:bg-muted/20 transition-colors"
                        >
                          <td className="px-5 py-3 text-muted-foreground sticky left-0 bg-background">
                            {row.dateLabel}
                          </td>
                          {visibleFields.map((f) => {
                            const val = row.values[f.key];
                            return (
                              <td
                                key={f.key}
                                className="px-5 py-3 text-right"
                              >
                                {val != null ? (
                                  val.toFixed(1)
                                ) : (
                                  <span className="opacity-25">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
