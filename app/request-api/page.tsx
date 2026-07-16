"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { apiRequest } from "@/services/apiClient"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, Loader2, CloudSun, Thermometer, Wind, Droplets, Gauge } from "lucide-react"

const SAMPLE_FIELDS = [
  { icon: Thermometer, label: "อุณหภูมิอากาศ", unit: "°C" },
  { icon: Droplets,    label: "ความชื้นสัมพัทธ์", unit: "%" },
  { icon: Wind,        label: "ความเร็วลม", unit: "m/s" },
  { icon: CloudSun,    label: "ความเข้มแสง", unit: "lux" },
  { icon: Gauge,       label: "ความกดอากาศ", unit: "hPa" },
]

export default function RequestApiPage() {
  const [form, setForm] = useState({ name: "", email: "", organization: "", purpose: "" })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState("")

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!form.name.trim() || !form.email.trim() || !form.purpose.trim()) {
      setError("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError("รูปแบบอีเมลไม่ถูกต้อง")
      return
    }
    setIsSubmitting(true)
    try {
      await apiRequest("/api-key-requests", {
        method: "POST",
        body: {
          name: form.name.trim(),
          email: form.email.trim(),
          organization: form.organization.trim() || undefined,
          purpose: form.purpose.trim(),
        },
      })
      setSubmitted(true)
    } catch {
      setError("ส่งคำขอไม่สำเร็จ กรุณาลองใหม่อีกครั้ง")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      {/* Header */}
      <header className="bg-background border-b px-6 py-4 flex items-center gap-3">
        <div className="flex items-center justify-center rounded-2xl overflow-hidden bg-primary/10" style={{ width: 36, height: 36 }}>
          <Image src="/apple-icon.png" alt="WIMARC" width={32} height={32} className="object-contain" />
        </div>
        <div>
          <span className="font-extrabold tracking-widest text-base">WIMARC</span>
          <span className="text-muted-foreground text-sm ml-2">ขอใช้งาน API</span>
        </div>
        <div className="ml-auto">
          <Link href="/">
            <Button variant="outline" size="sm">เข้าสู่ระบบ</Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-10 grid md:grid-cols-2 gap-8 items-start">
        {/* Left: info */}
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">ขอรับ API Key</h1>
            <p className="text-muted-foreground mt-1">
              สำหรับนักพัฒนาและหน่วยงานที่ต้องการเข้าถึงข้อมูลสภาพอากาศจากสถานีตรวจวัด WIMARC
            </p>
          </div>

          {/* Fast path */}
          <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 space-y-2">
            <p className="text-sm font-semibold">ต้องการ API Key ทันที?</p>
            <p className="text-xs text-muted-foreground">
              เข้าสู่ระบบด้วยอีเมล สร้าง API Key ได้เลย ไม่ต้องรออนุมัติ
            </p>
            <Link href="/portal">
              <Button size="sm" className="gap-1.5 mt-1">
                เข้าสู่ระบบเพื่อสร้าง API Key →
              </Button>
            </Link>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">ข้อมูลที่ได้รับ</CardTitle>
              <CardDescription>ข้อมูลวัดอากาศแบบ real-time จากสถานีทั่วประเทศ</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {SAMPLE_FIELDS.map(f => (
                <div key={f.label} className="flex items-center gap-2 text-sm">
                  <f.icon className="w-4 h-4 text-primary/70 shrink-0" />
                  <span>{f.label}</span>
                  <span className="text-muted-foreground ml-auto font-mono">{f.unit}</span>
                </div>
              ))}
              <p className="text-xs text-muted-foreground pt-1">
                + ทิศทางลม, ปริมาณฝน, VPD และอื่นๆ
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Endpoints ที่ใช้ได้</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 font-mono text-xs">
              {[
                "GET /backend/stations",
                "GET /backend/stations/{id}/readings",
                "GET /backend/stations/readings/latest",
                "GET /backend/stations/{id}/forecast",
              ].map(e => (
                <div key={e} className="bg-muted rounded px-2 py-1">{e}</div>
              ))}
              <p className="text-xs text-muted-foreground font-sans pt-1">
                ใส่ header <code className="bg-muted px-1 rounded">X-Api-Key: {"<key>"}</code> ทุก request
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right: form */}
        <div>
          {submitted ? (
            <Card>
              <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-4">
                <CheckCircle2 className="w-14 h-14 text-green-500" />
                <div>
                  <h2 className="text-lg font-semibold">ส่งคำขอสำเร็จแล้ว</h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    ทีมงานจะตรวจสอบและส่ง API Key ไปที่อีเมลของคุณภายใน 1–3 วันทำการ
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  อีเมล: <strong>{form.email}</strong>
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">กรอกข้อมูลเพื่อขอ API Key</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>ชื่อ-นามสกุล <span className="text-destructive">*</span></Label>
                    <Input
                      placeholder="ชื่อจริง นามสกุลจริง"
                      value={form.name}
                      onChange={set("name")}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>อีเมล <span className="text-destructive">*</span></Label>
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={form.email}
                      onChange={set("email")}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>หน่วยงาน / องค์กร</Label>
                    <Input
                      placeholder="ชื่อบริษัท มหาวิทยาลัย หรือหน่วยงาน (ถ้ามี)"
                      value={form.organization}
                      onChange={set("organization")}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>จุดประสงค์การใช้งาน <span className="text-destructive">*</span></Label>
                    <Textarea
                      placeholder="อธิบายว่าต้องการนำข้อมูลไปใช้ทำอะไร เช่น แอปพลิเคชันเกษตร, งานวิจัย, dashboard แสดงผล"
                      value={form.purpose}
                      onChange={set("purpose")}
                      rows={4}
                      disabled={isSubmitting}
                    />
                  </div>

                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />กำลังส่ง...</>
                    ) : "ส่งคำขอ"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    ข้อมูลของคุณจะถูกใช้เพื่อพิจารณาการเข้าถึง API เท่านั้น
                  </p>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
