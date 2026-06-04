// components/config/ValidRangeSection.tsx
// Section 2 — valid range per sensor. Readings outside [min,max] are nulled
// before charting (an explicit replacement for an IQR outlier filter). GLOBAL.
"use client"

import { Filter } from "lucide-react"
import { SENSORS, type SensorKey, type Limit, type SystemConfig } from "./configTypes"
import { SectionCard, NumField } from "./configControls"
import { SensorTag } from "./SensorTag"

// horizontal bar: hatched reject zones on the ends, solid accept band in the middle
function RangeBar({ s, lim }: { s: (typeof SENSORS)[number]; lim: Limit }) {
  const [d0, d1] = s.domain
  const span = d1 - d0
  const clamp = (v: number) => Math.max(0, Math.min(100, ((v - d0) / span) * 100))
  const left = clamp(lim.min)
  const right = clamp(lim.max)
  return (
    <div>
      <div className="relative h-[22px] overflow-hidden rounded-[7px] border bg-red-50 dark:bg-red-950/30">
        <div
          className="absolute bottom-0 left-0 top-0"
          style={{ width: `${left}%`, background: "repeating-linear-gradient(45deg, color-mix(in srgb, var(--color-destructive) 16%, transparent) 0 6px, transparent 6px 12px)" }}
        />
        <div
          className="absolute bottom-0 right-0 top-0"
          style={{ width: `${100 - right}%`, background: "repeating-linear-gradient(45deg, color-mix(in srgb, var(--color-destructive) 16%, transparent) 0 6px, transparent 6px 12px)" }}
        />
        <div
          className="absolute bottom-0 top-0 border-x-2 border-green-600"
          style={{ left: `${left}%`, width: `${right - left}%`, background: "color-mix(in srgb, var(--color-chart-2, #16a34a) 22%, transparent)" }}
        />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[9.5px] text-muted-foreground">
        <span>{d0.toLocaleString()}</span>
        <span className="font-bold text-green-600">ช่วงที่ยอมรับ {lim.min.toLocaleString()}–{lim.max.toLocaleString()} {s.unit}</span>
        <span>{d1.toLocaleString()}</span>
      </div>
    </div>
  )
}

export function ValidRangeSection({
  system, setSystem,
}: {
  system: SystemConfig
  setSystem: React.Dispatch<React.SetStateAction<SystemConfig>>
}) {
  const set = (key: SensorKey, patch: Partial<Limit>) =>
    setSystem((sys) => ({ ...sys, limits: { ...sys.limits, [key]: { ...sys.limits[key], ...patch } } }))

  return (
    <SectionCard
      icon={Filter}
      title="ช่วงค่าที่ยอมรับของเซนเซอร์"
      scope="Global · ตัด outlier"
      subtitle="ค่าที่อยู่นอกช่วงนี้จะถูกทำเป็น null ก่อนแสดงในกราฟ (ไม่บันทึกทับ raw data)"
      footer="ใช้แทน IQR outlier filter — ควบคุมได้ตรงกว่า"
    >
      {/* Desktop header */}
      <div className="hidden sm:grid gap-3.5 bg-muted px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"
        style={{ gridTemplateColumns: "minmax(165px,1fr) 96px 96px minmax(220px,1.5fr)" }}>
        <span>เซนเซอร์</span><span>Min</span><span>Max</span><span>ช่วงที่ยอมรับ</span>
      </div>
      {SENSORS.map((s) => {
        const lim = system.limits[s.key]
        return (
          <div key={s.key} className="border-t px-4 py-3 sm:px-5 sm:py-3.5">
            {/* Desktop: 4-column inline */}
            <div className="hidden sm:grid items-center gap-3.5"
              style={{ gridTemplateColumns: "minmax(165px,1fr) 96px 96px minmax(220px,1.5fr)" }}>
              <SensorTag s={s} />
              <NumField className="w-full" value={lim.min} onChange={(v) => set(s.key, { min: parseFloat(v) || 0 })} />
              <NumField className="w-full" value={lim.max} onChange={(v) => set(s.key, { max: parseFloat(v) || 0 })} />
              <RangeBar s={s} lim={lim} />
            </div>
            {/* Mobile: sensor + fields stacked */}
            <div className="sm:hidden">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1"><SensorTag s={s} /></div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[9px] font-bold uppercase text-muted-foreground">Min</span>
                    <NumField className="w-[72px]" value={lim.min} onChange={(v) => set(s.key, { min: parseFloat(v) || 0 })} />
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[9px] font-bold uppercase text-muted-foreground">Max</span>
                    <NumField className="w-[72px]" value={lim.max} onChange={(v) => set(s.key, { max: parseFloat(v) || 0 })} />
                  </div>
                </div>
              </div>
              <div className="mt-2.5"><RangeBar s={s} lim={lim} /></div>
            </div>
          </div>
        )
      })}
    </SectionCard>
  )
}
