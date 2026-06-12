# เพิ่มหน้า "ตั้งค่าระบบ" (System Config / Admin) เข้าโปรเจกต์ WiMaRC

หน้าตั้งค่าสำหรับ **admin** — แก้สูตรแปลงค่าเซนเซอร์, ช่วงค่าที่ยอมรับ, การแสดงผล/รีเฟรช
(ระดับ Global) และ VPD thresholds + alert limits **แยกรายสถานี** มีแถบ "ยังไม่ได้บันทึก"
แบบ sticky + validation ก่อนเซฟ ใช้ design token, shadcn/ui และ lucide เดิมของโปรเจกต์ทั้งหมด

---

## 1. คัดลอกไฟล์เข้าโปรเจกต์

วางไฟล์ตามโครงนี้ (path ตรงกับ alias `@/` เดิม):

```
app/config/page.tsx                              ← หน้าใหม่ (route /config)
components/config/configTypes.ts                 ← types + แคตตาล็อกเซนเซอร์ + alert rows
components/config/configUtils.ts                 ← convert, evalFormula, defaults, validate, icons, token classes
components/config/configControls.tsx             ← SectionCard, Switch, SegToggle, RangeSlider, NumField
components/config/SensorTag.tsx                   ← chip ไอคอน + ชื่อเซนเซอร์
components/config/ConversionSection.tsx          ← Section 1 — สูตรแปลงค่า + preview
components/config/ValidRangeSection.tsx           ← Section 2 — ช่วงค่าที่ยอมรับ
components/config/DisplaySection.tsx              ← Section 3 — gap threshold + refresh interval
components/config/StationConfigAccordion.tsx     ← Section 4 — VPD + alert รายสถานี
services/configService.ts                        ← จุดต่อข้อมูล (ต้องแก้)
```

> ทุกไฟล์ใช้ `@/components/ui/*` (card, input, button, label, badge, skeleton),
> `@/contexts/StationContext` และ `lucide-react` ที่มีอยู่แล้ว — **ไม่ต้องลงไลบรารีเพิ่ม**
> `Switch / SegToggle / RangeSlider` ทำเองในไฟล์ `configControls.tsx` (โปรเจกต์ยังไม่มี shadcn switch/slider)

---

## 2. ต่อข้อมูลจริง — แก้ `services/configService.ts`

หน้านี้เรียก 3 ฟังก์ชัน — ตอนนี้คืน **ค่าเริ่มต้น (factory defaults)** ไว้ให้หน้าเรนเดอร์ได้เลย
เปลี่ยน body ให้ยิง API จริง (มี comment ตัวอย่าง `fetch` กำกับทุกอัน):

| ฟังก์ชัน | ทำอะไร |
|---|---|
| `getSystemConfig()` | โหลด config ระดับ global (สูตร / ช่วงค่า / การแสดงผล) |
| `getStationConfigs(ids)` | โหลด config รายสถานี → คืนเป็น `Record<stationId, StationConfig>` |
| `saveConfig({ system, stations })` | บันทึกทั้งหมดในครั้งเดียว (admin) — throw ถ้าไม่สำเร็จ |

> สถานีที่ยังไม่เคยตั้งค่าให้ปล่อยว่าง — หน้าจะเติม `defaultStation()` ให้เอง และโชว์ป้าย "ค่าเริ่มต้น"

---

## 3. โครงสร้างข้อมูลที่ persist (`components/config/configTypes.ts`)

```ts
SystemConfig = {
  conversions: { [sensorKey]: { mode: "linear"|"custom", a, b, customFormula, unit } }
  limits:      { [sensorKey]: { min, max } }     // ช่วงค่าที่ยอมรับ (หน่วยหลังแปลง)
  gapThresholdMinutes: number                    // ช่องว่างกราฟเมื่อข้อมูลหาย
  dashboardRefreshSeconds: number | null         // null = ปิด auto-refresh
}

StationConfig = {
  vpdLow: number, vpdHigh: number                // ขอบเขต VPD (kPa)
  alerts: { [alertKey]: { min: number|null, max: number|null, enabled: boolean } }
  configured: boolean                            // false = ยังใช้ค่าเริ่มต้น
}
```

`sensorKey` 10 ตัว + `alertKey` 6 ตัว นิยามไว้ใน `configTypes.ts` (`SENSORS`, `ALERT_ROWS`)
ปรับ default a/b/unit/ช่วงค่าได้ที่นั่นที่เดียว

---

## 4. เพิ่มลิงก์เข้าเมนู (เฉพาะ admin)

ใส่ลิงก์ไปที่ `/config` ใน sidebar / quick-links — แนะนำให้ gate ด้วย role:

```tsx
{user?.role === "admin" && (
  <Button asChild variant="outline" size="sm"><Link href="/config">ตั้งค่าระบบ</Link></Button>
)}
```

ตัว route เองควรกันด้วย middleware/guard ของโปรเจกต์อีกชั้น (หน้านี้ไม่ได้ตรวจสิทธิ์เอง)

---

## หมายเหตุการออกแบบ

- **2 ระดับ:** Section 1–3 = Global (ทุกสถานี), Section 4 = Per-Station — มีป้าย scope กำกับทุกการ์ด
- **Conversion preview** คำนวณสด ๆ ขณะพิมพ์ — สูตร custom รับเฉพาะ `x` + เลข + `+ - * / ( )` (กันโค้ดแปลกปลอม ดู `evalFormula`)
- **Valid range** = ตัวแทน IQR outlier filter; ค่านอกช่วงถูกทำเป็น `null` ก่อนวาดกราฟ (ไม่ทับ raw)
- **แถบ "ยังไม่ได้บันทึก"** เด้งขึ้นเมื่อ state ต่างจาก baseline; กด *ยกเลิก* คืนค่า baseline, กด *บันทึก* ผ่าน `validateSystem()` ก่อน
- **Toast** ทำเป็น inline ในหน้า (ไม่มี dep เพิ่ม) — ถ้ามี `sonner`/`use-toast` อยู่แล้ว สลับไปใช้ของเดิมได้
- VPD band, สี alert ใช้ token `--sensor-*` / สีสถานะเดิม → สลับ light/dark ได้ทันที (ปุ่มมุมขวาบน หรือใช้ theme provider เดิมแล้วลบปุ่มออกได้)
- station list ดึงจาก `StationContext.permittedStations` (เรียงตามเลขท้าย id) — ใช้ field `id / name / province / status`

ดีไซน์อ้างอิงทั้งหมดอยู่ใน prototype: `config.html` (เปิดดูได้เพื่อเทียบหน้าตา)
