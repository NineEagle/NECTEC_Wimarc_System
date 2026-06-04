"use client"

import { Activity } from "lucide-react"
import type { SystemConfig } from "./configTypes"
import { SectionCard, NumField } from "./configControls"

function VpdBand({ low, high }: { low: number; high: number }) {
  const MAX = 2.5
  const lowW = Math.max(0, Math.min(1, low / MAX)) * 100
  const highStart = Math.max(0, Math.min(1, high / MAX)) * 100
  const optW = Math.max(0, highStart - lowW)
  const hiW = Math.max(0, 100 - highStart)
  const seg = (w: number, color: string, label: string) => (
    <div className="relative transition-[width] duration-200" style={{ width: `${w}%`, minWidth: w > 0 ? 2 : 0 }}>
      <div className="h-[30px] border-b-[3px]" style={{ borderColor: color, background: `color-mix(in srgb, ${color} 26%, transparent)` }} />
      {w > 12 && <div className="mt-1.5 text-center text-[11px] font-bold" style={{ color }}>{label}</div>}
    </div>
  )
  return (
    <div className="mt-4">
      <div className="relative flex overflow-hidden rounded-lg border">
        {seg(lowW, "#2563eb", "ความเครียดต่ำ")}
        {seg(optW, "#16a34a", "เหมาะสม")}
        {seg(hiW, "#dc2626", "ความเครียดสูง")}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>0</span>
        <span className="font-bold text-blue-600">◆ {low.toFixed(2)}</span>
        <span className="font-bold text-red-600">◆ {high.toFixed(2)} kPa</span>
        <span>{MAX}</span>
      </div>
    </div>
  )
}

export function VpdGlobalSection({
  system, setSystem,
}: {
  system: SystemConfig
  setSystem: React.Dispatch<React.SetStateAction<SystemConfig>>
}) {
  return (
    <SectionCard
      icon={Activity}
      title="VPD Thresholds (ทุเรียน)"
      scope="Global · ทุกสถานี"
      subtitle="กำหนดเกณฑ์แบ่ง 3 โซน: ความเครียดต่ำ / เหมาะสม / ความเครียดสูง — ใช้กับทุกสถานี"
    >
      <div className="px-5 py-5">
        <div className="flex flex-wrap gap-6">
          <label className="flex-1 min-w-[160px]">
            <span className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">
              Low → Optimal (kPa)
            </span>
            <NumField
              className="w-full"
              value={system.vpdLow}
              onChange={(v) => setSystem((s) => ({ ...s, vpdLow: parseFloat(v) || 0 }))}
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">VPD น้อยกว่าค่านี้ = ความเครียดต่ำ</p>
          </label>
          <label className="flex-1 min-w-[160px]">
            <span className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">
              Optimal → High (kPa)
            </span>
            <NumField
              className="w-full"
              value={system.vpdHigh}
              onChange={(v) => setSystem((s) => ({ ...s, vpdHigh: parseFloat(v) || 0 }))}
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">VPD มากกว่าค่านี้ = ความเครียดสูง</p>
          </label>
        </div>
        <VpdBand low={system.vpdLow} high={system.vpdHigh} />
      </div>
    </SectionCard>
  )
}
