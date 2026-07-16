"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { sendOtp, verifyOtp, listPortalApiKeys, createPortalApiKey, revokePortalApiKey, getPortalKeyUsage } from "@/services/portalService"
import type { PortalUser, PortalApiKey, UsageLog, DataScope } from "@/services/portalService"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { formatThaiDate } from "@/utils/dateUtils"
import {
  Key, Plus, Copy, Check, Trash2, Clock, Infinity, Loader2,
  LogOut, ChevronDown, Activity, Globe, Thermometer, CloudSun,
} from "lucide-react"

// ─── helpers ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "portal_token"
const STORAGE_USER = "portal_user"

function saveSession(token: string, user: PortalUser) {
  localStorage.setItem(STORAGE_KEY, token)
  localStorage.setItem(STORAGE_USER, JSON.stringify(user))
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(STORAGE_USER)
}

function loadSession(): { token: string; user: PortalUser } | null {
  if (typeof window === "undefined") return null
  const token = localStorage.getItem(STORAGE_KEY)
  const user = localStorage.getItem(STORAGE_USER)
  if (!token || !user) return null
  try { return { token, user: JSON.parse(user) } }
  catch { return null }
}

function isExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false
  return new Date(expiresAt) < new Date()
}

// ─── Key reveal dialog ───────────────────────────────────────────────────────

function KeyRevealDialog({ apiKey, onClose }: { apiKey: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
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
            <code className="flex-1 block rounded-lg bg-muted px-3 py-2 text-xs font-mono break-all select-all">
              {apiKey}
            </code>
            <Button size="icon" variant="outline" onClick={async () => {
              await navigator.clipboard.writeText(apiKey)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}>
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            ใส่ใน HTTP header: <code className="bg-muted px-1 rounded">X-Api-Key: {"<key>"}</code>
          </p>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>เข้าใจแล้ว</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Usage logs dialog ───────────────────────────────────────────────────────

function UsageLogsDialog({ keyId, keyName, onClose }: { keyId: string; keyName: string; onClose: () => void }) {
  const [logs, setLogs] = useState<UsageLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPortalKeyUsage(keyId).then(l => { setLogs(l); setLoading(false) }).catch(() => setLoading(false))
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
            <div className="space-y-2">{Array.from({length: 5}).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">ยังไม่มี usage logs</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium text-muted-foreground">เวลา</th>
                  <th className="text-left py-2 font-medium text-muted-foreground">Method</th>
                  <th className="text-left py-2 font-medium text-muted-foreground">Path</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="py-1.5 text-muted-foreground whitespace-nowrap">{formatThaiDate(l.timestamp)}</td>
                    <td className="py-1.5 pr-2"><Badge variant="outline" className="text-[10px] px-1">{l.method}</Badge></td>
                    <td className="py-1.5 font-mono">{l.path}</td>
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

// ─── Create key dialog ───────────────────────────────────────────────────────

function CreateKeyDialog({ onCreated, onClose }: { onCreated: (key: string) => void; onClose: () => void }) {
  const { toast } = useToast()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [dataScope, setDataScope] = useState<DataScope[]>(["sensor", "forecast"])
  const [submitting, setSubmitting] = useState(false)

  const toggleScope = (scope: DataScope) => {
    setDataScope(prev => {
      if (prev.includes(scope)) {
        if (prev.length === 1) return prev  // keep at least one
        return prev.filter(s => s !== scope)
      }
      return [...prev, scope]
    })
  }

  const handleSubmit = async () => {
    if (!name.trim()) { toast({ variant: "destructive", title: "กรุณาใส่ชื่อ" }); return }
    setSubmitting(true)
    try {
      const result = await createPortalApiKey(name.trim(), description.trim() || undefined, null, dataScope)
      onCreated(result.key)
    } catch (e: any) {
      toast({ variant: "destructive", title: e.message || "สร้างไม่สำเร็จ" })
    } finally { setSubmitting(false) }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>สร้าง API Key</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>ชื่อ <span className="text-destructive">*</span></Label>
            <Input placeholder="เช่น My App" value={name} onChange={e => setName(e.target.value)} disabled={submitting} />
          </div>
          <div className="space-y-1.5">
            <Label>คำอธิบาย (ไม่บังคับ)</Label>
            <Textarea placeholder="ใช้สำหรับ..." value={description} onChange={e => setDescription(e.target.value)} rows={2} disabled={submitting} />
          </div>
          <div className="space-y-2">
            <Label>ประเภทข้อมูล</Label>
            <div
              className="flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer hover:bg-muted/50"
              onClick={() => toggleScope("sensor")}
            >
              <Checkbox checked={dataScope.includes("sensor")} onCheckedChange={() => toggleScope("sensor")} />
              <Thermometer className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">ข้อมูล Sensor (ค่าตรวจวัดจริง)</span>
            </div>
            <div
              className="flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer hover:bg-muted/50"
              onClick={() => toggleScope("forecast")}
            >
              <Checkbox checked={dataScope.includes("forecast")} onCheckedChange={() => toggleScope("forecast")} />
              <CloudSun className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">พยากรณ์อากาศล่วงหน้า</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>ยกเลิก</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "สร้าง"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Login form (email → OTP) ────────────────────────────────────────────────

function LoginForm({ onLoggedIn }: { onLoggedIn: (user: PortalUser) => void }) {
  const { toast } = useToast()
  const [step, setStep] = useState<"email" | "otp">("email")
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [organization, setOrganization] = useState("")
  const [otp, setOtp] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!email.trim() || !name.trim()) { setError("กรุณากรอกชื่อและอีเมล"); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("รูปแบบอีเมลไม่ถูกต้อง"); return }
    setSubmitting(true)
    try {
      await sendOtp(email.trim().toLowerCase(), name.trim(), organization.trim() || undefined)
      setStep("otp")
    } catch (e: any) {
      setError(e.message || "ส่ง OTP ไม่สำเร็จ")
    } finally { setSubmitting(false) }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!otp.trim()) { setError("กรุณากรอก OTP"); return }
    setSubmitting(true)
    try {
      const result = await verifyOtp(email, otp.trim(), name.trim(), organization.trim() || undefined)
      saveSession(result.token, result.user)
      onLoggedIn(result.user)
    } catch (e: any) {
      setError(e.message || "OTP ไม่ถูกต้องหรือหมดอายุ")
    } finally { setSubmitting(false) }
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center justify-center rounded-2xl overflow-hidden bg-primary/10 w-14 h-14">
            <Image src="/apple-icon.png" alt="WIMARC" width={48} height={48} className="object-contain" />
          </div>
          <div className="text-center">
            <h1 className="font-extrabold tracking-widest text-lg">WIMARC</h1>
            <p className="text-muted-foreground text-sm">API Portal สำหรับนักพัฒนา</p>
          </div>
        </div>

        <Card>
          {step === "email" ? (
            <CardContent className="pt-6">
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>ชื่อ-นามสกุล <span className="text-destructive">*</span></Label>
                  <Input placeholder="ชื่อจริง นามสกุลจริง" value={name} onChange={e => setName(e.target.value)} disabled={submitting} />
                </div>
                <div className="space-y-1.5">
                  <Label>อีเมล <span className="text-destructive">*</span></Label>
                  <Input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} disabled={submitting} />
                </div>
                <div className="space-y-1.5">
                  <Label>หน่วยงาน / องค์กร</Label>
                  <Input placeholder="ไม่บังคับ" value={organization} onChange={e => setOrganization(e.target.value)} disabled={submitting} />
                </div>
                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />กำลังส่ง OTP...</> : "รับรหัส OTP ทางอีเมล"}
                </Button>
              </form>
            </CardContent>
          ) : (
            <CardContent className="pt-6">
              <form onSubmit={handleVerify} className="space-y-4">
                <div className="text-center text-sm text-muted-foreground">
                  ส่งรหัส OTP ไปที่ <strong>{email}</strong> แล้ว
                  <br />มีอายุ 15 นาที
                </div>
                <div className="space-y-1.5">
                  <Label>รหัส OTP (6 หลัก)</Label>
                  <Input
                    placeholder="000000"
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="text-center text-xl tracking-[0.5em] font-mono"
                    disabled={submitting}
                    maxLength={6}
                  />
                </div>
                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                <Button type="submit" className="w-full" disabled={submitting || otp.length !== 6}>
                  {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />กำลังยืนยัน...</> : "ยืนยัน OTP"}
                </Button>
                <Button type="button" variant="ghost" className="w-full text-sm" onClick={() => { setStep("email"); setOtp(""); setError("") }}>
                  ส่งรหัสใหม่
                </Button>
              </form>
            </CardContent>
          )}
        </Card>
        <p className="text-xs text-center text-muted-foreground">
          เพียงใส่อีเมล ไม่ต้องจดจำรหัสผ่าน
        </p>
      </div>
    </div>
  )
}

// ─── Dashboard (authenticated) ────────────────────────────────────────────────

function Dashboard({ user, onLogout }: { user: PortalUser; onLogout: () => void }) {
  const { toast } = useToast()
  const [keys, setKeys] = useState<PortalApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [revealKey, setRevealKey] = useState<string | null>(null)
  const [usageKeyId, setUsageKeyId] = useState<string | null>(null)
  const [usageKeyName, setUsageKeyName] = useState("")

  const load = () => listPortalApiKeys().then(k => { setKeys(k); setLoading(false) }).catch(() => setLoading(false))

  useEffect(() => { load() }, [])

  const handleRevoke = async (k: PortalApiKey) => {
    try {
      await revokePortalApiKey(k.id)
      toast({ title: `ปิดการใช้งาน ${k.name} แล้ว` })
      load()
    } catch (e: any) {
      toast({ variant: "destructive", title: e.message || "ดำเนินการไม่สำเร็จ" })
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      {/* Header */}
      <header className="bg-background border-b px-6 py-4 flex items-center gap-3">
        <div className="flex items-center justify-center rounded-2xl overflow-hidden bg-primary/10 w-9 h-9">
          <Image src="/apple-icon.png" alt="WIMARC" width={32} height={32} className="object-contain" />
        </div>
        <span className="font-extrabold tracking-widest text-base">WIMARC API Portal</span>
        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <span>{user.name}</span>
          <Button variant="ghost" size="sm" onClick={onLogout} className="gap-1.5">
            <LogOut className="w-3.5 h-3.5" />
            ออกจากระบบ
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
        {/* Endpoint info */}
        <Card className="border-dashed">
          <CardContent className="pt-4 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Endpoints ที่ใช้ได้ (ใส่ header <code className="bg-muted px-1 rounded">X-Api-Key</code>)</p>
            <div className="space-y-1 font-mono text-xs">
              {[
                "GET /backend/stations",
                "GET /backend/stations/{id}/readings",
                "GET /backend/stations/readings/latest",
                "GET /backend/stations/{id}/forecast",
              ].map(e => (
                <div key={e} className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">GET</Badge>
                  <code>{e}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Keys section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <Key className="w-4 h-4" />
              API Keys ของคุณ
            </h2>
            <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              สร้าง Key
            </Button>
          </div>

          {loading ? (
            Array.from({length: 2}).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
          ) : keys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <Key className="w-10 h-10 opacity-30" />
              <p className="text-sm">ยังไม่มี API Key</p>
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
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{k.name}</span>
                          {expired ? (
                            <Badge variant="destructive" className="text-xs">Expired</Badge>
                          ) : k.isActive ? (
                            <Badge variant="default" className="text-xs">Active</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Inactive</Badge>
                          )}
                        </div>
                        {k.description && <p className="text-xs text-muted-foreground">{k.description}</p>}
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            {k.expiresAt
                              ? <><Clock className="w-3 h-3" />หมดอายุ {formatThaiDate(k.expiresAt)}</>
                              : <><Infinity className="w-3 h-3" />ไม่หมดอายุ</>}
                          </span>
                          <span className="flex items-center gap-1"><Globe className="w-3 h-3" />ทุกสถานี (อากาศ)</span>
                          <span className="flex items-center gap-1">
                            {k.dataScope.includes("sensor") && <Thermometer className="w-3 h-3" />}
                            {k.dataScope.includes("forecast") && <CloudSun className="w-3 h-3" />}
                            {k.dataScope.includes("sensor") && k.dataScope.includes("forecast")
                              ? "Sensor + พยากรณ์"
                              : k.dataScope.includes("sensor") ? "เฉพาะ Sensor" : "เฉพาะพยากรณ์"}
                          </span>
                          {k.lastUsedAt && <span>ใช้ล่าสุด: {formatThaiDate(k.lastUsedAt)}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs"
                          onClick={() => { setUsageKeyId(k.id); setUsageKeyName(k.name) }}
                        >
                          <Activity className="w-3 h-3" />
                          Logs
                        </Button>
                        {k.isActive && !expired && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-xs text-destructive border-destructive/20 hover:bg-destructive/5"
                            onClick={() => handleRevoke(k)}
                          >
                            <Trash2 className="w-3 h-3" />
                            ยกเลิก
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          สามารถสร้าง API Key ได้สูงสุด 5 keys · ข้อมูลสถานีวัดอากาศเท่านั้น
        </p>
      </main>

      {showCreate && (
        <CreateKeyDialog
          onCreated={(key) => { setShowCreate(false); setRevealKey(key); load() }}
          onClose={() => setShowCreate(false)}
        />
      )}
      {revealKey && <KeyRevealDialog apiKey={revealKey} onClose={() => setRevealKey(null)} />}
      {usageKeyId && (
        <UsageLogsDialog
          keyId={usageKeyId}
          keyName={usageKeyName}
          onClose={() => { setUsageKeyId(null); setUsageKeyName("") }}
        />
      )}
    </div>
  )
}

// ─── Root page (decides login or dashboard) ──────────────────────────────────

export default function PortalPage() {
  const [user, setUser] = useState<PortalUser | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const session = loadSession()
    if (session) setUser(session.user)
    setChecked(true)
  }, [])

  if (!checked) return null

  if (!user) {
    return <LoginForm onLoggedIn={(u) => setUser(u)} />
  }

  return (
    <Dashboard
      user={user}
      onLogout={() => { clearSession(); setUser(null) }}
    />
  )
}
