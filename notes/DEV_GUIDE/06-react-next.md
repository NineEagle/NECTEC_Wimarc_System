# บทที่ 06 — React / Next.js เท่าที่ต้องรู้

> อ่าน 30 นาที · บทนี้ยาวที่สุดในเล่ม แต่จ่ายครั้งเดียวใช้ตลอด

ฝั่งหน้าเว็บเขียนด้วย **React** (วิธีเขียนหน้าจอ) บนกรอบงาน **Next.js** (จัดการเรื่อง URL,
การ build, การส่งต่อ API) และเขียนด้วย **TypeScript** (JavaScript ที่ระบุชนิดข้อมูลได้)

บทนี้สอนแค่ 8 เรื่องที่ต้องใช้จริงในโปรเจกต์นี้ ไม่ต้องไปเรียน React ครบทุกหัวข้อก่อน

---

## 1. Component คือฟังก์ชันที่คืนหน้าตาออกมา

```tsx
function Greeting() {
  return <p>สวัสดี WiMaRC</p>
}
```

- ชื่อ component **ต้องขึ้นต้นด้วยตัวใหญ่** เสมอ (`Greeting` ไม่ใช่ `greeting`)
- สิ่งที่หน้าตาเหมือน HTML ใน `return` เรียกว่า **JSX** — เขียน HTML ปนอยู่ในโค้ดได้เลย
- component เอาไปวางในอีก component ได้: `<Greeting />`

## 2. Props คือค่าที่ส่งเข้าไปให้ component

```tsx
function SensorCard({ title, value, unit }: { title: string; value: number; unit: string }) {
  return (
    <div>
      <span>{title}</span>
      <b>{value} {unit}</b>
    </div>
  )
}

// เรียกใช้
<SensorCard title="อุณหภูมิอากาศ" value={31.2} unit="°C" />
```

ปีกกา `{ }` ใน JSX แปลว่า "ตรงนี้เอาค่าจาก JavaScript มาแสดง"
ข้อความธรรมดาไม่ต้องมีปีกกา ตัวเลข/ตัวแปร/นิพจน์ต้องมี

## 3. useState — ค่าที่เปลี่ยนแล้วหน้าจอต้องวาดใหม่

```tsx
const [count, setCount] = useState(0)
// count     = ค่าปัจจุบัน
// setCount  = ฟังก์ชันเปลี่ยนค่า → พอเรียกแล้ว React จะวาดหน้าใหม่ให้เอง
```

🔴 **ห้ามแก้ค่าตรง ๆ** — `count = 5` ไม่ทำให้หน้าจอเปลี่ยน ต้อง `setCount(5)` เท่านั้น

ในหน้าจริงจะเห็นแบบนี้เต็มไปหมด:

```tsx
const [liveData, setLiveData] = useState<LiveData | null>(null)   // ข้อมูลที่ดึงมา
const [isLoading, setIsLoading] = useState(true)                  // กำลังโหลดอยู่ไหม
const [error, setError] = useState("")                            // ข้อความ error
```

## 4. useEffect — สั่งให้ทำอะไรบางอย่างหลังหน้าจอวาดเสร็จ

ใช้สำหรับ "ไปดึงข้อมูลมา" หรือ "ตั้งเวลาให้ทำซ้ำ"

```tsx
useEffect(() => {
  // โค้ดในนี้ทำงานหลังหน้าจอวาดเสร็จ
  getLiveData(stationId).then(setLiveData)
}, [stationId])
//  ▲ กล่องนี้เรียกว่า dependency array
```

กติกาของกล่องท้าย:

| เขียนแบบ | ทำงานเมื่อไหร่ |
|---|---|
| `[]` | ครั้งเดียวตอนเปิดหน้า |
| `[stationId]` | ตอนเปิดหน้า และทุกครั้งที่ `stationId` เปลี่ยน |
| ไม่ใส่เลย | ทุกครั้งที่วาดหน้าใหม่ — **แทบไม่เคยเป็นสิ่งที่ต้องการ ระวังลูปไม่รู้จบ** |

ถ้าต้องเก็บกวาด (เช่นหยุดตัวจับเวลา) ให้ `return` ฟังก์ชันออกมา:

```tsx
useEffect(() => {
  const id = setInterval(() => refresh(), 15000)   // ดึงข้อมูลใหม่ทุก 15 วินาที
  return () => clearInterval(id)                   // ← ทำตอนออกจากหน้า
}, [])
```

## 5. "use client" — บรรทัดแรกที่ขาดไม่ได้

Next.js รัน component บนเซิร์ฟเวอร์เป็นค่าเริ่มต้น แต่ถ้าหน้าไหนต้องใช้ `useState`,
`useEffect`, การกดปุ่ม, หรือ `localStorage` ต้องประกาศบรรทัดแรกสุดของไฟล์ว่า:

```tsx
"use client"
```

**ทุกหน้าในโปรเจกต์นี้เป็น client component** เพราะทุกหน้าต้องอ่าน token จาก localStorage
ถ้าลืมบรรทัดนี้ จะเจอ error ประมาณ `useState only works in a Client Component`

## 6. App Router — 1 โฟลเดอร์ = 1 URL

Next.js ดู URL จาก**โครงสร้างโฟลเดอร์** ไม่มีไฟล์ตั้งค่าเส้นทางแยกต่างหาก

| ไฟล์ | URL ที่ได้ |
|---|---|
| `app/page.tsx` | `/` |
| `app/dashboard/page.tsx` | `/dashboard` |
| `app/admin/users/page.tsx` | `/admin/users` |
| `app/mango/page.tsx` | `/mango` |

ชื่อไฟล์ต้องเป็น `page.tsx` เป๊ะ ๆ และต้อง `export default` ฟังก์ชันออกมา 1 ตัว

ไฟล์พิเศษอื่น: `layout.tsx` (กรอบครอบหน้าลูกทั้งหมด), `loading.tsx` (หน้าจอระหว่างโหลด)

## 7. Tailwind CSS — จัดสไตล์ด้วยชื่อ class

โปรเจกต์นี้ไม่เขียน CSS แยกไฟล์ แต่ใส่ class สำเร็จรูปลงไปในแท็กเลย

```tsx
<div className="flex items-center gap-3 rounded-lg border p-4 text-sm">
```

| class | ความหมาย |
|---|---|
| `flex` | เรียงลูกในแนวนอน |
| `items-center` | จัดกึ่งกลางแนวตั้ง |
| `gap-3` | เว้นช่องระหว่างลูก |
| `p-4` / `px-4` / `py-2` | ระยะขอบใน (ทุกด้าน / ซ้ายขวา / บนล่าง) |
| `rounded-lg` | มุมโค้ง |
| `border` | เส้นขอบ |
| `text-sm` / `text-2xl` | ขนาดตัวอักษร |
| `text-muted-foreground` | สีตัวอักษรจาง (ตัวแปรสีของระบบ) |
| `grid grid-cols-2 md:grid-cols-4` | ตาราง 2 คอลัมน์ จอใหญ่เป็น 4 |
| `hidden md:block` | ซ่อนบนมือถือ แสดงบนจอใหญ่ |

`md:` `lg:` คือ "เมื่อจอกว้างขึ้นให้ใช้ค่านี้แทน" — เขียนหน้าเดียวรองรับทั้งมือถือและจอใหญ่

## 8. shadcn/ui + lucide-react — ชิ้นส่วนสำเร็จรูป

ปุ่ม การ์ด ตาราง กล่องข้อความ ฯลฯ มีให้แล้วใน `components/ui/`

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Thermometer } from "lucide-react"

<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Thermometer className="h-5 w-5" /> อุณหภูมิอากาศ
    </CardTitle>
  </CardHeader>
  <CardContent>31.2 °C</CardContent>
</Card>
```

- `@/` หมายถึงรากโปรเจกต์เสมอ ไม่ต้องนับ `../../` ให้ปวดหัว
- ไอคอนทั้งหมดมาจาก `lucide-react`

🔴 **กับดักที่ทำ build พังบ่อยที่สุด:** ชื่อไอคอนต้องสะกดตรงเป๊ะ (`Grape` ไม่ใช่ `Grapes`)
TypeScript ผิดไม่ทำให้ build ล้ม (เพราะตั้ง `ignoreBuildErrors: true`) แต่**ชื่อไอคอนผิดทำให้ build ล้มแน่นอน**
ตรวจชื่อก่อนได้ด้วย:

```bash
docker run --rm wimarc-frontend node -e \
  "const l=require('lucide-react');console.log(Object.keys(l).filter(k=>/grape/i.test(k)))"
```

---

## กายวิภาคของไฟล์หน้าเว็บ 1 หน้า

ทุกหน้าในโปรเจกต์นี้เรียงเหมือนกันหมด จำลำดับนี้ไว้แล้วอ่านหน้าไหนก็ออก

```tsx
"use client"                                   // ① ประกาศว่าเป็น client component

import { useState, useEffect } from "react"    // ② import: React ก่อน
import { useAuth } from "@/contexts/AuthContext"       //    ตามด้วย context
import { useStation } from "@/contexts/StationContext"
import { getLiveData } from "@/services/sensorService" //    ตามด้วย service
import type { LiveData } from "@/types"                //    ตามด้วยชนิดข้อมูล
import { Card } from "@/components/ui/card"            //    ตามด้วยชิ้นส่วนหน้าจอ
import { Thermometer } from "lucide-react"             //    ปิดท้ายด้วยไอคอน

const POLL_INTERVAL = 15                       // ③ ค่าคงที่ของหน้านี้

export default function DashboardPage() {      // ④ ฟังก์ชันหลักของหน้า
  const { user } = useAuth()                   // ⑤ ดึงสถานะร่วม: ใครล็อกอินอยู่
  const { selectedStation } = useStation()     //    สถานีที่เลือกอยู่

  const [data, setData] = useState<LiveData | null>(null)   // ⑥ สถานะของหน้านี้
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {                            // ⑦ ไปดึงข้อมูลมา
    if (!selectedStation) return
    setIsLoading(true)
    getLiveData(selectedStation.id)
      .then(setData)
      .finally(() => setIsLoading(false))
  }, [selectedStation])

  if (isLoading) return <p>กำลังโหลด...</p>     // ⑧ กรณีพิเศษก่อน แล้วค่อยหน้าหลัก

  return (                                     // ⑨ หน้าตาจริง
    <Card>...</Card>
  )
}
```

🔴 **กฎเหล็กของ React:** `useState` / `useEffect` ต้องอยู่ **บนสุดของฟังก์ชันเสมอ**
ห้ามอยู่ใน `if`, ใน `for`, หรือหลัง `return` — ถ้าฝ่าฝืนจะเจอ error แปลก ๆ ที่หาสาเหตุยากมาก

> **เรื่องจริงจากโปรเจกต์นี้:** เคยมีบั๊กที่วาง `useEffect` ไว้ *ก่อน* บรรทัดที่ประกาศตัวแปรที่มันใช้
> ทำให้ throw `ReferenceError` ทันทีตอนเปิดหน้าแผนที่ ต้องย้ายลงไปหลังการประกาศตัวแปร
> (บันทึกไว้ใน `notes/BUGS.md` ข้อ 27)

---

## Context — สถานะที่ใช้ร่วมกันทุกหน้า

มี 2 ตัว ประกาศครอบไว้ใน `app/layout.tsx` แล้ว ทุกหน้าเรียกใช้ได้เลย

```tsx
const { user, isAuthenticated, logout } = useAuth()
const { allStations, permittedStations, selectedStation, setSelectedStationId } = useStation()
```

| Context | ให้อะไร |
|---|---|
| `AuthContext` | ผู้ใช้ปัจจุบัน, สถานะล็อกอิน, ฟังก์ชัน login/logout, ระบบเตะออกอัตโนมัติเมื่อไม่ขยับ 10 นาที, การเชื่อม Google |
| `StationContext` | รายชื่อสถานีทั้งหมด, สถานีที่ผู้ใช้คนนี้มีสิทธิ์, สถานีที่เลือกอยู่, การหาสถานีใกล้สุดสำหรับ Guest |

**อย่าดึงรายชื่อสถานีเองในหน้าใหม่** ให้ใช้จาก `useStation()` เพราะมันกรองสิทธิ์และเรียงลำดับให้แล้ว

---

## TypeScript เท่าที่ต้องรู้

```ts
const name: string = "wimarc1"        // ข้อความ
const temp: number = 31.2             // ตัวเลข
const ok: boolean = true              // จริง/เท็จ
const list: string[] = ["a", "b"]     // อาร์เรย์
const maybe: number | null = null     // เป็นเลขหรือ null ก็ได้
const opt?: string                    // มีหรือไม่มีก็ได้ (undefined ได้)
```

หน้าตาข้อมูลทุกชนิดของระบบอยู่ใน `types/index.ts` เช่น:

```ts
export interface Station {
  id: string
  name: string
  type: "weather" | "soil"       // เป็นได้แค่ 2 ค่านี้เท่านั้น
  latitude: number
  longitude: number
  status: "online" | "offline"
  lastDataTime: Date | null
  area: string
  description: string
}
```

ประโยชน์จริง: พิมพ์ `station.` ใน VS Code แล้วมันจะเติมชื่อฟิลด์ที่มีให้เลือกให้
และถ้าพิมพ์ผิดจะขีดเส้นแดงทันทีก่อนรัน

> **หมายเหตุ:** โปรเจกต์นี้ตั้ง `typescript: { ignoreBuildErrors: true }` ใน `next.config.mjs`
> แปลว่าเส้นแดงไม่ขัดขวางการ build — เป็นการผ่อนปรนที่ตั้งใจไว้ **แต่อย่าปล่อยเส้นแดงทิ้งไว้**
> เพราะมันคือคำเตือนล่วงหน้าว่าโค้ดจะพังตอนรันจริง
