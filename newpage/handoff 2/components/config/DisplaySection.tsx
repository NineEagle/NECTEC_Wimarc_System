// components/config/DisplaySection.tsx
// Section 3 — display & refresh settings (chart gap threshold + dashboard
// auto-refresh interval). GLOBAL.
"use client"

import { Eye } from "lucide-react"
import type { SystemConfig } from "./configTypes"
import { SectionCard, RangeSlider, SegToggle } from "./configControls"

const REFRESH_OPTS: { value: number | null; label: string; danger?: boolean }[] = [
  { value: 30, label: "30s" },
  { value: 60, label: "60s" },
  { value: 120, label: "120s" },
  { value: null, label: "ปิด", danger: true },
]

export function DisplaySection({
  system, setSystem,
}: {
  system: SystemConfig
  setSystem: React.Dispatch<React.SetStateAction<SystemConfig>>
}) {
  const gap = system.gapThresholdMinutes
  const refresh = system.dashboardRefreshSeconds

  return (
    <SectionCard
      icon={Eye}
      title="การแสดงผล"
      scope="Global"
      subtitle="ตั้งค่าการแสดงกราฟและการรีเฟรชหน้า dashboard"
    >
      <div className="disp-grid grid grid-cols-1 md:grid-cols-2">
        {/* chart gap threshold */}
        <div className="border-t px-5 py-[18px]">
          <div className="mb-3 flex items-baseline justify-between">
            <label className="text-[13px] font-semibold">Chart gap threshold</label>
            <span className="font-mono text-lg font-bold text-primary">
              {gap}<span className="ml-1 text-xs text-muted-foreground">นาที</span>
            </span>
          </div>
          <RangeSlider value={gap} min={5} max={120} step={5} onChange={(v) => setSystem((s) => ({ ...s, gapThresholdMinutes: v }))} />
          <div className="mt-1.5 flex justify-between font-mono text-[10px] text-muted-foreground"><span>5</span><span>120</span></div>
          <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">ช่องว่างในกราฟเมื่อข้อมูลหายนานกว่า {gap} นาที</p>
        </div>

        {/* dashboard refresh interval */}
        <div className="border-t px-5 py-[18px] md:border-l">
          <label className="mb-3 block text-[13px] font-semibold">Dashboard refresh interval</label>
          <SegToggle
            size="md"
            value={refresh}
            onChange={(v) => setSystem((s) => ({ ...s, dashboardRefreshSeconds: v }))}
            options={REFRESH_OPTS}
          />
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {refresh === null ? "ปิดการรีเฟรชอัตโนมัติ — ต้องรีเฟรชเอง" : `dashboard จะดึงข้อมูลใหม่ทุก ${refresh} วินาที`}
          </p>
        </div>
      </div>
    </SectionCard>
  )
}
