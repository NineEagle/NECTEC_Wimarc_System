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
  return (
    <Card className="shadow-sm overflow-hidden border">
      <CardHeader className="py-2.5 bg-muted/20 border-b flex flex-row items-center justify-between">
        <CardTitle className="text-[11px] font-bold uppercase tracking-tight flex items-center gap-1.5 text-muted-foreground">
          <Icon className="h-3.5 w-3.5" /> {title}
        </CardTitle>
        <span className="text-[10px] font-mono opacity-50 lowercase">{unit}</span>
      </CardHeader>
      <CardContent className="pt-5 px-1">
        <ResponsiveContainer width="100%" height={180}>
          {type === "bar" ? (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
              <XAxis dataKey="timeLabel" hide />
              <YAxis className="text-[10px]" unit={unit} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey={dataKey} fill={color} radius={[2, 2, 0, 0]} />
            </BarChart>
          ) : type === "area" ? (
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
              <XAxis dataKey="timeLabel" hide />
              <YAxis className="text-[10px]" unit={unit} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey={dataKey} stroke={color} fill={color} fillOpacity={0.1} strokeWidth={2} />
            </AreaChart>
          ) : (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
              <XAxis dataKey="timeLabel" hide />
              <YAxis className="text-[10px]" unit={unit} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
