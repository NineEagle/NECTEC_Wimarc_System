// components/config/StationConfigAccordion.tsx
// Section 4 — per-station VPD thresholds + sensor alert limits, in an accordion.
// Unconfigured stations inherit the system defaults (badge = "ค่าเริ่มต้น").
"use client"

import { ChevronDown, SlidersHorizontal, Bell } from "lucide-react"
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

function AlertRow({ row, a, set }: { row: AlertRowDef; a: AlertRule; set: (p: Partial<AlertRule>) => void }) {
  const st = SENSOR_STYLE[alertSensorType(row.key)]
  const muted = !a.enabled
  return (
    <div className={`grid items-center gap-2 border-t px-3.5 py-2.5 transition-opacity ${muted ? "opacity-50" : ""}`}
      style={{ gridTemplateColumns: "minmax(0,1fr) 72px 72px 40px" }}>
      <div className="flex min-w-0 items-center gap-2">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-[3px] ${st.fg.replace("text-", "bg-")}`} />
        <span className="truncate text-[12.5px] font-semibold">{row.label}</span>
        <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">{row.unit}</span>
      </div>
      <NumField className="w-full px-[6px] py-[5px] text-[12px]" disabled={muted} placeholder="—" value={a.min ?? ""} onChange={(v) => set({ min: v === "" ? null : parseFloat(v) })} />
      <NumField className="w-full px-[6px] py-[5px] text-[12px]" disabled={muted} placeholder="—" value={a.max ?? ""} onChange={(v) => set({ max: v === "" ? null : parseFloat(v) })} />
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

function AccordionItem({ st, cfg, open, onToggle, setAlert }: {
  st: StationMeta
  cfg: StationConfig
  open: boolean
  onToggle: () => void
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
        className={`flex w-full items-center gap-2.5 px-4 py-3 text-left text-foreground sm:gap-3 sm:px-5 sm:py-3.5 ${open ? "bg-muted" : ""}`}
      >
        <ChevronDown className={`h-[17px] w-[17px] shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
        <span className="shrink-0 rounded-[7px] border bg-secondary px-2 py-[3px] font-mono text-[12px] font-bold sm:px-2.5 sm:text-[13px]">{st.id}</span>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${STATUS_DOT[st.status]}`} />
          <span className="truncate text-[13px] font-semibold sm:text-[13.5px]">{st.name}</span>
        </span>
        <span className="hidden text-[11.5px] text-muted-foreground sm:inline">· {st.province}</span>
        <span
          className={`ml-auto shrink-0 rounded-full border px-2 py-[3px] text-[10.5px] font-bold sm:px-2.5 sm:text-[11px] ${
            cfg.configured ? "border-primary/30 bg-accent text-primary" : "border-border bg-secondary text-muted-foreground"
          }`}
        >
          {cfg.configured ? "ตั้งค่าแล้ว" : "ค่าเริ่มต้น"}
        </span>
      </button>

      {open && (
        <div className="px-3.5 pb-4 pt-3 sm:px-5 sm:pb-5">
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <Bell className="h-[15px] w-[15px] text-primary" />
            <h4 className="text-[13.5px] font-bold">Sensor Alert Limits</h4>
            <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10.5px] text-muted-foreground">เก็บค่าไว้ก่อน — notification ทำทีหลัง</span>
          </div>
          <div className="grid gap-2.5">
            <AlertTable title="สถานีอากาศ" rows={weather} cfg={cfg} setAlert={setAlert} />
            <AlertTable title="สถานีดิน" rows={soil} cfg={cfg} setAlert={setAlert} />
          </div>
        </div>
      )}
    </div>
  )
}

export function StationConfigAccordion({
  stations, configs, openId, setOpenId, setAlert, enabled, setEnabled,
}: {
  stations: StationMeta[]
  configs: Record<string, StationConfig>
  openId: string | null
  setOpenId: (id: string | null) => void
  setAlert: (id: string, key: AlertKey, patch: Partial<AlertRule>) => void
  enabled: boolean
  setEnabled: (v: boolean) => void
}) {
  return (
    <SectionCard
      icon={SlidersHorizontal}
      title="ตั้งค่าแจ้งเตือนรายสถานี"
      scope="Per-Station"
      subtitle="Alert limits แยกตามแต่ละสถานี — ค่าที่ไม่ได้ตั้งจะใช้ค่าเริ่มต้นของระบบ"
    >
      {/* Master toggle */}
      <div className="flex items-center justify-between gap-4 border-b px-4 py-3 sm:px-5">
        <div>
          <p className="text-[13px] font-semibold">เปิดการตั้งค่ารายสถานี</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {enabled
              ? "แต่ละสถานีใช้ค่าที่ตั้งไว้ด้านล่าง — ถ้าไม่ได้ตั้งจะใช้ค่า Global"
              : "ทุกสถานีใช้ค่าแจ้งเตือน Global ทั้งหมด"}
          </p>
        </div>
        <Switch
          checked={enabled}
          size={24}
          label="เปิด/ปิดการตั้งค่ารายสถานี"
          onChange={setEnabled}
        />
      </div>

      {/* Accordion list — shown only when enabled */}
      {enabled ? (
        <div className="max-h-[560px] overflow-y-auto">
          {stations.map((st) => (
            <AccordionItem
              key={st.id}
              st={st}
              cfg={configs[st.id]}
              open={openId === st.id}
              onToggle={() => setOpenId(openId === st.id ? null : st.id)}
              setAlert={(k, p) => setAlert(st.id, k, p)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-muted">
            <SlidersHorizontal className="h-5 w-5 text-muted-foreground/40" />
          </div>
          <p className="text-[12px] font-semibold text-muted-foreground">ปิดการตั้งค่ารายสถานี</p>
          <p className="text-[11px] text-muted-foreground/70">ทุกสถานีใช้ค่าแจ้งเตือน Global ด้านบน</p>
        </div>
      )}
    </SectionCard>
  )
}
