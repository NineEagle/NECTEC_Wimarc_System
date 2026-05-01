/**
 * Login Page - Entry point for WiMaRC application
 * Handles user authentication with username and password
 * Redirects to dashboard after successful login
 */

"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"

// Enable this flag to show TOR references in the UI for development/QA
const SHOW_TOR = process.env.NODE_ENV === "development"

export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [bgImage, setBgImage] = useState("/background/farm1.jpg")
  const { login } = useAuth()
  const router = useRouter()

  // Pick a random background on mount
  useEffect(() => {
    const images = ["farm1.jpg", "farm2.jpg", "farm3.jpg", "farm4.jpg", "farm5.jpg"]
    const randomImage = images[Math.floor(Math.random() * images.length)]
    setBgImage(`/background/${randomImage}`)
  }, [])

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
    <div 
      className="flex min-h-screen items-center justify-center p-4 transition-all duration-1000"
      style={{
        backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.45)), url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      <Card className="w-full max-w-md border-white/20 shadow-2xl bg-black/40 backdrop-blur-xl">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-white/20 shadow-inner border border-white/30 overflow-hidden p-2">
            <img
              src="/durian-logo.svg"
              alt="wimarc durian logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <CardTitle className="text-3xl font-black text-white tracking-tight drop-shadow-sm lowercase">wimarc</CardTitle>
            <CardDescription className="mt-2 text-white/90 font-semibold drop-shadow-sm">ระบบตรวจวัดและจัดเก็บสภาวะแวดล้อมเชิงพื้นที่</CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username field */}
            <div className="space-y-2">
              <Label htmlFor="username" className="flex items-center text-white font-bold drop-shadow-sm">
                ชื่อผู้ใช้
                {SHOW_TOR && (
                  <span className="font-mono text-[10px] border border-white/50 text-white px-1.5 py-0.5 rounded ml-2 font-medium bg-white/10">
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
                className="bg-white/10 border-white/40 text-white placeholder:text-white/40 focus:bg-white/20 focus:border-white/70 transition-all border"
              />
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center text-white font-bold drop-shadow-sm">
                รหัสผ่าน
                {SHOW_TOR && (
                  <span className="font-mono text-[10px] border border-white/50 text-white px-1.5 py-0.5 rounded ml-2 font-medium bg-white/10">
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
                className="bg-white/10 border-white/40 text-white placeholder:text-white/40 focus:bg-white/20 focus:border-white/70 transition-all border"
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
                <span className="w-full border-t border-white/20" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-transparent px-3 text-white/50 backdrop-blur-none">หรือ</span>
              </div>
            </div>

            {/* Google login button */}
            <Button
              type="button"
              variant="outline"
              className="w-full bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white hover:border-white/50 transition-all"
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
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
