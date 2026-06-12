// components/config/SensorTag.tsx
"use client"

import { SENSOR_ICON, SENSOR_STYLE } from "./configUtils"
import { SENSOR_ICON_NAME, type SensorDef } from "./configTypes"

// Icon chip + label + raw-unit caption — reused across the conversion and
// valid-range tables.
export function SensorTag({ s }: { s: SensorDef }) {
  const st = SENSOR_STYLE[s.type]
  const Icon = SENSOR_ICON[SENSOR_ICON_NAME[s.key]]
  return (
    <div className="flex items-center gap-2.5">
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${st.bg} ${st.border} ${st.fg}`}>
        {Icon && <Icon className="h-[15px] w-[15px]" />}
      </span>
      <div className="leading-tight">
        <div className="text-[13px] font-semibold">{s.label}</div>
        <div className="font-mono text-[10.5px] text-muted-foreground">raw · {s.rawUnit}</div>
      </div>
    </div>
  )
}
