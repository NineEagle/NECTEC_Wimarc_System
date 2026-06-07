// components/overview/StationsTable.tsx
"use client"

import { useState } from "react"
import { Leaf, ArrowDown, ArrowUp } from "lucide-react"
import type { OverviewStation } from "./overviewTypes"
import { HEADLINE } from "./overviewTypes"
import { STATUS_META, getVPDStatus, formatValue, batteryColor } from "./overviewUtils"

type SortKey = "status" | "name" | "battery" | "soilMoisture1" | string
type Sort = { key: SortKey; dir: 1 | -1 }

function valueFor(s: OverviewStation, key: SortKey): number | string {
  if (key === "status") return { online: 0, weak: 1, offline: 2 }[s.status]
  if (key === "name") return s.name
  if (key === "battery") return s.batteryVoltage ?? -1
  if (key === "soilMoisture1") return s.client.sensors.soilMoisture1 ?? -1
  return (s.main.sensors as Record<string, number | null>)[key] ?? -1
}

export function StationsTable({
  stations, onOpen,
}: {
  stations: OverviewStation[]; onOpen: (s: OverviewStation) => void
}) {
  const [sort, setSort] = useState<Sort>({ key: "status", dir: 1 })

  const sorted = [...stations].sort((a, b) => {
    const av = valueFor(a, sort.key), bv = valueFor(b, sort.key)
    if (av < bv) return -sort.dir
    if (av > bv) return sort.dir
    return 0
  })
  const toggle = (key: SortKey) =>
    setSort((p) => (p.key === key ? { key, dir: (p.dir * -1) as 1 | -1 } : { key, dir: 1 }))

  const Arrow = ({ k }: { k: SortKey }) =>
    sort.key === k ? (sort.dir === 1 ? <ArrowDown className="ml-0.5 inline h-3 w-3" /> : <ArrowUp className="ml-0.5 inline h-3 w-3" />) : null

  const th = "sticky top-0 z-[1] cursor-pointer select-none whitespace-nowrap border-b bg-background px-2.5 py-2.5 text-[0.55rem] font-semibold text-muted-foreground"

  return (
    <div className="overflow-hidden rounded-2xl border bg-background shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr>
              <th className={`${th} pl-4 text-left`} onClick={() => toggle("status")}>สถานะ<Arrow k="status" /></th>
              <th className={`${th} text-left`} onClick={() => toggle("name")}>สถานี<Arrow k="name" /></th>
              {HEADLINE.map((h) => (
                <th key={h.key} className={`${th} text-right`} onClick={() => toggle(h.key)}>
                  <span className="inline-flex items-center justify-end gap-0.5">{h.short}<Arrow k={h.key} /></span>
                </th>
              ))}
              <th className={`${th} text-right`} onClick={() => toggle("soilMoisture1")}>
                <span className="inline-flex items-center gap-1"><Leaf className="h-3 w-3 text-sensor-soil-fg" />ดิน<Arrow k="soilMoisture1" /></span>
              </th>
              <th className={`${th} pr-4 text-right`} onClick={() => toggle("battery")}>แบต<Arrow k="battery" /></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => {
              const meta = STATUS_META[s.status]
              const off = s.status === "offline"
              return (
                <tr
                  key={s.id}
                  onClick={() => onOpen(s)}
                  className={`cursor-pointer transition-colors hover:bg-muted ${i ? "border-t" : ""}`}
                >
                  <td className="py-2.5 pl-4 pr-2.5">
                    <span className={`inline-flex items-center gap-2 text-xs font-semibold ${meta.text}`}>
                      <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                      <span className="max-md:hidden">{meta.label}</span>
                    </span>
                  </td>
                  <td className="px-2.5 py-2.5">
                    <div className="whitespace-nowrap text-[0.65rem] font-semibold">{s.name}</div>
                    <div className="font-mono text-[0.525rem] text-muted-foreground">{s.id} · {s.province}</div>
                  </td>
                  {HEADLINE.map((h) => {
                    const v = (s.main.sensors as Record<string, number | null>)[h.key]
                    const alert = h.key === "vpd" && !off && getVPDStatus(v) !== "เหมาะสม"
                    return (
                      <td key={h.key} className="px-2.5 py-2.5 text-right">
                        <span className={`text-[0.65rem] font-semibold tabular-nums ${off ? "text-muted-foreground" : alert ? "text-orange-600" : "text-foreground"}`}>
                          {off ? "—" : formatValue(h.key, v)}
                        </span>
                      </td>
                    )
                  })}
                  <td className="px-2.5 py-2.5 text-right">
                    <span className="text-[0.65rem] font-semibold tabular-nums text-sensor-soil-fg">
                      {off || s.client.sensors.soilMoisture1 == null ? "—" : `${s.client.sensors.soilMoisture1}%`}
                    </span>
                  </td>
                  <td className="py-2.5 pl-2.5 pr-4 text-right">
                    <span className={`font-mono text-xs font-semibold tabular-nums ${batteryColor(s.batteryVoltage)}`}>
                      {s.batteryVoltage != null ? `${s.batteryVoltage.toFixed(1)}V` : "—"}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
