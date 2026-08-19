"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Eye, EyeOff, Check, CheckCircle2 } from "lucide-react"
import Link from "next/link"

function passwordStrength(p: string): number {
  let score = 0
  if (p.length >= 8) score++
  if (p.length >= 12) score++
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++
  if (/\d/.test(p)) score++
  if (/[^A-Za-z0-9]/.test(p)) score++
  return Math.min(score, 4)
}

const STRENGTH_LABEL = ["", "อ่อน", "พอใช้", "ดี", "แข็งแกร่ง"]
const STRENGTH_COLOR = ["", "bg-red-500", "bg-orange-400", "bg-yellow-400", "bg-green-500"]

export default function RegisterPage() {
  const { register } = useAuth()
  const router = useRouter()

  const [success, setSuccess] = useState(false)
  const [fullName, setFullName] = useState("")
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [terms, setTerms] = useState(true)
  const [pdpa, setPdpa] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [bgImage, setBgImage] = useState("/background/farm1.jpg")
  const [particles, setParticles] = useState<Array<{ id: number; left: string; size: number; duration: number; delay: number }>>([])

  useEffect(() => {
    const images = ["farm1.jpg", "farm2.jpg", "farm3.jpg", "farm4.jpg", "farm5.jpg"]
    setBgImage(`/background/${images[Math.floor(Math.random() * images.length)]}`)
    setParticles(
      Array.from({ length: 15 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        size: Math.random() * 3 + 2,
        duration: Math.random() * 8 + 10,
        delay: Math.random() * 10,
      }))
    )
  }, [])

  const strength = passwordStrength(password)
  const passwordMismatch = confirm.length > 0 && confirm !== password

  const errorMap: Record<string, string> = {
    username_taken: "ชื่อผู้ใช้นี้ถูกใช้แล้ว",
    email_taken: "อีเมลนี้ถูกใช้แล้ว",
    password_too_short: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร",
    network_error: "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้",
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (password !== confirm) { setError("รหัสผ่านไม่ตรงกัน"); return }
    setIsLoading(true)
    try {
      const result = await register({ username, email, password, fullName })
      if (result.ok) {
        setSuccess(true)
      } else {
        setError(errorMap[result.error ?? ""] ?? `เกิดข้อผิดพลาด: ${result.error}`)
      }
    } catch {
      setError("เกิดข้อผิดพลาดในการสมัคร กรุณาลองใหม่อีกครั้ง")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-8 py-4 overflow-hidden">
      <div
        className="absolute inset-0 login-bg"
        style={{ backgroundImage: `url(${bgImage})`, backgroundSize: "cover", backgroundPosition: "center" }}
      />
      <div className="absolute inset-0" style={{ background: "linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.45))" }} />
      {particles.map(p => (
        <div
          key={p.id}
          className="login-particle"
          style={{ left: p.left, width: `${p.size}px`, height: `${p.size}px`, animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s` }}
        />
      ))}

      <Card className="relative z-10 w-full max-w-xs border-white/25 shadow-2xl bg-black/40 backdrop-blur-xl">
        <CardHeader className="space-y-1.5 text-center pb-2 pt-3 px-4">
          <div className="mx-auto">
            <img src="/apple-icon.png" alt="WiMaRC" className="h-8 w-auto object-contain login-logo-glow" />
          </div>
          <div>
            <CardTitle className="text-lg font-black text-white tracking-tight drop-shadow-sm uppercase">สมัครสมาชิก</CardTitle>
            <CardDescription className="mt-0.5 text-white/90 font-semibold drop-shadow-sm text-[10px] leading-tight">ระบบตรวจวัดและจัดเก็บสภาวะแวดล้อมเชิงพื้นที่</CardDescription>
          </div>
        </CardHeader>

        <CardContent className="px-3 pb-3">
          {success ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-400" />
              <div>
                <p className="text-white font-bold text-sm">ส่งคำขอสำเร็จ!</p>
                <p className="text-white/70 text-[11px] mt-1 leading-relaxed">คำขอสมัครสมาชิกถูกส่งแล้ว<br />รอผู้ดูแลระบบอนุมัติและแจ้งให้ทราบ</p>
              </div>
              <Button
                type="button"
                className="w-full font-bold bg-primary hover:bg-primary/90 text-primary-foreground mt-1"
                onClick={() => router.push("/")}
              >
                ไปยังหน้าเข้าสู่ระบบ
              </Button>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-2">
            {/* Full name */}
            <div className="space-y-1">
              <Label htmlFor="fullName" className="text-white font-bold drop-shadow-sm text-xs">ชื่อ-นามสกุล</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="กรอกชื่อ-นามสกุล"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                disabled={isLoading}
                autoComplete="name"
                className="bg-white/10 border-white/40 text-white placeholder:text-white/40 focus:bg-white/20 focus:border-white/70 transition-all border"
              />
            </div>

            {/* Username */}
            <div className="space-y-1">
              <Label htmlFor="username" className="text-white font-bold drop-shadow-sm text-xs">ชื่อผู้ใช้ <span className="text-red-400">*</span></Label>
              <Input
                id="username"
                type="text"
                placeholder="กรอกชื่อผู้ใช้"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="username"
                className="bg-white/10 border-white/40 text-white placeholder:text-white/40 focus:bg-white/20 focus:border-white/70 transition-all border"
              />
            </div>

            {/* Email */}
            <div className="space-y-1">
              <Label htmlFor="email" className="text-white font-bold drop-shadow-sm text-xs">อีเมล <span className="text-red-400">*</span></Label>
              <Input
                id="email"
                type="email"
                placeholder="กรอกอีเมล"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="email"
                className="bg-white/10 border-white/40 text-white placeholder:text-white/40 focus:bg-white/20 focus:border-white/70 transition-all border"
              />
            </div>

            {/* Password */}
            <div className="space-y-1">
              <Label htmlFor="password" className="text-white font-bold drop-shadow-sm text-xs">รหัสผ่าน <span className="text-red-400">*</span></Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                  className="bg-white/10 border-white/40 text-white placeholder:text-white/40 focus:bg-white/20 focus:border-white/70 transition-all border pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                  aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                  aria-pressed={showPassword}
                  title={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                >
                  {showPassword ? <Eye className="h-4 w-4" aria-hidden="true" /> : <EyeOff className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="space-y-0.5">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength ? STRENGTH_COLOR[strength] : "bg-white/20"}`} />
                    ))}
                  </div>
                  <p className={`text-[10px] font-semibold ${strength >= 3 ? "text-green-400" : strength === 2 ? "text-yellow-400" : "text-red-400"}`}>{STRENGTH_LABEL[strength]}</p>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div className="space-y-1">
              <Label htmlFor="confirm" className="text-white font-bold drop-shadow-sm text-xs">ยืนยันรหัสผ่าน <span className="text-red-400">*</span></Label>
              <div className="relative">
                <Input
                  id="confirm"
                  type={showConfirm ? "text" : "password"}
                  placeholder="กรอกรหัสผ่านอีกครั้ง"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                  className={`bg-white/10 text-white placeholder:text-white/40 focus:bg-white/20 transition-all border pr-10 ${passwordMismatch ? "border-red-500" : "border-white/40 focus:border-white/70"}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                  aria-label={showConfirm ? "ซ่อนรหัสผ่านยืนยัน" : "แสดงรหัสผ่านยืนยัน"}
                  aria-pressed={showConfirm}
                  title={showConfirm ? "ซ่อนรหัสผ่านยืนยัน" : "แสดงรหัสผ่านยืนยัน"}
                >
                  {showConfirm ? <Eye className="h-4 w-4" aria-hidden="true" /> : <EyeOff className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
              {passwordMismatch && <p className="text-[10px] text-red-400 font-semibold">รหัสผ่านไม่ตรงกัน</p>}
            </div>

            {/* Consents */}
            <div className="space-y-2 pt-0.5">
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={terms}
                  onChange={e => setTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary cursor-pointer"
                />
                <span className="text-[11px] text-white/80 leading-tight group-hover:text-white transition-colors">
                  ยอมรับ <span className="text-white underline underline-offset-2">เงื่อนไขการใช้งาน</span> <span className="text-red-400">*</span>
                </span>
              </label>
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={pdpa}
                  onChange={e => setPdpa(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary cursor-pointer"
                />
                <span className="text-[11px] text-white/80 leading-tight group-hover:text-white transition-colors">
                  ยอมรับ <span className="text-white underline underline-offset-2">นโยบายความเป็นส่วนตัว (PDPA)</span> <span className="text-red-400">*</span>
                </span>
              </label>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={isLoading || passwordMismatch || !terms || !pdpa}
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />กำลังสมัคร...</>
              ) : "สมัครสมาชิก"}
            </Button>

            <p className="text-center text-[11px] text-white/60 pt-0.5">
              มีบัญชีแล้ว?{" "}
              <Link href="/" className="text-white font-semibold hover:underline underline-offset-2">เข้าสู่ระบบ</Link>
            </p>
          </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
