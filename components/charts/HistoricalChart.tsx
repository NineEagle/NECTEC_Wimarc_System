"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area,
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

export function HistoricalChart({ title, data, dataKey, unit, color, icon: Icon, type = "line" }: {
  title: string; data: any[]; dataKey: string; unit: string; color: string
  icon: React.ElementType; type?: "line" | "bar" | "area"
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

  // Auto-interval: show ~6 x-axis labels regardless of data density
  const tickInterval = data.length > 0 ? Math.max(0, Math.floor(data.length / 6) - 1) : 0
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
          <span>ล่าสุด <span className="font-bold text-foreground">{fmt(latest)}</span></span>
          <span>เฉลี่ย <span className="font-bold">{fmt(avg)}</span></span>
          <span>ต่ำ <span className="font-bold text-blue-600">{fmt(minV)}</span></span>
          <span>สูง <span className="font-bold text-orange-600">{fmt(maxV)}</span></span>
        </div>
      </CardHeader>
      <CardContent className="pt-5 px-1">
        <ResponsiveContainer width="100%" height={200}>
          {type === "bar" ? (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
              <XAxis dataKey="timeLabel" className="text-[9px]" interval={tickInterval} tick={{ fontSize: 9 }} />
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
              <XAxis dataKey="timeLabel" className="text-[9px]" interval={tickInterval} tick={{ fontSize: 9 }} />
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
              <XAxis dataKey="timeLabel" className="text-[9px]" interval={tickInterval} tick={{ fontSize: 9 }} />
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
