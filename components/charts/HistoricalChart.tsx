"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area, ComposedChart, Legend,
} from "recharts"

export function MiniStat({ label, value, icon: Icon, colorClass }: {
  label: string; value: string; icon: React.ElementType; colorClass: string
}) {
  return (
    <Card className="shadow-sm border">
      <CardContent className="p-4 text-center">
        <div className={`mx-auto mb-1 w-8 h-8 rounded-full flex items-center justify-center bg-muted/50 ${colorClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-xl font-black font-mono tracking-tight">{value}</div>
        <div className="text-[10px] uppercase font-bold text-muted-foreground mt-1 tracking-wider">{label}</div>
      </CardContent>
    </Card>
  )
}

export function HistoricalChart({ title, data, dataKey, unit, color, icon: Icon, type = "line", timeRange, overlayKey, overlayColor, overlayUnit }: {
  title: string; data: any[]; dataKey: string; unit: string; color: string
  icon: React.ElementType; type?: "line" | "bar" | "area"; timeRange?: number
  overlayKey?: string; overlayColor?: string; overlayUnit?: string
}) {
  const tooltipStyle = {
    backgroundColor: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "var(--radius)",
    fontSize: "10px",
  }

  // Stats: latest + avg + min/max of visible data
  const vals = data.map(d => d[dataKey]).filter(v => typeof v === "number") as number[]
  const latest = vals.length ? vals[vals.length - 1] : null
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  const minV = vals.length ? Math.min(...vals) : null
  const maxV = vals.length ? Math.max(...vals) : null

  // Generate uniform ticks from actual time range (not from data points)
  const { ticks, tickFormatter } = (() => {
    if (!data.length || !data[0].ts) return { ticks: undefined, tickFormatter: undefined }
    const tsMin = data[0].ts as number
    const tsMax = data[data.length - 1].ts as number
    const intervalMs = timeRange === 1 ? 3600_000 : 6 * 3600_000
    // Round first tick up to next boundary
    const firstTick = Math.ceil(tsMin / intervalMs) * intervalMs
    const t: number[] = []
    for (let ts = firstTick; ts <= tsMax; ts += intervalMs) t.push(ts)
    const fmt = (ts: number) => {
      const d = new Date(ts)
      const hh = String(d.getHours()).padStart(2, "0")
      const mm = String(d.getMinutes()).padStart(2, "0")
      return timeRange === 1
        ? `${hh}:${mm}`
        : `${d.getDate()} ${["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."][d.getMonth()]} ${hh}:${mm}`
    }
    return { ticks: t, tickFormatter: fmt }
  })()

  const fmt = (v: number | null) => v == null ? "—" : (Number.isInteger(v) ? v.toString() : v.toFixed(1))

  return (
    <Card className="shadow-sm overflow-hidden border">
      <CardHeader className="py-2.5 bg-muted/20 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[11px] font-bold uppercase tracking-tight flex items-center gap-1.5 text-muted-foreground">
            <Icon className="h-3.5 w-3.5" style={{ color }} /> {title}
          </CardTitle>
          <span className="text-[10px] font-mono opacity-50 lowercase">{unit}</span>
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono text-muted-foreground">
          <span>ล่าสุด <span className="font-bold text-foreground">{fmt(latest)}{unit}</span></span>
          <span>เฉลี่ย <span className="font-bold">{fmt(avg)}{unit}</span></span>
          <span>ต่ำ <span className="font-bold text-blue-600">{fmt(minV)}{unit}</span></span>
          <span>สูง <span className="font-bold text-orange-600">{fmt(maxV)}{unit}</span></span>
        </div>
      </CardHeader>
      <CardContent className="pt-5 px-1">
        <ResponsiveContainer width="100%" height={200}>
          {overlayKey ? (
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
              <XAxis dataKey="ts" type="number" scale="time" domain={["auto","auto"]} ticks={ticks} tickFormatter={tickFormatter} tick={{ fontSize: 9, angle: -40, textAnchor: "end" }} height={52} />
              <YAxis
                yAxisId="left"
                className="text-[10px]"
                unit={unit}
                domain={["auto", "auto"]}
                label={{ value: `${title} (${unit})`, angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 10, fill: "#64748b", textAnchor: "middle" } }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                className="text-[10px]"
                unit={overlayUnit ?? ""}
                domain={[0, "auto"]}
                label={{ value: `ฝน (${overlayUnit ?? ""})`, angle: 90, position: "insideRight", offset: 10, style: { fontSize: 10, fill: "#64748b", textAnchor: "middle" } }}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: any, name: string) => {
                  if (name === overlayKey) return [`${fmt(v)} ${overlayUnit ?? ""}`, "น้ำฝน"]
                  return [`${fmt(v)} ${unit}`, title]
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 9, paddingTop: 4 }}
                formatter={(value) => value === overlayKey ? `น้ำฝน (${overlayUnit})` : title}
              />
              <Area yAxisId="left" type="monotone" dataKey={dataKey} stroke={color} fill={color} fillOpacity={0.15} strokeWidth={2} dot={false} />
              <Bar yAxisId="right" dataKey={overlayKey} fill={overlayColor ?? "#6366f1"} fillOpacity={0.7} radius={[2, 2, 0, 0]} barSize={3} />
            </ComposedChart>
          ) : type === "bar" ? (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
              <XAxis dataKey="ts" type="number" scale="time" domain={["auto","auto"]} ticks={ticks} tickFormatter={tickFormatter} tick={{ fontSize: 9, angle: -40, textAnchor: "end" }} height={52} />
              <YAxis
                className="text-[10px]"
                unit={unit}
                domain={["auto", "auto"]}
                label={{ value: `${title} (${unit})`, angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 10, fill: "#64748b", textAnchor: "middle" } }}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${fmt(v)} ${unit}`, title]} />
              <Bar dataKey={dataKey} fill={color} radius={[2, 2, 0, 0]} />
            </BarChart>
          ) : type === "area" ? (
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
              <XAxis dataKey="ts" type="number" scale="time" domain={["auto","auto"]} ticks={ticks} tickFormatter={tickFormatter} tick={{ fontSize: 9, angle: -40, textAnchor: "end" }} height={52} />
              <YAxis
                className="text-[10px]"
                unit={unit}
                domain={["auto", "auto"]}
                label={{ value: `${title} (${unit})`, angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 10, fill: "#64748b", textAnchor: "middle" } }}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${fmt(v)} ${unit}`, title]} />
              <Area type="monotone" dataKey={dataKey} stroke={color} fill={color} fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          ) : (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
              <XAxis dataKey="ts" type="number" scale="time" domain={["auto","auto"]} ticks={ticks} tickFormatter={tickFormatter} tick={{ fontSize: 9, angle: -40, textAnchor: "end" }} height={52} />
              <YAxis
                className="text-[10px]"
                unit={unit}
                domain={["auto", "auto"]}
                label={{ value: `${title} (${unit})`, angle: -90, position: "insideLeft", offset: 10, style: { fontSize: 10, fill: "#64748b", textAnchor: "middle" } }}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${fmt(v)} ${unit}`, title]} />
              <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
