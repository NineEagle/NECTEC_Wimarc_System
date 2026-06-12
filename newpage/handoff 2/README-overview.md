# เพิ่มหน้า "ภาพรวมสถานี" (Multi-Station Overview) เข้าโปรเจกต์ WiMaRC

หน้านี้แสดงสถานีทั้งหมด (เช่น 30 สถานี) ในมุมมองเดียว — แต่ละสถานีมี **หน่วยหลัก (Main)**
+ **หน่วยลูกข่าย (Client)** สลับดูได้ 3 รูปแบบ (การ์ด / ตาราง / บอร์ด) คลิกเพื่อดูรายละเอียด
ใช้ design token, shadcn/ui และ lucide เดิมของโปรเจกต์ทั้งหมด

---

## 1. คัดลอกไฟล์เข้าโปรเจกต์

วางไฟล์ตามโครงนี้ (path ตรงกับ alias `@/` เดิม):

```
app/overview/page.tsx                          ← หน้าใหม่ (route /overview)
components/overview/overviewTypes.ts           ← types + config เซนเซอร์
components/overview/overviewUtils.ts           ← VPD, compass, format, token classes
components/overview/StationCameraThumb.tsx     ← ภาพกล้อง main/client
components/overview/StationDetailModal.tsx     ← popup รายละเอียด (main + client)
components/overview/StationOverviewCard.tsx    ← layout การ์ด
components/overview/StationsTable.tsx          ← layout ตาราง
components/overview/StationBoard.tsx           ← layout บอร์ด
services/overviewService.ts                    ← จุดต่อข้อมูล (ต้องแก้)
```

> ทุกไฟล์ใช้ `@/components/ui/*`, `@/contexts/StationContext`, `lucide-react` ที่มีอยู่แล้ว
> ไม่ต้องลงไลบรารีเพิ่ม

---

## 2. ต่อข้อมูลจริง — แก้ `services/overviewService.ts`

หน้าเรียก `getOverviewData(stationMeta)` ครั้งเดียวเพื่อเอาข้อมูลสดของทุกสถานี เลือกได้ 2 วิธี:

**วิธี A — มี endpoint รวม** (แนะนำ ถ้ามี): ให้ backend คืนทุกสถานีในครั้งเดียว แล้ว map ผ่าน `toOverviewStation`

**วิธี B — ใช้ `getLiveData(stationId)` เดิม**: เปิด comment บล็อก "Option B" ที่ fan-out ยิงทีละสถานีแบบขนาน

ดูตัวอย่างทั้งสองแบบในไฟล์ (มี comment กำกับ)

---

## 3. เพิ่ม 2 ฟิลด์ใน payload / type `LiveData`

หน้านี้ต้องใช้ฟิลด์ที่ dashboard เดิมยังไม่มี — เพิ่มที่ backend + `@/types`:

| ฟิลด์ | ชนิด | หมายเหตุ |
|---|---|---|
| `windDirection` | `number` (0–359°) | ทิศทางลม — แสดงเข็มทิศ + ลูกศรหมุน |
| `batteryVoltage` | `number` (โวลต์) | **เป็น V ไม่ใช่ %** สีแดงเมื่อ < 11.6V, ส้ม < 12.0V |
| `clientImageUrl` | `string` | ภาพกล้องหน่วยลูกข่าย (ถ้ามีแยก) |

ถ้ายังไม่มีฟิลด์ไหน หน้าจะแสดง "—" ให้เองโดยไม่พัง

---

## 4. เพิ่มลิงก์เข้าเมนู

ใส่ปุ่ม/ลิงก์ไปที่ `/overview` ใน sidebar หรือ quick-links bar ของ dashboard:

```tsx
<Button asChild variant="outline" size="sm"><Link href="/overview">ภาพรวมทุกสถานี</Link></Button>
```

---

## หมายเหตุการออกแบบ

- **Main = เซนเซอร์อากาศ 8 ตัว** (รวมทิศทางลม + ความกดอากาศ), **Client = เซนเซอร์ดิน 4 ตัว** — แยกรูปกล้องของแต่ละหน่วยใน popup
- การ์ดภาพรวมโชว์ 6 ค่าหลักจาก Main + แถบสรุป "ดิน/โวลต์" ของ Client
- **บอร์ด** เรียงสถานีที่ออฟไลน์/แจ้งเตือน VPD ขึ้นก่อน (เหมาะกับจอ monitor)
- โทน minimal: ใช้สีเน้นเฉพาะค่าผิดปกติ (VPD) — ที่เหลือเป็นตัวเลขสะอาด ๆ
- **ตัดออกตามที่ขอ:** แถบสัญญาณ (signal bars) และข้อความ "อัปเดต x วิที่แล้ว"
- light/dark ใช้ token `--sensor-*` เดิม → สลับธีมได้ทันที (ปุ่มมุมขวาบน หรือใช้ theme provider เดิมแล้วลบปุ่มออกได้)
- polling 15 วินาที + countdown ใช้ pattern เดียวกับ `app/dashboard/page.tsx`

ดีไซน์ที่ใช้อ้างอิงทั้งหมดอยู่ใน prototype: `index.html` (เปิดดูได้เพื่อเทียบหน้าตา)
