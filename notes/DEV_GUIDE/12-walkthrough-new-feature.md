# บทที่ 12 — ฝึก 3: เพิ่มฟีเจอร์ทั้งชุด (เพิ่ม/แก้/ลบ)

> ทำ 2–3 ชั่วโมง · งานใหญ่ที่สุดที่คุณจะเจอ

โจทย์ตัวอย่าง: ทำระบบ **"บันทึกการเก็บเกี่ยว"** — Admin บันทึกได้ว่าสถานีไหน
เก็บเกี่ยวเมื่อไหร่ ได้กี่กิโล พร้อมแก้ ลบ และส่งออก CSV

โครงสร้างนี้เลียนแบบระบบ **"บันทึกอุปกรณ์เสีย"** (`/admin/faults`) ที่ทำไปแล้วจริง
ถ้าติดตรงไหน ให้เปิดไฟล์ของ faults ดูเป็นแม่แบบได้ทันที

## แผนงาน 9 ไฟล์ ทำตามลำดับนี้

| ลำดับ | ไฟล์ | ทำอะไร | ไฟล์แม่แบบ |
|---|---|---|---|
| 1 | `backend/app/models.py` | สร้างตาราง | `class StationFault` |
| 2 | `backend/app/schemas.py` | สัญญาข้อมูลเข้า-ออก | `StationFault*` |
| 3 | `backend/app/main.py` | 4 endpoint + ตัวช่วย | บรรทัด 2241–2340 |
| 4 | `types/index.ts` | ชนิดข้อมูลฝั่งหน้าเว็บ | `StationFault` |
| 5 | `services/apiMappers.ts` | แปลง snake → camel | `mapStationFault` |
| 6 | `services/harvestService.ts` | ฟังก์ชันเรียก API | `faultService.ts` |
| 7 | `app/admin/harvest/page.tsx` | หน้าจอ | `app/admin/faults/page.tsx` |
| 8 | `components/layout/AppSidebar.tsx` | เมนู | — |
| 9 | `services/exportService.ts` | ส่งออก CSV (ถ้าต้องการ) | ฟังก์ชัน export ของ faults |

---

## 1) ตารางในฐานข้อมูล

`backend/app/models.py` — ต่อท้ายไฟล์

```python
class HarvestLog(Base):
    """บันทึกการเก็บเกี่ยวรายครั้ง — คนกรอกเองทั้งหมด ไม่ได้มาจากเซนเซอร์"""

    __tablename__ = "harvest_logs"

    id = Column(String, primary_key=True)
    station_id = Column(String, ForeignKey("stations.id"), index=True, nullable=False)
    harvest_date = Column(Date, nullable=False)
    weight_kg = Column(Float, nullable=False)
    grade = Column(String, nullable=True)            # เกรดผลผลิต
    note = Column(Text, nullable=True)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_by_name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
```

ตารางใหม่ทั้งตารางไม่ต้องเขียน `ALTER TABLE` เพราะ `create_all()` สร้างตารางใหม่ให้อยู่แล้ว
(ต้องเขียน ALTER เฉพาะตอนเพิ่มคอลัมน์ใน**ตารางเดิม**)

## 2) สัญญาข้อมูล

`backend/app/schemas.py`

```python
class HarvestLogBase(BaseModel):
    station_id: str
    harvest_date: date
    weight_kg: float = Field(gt=0, le=100000)     # ต้องมากกว่า 0 และไม่เกิน 100 ตัน
    grade: Optional[str] = None
    note: Optional[str] = None


class HarvestLogCreate(HarvestLogBase):
    id: Optional[str] = None


class HarvestLogUpdate(BaseModel):
    harvest_date: Optional[date] = None
    weight_kg: Optional[float] = Field(default=None, gt=0, le=100000)
    grade: Optional[str] = None
    note: Optional[str] = None


class HarvestLogOut(HarvestLogBase):
    id: str
    created_by: str
    created_by_name: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
```

`Field(gt=0, le=100000)` ทำให้ FastAPI ปฏิเสธค่าติดลบหรือค่าเพี้ยนให้เองด้วย 422
**ตรวจที่ schema ดีกว่าเขียน if ในฟังก์ชัน** เพราะบังคับใช้กับทุกทางเข้า

## 3) Endpoint 4 ตัว

`backend/app/main.py` — วางต่อจากกลุ่ม faults จะหาง่าย
อย่าลืม import ชื่อใหม่ที่ส่วนหัวไฟล์ (`from .models import ... HarvestLog`
และ `from .schemas import ... HarvestLogCreate, HarvestLogOut, HarvestLogUpdate`)

```python
@app.get("/harvests", response_model=List[HarvestLogOut])
def list_harvests(
    station_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),   # ← GET ก็ต้องใส่! middleware ไม่ตรวจให้
    db: Session = Depends(get_db),
):
    q = db.query(HarvestLog)
    if station_id:
        q = q.filter(HarvestLog.station_id == station_id)
    # ผู้ใช้ทั่วไปเห็นเฉพาะสถานีของตัวเอง
    if current_user.role != "Admin":
        q = q.filter(HarvestLog.station_id.in_(current_user.permitted_station_ids or []))
    return q.order_by(HarvestLog.harvest_date.desc()).all()


@app.post("/harvests", response_model=HarvestLogOut, status_code=status.HTTP_201_CREATED)
def create_harvest(
    payload: HarvestLogCreate,
    current_user: User = Depends(require_not_guest),
    db: Session = Depends(get_db),
):
    if not db.query(Station).filter(Station.id == payload.station_id).first():
        raise HTTPException(status_code=404, detail="Station not found")
    _require_write_station(current_user, payload.station_id)      # สิทธิ์ระดับสถานี

    row = HarvestLog(
        id=payload.id or f"harvest-{uuid4().hex[:12]}",
        station_id=payload.station_id,
        harvest_date=payload.harvest_date,
        weight_kg=payload.weight_kg,
        grade=payload.grade,
        note=payload.note,
        created_by=current_user.id,               # ← จาก token เท่านั้น
        created_by_name=current_user.full_name,   # ← ห้ามรับจาก client
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@app.put("/harvests/{harvest_id}", response_model=HarvestLogOut)
def update_harvest(
    harvest_id: str,
    payload: HarvestLogUpdate,
    current_user: User = Depends(require_not_guest),
    db: Session = Depends(get_db),
):
    row = db.query(HarvestLog).filter(HarvestLog.id == harvest_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Harvest log not found")
    _require_write_station(current_user, row.station_id)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)                # อัปเดตเฉพาะฟิลด์ที่ส่งมา
    db.commit()
    db.refresh(row)
    return row


@app.delete("/harvests/{harvest_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_harvest(
    harvest_id: str,
    current_user: User = Depends(require_not_guest),
    db: Session = Depends(get_db),
):
    row = db.query(HarvestLog).filter(HarvestLog.id == harvest_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Harvest log not found")
    _require_write_station(current_user, row.station_id)
    db.delete(row)
    db.commit()
```

### ทดสอบ backend ให้จบก่อนแตะหน้าเว็บ

```bash
docker compose build backend && docker compose up -d backend

TOKEN=<token>
# สร้าง
curl -s -X POST http://localhost:8000/harvests \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"station_id":"wimarc1","harvest_date":"2026-09-08","weight_kg":250.5,"grade":"A"}'

# อ่าน
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/harvests | python3 -m json.tool

# ลบ (ใส่ id ที่ได้จากขั้นสร้าง)
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" http://localhost:8000/harvests/harvest-xxxx -i
```

ต้องได้ 201, 200, และ 204 ตามลำดับ **ทำจนผ่านหมดก่อนค่อยไปต่อ**

## 4) ชนิดข้อมูลฝั่งหน้าเว็บ

`types/index.ts`

```ts
export interface HarvestLog {
  id: string
  stationId: string
  harvestDate: Date
  weightKg: number
  grade?: string
  note?: string
  createdBy: string
  createdByName: string
  createdAt: Date
}
```

## 5) Mapper

`services/apiMappers.ts`

```ts
interface HarvestLogApi {
  id: string
  station_id: string
  harvest_date: string
  weight_kg: number
  grade: string | null
  note: string | null
  created_by: string
  created_by_name: string
  created_at: string
}

export function mapHarvestLog(api: HarvestLogApi): HarvestLog {
  return {
    id: api.id,
    stationId: api.station_id,
    harvestDate: parseDateOnly(api.harvest_date) || new Date(),
    weightKg: api.weight_kg,
    grade: api.grade || undefined,
    note: api.note || undefined,
    createdBy: api.created_by,
    createdByName: api.created_by_name,
    createdAt: new Date(api.created_at),
  }
}
```

## 6) Service

`services/harvestService.ts` (ไฟล์ใหม่)

```ts
import type { HarvestLog } from "@/types"
import { apiRequest, ApiError } from "@/services/apiClient"
import { mapHarvestLog } from "@/services/apiMappers"

export interface HarvestInput {
  stationId: string
  harvestDate: string        // "YYYY-MM-DD"
  weightKg: number
  grade?: string | null
  note?: string | null
}

function toPayload(input: Partial<HarvestInput>): Record<string, unknown> {
  const p: Record<string, unknown> = {}
  if (input.stationId !== undefined)   p.station_id = input.stationId
  if (input.harvestDate !== undefined) p.harvest_date = input.harvestDate
  if (input.weightKg !== undefined)    p.weight_kg = input.weightKg
  if (input.grade !== undefined)       p.grade = input.grade || null
  if (input.note !== undefined)        p.note = input.note || null
  return p
}

export async function getHarvests(stationId?: string): Promise<HarvestLog[]> {
  const rows = await apiRequest<any[]>("/harvests", {
    query: stationId ? { station_id: stationId } : undefined,
  })
  return rows.map(mapHarvestLog)
}

export async function createHarvest(input: HarvestInput): Promise<HarvestLog> {
  const created = await apiRequest<any>("/harvests", { method: "POST", body: toPayload(input) })
  return mapHarvestLog(created)
}

export async function updateHarvest(id: string, updates: Partial<HarvestInput>) {
  const updated = await apiRequest<any>(`/harvests/${id}`, { method: "PUT", body: toPayload(updates) })
  return mapHarvestLog(updated)
}

export async function deleteHarvest(id: string): Promise<boolean> {
  try {
    await apiRequest<void>(`/harvests/${id}`, { method: "DELETE" })
    return true
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return false
    throw e
  }
}
```

**สังเกตรูปแบบ `toPayload`** — แปลง camelCase กลับเป็น snake_case ตอนส่งออก
และใส่เฉพาะฟิลด์ที่ถูกกำหนดมาจริง เพื่อให้ `PUT` แก้เฉพาะสิ่งที่เปลี่ยน

## 7) หน้าจอ

`app/admin/harvest/page.tsx` โครงขั้นต่ำ

```tsx
"use client"

import { useEffect, useState } from "react"
import { useStation } from "@/contexts/StationContext"
import { getHarvests, createHarvest, deleteHarvest } from "@/services/harvestService"
import type { HarvestLog } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

export default function HarvestPage() {
  const { permittedStations } = useStation()
  const { toast } = useToast()
  const [rows, setRows] = useState<HarvestLog[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = () => {
    setIsLoading(true)
    getHarvests()
      .then(setRows)
      .catch(() => toast({ title: "โหลดข้อมูลไม่สำเร็จ", variant: "destructive" }))
      .finally(() => setIsLoading(false))
  }

  useEffect(load, [])

  const handleDelete = async (id: string) => {
    if (!confirm("ยืนยันการลบรายการนี้?")) return
    await deleteHarvest(id)
    toast({ title: "ลบแล้ว" })
    load()                         // โหลดใหม่จากเซิร์ฟเวอร์ อย่าลบจาก state เอง
  }

  if (isLoading) return <p>กำลังโหลด...</p>

  return (
    <Card>
      <CardHeader><CardTitle>บันทึกการเก็บเกี่ยว</CardTitle></CardHeader>
      <CardContent>
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between border-b py-2">
            <span>{r.stationId} · {r.weightKg} กก. · {r.grade ?? "-"}</span>
            <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}>ลบ</Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
```

**ทำไมต้อง `load()` ใหม่หลังลบ แทนที่จะตัดออกจาก state:** เพราะข้อมูลบางอย่างถูกคำนวณ
ฝั่งเซิร์ฟเวอร์ (เช่นเลขลำดับครั้งที่ของ faults) การโหลดใหม่ทำให้ทุกอย่างตรงกับความจริงเสมอ

ส่วนฟอร์มเพิ่ม/แก้ ให้ทำเป็น dialog แยกไฟล์ตามแบบ `components/admin/UserFormDialog.tsx`
หรือ `components/activities/ActivityFormDialog.tsx`

## 8) เมนู

`components/layout/AppSidebar.tsx` เพิ่มใน `navItems` (ดูบทที่ 10)

```tsx
{ href: "/admin/harvest", label: "บันทึกเก็บเกี่ยว", icon: Package, adminOnly: true },
```

## 9) ส่งออก CSV

`services/exportService.ts` มีตัวช่วยอยู่แล้ว ให้ทำตามรูปแบบเดิม

🔴 **บทเรียนจากบั๊กจริง** (บันทึกไว้ใน `notes/BUGS.md` ข้อ 26): ค่าที่มี **ขึ้นบรรทัดใหม่**
ต้องถูกครอบด้วยเครื่องหมายคำพูดในไฟล์ CSV ไม่ใช่แค่ค่าที่มีจุลภาค
เงื่อนไขที่ถูกต้องคือ `/[",\n\r]/` — ถ้าตรวจแค่จุลภาค ช่องหมายเหตุที่ผู้ใช้กด Enter
จะทำให้ทั้งไฟล์เพี้ยนตั้งแต่แถวนั้นเป็นต้นไป

---

## build ทั้งชุด

```bash
docker compose build backend frontend && docker compose up -d
```

## เช็กลิสต์ก่อนบอกว่าเสร็จ

- [ ] เพิ่ม / แก้ / ลบ ผ่าน UI ได้ครบ และรีเฟรชแล้วข้อมูลยังอยู่
- [ ] ล็อกอินด้วยบัญชี User (ไม่ใช่ Admin) แล้วเห็นเฉพาะสถานีของตัวเอง
- [ ] ล็อกอินด้วย Guest แล้วเข้าหน้านี้ไม่ได้
- [ ] ยิง `curl` โดยไม่มี token → ต้องได้ 401
- [ ] ยิง `curl` ด้วย token ของ User ไปแก้ข้อมูลสถานีที่ไม่มีสิทธิ์ → ต้องได้ 403
- [ ] ส่งค่า `weight_kg: -5` → ต้องได้ 422
- [ ] บันทึกลง `notes/DEPLOYMENT_NOTES.md` พร้อมเลข commit
