# บทที่ 10 — ฝึก 1: เพิ่มหน้าใหม่พร้อมเมนู

> ทำ 30 นาที · เป็นงานที่ถูกสั่งบ่อยที่สุด

โจทย์: เพิ่มหน้าใหม่ที่ URL `/mango` ชื่อเมนู "แปลงมะม่วง" แสดงรายการสถานีที่ผู้ใช้มีสิทธิ์

การเพิ่มหน้ามี **3 ขั้น** เท่านั้น จำลำดับนี้ไว้ใช้ได้กับทุกหน้า

---

## ขั้นที่ 1 — สร้างไฟล์หน้า

สร้างโฟลเดอร์และไฟล์ `app/mango/page.tsx` ชื่อไฟล์ต้องเป็น `page.tsx` เป๊ะ ๆ

```tsx
"use client"

import { useStation } from "@/contexts/StationContext"
import { useAuth } from "@/contexts/AuthContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Sprout } from "lucide-react"

export default function MangoPage() {
  const { user } = useAuth()
  const { permittedStations, isLoading } = useStation()

  if (isLoading) {
    return <p className="text-muted-foreground">กำลังโหลด...</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sprout className="h-6 w-6" /> แปลงมะม่วง
        </h1>
        <p className="text-muted-foreground">
          สวัสดี {user?.fullName} — คุณมีสิทธิ์ {permittedStations.length} สถานี
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {permittedStations.map((station) => (
          <Card key={station.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span>{station.name}</span>
                <Badge variant={station.status === "online" ? "default" : "secondary"}>
                  {station.status === "online" ? "ออนไลน์" : "ออฟไลน์"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>พื้นที่: {station.area}</p>
              <p>พิกัด: {station.latitude.toFixed(4)}, {station.longitude.toFixed(4)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

สิ่งที่เกิดขึ้นทันที: URL `/mango` ใช้งานได้แล้ว **ยังไม่ต้องแก้ Apache ไม่ต้องแตะ DNS
ไม่ต้องตั้งค่าเส้นทางใด ๆ** เพราะ Next.js อ่านจากโครงสร้างโฟลเดอร์

ทดสอบ (โหมด `pnpm dev`): เปิด `http://localhost:3000/mango`

> **สังเกต 3 จุดในโค้ดนี้**
> 1. `key={station.id}` — เวลาวาดรายการด้วย `.map()` React บังคับให้ทุกชิ้นมี `key` ที่ไม่ซ้ำ
> 2. `permittedStations` มาจาก context จึงกรองสิทธิ์ให้แล้ว ไม่ต้องกรองเอง
> 3. หน้านี้ไม่ต้องเขียนโค้ดเช็กล็อกอินเลย เพราะ `AppShell` จัดการให้ (ดูขั้นที่ 3)

---

## ขั้นที่ 2 — เพิ่มเมนูซ้าย

แก้ `components/layout/AppSidebar.tsx` 2 จุด

**จุดที่ 1 — import ไอคอน** (อยู่ราวบรรทัด 10–25)

```tsx
import {
  LayoutDashboard,
  History,
  ...
  Wrench,
  Sprout,          // ← เพิ่มบรรทัดนี้
} from "lucide-react";
```

**จุดที่ 2 — เพิ่มรายการใน `navItems`** (ราวบรรทัด 52)

```tsx
const navItems: NavItem[] = [
  { href: "/dashboard", label: "สภาวะแวดล้อม", icon: LayoutDashboard },
  { href: "/historical", label: "ข้อมูลย้อนหลัง", icon: History },
  ...
  { href: "/mango", label: "แปลงมะม่วง", icon: Sprout },   // ← เพิ่มบรรทัดนี้
];
```

ลำดับในอาร์เรย์ = ลำดับบนเมนู

### ถ้าอยากให้เห็นเฉพาะ Admin

```tsx
{ href: "/mango", label: "แปลงมะม่วง", icon: Sprout, adminOnly: true },
```

ตัวเลือกที่มีให้ใช้:

| ธง | ผลลัพธ์ |
|---|---|
| ไม่ใส่อะไร | Admin และ User เห็น (Guest ไม่เห็น เพราะ Guest เห็นแค่ `/dashboard`) |
| `adminOnly: true` | เฉพาะ Admin |
| `requiresSimAccess: true` | ทุกคนยกเว้น Guest |

🔴 **การซ่อนเมนูไม่ใช่การรักษาความปลอดภัย** ผู้ใช้ยังพิมพ์ URL เข้าตรงได้
ถ้าหน้านั้นมีข้อมูลที่ต้องหวง ต้องกันที่ endpoint ฝั่ง backend ด้วย `Depends(require_admin)`
และควรกันในหน้าเว็บด้วย:

```tsx
const { user } = useAuth()
if (!canAccessAdminPages(user)) {
  return <p>คุณไม่มีสิทธิ์เข้าหน้านี้</p>
}
```

---

## ขั้นที่ 3 — build แล้ว deploy

```bash
cd /var/www/WiMaRC
docker compose build frontend && docker compose up -d frontend
```

รอประมาณ 1–3 นาที แล้วเปิด `https://www.wimarc.in.th/mango`

🔴 **ไม่ build = ไม่เห็นการเปลี่ยนแปลง** container ของหน้าเว็บไม่มี volume mount
โค้ดถูกคัดลอกเข้า image ตอน build เท่านั้น (นี่คือคำถามอันดับ 1 ของคนใหม่ทุกคน)

---

## กรณีพิเศษ: หน้าที่ไม่ต้องล็อกอิน

ทุกหน้าถูกบังคับให้ล็อกอินโดยอัตโนมัติจาก `components/layout/AppShell.tsx`

```tsx
const PUBLIC_ROUTES = new Set<string>(["/", "/register", "/request-api", "/portal"])
const GUEST_ALLOWED_ROUTES = new Set<string>(["/dashboard"])
```

- อยากให้หน้าใหม่เปิดสาธารณะ → เพิ่ม path ลงใน `PUBLIC_ROUTES` (หน้าจะไม่มีเมนูซ้ายและ header)
- อยากให้ Guest เข้าได้ด้วย → เพิ่มลงใน `GUEST_ALLOWED_ROUTES`

ถ้าไม่เพิ่มอะไรเลย: ผู้ที่ยังไม่ล็อกอินจะถูกส่งกลับหน้า `/` และ Guest จะถูกส่งไป `/dashboard`

---

## 🔴 ชื่อ URL ที่ห้ามใช้

Apache กันเส้นทางของระบบเดิมไว้ไม่ให้ส่งมาที่ Next.js ถ้าตั้งชื่อหน้าชนกับรายการนี้
หน้าจะเปิดไม่ได้และหาสาเหตุยากมาก

```
InsertdataW32*   checkTimer*   uploadCAM*   uploadCAMV*   uploadIMG
view*   dblink*   linenotifySIM   test   export01   createtable   droptable
imgMain/*   imgClient/*   media/*   favicon.ico   api/*   backend/*
```

- `api/` สงวนให้ NextAuth (`/api/auth/*`)
- `backend/` สงวนให้การส่งต่อไป FastAPI

ชื่อไทยหรือชื่อทั่วไปอย่าง `/mango`, `/durian`, `/report` ใช้ได้ปกติ

---

## แบบฝึกเพิ่มเติม

1. เพิ่มปุ่มบนการ์ดแต่ละใบที่ลิงก์ไป `/dashboard?station=<id>` (ใช้ `<Link href=...>` จาก `next/link`)
2. เพิ่มช่องค้นหาที่กรองรายการตามชื่อสถานี (ใช้ `useState` + `.filter()`)
3. ทำให้หน้าแสดงเฉพาะสถานีที่ `status === "online"` พร้อมตัวสลับเปิด/ปิดตัวกรอง
