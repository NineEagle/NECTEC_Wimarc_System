// components/map/StationPopup.tsx
//
// WiMaRC map popup — "Metric Tiles" design (option B).
// Drop into a Leaflet <Popup> / Google Maps InfoWindow / Mapbox popup as the
// rendered content. Pure presentational: pass a `station` object + `onClose`.
//
// Styling uses the project's design tokens only (sensor-* tokens from
// globals.css, primary/muted/border, Sarabun). No extra dependencies beyond
// lucide-react, which the project already uses.

"use client";

import {
  Thermometer,
  Droplets,
  CloudRain,
  Wind,
  Activity,
  Sprout,
  Sun,
  MapPin,
  Clock,
  X,
  type LucideIcon,
} from "lucide-react";

// ---- types ----
export type SensorTone = "temp" | "humid" | "rain" | "wind" | "soil";
export type LinkStatus = "online" | "offline";

export interface Metric {
  label: string;
  value: string; // pre-formatted (e.g. "28.9")
  unit: string;
  tone: SensorTone;
  icon: LucideIcon;
}

export interface StationPopupData {
  name: string;
  place: string; // "นายายอาม จ.จันทบุรี"
  kind: string; // "อากาศ+ดิน"
  main: LinkStatus; // Main unit link
  client: LinkStatus; // Client unit link
  vpd: number; // kPa
  weather: Metric[]; // 4 tiles
  soil: Metric[]; // 4 tiles
  photoUrl?: string;
  time: string; // "4 มิ.ย. 2569 · 14:47"
}

// ---- sensor token classes (globals.css --sensor-*) ----
const TONE: Record<SensorTone, string> = {
  temp: "bg-sensor-temp-bg border-sensor-temp-border text-sensor-temp-fg",
  humid: "bg-sensor-humid-bg border-sensor-humid-border text-sensor-humid-fg",
  rain: "bg-sensor-rain-bg border-sensor-rain-border text-sensor-rain-fg",
  wind: "bg-sensor-wind-bg border-sensor-wind-border text-sensor-wind-fg",
  soil: "bg-sensor-soil-bg border-sensor-soil-border text-sensor-soil-fg",
};

// ---- VPD status (ต่ำ <0.8 · เหมาะสม 0.8–1.6 · สูง >1.6) ----
function vpdStatus(v: number) {
  if (v < 0.8)
    return {
      label: "ต่ำ",
      wrap: "bg-sensor-humid-bg border-sensor-humid-border text-sensor-humid-fg",
      dot: "bg-blue-500",
    };
  if (v <= 1.6)
    return {
      label: "เหมาะสม",
      wrap: "bg-sensor-vpd-bg border-sensor-vpd-border text-sensor-vpd-fg",
      dot: "bg-emerald-500",
    };
  return {
    label: "สูง",
    wrap: "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300",
    dot: "bg-red-500",
  };
}

function StatusDot({ status, label }: { status: LinkStatus; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
      <span
        className={`h-2 w-2 rounded-full ${status === "online" ? "bg-emerald-500" : "bg-red-500"}`}
      />
      {label}
    </span>
  );
}

function Tile({ m }: { m: Metric }) {
  const Icon = m.icon;
  return (
    <div
      className={`relative rounded-[10px] border px-3 py-2.5 ${TONE[m.tone]}`}
    >
      <Icon
        className="absolute right-2.5 top-2.5 h-[15px] w-[15px] opacity-80"
        aria-hidden="true"
      />
      <div className="font-extrabold leading-none">
        {m.value}
        <span className="ml-0.5 align-baseline text-[0.62em] font-semibold opacity-85">
          {m.unit}
        </span>
      </div>
      <div className="mt-1 text-[11.5px] text-muted-foreground">{m.label}</div>
    </div>
  );
}

function SectionLabel({
  icon: Icon,
  color,
  children,
}: {
  icon: LucideIcon;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center gap-1.5 font-bold uppercase tracking-[0.06em] text-muted-foreground">
      <Icon className={`h-[15px] w-[15px] ${color}`} aria-hidden="true" />{" "}
      {children}
    </div>
  );
}

export function StationPopup({
  station,
  onClose,
}: {
  station: StationPopupData;
  onClose?: () => void;
}) {
  const vs = vpdStatus(station.vpd);
  return (
    <div className="w-full max-w-[338px] overflow-hidden rounded-xl border border-border bg-card text-card-foreground">
      {/* close */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิด"
          className="absolute right-2 top-2 z-10 grid h-[26px] w-[26px] place-items-center rounded-md bg-background/80 text-muted-foreground backdrop-blur transition hover:bg-secondary hover:text-foreground"
        >
          <X className="h-[15px] w-[15px]" />
        </button>
      )}

      {/* header */}
      <div className="flex items-start justify-between gap-2 px-4 pb-3 pt-3.5">
        <div className="min-w-0 flex-1">
          <div className="font-bold leading-tight">
            {(() => {
              const parts = station.name.split(" — ");
              const stationName = parts[0].replace(/\s*\(.*?\)\s*/, "").trim();
              const owner = parts[1];
              return (
                <>
                  <div className="truncate">{stationName}</div>
                  {owner && (
                    <span className="truncate text-[14px] font-semibold text-muted-foreground">
                      {owner}
                    </span>
                  )}
                </>
              );
            })()}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <MapPin
              className="h-[13px] w-[13px] shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="truncate min-w-0 flex-1">{station.place}</span>
            <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
              <StatusDot status={station.main} label="อากาศ" />
              <StatusDot status={station.client} label="ดิน" />
            </div>
            {/* <span className="shrink-0 rounded-full bg-accent px-1.5 py-px text-[10.5px] font-semibold text-accent-foreground">
              {station.kind}
            </span> */}
          </div>
        </div>
      </div>

      {/* tiles */}
      <div className="px-4 pb-1 pt-3.5">
        <SectionLabel icon={Sun} color="text-amber-500">
          อากาศ
        </SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          {station.weather.map((m) => (
            <Tile key={m.label} m={m} />
          ))}
        </div>

        <div className="mt-3">
          <SectionLabel icon={Sprout} color="text-green-600">
            ดิน
          </SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {station.soil.map((m) => (
              <Tile key={m.label} m={m} />
            ))}
          </div>
        </div>
      </div>

      {/* camera photo */}
      {station.photoUrl && (
        <div className="relative m-3 h-[104px] overflow-hidden rounded-[9px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={station.photoUrl}
            alt={`ภาพจากสวน`}
            className="h-full w-full object-cover"
          />
          <span className="absolute bottom-2 left-2.5 inline-flex items-center gap-1.5 rounded-md bg-black/50 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur">
            <Clock className="h-[11px] w-[11px]" /> {station.time}
          </span>
        </div>
      )}
    </div>
  );
}

// ---- helper to build the metric arrays from a live reading ----
export function buildMetrics(r: {
  airTemp: number;
  humidity: number;
  rain: number;
  windSpeed: number;
  soilMoist1: number;
  soilTemp1: number;
  soilMoist2: number;
  soilTemp2: number;
}): { weather: Metric[]; soil: Metric[] } {
  const f = (n: number, d = 1) => n.toFixed(d);
  return {
    weather: [
      {
        label: "อุณหภูมิ",
        value: f(r.airTemp),
        unit: "°C",
        tone: "temp",
        icon: Thermometer,
      },
      {
        label: "ความชื้น",
        value: f(r.humidity),
        unit: "%",
        tone: "humid",
        icon: Droplets,
      },
      {
        label: "ฝน",
        value: f(r.rain),
        unit: "mm",
        tone: "rain",
        icon: CloudRain,
      },
      {
        label: "ลม",
        value: f(r.windSpeed),
        unit: "m/s",
        tone: "wind",
        icon: Wind,
      },
    ],
    soil: [
      {
        label: "ความชื้นลึก 15 cm",
        value: f(r.soilMoist1, 1),
        unit: "%",
        tone: "soil",
        icon: Droplets,
      },
      {
        label: "อุณหภูมิ 15 cm",
        value: f(r.soilTemp1, 1),
        unit: "°C",
        tone: "soil",
        icon: Thermometer,
      },
      {
        label: "ความชื้นลึก 30 cm",
        value: f(r.soilMoist2, 1),
        unit: "%",
        tone: "soil",
        icon: Droplets,
      },
      {
        label: "อุณหภูมิ 30 cm",
        value: f(r.soilTemp2, 1),
        unit: "°C",
        tone: "soil",
        icon: Thermometer,
      },
    ],
  };
}
