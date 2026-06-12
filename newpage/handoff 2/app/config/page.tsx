// app/config/page.tsx
"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import {
  Lock, Clock, Save, RefreshCw, Moon, Sun, Check, AlertTriangle,
} from "lucide-react"
import { useStation } from "@/contexts/StationContext"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getSystemConfig, getStationConfigs, saveConfig,
} from "@/services/configService"
import type {
  SystemConfig, StationConfig, StationMeta, AlertKey, AlertRule,
} from "@/components/config/configTypes"
import {
  defaultStation, validateSystem, configSignature, thaiStamp,
} from "@/components/config/configUtils"
import { ConversionSection } from "@/components/config/ConversionSection"
import { ValidRangeSection } from "@/components/config/ValidRangeSection"
import { DisplaySection } from "@/components/config/DisplaySection"
import { StationConfigAccordion } from "@/components/config/StationConfigAccordion"

type Toast = { id: string; kind: "ok" | "error"; msg: string }

export default function ConfigPage() {
  const { permittedStations, isLoading: stationLoading } = useStation()

  const [loading, setLoading] = useState(true)
  const [system, setSystem] = useState<SystemConfig | null>(null)
  const [stationConfigs, setStationConfigs] = useState<Record<string, StationConfig>>({})
  const [openId, setOpenId] = useState<string | null>(null)
  const [baseline, setBaseline] = useState("")
  const [lastSaved, setLastSaved] = useState<string>("—")
  const [saving, setSaving] = useState(false)
  const [theme, setTheme] = useState<"light" | "dark">("light")
  const [toasts, setToasts] = useState<Toast[]>([])

  // station list (sorted by trailing number) — identity comes from StationContext
  const stations: StationMeta[] = useMemo(
    () =>
      [...permittedStations]
        .map((s: any) => ({ id: s.id, name: s.name, province: s.province ?? "", status: s.status ?? "online" }))
        .sort((a, b) => Number(a.id.slice(-2)) - Number(b.id.slice(-2))),
    [permittedStations],
  )

  const pushToast = useCallback((t: Omit<Toast, "id">, ms = 2600) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((ts) => [...ts, { id, ...t }])
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), ms)
  }, [])

  // initial load
  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light")
  }, [])

  useEffect(() => {
    if (stationLoading) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const ids = stations.map((s) => s.id)
      const [sys, stns] = await Promise.all([getSystemConfig(), getStationConfigs(ids)])
      if (cancelled) return
      // guarantee a config object exists for every permitted station
      const filled: Record<string, StationConfig> = {}
      for (const id of ids) filled[id] = stns[id] ?? defaultStation()
      setSystem(sys)
      setStationConfigs(filled)
      setBaseline(configSignature(sys, filled))
      setOpenId(ids[0] ?? null)
      setLastSaved(thaiStamp(new Date()))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [stationLoading, stations])

  const current = useMemo(
    () => (system ? configSignature(system, stationConfigs) : ""),
    [system, stationConfigs],
  )
  const dirty = current !== "" && current !== baseline

  // per-station mutators
  const setConfig = (id: string, patch: Partial<StationConfig>) =>
    setStationConfigs((m) => ({ ...m, [id]: { ...m[id], ...patch } }))
  const setAlert = (id: string, key: AlertKey, patch: Partial<AlertRule>) =>
    setStationConfigs((m) => ({
      ...m,
      [id]: { ...m[id], configured: true, alerts: { ...m[id].alerts, [key]: { ...m[id].alerts[key], ...patch } } },
    }))

  async function handleSave() {
    if (!system) return
    const err = validateSystem(system)
    if (err) { pushToast({ kind: "error", msg: err }, 3200); return }
    setSaving(true)
    try {
      await saveConfig({ system, stations: stationConfigs })
      setBaseline(configSignature(system, stationConfigs))
      setLastSaved(thaiStamp(new Date()))
      pushToast({ kind: "ok", msg: "บันทึกสำเร็จ" })
    } catch {
      pushToast({ kind: "error", msg: "บันทึกไม่สำเร็จ ลองอีกครั้ง" }, 3200)
    } finally {
      setSaving(false)
    }
  }
  function handleCancel() {
    const b = JSON.parse(baseline) as { system: SystemConfig; stations: Record<string, StationConfig> }
    setSystem(b.system)
    setStationConfigs(b.stations)
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark"
    setTheme(next)
    document.documentElement.classList.toggle("dark", next === "dark")
  }

  if (loading || !system) {
    return (
      <div className="mx-auto max-w-[1480px] space-y-5 pb-10">
        <Skeleton className="h-9 w-56" />
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1480px]" style={{ paddingBottom: dirty ? 86 : 24 }}>
      {/* title row */}
      <div className="mb-1.5 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">ตั้งค่าระบบ</h1>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-red-600 to-orange-600 px-2.5 py-1 text-[11.5px] font-extrabold tracking-wide text-white shadow-md">
          <Lock className="h-3 w-3" /> ADMIN
        </span>
        <div className="ml-auto flex items-center gap-2.5">
          <span className="flex items-center gap-1.5 font-mono text-[11.5px] text-muted-foreground">
            <Clock className="h-[13px] w-[13px]" /> {lastSaved}
          </span>
          <button onClick={toggleTheme} aria-label="สลับธีม" className="grid h-9 w-9 place-items-center rounded-lg border bg-secondary text-foreground hover:bg-muted">
            {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>
        </div>
      </div>
      <p className="mb-5 text-[13.5px] text-muted-foreground">
        บันทึกล่าสุด: <span className="font-mono font-semibold text-foreground">{lastSaved}</span>
        {dirty && <span className="font-semibold text-amber-600"> · มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก</span>}
      </p>

      {/* sections */}
      <div className="flex flex-col gap-5">
        <ConversionSection system={system} setSystem={setSystem as any} />
        <ValidRangeSection system={system} setSystem={setSystem as any} />
        <DisplaySection system={system} setSystem={setSystem as any} />
        <StationConfigAccordion
          stations={stations}
          configs={stationConfigs}
          openId={openId}
          setOpenId={setOpenId}
          setConfig={setConfig}
          setAlert={setAlert}
        />
      </div>

      {/* toasts */}
      <div className="pointer-events-none fixed bottom-[92px] left-1/2 z-[90] flex -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13.5px] font-semibold shadow-lg ${
              t.kind === "error"
                ? "border-red-500/30 bg-red-50 text-red-600 dark:bg-red-950/40"
                : "border-green-500/30 bg-green-50 text-green-600 dark:bg-green-950/40"
            }`}
          >
            {t.kind === "error" ? <AlertTriangle className="h-4 w-4" /> : <Check className="h-4 w-4" />} {t.msg}
          </div>
        ))}
      </div>

      {/* sticky unsaved-changes bar */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 shadow-[0_-8px_30px_rgba(15,23,42,0.1)] backdrop-blur transition-transform duration-300"
        style={{ transform: dirty ? "translateY(0)" : "translateY(110%)" }}
      >
        <div className="mx-auto flex max-w-[1480px] items-center gap-3.5 px-[22px] py-3.5">
          <span className="mr-auto inline-flex items-center gap-2.5 text-[13.5px] font-semibold">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shadow-[0_0_0_4px_rgba(217,119,6,0.22)]" />
            มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก
          </span>
          <button
            onClick={handleCancel}
            disabled={saving}
            className="rounded-[9px] border bg-background px-4 py-2 text-[13.5px] font-semibold text-foreground transition hover:bg-secondary disabled:opacity-50"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex min-w-[168px] items-center justify-center gap-2 rounded-[9px] bg-primary px-4 py-2 text-[13.5px] font-semibold text-primary-foreground transition hover:brightness-105 disabled:cursor-not-allowed disabled:bg-secondary disabled:text-muted-foreground"
          >
            {saving ? (
              <><RefreshCw className="h-4 w-4 animate-spin" /> กำลังบันทึก...</>
            ) : (
              <><Save className="h-4 w-4" /> บันทึกการตั้งค่า</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
