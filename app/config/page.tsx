"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Lock, Clock, Save, RefreshCw, Check, AlertTriangle } from "lucide-react"
import { useStation } from "@/contexts/StationContext"
import { useAuth } from "@/contexts/AuthContext"
import { canAccessAdminPages } from "@/utils/permissions"
import { Skeleton } from "@/components/ui/skeleton"
import { getSystemConfig, getStationConfigs, saveConfig } from "@/services/configService"
import { invalidateConfigCache } from "@/services/systemConfigCache"
import { clearApiCache } from "@/services/apiClient"
import type { SystemConfig, StationConfig, StationMeta, AlertKey, AlertRule } from "@/components/config/configTypes"
import { defaultStation, validateSystem, configSignature, thaiStamp } from "@/components/config/configUtils"
import { UnitSection } from "@/components/config/UnitSection"
import { ValidRangeSection } from "@/components/config/ValidRangeSection"
import { VpdGlobalSection } from "@/components/config/VpdGlobalSection"
import { GlobalAlertSection } from "@/components/config/GlobalAlertSection"
import { StationConfigAccordion } from "@/components/config/StationConfigAccordion"

type Toast = { id: string; kind: "ok" | "error"; msg: string }

export default function ConfigPage() {
  const { permittedStations, isLoading: stationLoading } = useStation()
  const { user } = useAuth()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [system, setSystem] = useState<SystemConfig | null>(null)
  const [stationConfigs, setStationConfigs] = useState<Record<string, StationConfig>>({})
  const [openId, setOpenId] = useState<string | null>(null)
  const [baseline, setBaseline] = useState("")
  const [lastSaved, setLastSaved] = useState<string>("—")
  const [saving, setSaving] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])

  // Admin guard
  useEffect(() => {
    if (!user) return
    if (!canAccessAdminPages(user)) router.push("/dashboard")
  }, [user])

  const stations: StationMeta[] = useMemo(
    () =>
      [...permittedStations]
        .filter((s: any) => !s.id.endsWith("c"))
        .map((s: any) => ({ id: s.id, name: s.name, province: s.province ?? "", status: s.status ?? "online" }))
        .sort((a, b) => (parseInt(a.id.replace(/\D/g, "")) || 0) - (parseInt(b.id.replace(/\D/g, "")) || 0)),
    [permittedStations],
  )

  const pushToast = useCallback((t: Omit<Toast, "id">, ms = 2600) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(ts => [...ts, { id, ...t }])
    setTimeout(() => setToasts(ts => ts.filter(x => x.id !== id)), ms)
  }, [])

  useEffect(() => {
    if (stationLoading || !user || !canAccessAdminPages(user)) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const ids = stations.map(s => s.id)
      const [sys, stns] = await Promise.all([getSystemConfig(), getStationConfigs(ids)])
      if (cancelled) return
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
  }, [stationLoading, stations, user])

  const current = useMemo(
    () => (system ? configSignature(system, stationConfigs) : ""),
    [system, stationConfigs],
  )
  const dirty = current !== "" && current !== baseline

  const setConfig = (id: string, patch: Partial<StationConfig>) =>
    setStationConfigs(m => ({ ...m, [id]: { ...m[id], ...patch } }))
  const setAlert = (id: string, key: AlertKey, patch: Partial<AlertRule>) =>
    setStationConfigs(m => ({
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
      // Flush both cache layers so every page sees the new config immediately.
      invalidateConfigCache()
      clearApiCache("/config")
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

  if (stationLoading || !user) {
    return (
      <div className="mx-auto max-w-[1480px] space-y-5 pb-10">
        <Skeleton className="h-9 w-56" />
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
      </div>
    )
  }

  if (!canAccessAdminPages(user)) return null

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
      {/* Header */}
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold tracking-tight">ตั้งค่าระบบ</h1>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-red-600 to-orange-600 px-2.5 py-1 text-[11px] font-bold tracking-wide text-white">
          <Lock className="h-3 w-3" /> ADMIN
        </span>
        <div className="ml-auto flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" /> {lastSaved}
        </div>
      </div>
      {dirty && (
        <p className="mb-4 text-[12px] font-semibold text-amber-600">มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก</p>
      )}
      {!dirty && <div className="mb-4" />}

      {/* Sections */}
      <div className="flex flex-col gap-5">
        <UnitSection system={system} setSystem={setSystem as any} />
        <ValidRangeSection system={system} setSystem={setSystem as any} />
        <VpdGlobalSection system={system} setSystem={setSystem as any} />
        <GlobalAlertSection system={system} setSystem={setSystem as any} />
        <StationConfigAccordion
          stations={stations}
          configs={stationConfigs}
          openId={openId}
          setOpenId={setOpenId}
          setAlert={setAlert}
          enabled={system.perStationAlertsEnabled ?? false}
          setEnabled={(v) => setSystem(s => s ? { ...s, perStationAlertsEnabled: v } : s)}
        />
      </div>

      {/* Toasts */}
      <div className="pointer-events-none fixed bottom-[92px] left-1/2 z-[90] flex -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map(t => (
          <div key={t.id} className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-semibold shadow-lg ${
            t.kind === "error"
              ? "border-red-500/30 bg-red-50 text-red-600 dark:bg-red-950/40"
              : "border-green-500/30 bg-green-50 text-green-600 dark:bg-green-950/40"
          }`}>
            {t.kind === "error" ? <AlertTriangle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {t.msg}
          </div>
        ))}
      </div>

      {/* Sticky save bar */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 shadow-[0_-8px_30px_rgba(15,23,42,0.1)] backdrop-blur transition-transform duration-300"
        style={{ transform: dirty ? "translateY(0)" : "translateY(110%)" }}
      >
        <div className="mx-auto flex max-w-[1480px] items-center gap-2.5 px-4 py-3 sm:gap-3.5 sm:px-5 sm:py-3.5">
          <span className="mr-auto inline-flex items-center gap-2 text-[12px] font-semibold sm:text-[13px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500 shadow-[0_0_0_4px_rgba(217,119,6,0.22)]" />
            <span className="hidden sm:inline">มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก</span>
            <span className="sm:hidden">ยังไม่ได้บันทึก</span>
          </span>
          <button onClick={handleCancel} disabled={saving}
            className="rounded-lg border bg-background px-3 py-2 text-[12px] font-semibold transition hover:bg-secondary disabled:opacity-50 sm:px-4 sm:text-[13px]">
            ยกเลิก
          </button>
          <button onClick={handleSave} disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-[160px] sm:text-[13px]">
            {saving
              ? <><RefreshCw className="h-4 w-4 animate-spin" /> <span className="hidden sm:inline">กำลังบันทึก...</span></>
              : <><Save className="h-4 w-4" /> บันทึก</>}
          </button>
        </div>
      </div>
    </div>
  )
}
