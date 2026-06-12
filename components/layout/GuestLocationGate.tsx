"use client"

import { MapPin, LocateFixed, Loader2 } from "lucide-react"
import { useStation } from "@/contexts/StationContext"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"

type GeoStatus = "idle" | "prompting" | "granted" | "denied" | "unsupported"

export function GuestLocationGate({ status }: { status: GeoStatus }) {
  const { retryGeolocation } = useStation()
  const { logout } = useAuth()

  const isBusy = status === "prompting" || status === "idle"

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          {isBusy ? <Loader2 className="h-8 w-8 animate-spin" /> : <MapPin className="h-8 w-8" />}
        </div>

        {isBusy ? (
          <>
            <h1 className="mb-2 text-xl font-semibold">กำลังค้นหาตำแหน่งของคุณ…</h1>
            <p className="text-sm text-muted-foreground">
              กรุณากด “อนุญาต” เมื่อเบราว์เซอร์ขอเข้าถึงตำแหน่ง เพื่อแสดงสถานีที่อยู่ใกล้คุณที่สุด
            </p>
          </>
        ) : status === "unsupported" ? (
          <>
            <h1 className="mb-2 text-xl font-semibold">เบราว์เซอร์ไม่รองรับการระบุตำแหน่ง</h1>
            <p className="mb-6 text-sm text-muted-foreground">
              อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับ GPS/Geolocation จึงไม่สามารถแสดงสถานีที่ใกล้คุณได้
              กรุณาเปิดผ่านเบราว์เซอร์อื่น หรือเข้าสู่ระบบด้วยบัญชีผู้ใช้
            </p>
          </>
        ) : (
          <>
            <h1 className="mb-2 text-xl font-semibold">ต้องการสิทธิ์เข้าถึงตำแหน่ง</h1>
            <p className="mb-6 text-sm text-muted-foreground">
              บัญชีผู้เยี่ยมชม (Guest) จะแสดงข้อมูลของสถานีที่อยู่ใกล้คุณที่สุดเท่านั้น
              จึงจำเป็นต้องอนุญาตให้เข้าถึงตำแหน่งก่อน หากเผลอกดปฏิเสธไป
              กรุณาเปิดสิทธิ์ตำแหน่งในเบราว์เซอร์แล้วลองใหม่อีกครั้ง
            </p>
          </>
        )}

        {!isBusy && status !== "unsupported" && (
          <Button onClick={retryGeolocation} className="w-full gap-2">
            <LocateFixed className="h-4 w-4" />
            ลองอีกครั้ง
          </Button>
        )}

        <button
          onClick={logout}
          className="mt-4 text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          ออกจากระบบ
        </button>
      </div>
    </div>
  )
}
