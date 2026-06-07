"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

interface Props {
  data: any[]
  name1: string
  name2: string
  color1: string
  color2: string
  timeRange?: number
}

export function CompareLineChart({ data, name1, name2, color1, color2, timeRange }: Props) {
  const { ticks, tickFormatter, xDomain } = (() => {
    const pts = data.filter(d => d.ts)
    if (!pts.length) return { ticks: undefined, tickFormatter: undefined, xDomain: ["auto", "auto"] as ["auto", "auto"] }
    const tsMin = pts[0].ts as number
    const tsMax = pts[pts.length - 1].ts as number
    const days = timeRange ?? 0
    // Domain: start at first data point (no gap), end at now
    const domainMin = tsMin
    const domainMax = Math.max(tsMax, Date.now())
    // Ticks aligned to LOCAL time boundaries (not UTC)
    const t: number[] = []
    if (days >= 7) {
      const cur = new Date(domainMin); cur.setHours(0, 0, 0, 0)
      if (cur.getTime() < domainMin) cur.setDate(cur.getDate() + 1)
      while (cur.getTime() <= domainMax) { t.push(cur.getTime()); cur.setDate(cur.getDate() + 1) }
    } else if (days === 1) {
      const cur = new Date(domainMin); cur.setMinutes(0, 0, 0)
      if (cur.getTime() < domainMin) cur.setHours(cur.getHours() + 1)
      while (cur.getTime() <= domainMax) { t.push(cur.getTime()); cur.setHours(cur.getHours() + 1) }
    } else {
      const cur = new Date(domainMin); cur.setMinutes(0, 0, 0)
      cur.setHours(Math.ceil(cur.getHours() / 6) * 6)
      if (cur.getTime() < domainMin) cur.setHours(cur.getHours() + 6)
      while (cur.getTime() <= domainMax) { t.push(cur.getTime()); cur.setHours(cur.getHours() + 6) }
    }
    const MON = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."]
    const fmt = (ts: number) => {
      const d = new Date(ts)
      const hh = String(d.getHours()).padStart(2, "0")
      const mm = String(d.getMinutes()).padStart(2, "0")
      if (days === 1) return `${hh}:${mm}`
      if (days >= 7) return `${d.getDate()} ${MON[d.getMonth()]}`
      return `${d.getDate()} ${MON[d.getMonth()]} ${hh}:${mm}`
    }
    return { ticks: t, tickFormatter: fmt, xDomain: [domainMin, domainMax] as [number, number] }
  })()

  const labelFmt = (ts: any) => {
    if (typeof ts !== "number") return ""
    const d = new Date(ts)
    const hh = String(d.getHours()).padStart(2, "0")
    const mm = String(d.getMinutes()).padStart(2, "0")
    const MM = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."]
    return `${d.getDate()} ${MM[d.getMonth()]} ${hh}:${mm}`
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
        <XAxis
          dataKey="ts"
          type="number"
          scale="time"
          domain={xDomain}
          ticks={ticks}
          tickFormatter={tickFormatter}
          tick={{ fontSize: 9, angle: -40, textAnchor: "end" }}
          height={52}
          padding={{ left: 0, right: 0 }}
        />
        <YAxis className="text-[10px]" domain={["auto", "auto"]} />
        <Tooltip
          contentStyle={{ fontSize: "12px", borderRadius: "8px" }}
          labelFormatter={labelFmt}
        />
        <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
        <Line type="monotone" dataKey="val1" name={name1} stroke={color1} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
        <Line type="monotone" dataKey="val2" name={name2} stroke={color2} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
