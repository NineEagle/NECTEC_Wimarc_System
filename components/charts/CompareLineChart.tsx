"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

interface Props {
  data: any[]
  name1: string
  name2: string
  color1: string
  color2: string
}

export function CompareLineChart({ data, name1, name2, color1, color2 }: Props) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
        <XAxis dataKey="time" className="text-[10px]" />
        <YAxis className="text-[10px]" />
        <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "8px" }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
        <Line type="monotone" dataKey="val1" name={name1} stroke={color1} strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
        <Line type="monotone" dataKey="val2" name={name2} stroke={color2} strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
