/**
 * Register Page - Account creation for WiMaRC application
 * Mirrors the login page (app/page.tsx): shadcn Card on a token-based
 * gradient, Thai copy, Google OAuth, and a PDPA consent block (required +
 * optional marketing). Redirects to /dashboard after successful sign-up.
 */

"use client"

import type React from "react"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Waves, Eye, EyeOff, ShieldCheck, Check } from "lucide-react"

// ---- password strength (0..4) ----
const STRENGTH = [
  { label: "", className: "" },
  { label: "อ่อนมาก", className: "bg-destructive" },
  { label: "พอใช้", className: "bg-amber-500" },
  { label: "ดี", className: "bg-lime-500" },
  { label: "แข็งแรง", className: "bg-green-600" },
]
function scorePassword(v: string): number {
  let s = 0
  if (v.length >= 8) s++
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++
  if (/\d/.test(v)) s++
  if (/[^A-Za-z0-9]/.test(v)) s++
  return s
}

// ---- token-styled checkbox (project's shadcn set has no Checkbox) ----
function ConsentCheck({
  id, checked, onChange, children,
}: {
  id: string
  checked: boolean
  onChange: (v: boolean) => void
  children: React.ReactNode
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 py-2 text-sm leading-relaxed text-muted-foreground">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        id={id}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border transition-colors ${
          checked ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background"
        }`}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>
      <span>{children}</span>
    </label>
  )
}

export default function RegisterPage() {
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [pdpaConsent, setPdpaConsent] = useState(false)
  const [pdpaMarketing, setPdpaMarketing] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  const { register } = useAuth()
  const router = useRouter()

  const pwScore = useMemo(() => scorePassword(password), [password])
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const confirmValid = confirm.length > 0 && confirm === password

  const handleGoogleRegister = async () => {
    setIsGoogleLoading(true)
    setError("")
    try {
      await signIn("google", { callbackUrl: "/dashboard" })
    } catch {
      setError("เกิดข้อผิดพลาดในการลงทะเบียนด้วย Google")
      setIsGoogleLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (username.trim().length < 3) return setError("ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร")
    if (!emailValid) return setError("รูปแบบอีเมลไม่ถูกต้อง")
    if (password.length < 8) return setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร")
    if (!confirmValid) return setError("รหัสผ่านยืนยันไม่ตรงกัน")
    if (!acceptTerms || !pdpaConsent) return setError("กรุณายอมรับเงื่อนไขและให้ความยินยอมตาม PDPA")

    setIsLoading(true)
    try {
      // register() should also persist the PDPA consent record (see AuthContext)
      const success = await register({
        username,
        email,
        password,
        consent: { terms: acceptTerms, pdpa: pdpaConsent, marketing: pdpaMarketing, at: new Date().toISOString() },
      })
      if (success) {
        router.push("/dashboard")
      } else {
        setError("ไม่สามารถสร้างบัญชีได้ ชื่อผู้ใช้หรืออีเมลอาจถูกใช้แล้ว")
      }
    } catch {
      setError("เกิดข้อผิดพลาดในการสมัครสมาชิก กรุณาลองใหม่อีกครั้ง")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/5 p-4">
      <Card className="w-full max-w-md border-border shadow-lg">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Waves className="h-8 w-8 text-primary" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">สมัครสมาชิก WiMaRC</CardTitle>
            <CardDescription className="mt-2 text-base">สร้างบัญชีเพื่อเข้าใช้งานระบบตรวจวัดสภาวะแวดล้อม</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div className="space-y-2">
              <Label htmlFor="username">ชื่อผู้ใช้</Label>
              <Input
                id="username"
                type="text"
                placeholder="กรอกชื่อผู้ใช้"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="username"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">อีเมล</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="email"
                aria-invalid={email.length > 0 && !emailValid}
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">รหัสผ่าน</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  placeholder="กรอกรหัสผ่าน"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={showPw ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                  aria-pressed={showPw}
                  title={showPw ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                >
                  {showPw ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
              {/* strength meter */}
              <div className="flex gap-1.5">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className={`h-1 flex-1 rounded-full ${i < pwScore ? STRENGTH[pwScore].className : "bg-muted"}`} />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {password.length === 0
                  ? "ใช้อย่างน้อย 8 ตัวอักษร ผสมตัวเลขและตัวพิมพ์ใหญ่"
                  : `ความปลอดภัย: ${STRENGTH[pwScore].label}`}
              </p>
            </div>

            {/* Confirm password */}
            <div className="space-y-2">
              <Label htmlFor="confirm">ยืนยันรหัสผ่าน</Label>
              <div className="relative">
                <Input
                  id="confirm"
                  type={showConfirm ? "text" : "password"}
                  placeholder="กรอกรหัสผ่านอีกครั้ง"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                  className="pr-10"
                  aria-invalid={confirm.length > 0 && !confirmValid}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={showConfirm ? "ซ่อนรหัสผ่านยืนยัน" : "แสดงรหัสผ่านยืนยัน"}
                  aria-pressed={showConfirm}
                  title={showConfirm ? "ซ่อนรหัสผ่านยืนยัน" : "แสดงรหัสผ่านยืนยัน"}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
              {confirm.length > 0 && !confirmValid && (
                <p className="text-xs text-destructive">รหัสผ่านไม่ตรงกัน</p>
              )}
            </div>

            {/* PDPA consent block */}
            <div className="rounded-md border border-border bg-muted/50 p-4">
              <p className="mb-1.5 flex items-center gap-2 text-sm font-medium text-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                ความยินยอมตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)
              </p>
              <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
                WiMaRC จะเก็บรวบรวมและใช้ข้อมูลส่วนบุคคล (ชื่อผู้ใช้ อีเมล และข้อมูลการใช้งาน)
                เพื่อการยืนยันตัวตนและการให้บริการ ท่านสามารถถอนความยินยอมได้ภายหลัง อ่านเพิ่มเติมใน{" "}
                <a href="/privacy" className="text-primary hover:underline">นโยบายความเป็นส่วนตัว</a>
              </p>

              <div className="divide-y divide-border">
                <ConsentCheck id="terms" checked={acceptTerms} onChange={setAcceptTerms}>
                  ฉันยอมรับ <a href="/terms" className="text-primary hover:underline">เงื่อนไขการใช้งาน</a> และ{" "}
                  <a href="/privacy" className="text-primary hover:underline">นโยบายความเป็นส่วนตัว</a>
                  <span className="ml-1 rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-bold text-destructive">จำเป็น</span>
                </ConsentCheck>

                <ConsentCheck id="pdpa" checked={pdpaConsent} onChange={setPdpaConsent}>
                  ฉันยินยอมให้เก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคลของฉัน เพื่อการให้บริการของระบบ WiMaRC
                  <span className="ml-1 rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-bold text-destructive">จำเป็น</span>
                </ConsentCheck>

                <ConsentCheck id="marketing" checked={pdpaMarketing} onChange={setPdpaMarketing}>
                  ฉันยินยอมให้ใช้ข้อมูลเพื่อรับข่าวสาร อัปเดต และคำแนะนำการเพาะปลูก
                  <span className="ml-1 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">ไม่บังคับ</span>
                </ConsentCheck>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Submit */}
            <Button
              type="submit"
              className="w-full font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={isLoading || isGoogleLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  กำลังสร้างบัญชี...
                </>
              ) : (
                "สมัครสมาชิก"
              )}
            </Button>

            {/* Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">หรือ</span>
              </div>
            </div>

            {/* Google register */}
            <Button
              type="button"
              variant="outline"
              className="w-full border-border hover:bg-accent hover:text-accent-foreground"
              onClick={handleGoogleRegister}
              disabled={isLoading || isGoogleLoading}
            >
              {isGoogleLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              ลงทะเบียนด้วย Google
            </Button>

            {/* Back to login */}
            <p className="mt-6 text-center text-sm text-muted-foreground">
              มีบัญชีอยู่แล้ว?{" "}
              <a href="/" className="font-semibold text-primary hover:underline">เข้าสู่ระบบ</a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
