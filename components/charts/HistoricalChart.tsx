"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  ComposedChart,
  Legend,
} from "recharts";

export function MiniStat({
  label,
  value,
  icon: Icon,
  colorClass,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  colorClass: string;
}) {
  return (
    <Card className="shadow-sm border">
      <CardContent className="p-4 text-center">
        <div
          className={`mx-auto mb-1 w-8 h-8 rounded-full flex items-center justify-center bg-muted/50 ${colorClass}`}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div className="text-2xl font-black tracking-tight">{value}</div>
        <div className="text-[14px] uppercase font-bold text-muted-foreground mt-1 tracking-wider">
          {label}
        </div>
      </CardContent>
    </Card>
  );
}

export function HistoricalChart({
  title,
  data,
  dataKey,
  unit,
  color,
  icon: Icon,
  type = "line",
  timeRange,
  domain,
  overlayKey,
  overlayColor,
  overlayUnit,
}: {
  title: string;
  data: any[];
  dataKey: string;
  unit: string;
  color: string;
  icon: React.ElementType;
  type?: "line" | "bar" | "area";
  timeRange?: number;
  domain?: [number, number];
  overlayKey?: string;
  overlayColor?: string;
  overlayUnit?: string;
}) {
  const tooltipStyle = {
    backgroundColor: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "var(--radius)",
    fontSize: "10px",
  };

  // Stats: latest + avg + min/max of visible data
  const vals = data
    .map((d) => d[dataKey])
    .filter((v) => typeof v === "number") as number[];
  const latest = vals.length ? vals[vals.length - 1] : null;
  const avg = vals.length
    ? vals.reduce((a, b) => a + b, 0) / vals.length
    : null;
  const minV = vals.length ? Math.min(...vals) : null;
  const maxV = vals.length ? Math.max(...vals) : null;

  // Generate uniform ticks from actual time range (not from data points)
  const { ticks, tickFormatter, xDomain } = (() => {
    if (!data.length || !data[0].ts)
      return {
        ticks: undefined,
        tickFormatter: undefined,
        xDomain: ["auto", "auto"] as ["auto", "auto"],
      };
    const tsMin = data[0].ts as number;
    const tsMax = data[data.length - 1].ts as number;
    const days = timeRange ?? 0;
    const domainEnd = domain ? domain[1] : tsMax;
    // Generate ticks aligned to LOCAL time (not UTC) to avoid +7h drift
    const t: number[] = [];
    if (days >= 7) {
      const cur = new Date(tsMin);
      cur.setHours(0, 0, 0, 0);
      if (cur.getTime() < tsMin) cur.setDate(cur.getDate() + 1);
      while (cur.getTime() <= domainEnd) {
        t.push(cur.getTime());
        cur.setDate(cur.getDate() + 1);
      }
    } else if (days === 1) {
      const cur = new Date(tsMin);
      cur.setMinutes(0, 0, 0);
      if (cur.getTime() < tsMin) cur.setHours(cur.getHours() + 1);
      while (cur.getTime() <= domainEnd) {
        t.push(cur.getTime());
        cur.setHours(cur.getHours() + 1);
      }
    } else {
      const cur = new Date(tsMin);
      cur.setMinutes(0, 0, 0);
      cur.setHours(Math.ceil(cur.getHours() / 6) * 6);
      if (cur.getTime() < tsMin) cur.setHours(cur.getHours() + 6);
      while (cur.getTime() <= domainEnd) {
        t.push(cur.getTime());
        cur.setHours(cur.getHours() + 6);
      }
    }
    const MON = [
      "ม.ค.",
      "ก.พ.",
      "มี.ค.",
      "เม.ย.",
      "พ.ค.",
      "มิ.ย.",
      "ก.ค.",
      "ส.ค.",
      "ก.ย.",
      "ต.ค.",
      "พ.ย.",
      "ธ.ค.",
    ];
    const fmt = (ts: number) => {
      const d = new Date(ts);
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      if (days === 1) return `${hh}:${mm}`;
      if (days >= 7) return `${d.getDate()} ${MON[d.getMonth()]}`;
      return `${d.getDate()} ${MON[d.getMonth()]} ${hh}:${mm}`;
    };
    const xDomain: [number, number] | ["auto", "auto"] = domain
      ? [Math.max(domain[0], tsMin), domain[1]]
      : [tsMin, tsMax];
    return { ticks: t, tickFormatter: fmt, xDomain };
  })();

  // Tooltip label: full date+time from ts
  const labelFmt = (ts: any) => {
    if (typeof ts !== "number") return "";
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const MM = [
      "ม.ค.",
      "ก.พ.",
      "มี.ค.",
      "เม.ย.",
      "พ.ค.",
      "มิ.ย.",
      "ก.ค.",
      "ส.ค.",
      "ก.ย.",
      "ต.ค.",
      "พ.ย.",
      "ธ.ค.",
    ];
    return `${d.getDate()} ${MM[d.getMonth()]} ${hh}:${mm}`;
  };

  const fmt = (v: number | null) =>
    v == null ? "—" : Number.isInteger(v) ? v.toString() : v.toFixed(1);

  return (
    <Card className="shadow-sm overflow-hidden border">
      <CardHeader className="py-2.5 bg-muted/20 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="font-bold uppercase tracking-tight flex items-center gap-1.5 text-muted-foreground">
            <Icon className="h-3.5 w-3.5" style={{ color }} /> {title}
          </CardTitle>
          <span className=" opacity-50 lowercase">
            {unit}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-[16px] text-muted-foreground">
          <span>
            ล่าสุด{" "}
            <span className="font-bold text-foreground">
              {fmt(latest)}
              {unit}
            </span>
          </span>
          <span>
            เฉลี่ย{" "}
            <span className="font-bold">
              {fmt(avg)}
              {unit}
            </span>
          </span>
          <span>
            ต่ำ{" "}
            <span className="font-bold text-blue-600">
              {fmt(minV)}
              {unit}
            </span>
          </span>
          <span>
            สูง{" "}
            <span className="font-bold text-orange-600">
              {fmt(maxV)}
              {unit}
            </span>
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-3 px-1 pb-2">
        <ResponsiveContainer width="100%" height={240}>
          {overlayKey ? (
            <ComposedChart data={data}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                strokeOpacity={0.1}
              />
              <XAxis
                dataKey="ts"
                type="number"
                scale="time"
                domain={xDomain ?? ["auto", "auto"]}
                ticks={ticks}
                tickFormatter={tickFormatter}
                tick={{ fontSize: 9, angle: -40, textAnchor: "end" }}
                height={52}
                padding={{ left: 0, right: 0 }}
              />
              <YAxis
                yAxisId="left"
                className="text-[10px]"
                unit={unit}
                domain={["auto", "auto"]}
                label={{
                  value: `${title} (${unit})`,
                  angle: -90,
                  position: "insideLeft",
                  offset: 10,
                  style: {
                    fontSize: 10,
                    fill: "#64748b",
                    textAnchor: "middle",
                  },
                }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                className="text-[10px]"
                unit={overlayUnit ?? ""}
                domain={[0, "auto"]}
                label={{
                  value: `ฝน (${overlayUnit ?? ""})`,
                  angle: 90,
                  position: "insideRight",
                  offset: 10,
                  style: {
                    fontSize: 10,
                    fill: "#64748b",
                    textAnchor: "middle",
                  },
                }}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={labelFmt}
                formatter={(v: any, name: string) => {
                  if (name === overlayKey)
                    return [`${fmt(v)} ${overlayUnit ?? ""}`, "น้ำฝน"];
                  return [`${fmt(v)} ${unit}`, title];
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 9, paddingTop: 4 }}
                formatter={(value) =>
                  value === overlayKey ? `น้ำฝน (${overlayUnit})` : title
                }
              />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                fill={color}
                fillOpacity={0.12}
                strokeWidth={2}
                dot={false}
              />
              <Bar
                yAxisId="right"
                dataKey={overlayKey}
                fill={overlayColor ?? "#6366f1"}
                fillOpacity={0.9}
                radius={[2, 2, 0, 0]}
                barSize={5}
              />
            </ComposedChart>
          ) : type === "bar" ? (
            <BarChart data={data}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                strokeOpacity={0.1}
              />
              <XAxis
                dataKey="ts"
                type="number"
                scale="time"
                domain={xDomain ?? ["auto", "auto"]}
                ticks={ticks}
                tickFormatter={tickFormatter}
                tick={{ fontSize: 9, angle: -40, textAnchor: "end" }}
                height={52}
                padding={{ left: 0, right: 0 }}
              />
              <YAxis
                className="text-[10px]"
                unit={unit}
                domain={["auto", "auto"]}
                label={{
                  value: `${title} (${unit})`,
                  angle: -90,
                  position: "insideLeft",
                  offset: 10,
                  style: {
                    fontSize: 10,
                    fill: "#64748b",
                    textAnchor: "middle",
                  },
                }}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={labelFmt}
                formatter={(v: any) => [`${fmt(v)} ${unit}`, title]}
              />
              <Bar dataKey={dataKey} fill={color} radius={[2, 2, 0, 0]} />
            </BarChart>
          ) : type === "area" ? (
            <AreaChart data={data}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                strokeOpacity={0.1}
              />
              <XAxis
                dataKey="ts"
                type="number"
                scale="time"
                domain={xDomain ?? ["auto", "auto"]}
                ticks={ticks}
                tickFormatter={tickFormatter}
                tick={{ fontSize: 9, angle: -40, textAnchor: "end" }}
                height={52}
                padding={{ left: 0, right: 0 }}
              />
              <YAxis
                className="text-[10px]"
                unit={unit}
                domain={["auto", "auto"]}
                label={{
                  value: `${title} (${unit})`,
                  angle: -90,
                  position: "insideLeft",
                  offset: 10,
                  style: {
                    fontSize: 10,
                    fill: "#64748b",
                    textAnchor: "middle",
                  },
                }}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={labelFmt}
                formatter={(v: any) => [`${fmt(v)} ${unit}`, title]}
              />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                fill={color}
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </AreaChart>
          ) : (
            <LineChart data={data}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                strokeOpacity={0.1}
              />
              <XAxis
                dataKey="ts"
                type="number"
                scale="time"
                domain={xDomain ?? ["auto", "auto"]}
                ticks={ticks}
                tickFormatter={tickFormatter}
                tick={{ fontSize: 9, angle: -40, textAnchor: "end" }}
                height={52}
                padding={{ left: 0, right: 0 }}
              />
              <YAxis
                className="text-[10px]"
                unit={unit}
                domain={["auto", "auto"]}
                label={{
                  value: `${title} (${unit})`,
                  angle: -90,
                  position: "insideLeft",
                  offset: 10,
                  style: {
                    fontSize: 10,
                    fill: "#64748b",
                    textAnchor: "middle",
                  },
                }}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={labelFmt}
                formatter={(v: any) => [`${fmt(v)} ${unit}`, title]}
              />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
