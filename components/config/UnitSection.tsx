"use client"

import { Ruler } from "lucide-react"
import { SENSORS, type SensorKey, type SystemConfig } from "./configTypes"
import { SENSOR_STYLE } from "./configUtils"
import { SectionCard } from "./configControls"

const GROUPS: { key: "weather" | "soil"; label: string }[] = [
  { key: "weather", label: "สถานีอากาศ" },
  { key: "soil",    label: "สถานีดิน" },
]

export function UnitSection({
  system,
  setSystem,
}: {
  system: SystemConfig
  setSystem: React.Dispatch<React.SetStateAction<SystemConfig>>
}) {
  const setUnit = (key: SensorKey, unit: string) =>
    setSystem((s) => ({
      ...s,
      conversions: { ...s.conversions, [key]: { ...s.conversions[key], unit } },
    }))

  return (
    <SectionCard
      icon={Ruler}
      title="หน่วยแสดงผลเซนเซอร์"
      scope="Global · ทุกสถานี"
      subtitle="กำหนดหน่วยที่แสดงในกราฟและ dashboard — เปลี่ยนได้อิสระ (เช่น lux → klux)"
    >
      <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
        {GROUPS.map(({ key: group, label }) => {
          const rows = SENSORS.filter((s) => s.group === group)
          return (
            <div key={group}>
              <div className="bg-muted px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                {label}
              </div>
              {rows.map((s) => {
                const st = SENSOR_STYLE[s.type]
                const unit = system.conversions[s.key]?.unit ?? s.unit
                return (
                  <div
                    key={s.key}
                    className="flex items-center gap-2 border-t px-3 py-2.5 sm:gap-3 sm:px-4"
                  >
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-[3px] ${st.fg.replace("text-", "bg-")}`} />
                    <span className="flex-1 text-[12.5px] font-semibold">{s.label}</span>
                    <span className="mr-1 hidden font-mono text-[10px] text-muted-foreground sm:inline">{s.rawUnit} →</span>
                    <input
                      value={unit}
                      onChange={(e) => setUnit(s.key, e.target.value)}
                      className="w-16 rounded-lg border border-input bg-background px-2 py-1 text-center text-[13px] font-bold text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/25 sm:w-20"
                    />
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </SectionCard>
  )
}
