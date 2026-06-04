"use client"

import { Bell } from "lucide-react"
import { ALERT_ROWS, type AlertKey, type AlertRule, type SystemConfig } from "./configTypes"
import { SENSOR_STYLE, alertSensorType } from "./configUtils"
import { SectionCard, Switch, NumField } from "./configControls"

function AlertRow({
  row,
  rule,
  set,
}: {
  row: (typeof ALERT_ROWS)[number]
  rule: AlertRule
  set: (patch: Partial<AlertRule>) => void
}) {
  const st = SENSOR_STYLE[alertSensorType(row.key)]
  const muted = !rule.enabled
  return (
    <div className={`grid items-center gap-2 border-t px-4 py-3 transition-opacity ${muted ? "opacity-40" : ""}`}
      style={{ gridTemplateColumns: "minmax(0,1fr) 72px 72px 40px" }}>
      <div className="flex min-w-0 items-center gap-2">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-[3px] ${st.fg.replace("text-", "bg-")}`} />
        <span className="truncate text-[12.5px] font-semibold">{row.label}</span>
        <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">{row.unit}</span>
      </div>
      <NumField className="w-full px-[6px] py-[5px] text-[12px]" disabled={muted} placeholder="—"
        value={rule.min ?? ""} onChange={(v) => set({ min: v === "" ? null : parseFloat(v) })} />
      <NumField className="w-full px-[6px] py-[5px] text-[12px]" disabled={muted} placeholder="—"
        value={rule.max ?? ""} onChange={(v) => set({ max: v === "" ? null : parseFloat(v) })} />
      <div className="flex justify-end">
        <Switch checked={rule.enabled} size={20} label={`เปิดแจ้งเตือน ${row.label}`} onChange={(v) => set({ enabled: v })} />
      </div>
    </div>
  )
}

function AlertGroup({
  title,
  rows,
  alerts,
  set,
}: {
  title: string
  rows: (typeof ALERT_ROWS)
  alerts: Record<AlertKey, AlertRule>
  set: (key: AlertKey, patch: Partial<AlertRule>) => void
}) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="flex items-center justify-between bg-muted px-4 py-2.5">
        <span className="text-[11.5px] font-bold text-muted-foreground">{title}</span>
        <span className="text-[10px] font-bold tracking-wide text-muted-foreground">MIN · MAX · เปิด</span>
      </div>
      {rows.map((r) => (
        <AlertRow key={r.key} row={r} rule={alerts[r.key]} set={(p) => set(r.key, p)} />
      ))}
    </div>
  )
}

export function GlobalAlertSection({
  system,
  setSystem,
}: {
  system: SystemConfig
  setSystem: React.Dispatch<React.SetStateAction<SystemConfig>>
}) {
  const alerts = system.globalAlerts

  const set = (key: AlertKey, patch: Partial<AlertRule>) =>
    setSystem((s) => ({
      ...s,
      globalAlerts: {
        ...s.globalAlerts,
        [key]: { ...s.globalAlerts[key], ...patch },
      },
    }))

  const weather = ALERT_ROWS.filter((r) => r.group === "weather")
  const soil = ALERT_ROWS.filter((r) => r.group === "soil")

  return (
    <SectionCard
      icon={Bell}
      title="ตั้งค่าแจ้งเตือนค่าเซนเซอร์"
      scope="Global · ทุกสถานี"
      subtitle="กำหนดช่วง Min/Max ของแต่ละค่า — ใช้เป็นค่าเริ่มต้นสำหรับทุกสถานี"
      footer="notification จะทำทีหลัง — ตั้งค่าไว้ก่อนได้เลย"
    >
      <div className="grid gap-3 p-4 md:grid-cols-2">
        <AlertGroup title="สถานีอากาศ" rows={weather} alerts={alerts} set={set} />
        <AlertGroup title="สถานีดิน" rows={soil} alerts={alerts} set={set} />
      </div>
    </SectionCard>
  )
}
