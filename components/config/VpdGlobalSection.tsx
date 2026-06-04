"use client"

import { Activity } from "lucide-react"
import type { SystemConfig } from "./configTypes"
import { SectionCard, Switch, NumField } from "./configControls"

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
  const enabled = system.vpdColorEnabled ?? true
  const low = system.vpdLow ?? 0.8
  const high = system.vpdHigh ?? 1.6

  return (
    <SectionCard
      icon={Activity}
      title="VPD Thresholds (ทุเรียน)"
      scope="Global · ทุกสถานี"
      subtitle="กำหนดเกณฑ์แบ่ง 3 โซน: ความเครียดต่ำ / เหมาะสม / ความเครียดสูง — ใช้กับทุกสถานี"
    >
      <div className="px-5 py-4">
        {/* Toggle row */}
        <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/40 px-4 py-3">
          <div>
            <p className="text-[13px] font-semibold">เปิดใช้สีบอกสถานะ VPD</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              แสดงสี <span className="font-bold text-blue-600">น้ำเงิน</span> / <span className="font-bold text-green-600">เขียว</span> / <span className="font-bold text-red-600">แดง</span> ในตารางข้อมูลย้อนหลัง
            </p>
          </div>
          <Switch
            checked={enabled}
            size={24}
            label="เปิด/ปิดสีบอกสถานะ VPD"
            onChange={(v) => setSystem((s) => ({ ...s, vpdColorEnabled: v }))}
          />
        </div>

        {/* Threshold fields — shown only when enabled */}
        {enabled && (
          <div className="mt-4">
            <div className="flex flex-wrap gap-6">
              <label className="flex-1 min-w-[160px]">
                <span className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">
                  Low → Optimal (kPa)
                </span>
                <NumField
                  className="w-full"
                  value={low}
                  onChange={(v) => setSystem((s) => ({ ...s, vpdLow: parseFloat(v) || 0 }))}
                />
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  VPD น้อยกว่าค่านี้ = <span className="font-bold text-blue-600">ความเครียดต่ำ</span>
                </p>
              </label>
              <label className="flex-1 min-w-[160px]">
                <span className="mb-1.5 block text-[12px] font-semibold text-muted-foreground">
                  Optimal → High (kPa)
                </span>
                <NumField
                  className="w-full"
                  value={high}
                  onChange={(v) => setSystem((s) => ({ ...s, vpdHigh: parseFloat(v) || 0 }))}
                />
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  VPD มากกว่าค่านี้ = <span className="font-bold text-red-600">ความเครียดสูง</span>
                </p>
              </label>
            </div>
            <VpdBand low={low} high={high} />
          </div>
        )}
      </div>
    </SectionCard>
  )
}
