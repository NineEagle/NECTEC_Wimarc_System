/**
 * Login Page - Entry point for WiMaRC application
 * Handles user authentication with username and password
 * Redirects to dashboard after successful login
 */

"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Waves } from "lucide-react"

// Enable this flag to show TOR references in the UI for development/QA
const SHOW_TOR = process.env.NODE_ENV === "development"

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const { login } = useAuth()
  const router = useRouter()

  /**
   * Handle Google OAuth login
   */
  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true)
    setError("")
    try {
      await signIn("google", { callbackUrl: "/dashboard" })
    } catch {
      setError("เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย Google")
      setIsGoogleLoading(false)
    }
  }

  /**
   * Handle login form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const success = await login(username, password)

      if (success) {
        router.push("/dashboard")
      } else {
        setError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง")
      }
    } catch (err) {
      setError("เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง")
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
            <CardTitle className="text-2xl font-bold">WiMaRC</CardTitle>
            <CardDescription className="mt-2 text-base">ระบบตรวจวัดและจัดเก็บสภาวะแวดล้อมเชิงพื้นที่</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username field */}
            <div className="space-y-2">
              <Label htmlFor="username" className="flex items-center">
                ชื่อผู้ใช้
                {SHOW_TOR && (
                  <span className="font-mono text-[10px] border border-primary/30 text-primary px-1.5 py-0.5 rounded ml-2 font-medium bg-primary/10">
                    TOR 4.5.2 &middot; user_info.username
                  </span>
                )}
              </Label>
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

            {/* Password field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center">
                รหัสผ่าน
                {SHOW_TOR && (
                  <span className="font-mono text-[10px] border border-primary/30 text-primary px-1.5 py-0.5 rounded ml-2 font-medium bg-primary/10">
                    TOR 4.5.2 &middot; user_info.password
                  </span>
                )}
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="กรอกรหัสผ่าน"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>

            {/* Error message */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Submit button */}
            <Button type="submit" className="w-full font-bold bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isLoading || isGoogleLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  กำลังเข้าสู่ระบบ...
                </>
              ) : (
                "เข้าสู่ระบบ"
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

            {/* Google login button */}
            <Button
              type="button"
              variant="outline"
              className="w-full border-border hover:bg-accent hover:text-accent-foreground"
              onClick={handleGoogleLogin}
              disabled={isLoading || isGoogleLoading}
            >
              {isGoogleLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              )}
              เข้าสู่ระบบด้วย Google
              {SHOW_TOR && <span className="font-mono text-muted-foreground ml-2 text-xs font-normal">(TOR 4.5.2)</span>}
            </Button>

            {/* Demo accounts info */}
            <div className="mt-6 rounded-md bg-muted p-4 text-sm border border-border">
              <p className="mb-2 font-medium flex items-center text-foreground">
                บัญชีทดสอบ
                {SHOW_TOR && (
                  <span className="font-mono text-xs text-muted-foreground ml-1 font-normal">
                    (user_info.type)
                  </span>
                )}
                :
              </p>
              <ul className="space-y-1.5 text-muted-foreground text-xs">
                <li className="flex items-center"><span className="mr-2">🔑</span> Admin (A): admin / admin123</li>
                <li className="flex items-center"><span className="mr-2 text-primary">👤</span> User (U): user1 / user123</li>
                <li className="flex items-center"><span className="mr-2 text-orange-500">👁️</span> Guest (G): guest1 / guest123</li>
              </ul>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
