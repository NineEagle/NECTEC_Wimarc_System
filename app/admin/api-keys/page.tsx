"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"
import { canAccessAdminPages } from "@/utils/permissions"
import {
  listApiKeys,
  createApiKey,
  updateApiKey,
  deleteApiKey,
  listApiKeyRequests,
  approveApiKeyRequest,
  rejectApiKeyRequest,
  deleteApiKeyRequest,
  getApiKeyUsageLogs,
  getPortalSettings,
  setPortalEnabled as savePortalEnabled,
  type ApiKey,
  type ApiKeyCreate,
  type ApiKeyRequestItem,
  type UsageLog,
  type DataScope,
} from "@/services/apiKeyService"
import { getAllStations } from "@/services/stationsService"
import type { Station } from "@/types"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
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
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  Power,
  PowerOff,
  Pencil,
  Globe,
  MapPin,
  Clock,
  Infinity,
  UserCheck,
  UserX,
  Mail,
  Building2,
  FileText,
  Activity,
  Thermometer,
  CloudSun,
} from "lucide-react"
import { formatThaiDate } from "@/utils/dateUtils"

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function isExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false
  return new Date(expiresAt) < new Date()
}

function expiryLabel(expiresAt: string | null | undefined): string {
  if (!expiresAt) return "ไม่หมดอายุ"
  if (isExpired(expiresAt)) return `หมดอายุ ${formatThaiDate(expiresAt)}`
  return `หมดอายุ ${formatThaiDate(expiresAt)}`
}

/** Convert a local date string (YYYY-MM-DD) to end-of-day UTC ISO string */
function localDateToEndOfDayISO(dateStr: string): string {
  const d = new Date(`${dateStr}T23:59:59`)
  return d.toISOString()
}

/** Convert an ISO datetime string back to a YYYY-MM-DD local date string for <input type="date"> */
function isoToLocalDate(iso: string | null | undefined): string {
  if (!iso) return ""
  return iso.slice(0, 10)
}

// ────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────

function KeyRevealDialog({ apiKey, onClose }: { apiKey: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-green-500" />
            API Key สร้างสำเร็จ
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            คัดลอก API Key นี้ไว้ก่อน — <strong>จะไม่สามารถดูได้อีกครั้ง</strong>
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 block rounded-lg bg-muted px-3 py-2 text-sm font-mono break-all select-all">
              {apiKey}
            </code>
            <Button size="icon" variant="outline" onClick={handleCopy} className="shrink-0">
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            ใช้ใน HTTP header:{" "}
            <code className="bg-muted px-1 py-0.5 rounded">X-Api-Key: {"<key>"}</code>
          </p>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>เข้าใจแล้ว ปิดหน้าต่าง</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const EXPIRY_PRESETS = [
  { label: "1 เดือน",  months: 1 },
  { label: "3 เดือน",  months: 3 },
  { label: "6 เดือน",  months: 6 },
  { label: "1 ปี",     months: 12 },
]

function addMonths(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

function ExpiryField({
  value,
  onChange,
}: {
  value: string       // "" = never, or YYYY-MM-DD
  onChange: (v: string) => void
}) {
  const hasExpiry = value !== ""
  const today = new Date().toISOString().slice(0, 10)
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5" />
        วันหมดอายุ
      </Label>

      {/* Never / custom toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange("")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors
            ${!hasExpiry
              ? "bg-primary text-primary-foreground border-primary"
              : "hover:bg-muted/50"}`}
        >
          <Infinity className="w-3.5 h-3.5" />
          ไม่หมดอายุ
        </button>
        <button
          type="button"
          onClick={() => { if (!hasExpiry) onChange(addMonths(1)) }}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors
            ${hasExpiry
              ? "bg-primary text-primary-foreground border-primary"
              : "hover:bg-muted/50"}`}
        >
          <Clock className="w-3.5 h-3.5" />
          กำหนดวัน
        </button>
      </div>

      {/* Presets + custom date picker */}
      {hasExpiry && (
        <div className="rounded-lg border p-3 space-y-3">
          <div className="grid grid-cols-4 gap-1.5">
            {EXPIRY_PRESETS.map(p => {
              const target = addMonths(p.months)
              const active = value === target
              return (
                <button
                  key={p.months}
                  type="button"
                  onClick={() => onChange(target)}
                  className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors
                    ${active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:bg-muted/60"}`}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">หรือเลือกวันเอง</p>
            <Input
              type="date"
              min={today}
              value={value}
              onChange={e => onChange(e.target.value)}
              className="w-full"
            />
          </div>
        </div>
      )}
    </div>
  )
}

function DataScopeField({
  value,
  onChange,
}: {
  value: DataScope[]
  onChange: (v: DataScope[]) => void
}) {
  const toggle = (scope: DataScope) => {
    if (value.includes(scope)) {
      if (value.length === 1) return  // must keep at least one
      onChange(value.filter(s => s !== scope))
    } else {
      onChange([...value, scope])
    }
  }
  return (
    <div className="space-y-2">
      <Label>ประเภทข้อมูล</Label>
      <div
        className="flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer hover:bg-muted/50"
        onClick={() => toggle("sensor")}
      >
        <Checkbox checked={value.includes("sensor")} onCheckedChange={() => toggle("sensor")} />
        <Thermometer className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm">ข้อมูล Sensor (ค่าตรวจวัดจริง)</span>
      </div>
      <div
        className="flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer hover:bg-muted/50"
        onClick={() => toggle("forecast")}
      >
        <Checkbox checked={value.includes("forecast")} onCheckedChange={() => toggle("forecast")} />
        <CloudSun className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm">พยากรณ์อากาศล่วงหน้า</span>
      </div>
    </div>
  )
}

function StationScopeField({
  stations,
  allStations,
  selectedStations,
  onAllChange,
  onToggle,
}: {
  stations: Station[]
  allStations: boolean
  selectedStations: string[]
  onAllChange: (v: boolean) => void
  onToggle: (id: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label>สิทธิ์การเข้าถึงสถานี</Label>
      <div
        className="flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer hover:bg-muted/50"
        onClick={() => onAllChange(true)}
      >
        <Checkbox checked={allStations} onCheckedChange={() => onAllChange(true)} />
        <Globe className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm">ทุกสถานี</span>
      </div>
      <div
        className="flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer hover:bg-muted/50"
        onClick={() => onAllChange(false)}
      >
        <Checkbox checked={!allStations} onCheckedChange={() => onAllChange(false)} />
        <MapPin className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm">เลือกเฉพาะสถานี</span>
      </div>
      {!allStations && (
        <div className="rounded-lg border p-3 space-y-1.5 max-h-48 overflow-y-auto">
          {stations.map(s => (
            <div
              key={s.id}
              className="flex items-center gap-2 cursor-pointer hover:bg-muted/40 rounded px-1 py-0.5"
              onClick={() => onToggle(s.id)}
            >
              <Checkbox
                checked={selectedStations.includes(s.id)}
                onCheckedChange={() => onToggle(s.id)}
              />
              <span className="text-sm">{s.name}</span>
              <span className="text-xs text-muted-foreground ml-auto">{s.id}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CreateKeyDialog({
  stations,
  onCreated,
  onClose,
}: {
  stations: Station[]
  onCreated: (key: string) => void
  onClose: () => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [allStations, setAllStations] = useState(true)
  const [selectedStations, setSelectedStations] = useState<string[]>([])
  const [dataScope, setDataScope] = useState<DataScope[]>(["sensor", "forecast"])
  const [expiryDate, setExpiryDate] = useState("")   // "" = never
  const [isSubmitting, setIsSubmitting] = useState(false)

  const toggleStation = (id: string) =>
    setSelectedStations(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({ variant: "destructive", title: "กรุณาใส่ชื่อ API Key" })
      return
    }
    if (!allStations && selectedStations.length === 0) {
      toast({ variant: "destructive", title: "เลือกสถานีอย่างน้อย 1 สถานี" })
      return
    }
    setIsSubmitting(true)
    try {
      const payload: ApiKeyCreate = {
        name: name.trim(),
        description: description.trim() || undefined,
        allowedStations: allStations ? null : selectedStations,
        dataScope,
        expiresAt: expiryDate ? localDateToEndOfDayISO(expiryDate) : null,
      }
      const result = await createApiKey(payload)
      onCreated(result.key)
    } catch {
      toast({ variant: "destructive", title: "สร้าง API Key ไม่สำเร็จ" })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>สร้าง API Key ใหม่</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>ชื่อ Key *</Label>
            <Input
              placeholder="เช่น Durian Grow App"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>คำอธิบาย (ไม่บังคับ)</Label>
            <Textarea
              placeholder="อธิบายว่า Key นี้ใช้งานอะไร"
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <DataScopeField value={dataScope} onChange={setDataScope} />
          <ExpiryField value={expiryDate} onChange={setExpiryDate} />
          <StationScopeField
            stations={stations}
            allStations={allStations}
            selectedStations={selectedStations}
            onAllChange={setAllStations}
            onToggle={toggleStation}
          />
        </div>
        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>ยกเลิก</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "กำลังสร้าง..." : "สร้าง Key"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditKeyDialog({
  apiKey,
  stations,
  onUpdated,
  onClose,
}: {
  apiKey: ApiKey
  stations: Station[]
  onUpdated: () => void
  onClose: () => void
}) {
  const { toast } = useToast()
  const [name, setName] = useState(apiKey.name)
  const [description, setDescription] = useState(apiKey.description ?? "")
  const [allStations, setAllStations] = useState(apiKey.allowedStations === null)
  const [selectedStations, setSelectedStations] = useState<string[]>(apiKey.allowedStations ?? [])
  const [dataScope, setDataScope] = useState<DataScope[]>(apiKey.dataScope ?? ["sensor", "forecast"])
  const [expiryDate, setExpiryDate] = useState(isoToLocalDate(apiKey.expiresAt))
  const [isSubmitting, setIsSubmitting] = useState(false)

  const toggleStation = (id: string) =>
    setSelectedStations(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({ variant: "destructive", title: "กรุณาใส่ชื่อ API Key" })
      return
    }
    setIsSubmitting(true)
    try {
      await updateApiKey(apiKey.id, {
        name: name.trim(),
        description: description.trim() || null,
        allowedStations: allStations ? null : selectedStations,
        dataScope,
        expiresAt: expiryDate ? localDateToEndOfDayISO(expiryDate) : null,
      })
      toast({ title: "บันทึกสำเร็จ" })
      onUpdated()
      onClose()
    } catch {
      toast({ variant: "destructive", title: "บันทึกไม่สำเร็จ" })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>แก้ไข API Key</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>ชื่อ Key *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>คำอธิบาย</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <DataScopeField value={dataScope} onChange={setDataScope} />
          <ExpiryField value={expiryDate} onChange={setExpiryDate} />
          <StationScopeField
            stations={stations}
            allStations={allStations}
            selectedStations={selectedStations}
            onAllChange={setAllStations}
            onToggle={toggleStation}
          />
        </div>
        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>ยกเลิก</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ────────────────────────────────────────────────────────────
// Requests tab
// ────────────────────────────────────────────────────────────

function RequestsTab({
  requests,
  isLoading,
  onApproved,
  onRejected,
  onDeleted,
}: {
  requests: ApiKeyRequestItem[]
  isLoading: boolean
  onApproved: (key: string) => void
  onRejected: () => void
  onDeleted: () => void
}) {
  const { toast } = useToast()
  const [rejectTarget, setRejectTarget] = useState<ApiKeyRequestItem | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<ApiKeyRequestItem | null>(null)
  const [processing, setProcessing] = useState<string | null>(null)

  const handleApprove = async (r: ApiKeyRequestItem) => {
    setProcessing(r.id)
    try {
      const result = await approveApiKeyRequest(r.id)
      toast({ title: `อนุมัติแล้ว — ${r.name}` })
      onApproved(result.key)
    } catch {
      toast({ variant: "destructive", title: "อนุมัติไม่สำเร็จ" })
    } finally {
      setProcessing(null)
    }
  }

  const handleReject = async () => {
    if (!rejectTarget) return
    setProcessing(rejectTarget.id)
    try {
      await rejectApiKeyRequest(rejectTarget.id, rejectReason)
      toast({ title: `ปฏิเสธแล้ว — ${rejectTarget.name}` })
      setRejectTarget(null)
      setRejectReason("")
      onRejected()
    } catch {
      toast({ variant: "destructive", title: "ดำเนินการไม่สำเร็จ" })
    } finally {
      setProcessing(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setProcessing(deleteTarget.id)
    try {
      await deleteApiKeyRequest(deleteTarget.id)
      toast({ title: `ลบคำขอแล้ว — ${deleteTarget.name}` })
      setDeleteTarget(null)
      onDeleted()
    } catch {
      toast({ variant: "destructive", title: "ลบไม่สำเร็จ" })
    } finally {
      setProcessing(null)
    }
  }

  const statusBadge = (s: ApiKeyRequestItem["status"]) => {
    if (s === "pending")  return <Badge variant="secondary">รออนุมัติ</Badge>
    if (s === "approved") return <Badge variant="default">อนุมัติแล้ว</Badge>
    return <Badge variant="destructive">ปฏิเสธ</Badge>
  }

  if (isLoading) return <div className="space-y-3">{Array.from({length:2}).map((_,i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>

  if (requests.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
      <FileText className="w-10 h-10 opacity-30" />
      <p>ยังไม่มีคำขอ</p>
    </div>
  )

  return (
    <>
      <div className="space-y-3">
        {requests.map(r => (
          <Card key={r.id}>
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{r.name}</span>
                    {statusBadge(r.status)}
                  </div>
                  <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{r.email}</span>
                    {r.organization && <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{r.organization}</span>}
                    <span>ส่งเมื่อ: {formatThaiDate(r.createdAt)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{r.purpose}</p>
                  {r.rejectReason && (
                    <p className="text-xs text-destructive">เหตุผล: {r.rejectReason}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  {r.status === "pending" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                        disabled={processing === r.id}
                        onClick={() => handleApprove(r)}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        อนุมัติ
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-destructive border-destructive/20 hover:bg-destructive/5"
                        disabled={processing === r.id}
                        onClick={() => { setRejectTarget(r); setRejectReason("") }}
                      >
                        <UserX className="w-3.5 h-3.5" />
                        ปฏิเสธ
                      </Button>
                    </>
                  )}
                  {/* Available on every status — removes the request row only, never the key */}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    title="ลบคำขอนี้"
                    disabled={processing === r.id}
                    onClick={() => setDeleteTarget(r)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {rejectTarget && (
        <AlertDialog open onOpenChange={() => setRejectTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>ปฏิเสธคำขอของ {rejectTarget.name}?</AlertDialogTitle>
              <AlertDialogDescription>ระบุเหตุผล (ไม่บังคับ)</AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              placeholder="เช่น ข้อมูลไม่ครบถ้วน, ไม่ตรงวัตถุประสงค์"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
            />
            <AlertDialogFooter>
              <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleReject}
              >
                ยืนยันปฏิเสธ
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {deleteTarget && (
        <AlertDialog open onOpenChange={() => setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>ลบคำขอของ {deleteTarget.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                ลบเฉพาะรายการคำขอออกจากหน้านี้
                {deleteTarget.status === "approved"
                  ? " — API key ที่ออกให้ไปแล้วยังใช้งานได้ตามปกติ ไม่ถูกลบไปด้วย"
                  : " — ไม่กระทบข้อมูลอื่นใด"}
                {" "}ผู้ขอสามารถส่งคำขอใหม่เข้ามาได้
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDelete}
              >
                ยืนยันลบ
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  )
}

// ────────────────────────────────────────────────────────────
// Usage logs dialog (admin)
// ────────────────────────────────────────────────────────────

function UsageLogsDialog({ keyId, keyName, onClose }: { keyId: string; keyName: string; onClose: () => void }) {
  const [logs, setLogs] = useState<UsageLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getApiKeyUsageLogs(keyId).then(l => { setLogs(l); setLoading(false) }).catch(() => setLoading(false))
  }, [keyId])

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Usage Logs — {keyName}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">ยังไม่มี usage logs</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium text-muted-foreground">เวลา</th>
                  <th className="text-left py-2 font-medium text-muted-foreground">Method</th>
                  <th className="text-left py-2 font-medium text-muted-foreground">Path</th>
                  <th className="text-left py-2 font-medium text-muted-foreground">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-1.5 pr-3 text-muted-foreground whitespace-nowrap">{formatThaiDate(l.timestamp)}</td>
                    <td className="py-1.5 pr-2"><Badge variant="outline" className="text-[10px] px-1">{l.method}</Badge></td>
                    <td className="py-1.5 font-mono">{l.path}</td>
                    <td className="py-1.5 text-muted-foreground">{l.ipAddress ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>ปิด</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ────────────────────────────────────────────────────────────
// Main page
// ────────────────────────────────────────────────────────────

export default function ApiKeysPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const [tab, setTab] = useState<"keys" | "requests">("keys")
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [requests, setRequests] = useState<ApiKeyRequestItem[]>([])
  const [stations, setStations] = useState<Station[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [portalEnabled, setPortalEnabled] = useState(true)
  const [togglingPortal, setTogglingPortal] = useState(false)

  const [showCreate, setShowCreate] = useState(false)
  const [revealKey, setRevealKey] = useState<string | null>(null)
  const [editKey, setEditKey] = useState<ApiKey | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ApiKey | null>(null)
  const [usageKey, setUsageKey] = useState<ApiKey | null>(null)

  const load = useCallback(async () => {
    try {
      const [k, r, s, ps] = await Promise.all([listApiKeys(), listApiKeyRequests(), getAllStations(), getPortalSettings()])
      setKeys(k)
      setRequests(r)
      setStations(s)
      setPortalEnabled(ps.enabled)
      setLoadError(false)
    } catch {
      // Never leave the page stuck on the skeleton — show a retryable error instead.
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!canAccessAdminPages(user)) { router.push("/dashboard"); return }
    load()
  }, [user, router, load])

  const handleToggleActive = async (k: ApiKey) => {
    try {
      await updateApiKey(k.id, { isActive: !k.isActive })
      toast({ title: k.isActive ? "ปิดใช้งาน Key แล้ว" : "เปิดใช้งาน Key แล้ว" })
      load()
    } catch {
      toast({ variant: "destructive", title: "ดำเนินการไม่สำเร็จ" })
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteApiKey(deleteTarget.id)
      toast({ title: "ลบ Key สำเร็จ" })
      setDeleteTarget(null)
      load()
    } catch {
      toast({ variant: "destructive", title: "ลบไม่สำเร็จ" })
    }
  }

  const handleCreated = (key: string) => {
    setShowCreate(false)
    setRevealKey(key)
    load()
  }

  const pendingCount = requests.filter(r => r.status === "pending").length

  const handleTogglePortal = async () => {
    setTogglingPortal(true)
    try {
      const result = await savePortalEnabled(!portalEnabled)
      setPortalEnabled(result.enabled)
      toast({ title: result.enabled ? "เปิด Self-service Portal แล้ว" : "ปิด Self-service Portal แล้ว" })
    } catch {
      toast({ variant: "destructive", title: "ดำเนินการไม่สำเร็จ" })
    } finally {
      setTogglingPortal(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Key className="w-5 h-5" />
            จัดการ API Keys
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            สร้างและจัดการ Key สำหรับแอปพลิเคชันภายนอก
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Portal on/off toggle */}
          <div className="flex items-center gap-2 rounded-lg border px-3 py-2 bg-muted/30">
            <span className="text-xs text-muted-foreground hidden sm:inline">Self-service Portal</span>
            <button
              onClick={handleTogglePortal}
              disabled={togglingPortal || isLoading || loadError}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none disabled:opacity-50 ${
                portalEnabled ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${
                  portalEnabled ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
            <span className={`text-xs font-medium ${portalEnabled ? "text-primary" : "text-muted-foreground"}`}>
              {portalEnabled ? "เปิด" : "ปิด"}
            </span>
          </div>
          {tab === "keys" && (
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              สร้าง Key ใหม่
            </Button>
          )}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setTab("keys")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === "keys"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Keys ({keys.length})
        </button>
        <button
          onClick={() => setTab("requests")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${
            tab === "requests"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          คำขอ
          {pendingCount > 0 && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
              {pendingCount}
            </Badge>
          )}
        </button>
      </div>

      {/* Only take over the page when there is nothing to show. load() also re-runs
          after approve/reject/create/delete, and a failed refresh must not blank a
          list that is already on screen — the mutation itself already succeeded. */}
      {loadError && keys.length === 0 && requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <p className="text-sm font-medium text-destructive">โหลดข้อมูลไม่สำเร็จ</p>
          <p className="text-xs text-muted-foreground">เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่อีกครั้ง</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-1"
            onClick={() => { setLoadError(false); setIsLoading(true); load() }}
          >
            ลองใหม่
          </Button>
        </div>
      ) : tab === "requests" ? (
        <RequestsTab
          requests={requests}
          isLoading={isLoading}
          onApproved={(key) => { setRevealKey(key); load() }}
          onRejected={load}
          onDeleted={load}
        />
      ) : (
        <>
          {/* Endpoint reference */}
          <Card className="border-dashed">
            <CardContent className="pt-4 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Endpoints ที่รองรับ X-Api-Key</p>
              <div className="space-y-1 font-mono text-xs">
                {[
                  { path: "/backend/stations", desc: "รายชื่อสถานีทั้งหมด" },
                  { path: "/backend/stations/{id}/readings", desc: "readings ของสถานี" },
                  { path: "/backend/stations/readings/latest", desc: "latest ทุกสถานีในครั้งเดียว" },
                  { path: "/backend/stations/{id}/forecast", desc: "พยากรณ์อากาศล่วงหน้า" },
                ].map(e => (
                  <div key={e.path} className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">GET</Badge>
                    <code>{e.path}</code>
                    <span className="text-muted-foreground">— {e.desc}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Key list */}
          <div className="space-y-3">
            {isLoading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))
            ) : keys.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <Key className="w-10 h-10 opacity-30" />
                <p>ยังไม่มี API Key</p>
                <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
                  <Plus className="w-4 h-4 mr-1" /> สร้างอันแรก
                </Button>
              </div>
            ) : (
              keys.map(k => {
                const expired = isExpired(k.expiresAt)
                const dim = !k.isActive || expired
                return (
                  <Card key={k.id} className={`transition-opacity ${dim ? "opacity-60" : ""}`}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{k.name}</span>
                            {expired ? (
                              <Badge variant="destructive" className="text-xs">Expired</Badge>
                            ) : k.isActive ? (
                              <Badge variant="default" className="text-xs">Active</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Inactive</Badge>
                            )}
                          </div>

                          {k.description && (
                            <p className="text-sm text-muted-foreground">{k.description}</p>
                          )}

                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                            <span>ID: <code className="font-mono">{k.id}</code></span>
                            <span>สร้าง: {formatThaiDate(k.createdAt)}</span>
                            {k.lastUsedAt && (
                              <span>ใช้ล่าสุด: {formatThaiDate(k.lastUsedAt)}</span>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                            <span className={`flex items-center gap-1 ${expired ? "text-destructive" : "text-muted-foreground"}`}>
                              {k.expiresAt ? (
                                <><Clock className="w-3 h-3" /> {expiryLabel(k.expiresAt)}</>
                              ) : (
                                <><Infinity className="w-3 h-3" /> ไม่หมดอายุ</>
                              )}
                            </span>
                            {k.allowedStations === null ? (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Globe className="w-3 h-3" /> ทุกสถานี
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <MapPin className="w-3 h-3" />
                                {k.allowedStations.length > 0
                                  ? k.allowedStations.join(", ")
                                  : "ไม่มีสถานี"}
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-muted-foreground">
                              {k.dataScope.includes("sensor") && <Thermometer className="w-3 h-3" />}
                              {k.dataScope.includes("forecast") && <CloudSun className="w-3 h-3" />}
                              {k.dataScope.includes("sensor") && k.dataScope.includes("forecast")
                                ? "Sensor + พยากรณ์"
                                : k.dataScope.includes("sensor")
                                ? "เฉพาะ Sensor"
                                : "เฉพาะพยากรณ์"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Button size="icon" variant="ghost" className="h-8 w-8" title="Usage logs" onClick={() => setUsageKey(k)}>
                            <Activity className="w-3.5 h-3.5 text-blue-500" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" title="แก้ไข" onClick={() => setEditKey(k)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" title={k.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"} onClick={() => handleToggleActive(k)}>
                            {k.isActive
                              ? <PowerOff className="w-3.5 h-3.5 text-amber-500" />
                              : <Power className="w-3.5 h-3.5 text-green-500" />}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" title="ลบ" onClick={() => setDeleteTarget(k)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </>
      )}

      {/* Dialogs */}
      {usageKey && (
        <UsageLogsDialog
          keyId={usageKey.id}
          keyName={usageKey.name}
          onClose={() => setUsageKey(null)}
        />
      )}
      {showCreate && (
        <CreateKeyDialog
          stations={stations}
          onCreated={handleCreated}
          onClose={() => setShowCreate(false)}
        />
      )}
      {revealKey && (
        <KeyRevealDialog apiKey={revealKey} onClose={() => setRevealKey(null)} />
      )}
      {editKey && (
        <EditKeyDialog
          apiKey={editKey}
          stations={stations}
          onUpdated={load}
          onClose={() => setEditKey(null)}
        />
      )}
      {deleteTarget && (
        <AlertDialog open onOpenChange={() => setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>ลบ API Key?</AlertDialogTitle>
              <AlertDialogDescription>
                Key <strong>{deleteTarget.name}</strong> จะถูกลบถาวร แอปที่ใช้ Key นี้จะหยุดทำงานทันที
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDelete}
              >
                ลบ Key
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
