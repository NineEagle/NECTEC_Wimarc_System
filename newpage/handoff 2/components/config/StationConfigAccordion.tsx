// components/config/StationConfigAccordion.tsx
// Section 4 — per-station VPD thresholds + sensor alert limits, in an accordion.
// Unconfigured stations inherit the system defaults (badge = "ค่าเริ่มต้น").
"use client"

import { ChevronDown, SlidersHorizontal, Activity, Bell } from "lucide-react"
import {
  ALERT_ROWS,
  type AlertKey, type AlertRule, type AlertRowDef,
  type StationConfig, type StationMeta,
} from "./configTypes"
import { SENSOR_STYLE, alertSensorType } from "./configUtils"
import { SectionCard, Switch, NumField } from "./configControls"

const STATUS_DOT: Record<StationMeta["status"], string> = {
  online: "bg-green-500", weak: "bg-orange-500", offline: "bg-red-500",
}

// 3-segment VPD band: low-stress / optimal / high-stress, scaled to 0–2.5 kPa
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
    <div className="mt-3.5">
      <div className="relative flex overflow-hidden rounded-lg border">
        {seg(lowW, "#2563eb", "ความเครียดต่ำ")}
        {seg(optW, "#16a34a", "เหมาะสม")}
        {seg(hiW, "#dc2626", "ความเครียดสูง")}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>0</span>
        <span className="font-bold text-blue-600">◆ {low.toFixed(1)}</span>
        <span className="font-bold text-red-600">◆ {high.toFixed(1)} kPa</span>
        <span>{MAX}</span>
      </div>
    </div>
  )
}

function AlertRow({ row, a, set }: { row: AlertRowDef; a: AlertRule; set: (p: Partial<AlertRule>) => void }) {
  const st = SENSOR_STYLE[alertSensorType(row.key)]
  const muted = !a.enabled
  return (
    <div className={`grid grid-cols-[minmax(150px,1fr)_90px_90px_52px] items-center gap-3 border-t px-3.5 py-2.5 transition-opacity ${muted ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-[3px] ${st.fg.replace("text-", "bg-")}`} />
        <span className="text-[12.5px] font-semibold">{row.label}</span>
        <span className="font-mono text-[10px] text-muted-foreground">{row.unit}</span>
      </div>
      <NumField className="w-full px-[7px] py-[5px]" disabled={muted} placeholder="—" value={a.min ?? ""} onChange={(v) => set({ min: v === "" ? null : parseFloat(v) })} />
      <NumField className="w-full px-[7px] py-[5px]" disabled={muted} placeholder="—" value={a.max ?? ""} onChange={(v) => set({ max: v === "" ? null : parseFloat(v) })} />
      <div className="flex justify-end">
        <Switch checked={a.enabled} size={20} label={`เปิดแจ้งเตือน ${row.label}`} onChange={(v) => set({ enabled: v })} />
      </div>
    </div>
  )
}

function AlertTable({ title, rows, cfg, setAlert }: {
  title: string; rows: AlertRowDef[]; cfg: StationConfig; setAlert: (k: AlertKey, p: Partial<AlertRule>) => void
}) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="flex justify-between bg-muted px-3.5 py-2.5 text-[11.5px] font-bold text-muted-foreground">
        <span>{title}</span><span className="text-[10px] tracking-wide">MIN · MAX · เปิด</span>
      </div>
      {rows.map((r) => <AlertRow key={r.key} row={r} a={cfg.alerts[r.key]} set={(p) => setAlert(r.key, p)} />)}
    </div>
  )
}

function AccordionItem({ st, cfg, open, onToggle, setConfig, setAlert }: {
  st: StationMeta
  cfg: StationConfig
  open: boolean
  onToggle: () => void
  setConfig: (p: Partial<StationConfig>) => void
  setAlert: (k: AlertKey, p: Partial<AlertRule>) => void
}) {
  const weather = ALERT_ROWS.filter((r) => r.group === "weather")
  const soil = ALERT_ROWS.filter((r) => r.group === "soil")
  return (
    <div className="border-t">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`flex w-full items-center gap-3 px-5 py-3.5 text-left text-foreground ${open ? "bg-muted" : ""}`}
      >
        <ChevronDown className={`h-[17px] w-[17px] text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
        <span className="rounded-[7px] border bg-secondary px-2.5 py-[3px] font-mono text-[13px] font-bold">{st.id}</span>
        <span className="inline-flex items-center gap-1.5">
          <span className={`h-[7px] w-[7px] rounded-full ${STATUS_DOT[st.status]}`} />
          <span className="text-[13.5px] font-semibold">{st.name}</span>
        </span>
        <span className="text-[11.5px] text-muted-foreground">· {st.province}</span>
        <span
          className={`ml-auto rounded-full border px-2.5 py-[3px] text-[11px] font-bold ${
            cfg.configured ? "border-primary/30 bg-accent text-primary" : "border-border bg-secondary text-muted-foreground"
          }`}
        >
          {cfg.configured ? "ตั้งค่าแล้ว" : "ค่าเริ่มต้น"}
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1">
          <div className="stn-grid grid grid-cols-1 items-start gap-[22px] lg:grid-cols-[minmax(280px,0.9fr)_1.1fr]">
            {/* 4a — VPD thresholds */}
            <div>
              <div className="mb-3 flex items-center gap-1.5">
                <Activity className="h-[15px] w-[15px] text-primary" />
                <h4 className="text-[13.5px] font-bold">VPD Thresholds <span className="font-medium text-muted-foreground">(ทุเรียน)</span></h4>
              </div>
              <div className="flex gap-3">
                <label className="flex-1">
                  <span className="mb-1.5 block text-[11.5px] font-semibold text-muted-foreground">Low → Optimal (kPa)</span>
                  <NumField className="w-full" value={cfg.vpdLow} onChange={(v) => setConfig({ vpdLow: parseFloat(v) || 0, configured: true })} />
                </label>
                <label className="flex-1">
                  <span className="mb-1.5 block text-[11.5px] font-semibold text-muted-foreground">Optimal → High (kPa)</span>
                  <NumField className="w-full" value={cfg.vpdHigh} onChange={(v) => setConfig({ vpdHigh: parseFloat(v) || 0, configured: true })} />
                </label>
              </div>
              <VpdBand low={cfg.vpdLow} high={cfg.vpdHigh} />
            </div>

            {/* 4b — sensor alert limits */}
            <div>
              <div className="mb-3 flex items-center gap-1.5">
                <Bell className="h-[15px] w-[15px] text-primary" />
                <h4 className="text-[13.5px] font-bold">Sensor Alert Limits</h4>
                <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10.5px] text-muted-foreground">เก็บค่าไว้ก่อน — notification ทำทีหลัง</span>
              </div>
              <div className="grid gap-2.5">
                <AlertTable title="สถานีอากาศ" rows={weather} cfg={cfg} setAlert={setAlert} />
                <AlertTable title="สถานีดิน" rows={soil} cfg={cfg} setAlert={setAlert} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function StationConfigAccordion({
  stations, configs, openId, setOpenId, setConfig, setAlert,
}: {
  stations: StationMeta[]
  configs: Record<string, StationConfig>
  openId: string | null
  setOpenId: (id: string | null) => void
  setConfig: (id: string, patch: Partial<StationConfig>) => void
  setAlert: (id: string, key: AlertKey, patch: Partial<AlertRule>) => void
}) {
  return (
    <SectionCard
      icon={SlidersHorizontal}
      title="ตั้งค่ารายสถานี"
      scope="Per-Station"
      subtitle="VPD thresholds และ alert limits แยกตามแต่ละสถานี — ค่าที่ไม่ได้ตั้งจะใช้ค่าเริ่มต้นของระบบ"
    >
      <div className="max-h-[560px] overflow-y-auto">
        {stations.map((st) => (
          <AccordionItem
            key={st.id}
            st={st}
            cfg={configs[st.id]}
            open={openId === st.id}
            onToggle={() => setOpenId(openId === st.id ? null : st.id)}
            setConfig={(p) => setConfig(st.id, p)}
            setAlert={(k, p) => setAlert(st.id, k, p)}
          />
        ))}
      </div>
    </SectionCard>
  )
}
