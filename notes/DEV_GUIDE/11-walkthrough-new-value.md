# บทที่ 11 — ฝึก 2: เพิ่มค่าใหม่ 1 ค่า จากฐานข้อมูลถึงหน้าจอ

> ทำ 45 นาที · งานที่ถูกสั่งบ่อยเป็นอันดับ 2

โจทย์: เพิ่มค่า **จุดน้ำค้าง (dew point)** บนหน้า `/dashboard`
เป็นค่าที่คำนวณจากอุณหภูมิและความชื้นสัมพัทธ์ที่มีอยู่แล้ว ไม่ต้องเพิ่มคอลัมน์ในฐานข้อมูล

การเพิ่มค่า 1 ค่าต้องแตะ **6 จุด** เรียงจากหลังไปหน้า (backend ก่อนเสมอ)

| ลำดับ | ไฟล์ | ทำอะไร |
|---|---|---|
| 1 | `backend/app/main.py` | คำนวณค่าและใส่ลงในผลลัพธ์ |
| 2 | `backend/app/schemas.py` | ประกาศให้ค่านี้ออกไปกับ JSON ได้ |
| 3 | `services/apiMappers.ts` | ประกาศชนิดขาเข้า + แปลงเป็น camelCase |
| 4 | `types/index.ts` | ประกาศฟิลด์ใหม่ในชนิดข้อมูลฝั่งหน้าเว็บ |
| 5 | `app/dashboard/page.tsx` | วาดการ์ดแสดงผล |
| 6 | build ทั้ง backend และ frontend | ทำให้มีผลจริง |

> **ทำไมต้องเริ่มจาก backend:** เพราะจะได้ทดสอบด้วย `curl` ได้ทันทีว่าค่ามาจริง
> ก่อนจะไปยุ่งกับหน้าเว็บ ถ้าเริ่มจากหน้าเว็บ เวลาไม่ขึ้นค่าจะแยกไม่ออกว่าใครผิด

---

## จุดที่ 1 — คำนวณค่าใน backend

เปิด `backend/app/main.py` หาฟังก์ชัน `_calc_vpd` (ราวบรรทัด 373) แล้วเพิ่มฟังก์ชันใหม่ต่อท้าย

```python
def _calc_dew_point(temp_c: Optional[float], rh: Optional[float]) -> Optional[float]:
    """จุดน้ำค้าง (°C) จากอุณหภูมิ (°C) และความชื้นสัมพัทธ์ (%) — สูตร Magnus."""
    if temp_c is None or rh is None or rh <= 0:
        return None
    a, b = 17.27, 237.7
    alpha = (a * temp_c) / (b + temp_c) + math.log(rh / 100.0)
    return round((b * alpha) / (a - alpha), 2)
```

จากนั้นหา endpoint `get_live_data` (ราวบรรทัด 1886) ตรงที่มันใส่ค่าลง `result`
แล้วเพิ่มบรรทัดจุดน้ำค้างต่อจาก `vpd`

```python
result.update({
    "sensor_time": ...,
    "air_temperature": temp,
    "relative_humidity": humid,
    ...
    "vpd": _calc_vpd(temp, humid),
    "dew_point": _calc_dew_point(temp, humid),     # ← เพิ่มบรรทัดนี้
})
```

## จุดที่ 2 — ประกาศในสัญญาข้อมูลขาออก

เปิด `backend/app/schemas.py` หา `class LiveDataOut` แล้วเพิ่มฟิลด์

```python
class LiveDataOut(BaseModel):
    ...
    vpd: Optional[float] = None
    dew_point: Optional[float] = None      # ← เพิ่มบรรทัดนี้
```

🔴 **ถ้าลืมขั้นนี้ ค่าจะหายเงียบ ๆ** เพราะ Pydantic ตัดฟิลด์ที่ไม่ได้ประกาศทิ้ง
โดยไม่มี error — เป็นอาการ "ใส่แล้วแต่ไม่มา" ที่คนใหม่หาสาเหตุกันนาน

### ทดสอบก่อนไปต่อ

```bash
docker compose build backend && docker compose up -d backend

TOKEN=<token ของคุณ>
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/stations/wimarc1/live | python3 -m json.tool | grep dew
```

ต้องเห็น `"dew_point": 24.8` (ตัวเลขแล้วแต่สภาพอากาศจริง)
**ถ้ายังไม่เห็น อย่าเพิ่งไปต่อ** — ปัญหาอยู่ในจุดที่ 1 หรือ 2 เท่านั้น

---

## จุดที่ 3 — บอกหน้าเว็บว่า JSON มีฟิลด์นี้

เปิด `services/apiMappers.ts` แก้ 2 ที่

**ก) ชนิดของ JSON ขาเข้า** (หา `interface LiveDataApi`)

```ts
interface LiveDataApi {
  ...
  vpd?: number | null
  dew_point?: number | null      // ← เพิ่ม
}
```

**ข) ฟังก์ชันแปลง** (หา `export function mapLiveData`)

```ts
export function mapLiveData(api: LiveDataApi): LiveData {
  return {
    ...
    vpd: api.vpd ?? undefined,
    dewPoint: api.dew_point ?? undefined,      // ← เพิ่ม (snake_case → camelCase)
  }
}
```

## จุดที่ 4 — ประกาศชนิดข้อมูลฝั่งหน้าเว็บ

เปิด `types/index.ts` หา `interface LiveData` แล้วเพิ่ม

```ts
export interface LiveData {
  ...
  vpd?: number
  dewPoint?: number      // ← เพิ่ม · °C
}
```

ใส่หน่วยไว้ในคอมเมนต์เสมอ ทั้งไฟล์นี้ทำแบบนั้นอยู่แล้ว

## จุดที่ 5 — วาดการ์ดบนหน้าจอ

เปิด `app/dashboard/page.tsx`

**ก) เพิ่มไอคอน** ในกลุ่ม import จาก `lucide-react`

```tsx
import { Thermometer, Droplets, ..., CloudDrizzle } from "lucide-react"
```

**ข) เพิ่มการ์ด** ในบริเวณที่วางการ์ดค่าอื่น ๆ

```tsx
<SensorCard
  title="จุดน้ำค้าง"
  value={liveData?.dewPoint}
  unit="°C"
  icon={CloudDrizzle}
/>
```

ดูรูปแบบการ์ดที่มีอยู่ในไฟล์แล้วเลียนแบบ อย่าประดิษฐ์รูปแบบใหม่ —
ความสม่ำเสมอสำคัญกว่าความสวยเฉพาะจุด

## จุดที่ 6 — build ทั้งสองฝั่ง

```bash
cd /var/www/WiMaRC
docker compose build backend frontend && docker compose up -d
```

เปิดหน้าเว็บ กด `Ctrl+Shift+R` (โหลดใหม่แบบไม่ใช้แคช) แล้วดูการ์ดใหม่

---

## ถ้าค่าใหม่ต้องอ่านจากฐานข้อมูลจริง

ตัวอย่างข้างบนคำนวณเอาเลยจึงข้ามเรื่องฐานข้อมูลไปได้ ถ้าค่าใหม่มาจากคอลัมน์จริง
จะมีจุดเพิ่มมาอีก 2 จุด **ก่อน** จุดที่ 1

**จุด 0a — เพิ่มคอลัมน์ในคำสั่ง SQL**

```python
row = wdb.execute(text("""
    SELECT date, time, "Temp", "Humid", "Rain", "WindS", "WindD", "Lux",
           "SoilEC"                              -- ← คอลัมน์ใหม่
    FROM sensor_1min s
    WHERE wimarc_id = :wid
    ORDER BY date DESC, time DESC LIMIT 1
"""), {"wid": wimarc_id}).mappings().first()

result["soil_ec"] = _parse_float(row["SoilEC"]) if row["SoilEC"] is not None else None
```

ใช้ `_parse_float()` เสมอ เพราะตารางเดิมเก็บตัวเลขเป็นข้อความ และบางค่ามีเครื่องหมายจุลภาค
(`"1,003.00"` → `1003.0`)

**จุด 0b — ถ้าเป็นตารางของแอปเอง ต้องเพิ่มคอลัมน์จริงด้วย**
ทำตามขั้นตอน 3 ข้อในบทที่ 09 (`models.py` + `ALTER TABLE ... IF NOT EXISTS` ใน `on_startup`)

---

## เช็กลิสต์ก่อนบอกว่าเสร็จ

- [ ] `curl` ที่ endpoint แล้วเห็นฟิลด์ใหม่จริง
- [ ] เปิด DevTools แท็บ Network กด request `live` แล้วเห็นฟิลด์ใหม่ใน response
- [ ] การ์ดขึ้นค่าถูกต้อง และตอนไม่มีข้อมูลแสดง "—" ไม่ใช่ `undefined` หรือ `NaN`
- [ ] ลองสลับไปสถานีดิน (`wimarc1c`) แล้วหน้าไม่พัง (สถานีดินไม่มีค่านี้ ต้องแสดง "—")
- [ ] บันทึกลง `notes/DEPLOYMENT_NOTES.md` ตามรูปแบบในบทที่ 15

---

## เมื่อไม่ขึ้นค่า ให้ไล่ตามลำดับนี้

| ตรวจ | ถ้าไม่ผ่านแปลว่า |
|---|---|
| 1. `curl` endpoint เห็นฟิลด์ไหม | ไม่เห็น → ผิดที่ `main.py` หรือ `schemas.py` |
| 2. DevTools → Network → response มีฟิลด์ไหม | ไม่มี → ยังไม่ได้ build backend ใหม่ |
| 3. `console.log(liveData)` เห็น `dewPoint` ไหม | ไม่เห็น → ผิดที่ `apiMappers.ts` |
| 4. การ์ดขึ้นแต่ว่าง | ชื่อฟิลด์ในหน้าเว็บสะกดไม่ตรงกับ mapper |
| 5. ทุกอย่างถูกแต่หน้าเว็บยังเหมือนเดิม | ยังไม่ได้ build frontend / ต้องล้างแคชเบราว์เซอร์ |
