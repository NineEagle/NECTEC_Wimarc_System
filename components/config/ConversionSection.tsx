// components/config/ConversionSection.tsx
// Section 1 — per-sensor raw→value conversion (linear a·x+b or custom formula)
// with a live preview. GLOBAL scope (applies to every station).
"use client"

import { useState } from "react"
import { Sigma, ArrowRight } from "lucide-react"
import { SENSORS, type SensorKey, type Conversion, type SystemConfig } from "./configTypes"
import { convert, fmtNum } from "./configUtils"
import { SectionCard, SegToggle, NumField } from "./configControls"
import { SensorTag } from "./SensorTag"

const COLS = "minmax(170px,1.3fr) 200px 80px minmax(195px,1fr)"

function ConvRow({
  s, conv, raw, onRaw, set,
}: {
  s: (typeof SENSORS)[number]
  conv: Conversion
  raw: string
  onRaw: (v: string) => void
  set: (patch: Partial<Conversion>) => void
}) {
  const result = convert(conv, Number(raw))
  const bad = !isFinite(result)
  return (
    <div className="conv-row grid items-center gap-3.5 border-t px-5 py-3.5" style={{ gridTemplateColumns: COLS }}>
      <SensorTag s={s} />

      <div className="flex flex-col gap-1.5">
        <SegToggle
          value={conv.mode}
          onChange={(m) => set({ mode: m })}
          options={[{ value: "linear", label: "Linear" }, { value: "custom", label: "Custom" }]}
        />
        {conv.mode === "linear" ? (
          <div className="flex items-center gap-1.5">
            <label className="text-[11px] font-bold text-muted-foreground">a</label>
            <NumField width={64} className="px-[7px] py-[5px]" value={conv.a} onChange={(v) => set({ a: parseFloat(v) || 0 })} />
            <label className="text-[11px] font-bold text-muted-foreground">b</label>
            <NumField width={64} className="px-[7px] py-[5px]" value={conv.b} onChange={(v) => set({ b: parseFloat(v) || 0 })} />
          </div>
        ) : (
          <input
            value={conv.customFormula}
            placeholder="(x - 500) * 0.1 + 20"
            onChange={(e) => set({ customFormula: e.target.value })}
            className="w-full rounded-lg border border-input bg-background px-2 py-[5px] font-mono text-[12px] text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
          />
        )}
        <div className="font-mono text-[10px] text-muted-foreground">
          {conv.mode === "linear" ? "y = a·x + b" : "y = f(x)"}
        </div>
      </div>

      <input
        value={conv.unit}
        onChange={(e) => set({ unit: e.target.value })}
        className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-center text-[13px] font-semibold text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/25"
      />

      <div className="flex items-center gap-2 rounded-[9px] border bg-muted px-2.5 py-[7px]">
        <span className="text-[11px] font-semibold text-muted-foreground">raw =</span>
        <NumField width={62} className="px-1.5 py-1" value={raw} onChange={onRaw} />
        <ArrowRight className="h-[13px] w-[13px] text-muted-foreground" />
        <span className={`ml-auto font-mono text-[13.5px] font-bold tabular-nums ${bad ? "text-red-600" : "text-primary"}`}>
          {bad ? "ผิดพลาด" : `${fmtNum(result, s.dec)} ${conv.unit}`}
        </span>
      </div>
    </div>
  )
}

export function ConversionSection({
  system, setSystem,
}: {
  system: SystemConfig
  setSystem: React.Dispatch<React.SetStateAction<SystemConfig>>
}) {
  const [raws, setRaws] = useState<Record<string, string>>(
    () => Object.fromEntries(SENSORS.map((s) => [s.key, "500"])),
  )
  const set = (key: SensorKey, patch: Partial<Conversion>) =>
    setSystem((sys) => ({ ...sys, conversions: { ...sys.conversions, [key]: { ...sys.conversions[key], ...patch } } }))

  return (
    <SectionCard
      icon={Sigma}
      title="การแปลงค่าและหน่วยเซนเซอร์"
      scope="Global · ทุกสถานี"
      subtitle="แปลงค่าดิบจากเซนเซอร์เป็นค่าที่อ่านได้ — เลือกสมการเชิงเส้นหรือสูตรกำหนดเอง"
      footer="ค่าที่ได้จากสูตรนี้จะใช้แสดงในกราฟและ dashboard ทุกหน้า"
    >
      <div
        className="conv-head grid gap-3.5 bg-muted px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground"
        style={{ gridTemplateColumns: COLS }}
      >
        <span>เซนเซอร์</span><span>สูตรแปลงค่า</span><span className="text-center">หน่วย</span><span>ทดสอบค่า (Preview)</span>
      </div>
      {SENSORS.map((s) => (
        <ConvRow
          key={s.key}
          s={s}
          conv={system.conversions[s.key]}
          raw={raws[s.key]}
          onRaw={(v) => setRaws((r) => ({ ...r, [s.key]: v }))}
          set={(p) => set(s.key, p)}
        />
      ))}
    </SectionCard>
  )
}
