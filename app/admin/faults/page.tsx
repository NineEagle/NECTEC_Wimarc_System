"use client"

/**
 * Station hardware fault log (บันทึกอุปกรณ์เสีย) — Admin only
 *
 * A manual register of which physical device failed on which station, and on
 * which occasion. Rows are dated by when they were logged — operators
 * generally cannot say when a part actually failed, only when they found it. wimarc{N} and wimarc{N}c are listed as a single site here:
 * the app splits each mast into a weather half and a soil half, but a
 * technician visits one pole carrying both sets of hardware. There is deliberately no auto-detection: telemetry going
 * quiet tells you the data stopped, not which part broke (a flat battery, a
 * dead SIM and a snapped mast all look identical from the server), so every
 * row here is entered by whoever went and looked.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { useStation } from "@/contexts/StationContext"
import { canAccessAdminPages } from "@/utils/permissions"
import type { FaultDeviceKey, Station, StationFault } from "@/types"
import {
  createFault,
  deleteFault,
  faultDeviceLabel,
  FAULT_DEVICE_GROUP_LABELS,
  FAULT_DEVICES,
  getGroupedDevices,
  getFaults,
  updateFault,
} from "@/services/faultService"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Download, Pencil, PlusCircle, Trash2, Wrench } from "lucide-react"
import { exportFaultsToCSV } from "@/services/exportService"
import { useToast } from "@/hooks/use-toast"

const TH_MON = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]

/** Explicit month names — toLocaleDateString('th-TH') malforms in this Node image. */
function formatThaiDate(date: Date): string {
  return `${date.getDate()} ${TH_MON[date.getMonth()]} ${date.getFullYear() + 543}`
}

/** Numeric, so wimarc10 sorts after wimarc2 rather than before it. */
const wimarcNum = (id: string) => {
  const m = id.match(/^wimarc(\d+)/i)
  return m ? parseInt(m[1], 10) : 9999
}

const ALL = "__all__"

interface FormState {
  id: string | null
  stationId: string
  device: FaultDeviceKey | ""
  deviceOther: string
  symptom: string
  note: string
}

const emptyForm: FormState = {
  id: null,
  stationId: "",
  device: "",
  deviceOther: "",
  symptom: "",
  note: "",
}

export default function FaultsPage() {
  const { user } = useAuth()
  const { allStations } = useStation()
  const router = useRouter()
  const { toast } = useToast()

  const [faults, setFaults] = useState<StationFault[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const [filterStation, setFilterStation] = useState<string>(ALL)
  const [filterDevice, setFilterDevice] = useState<string>(ALL)

  const [form, setForm] = useState<FormState>(emptyForm)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<StationFault | null>(null)

  // Drop the "c" (soil client) half — its faults are logged against the base
  // station so each site has one continuous history per device.
  const stations = useMemo(
    () =>
      allStations
        .filter((s) => !/^wimarc\d+c$/i.test(s.id))
        .sort((a, b) => wimarcNum(a.id) - wimarcNum(b.id)),
    [allStations],
  )
  const stationById = useMemo(() => {
    const map = new Map<string, Station>()
    stations.forEach((s) => map.set(s.id, s))
    return map
  }, [stations])

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getFaults({
        stationId: filterStation === ALL ? undefined : filterStation,
        device: filterDevice === ALL ? undefined : (filterDevice as FaultDeviceKey),
      })
      setFaults(data)
      setLoadError(false)
    } catch {
      setFaults([])
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [filterStation, filterDevice])

  useEffect(() => {
    if (!canAccessAdminPages(user)) {
      router.push("/dashboard")
      return
    }
    load()
  }, [user, router, load])

  const deviceGroups = useMemo(() => getGroupedDevices(), [])

  // Read off the rows currently shown, so the numbers always match the table
  // under the active filters rather than describing some other set.
  const summary = useMemo(() => {
    const repeats = faults.filter((f) => f.occurrenceNo > 1).length
    const worst = new Map<string, number>()
    faults.forEach((f) => {
      const label = faultDeviceLabel(f)
      worst.set(label, (worst.get(label) ?? 0) + 1)
    })
    const top = [...worst.entries()].sort((a, b) => b[1] - a[1])[0]
    return {
      total: faults.length,
      stations: new Set(faults.map((f) => f.stationId)).size,
      repeats,
      topDevice: top ? `${top[0]} (${top[1]} ครั้ง)` : "—",
    }
  }, [faults])

  const handleExport = () => {
    if (faults.length === 0) return
    const names = new Map(stations.map((st) => [st.id, st.name]))
    exportFaultsToCSV(faults, names)
  }

  const openCreate = () => {
    setForm({ ...emptyForm, stationId: stations[0]?.id ?? "" })
    setIsFormOpen(true)
  }

  const openEdit = (fault: StationFault) => {
    setForm({
      id: fault.id,
      stationId: fault.stationId,
      device: fault.device,
      deviceOther: fault.deviceOther ?? "",
      symptom: fault.symptom,
      note: fault.note ?? "",
    })
    setIsFormOpen(true)
  }

  const canSave =
    form.stationId &&
    form.device &&
    form.symptom.trim() &&
    (form.device !== "other" || form.deviceOther.trim())

  const handleSave = async () => {
    if (!canSave) return
    setIsSaving(true)
    try {
      const input = {
        stationId: form.stationId,
        device: form.device as FaultDeviceKey,
        deviceOther: form.device === "other" ? form.deviceOther.trim() : null,
        symptom: form.symptom.trim(),
        note: form.note.trim() || null,
      }
      if (form.id) {
        await updateFault(form.id, input)
        toast({ title: "แก้ไขรายการแล้ว" })
      } else {
        await createFault(input)
        toast({ title: "บันทึกรายการแล้ว" })
      }
      setIsFormOpen(false)
      setForm(emptyForm)
      await load()
    } catch {
      toast({ title: "บันทึกไม่สำเร็จ", description: "กรุณาลองใหม่อีกครั้ง", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteFault(pendingDelete.id)
      toast({ title: "ลบรายการแล้ว" })
      await load()
    } catch {
      toast({ title: "ลบไม่สำเร็จ", variant: "destructive" })
    } finally {
      setPendingDelete(null)
    }
  }

  if (!canAccessAdminPages(user)) return null

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Wrench className="h-5 w-5" /> บันทึกอุปกรณ์เสีย
          </h1>
          <p className="text-xs text-muted-foreground">
            บันทึกด้วยตนเองว่าสถานีไหน อุปกรณ์ตัวใดเสีย ครั้งที่เท่าไร — ระบบไม่ตรวจจับให้อัตโนมัติ
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport} disabled={faults.length === 0}>
            <Download className="h-4 w-4 mr-2" /> ดาวน์โหลด CSV
          </Button>
          <Button onClick={openCreate} disabled={stations.length === 0}>
            <PlusCircle className="h-4 w-4 mr-2" /> เพิ่มรายการ
          </Button>
        </div>
      </div>

      {/* Four numbers that answer "is anything worth worrying about" without
          reading the table: how much, how spread out, how much is recurring,
          and which part is the repeat offender. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "รายการทั้งหมด", value: String(summary.total) },
          { label: "สถานีที่มีปัญหา", value: `${summary.stations} สถานี` },
          { label: "เสียซ้ำ (ครั้งที่ 2 ขึ้นไป)", value: String(summary.repeats), warn: summary.repeats > 0 },
          { label: "อุปกรณ์ที่เสียบ่อยที่สุด", value: summary.topDevice },
        ].map((card) => (
          <Card key={card.label}>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">{card.label}</div>
              <div className={`text-lg font-bold mt-1 ${card.warn ? "text-destructive" : ""}`}>
                {card.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">ตัวกรอง</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">สถานี</Label>
            <Select value={filterStation} onValueChange={setFilterStation}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>ทุกสถานี</SelectItem>
                {stations.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.id} — {s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">อุปกรณ์</Label>
            <Select value={filterDevice} onValueChange={setFilterDevice}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>ทุกอุปกรณ์</SelectItem>
                {FAULT_DEVICES.map((d) => (
                  <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : loadError ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              โหลดข้อมูลไม่สำเร็จ
              <div className="mt-3"><Button variant="outline" size="sm" onClick={load}>ลองใหม่</Button></div>
            </div>
          ) : faults.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">ยังไม่มีรายการ</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left p-3">สถานี</th>
                  <th className="text-left p-3">อุปกรณ์</th>
                  <th className="text-left p-3 whitespace-nowrap">ครั้งที่</th>
                  <th className="text-left p-3">อาการ</th>
                  <th className="text-left p-3 whitespace-nowrap">วันที่บันทึก</th>
                  <th className="text-left p-3">ผู้บันทึก</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {faults.map((f) => (
                  <tr key={f.id} className="border-t align-top">
                    <td className="p-3 whitespace-nowrap">
                      <div className="font-medium">{f.stationId}</div>
                      <div className="text-xs text-muted-foreground">
                        {stationById.get(f.stationId)?.name ?? ""}
                      </div>
                    </td>
                    <td className="p-3">{faultDeviceLabel(f)}</td>
                    <td className="p-3">
                      {/* A repeat is the signal worth spotting, so it is the one
                          thing on the row that changes colour. */}
                      <Badge variant={f.occurrenceNo > 1 ? "destructive" : "secondary"}>
                        ครั้งที่ {f.occurrenceNo}
                      </Badge>
                    </td>
                    <td className="p-3 max-w-md">
                      <div>{f.symptom}</div>
                      {f.note && <div className="text-xs text-muted-foreground mt-1">{f.note}</div>}
                    </td>
                    <td className="p-3 whitespace-nowrap">{formatThaiDate(f.createdAt)}</td>
                    <td className="p-3 whitespace-nowrap text-xs">{f.createdByName}</td>
                    <td className="p-3 whitespace-nowrap text-right">
                      <Button variant="ghost" size="icon" aria-label="แก้ไข" onClick={() => openEdit(f)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="ลบ" onClick={() => setPendingDelete(f)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "แก้ไขรายการ" : "เพิ่มรายการอุปกรณ์เสีย"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">สถานี</Label>
              <Select
                value={form.stationId}
                onValueChange={(v) => setForm((f) => ({ ...f, stationId: v }))}
              >
                <SelectTrigger><SelectValue placeholder="เลือกสถานี" /></SelectTrigger>
                <SelectContent>
                  {stations.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.id} — {s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">อุปกรณ์</Label>
              <Select
                value={form.device}
                onValueChange={(v) => setForm((f) => ({ ...f, device: v as FaultDeviceKey }))}
              >
                <SelectTrigger><SelectValue placeholder="เลือกอุปกรณ์" /></SelectTrigger>
                <SelectContent>
                  {deviceGroups.map(({ group, devices }) => (
                    <SelectGroup key={group}>
                      <SelectLabel>{FAULT_DEVICE_GROUP_LABELS[group]}</SelectLabel>
                      {devices.map((d) => (
                        <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.device === "other" && (
              <div className="space-y-1">
                <Label className="text-xs">ระบุอุปกรณ์</Label>
                <Input
                  value={form.deviceOther}
                  onChange={(e) => setForm((f) => ({ ...f, deviceOther: e.target.value }))}
                  placeholder="เช่น สายไฟ, ตู้คอนโทรล"
                />
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">อาการ</Label>
              <Textarea
                rows={2}
                value={form.symptom}
                onChange={(e) => setForm((f) => ({ ...f, symptom: e.target.value }))}
                placeholder="เช่น ค่าไม่ขึ้นเลย 3 วัน"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">หมายเหตุ <span className="text-muted-foreground">(ไม่บังคับ)</span></Label>
              <Textarea
                rows={2}
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>ยกเลิก</Button>
            <Button onClick={handleSave} disabled={!canSave || isSaving}>
              {isSaving ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบรายการนี้?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && (
                <>
                  {pendingDelete.stationId} — {faultDeviceLabel(pendingDelete)} (ครั้งที่ {pendingDelete.occurrenceNo})
                  <br />
                  ลบแล้วเลข &quot;ครั้งที่&quot; ของรายการที่เหลือจะเรียงใหม่ให้อัตโนมัติ
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>ลบ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
