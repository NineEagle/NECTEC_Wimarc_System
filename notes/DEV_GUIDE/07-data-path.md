# บทที่ 07 — เส้นทางของข้อมูล 1 ค่า

> อ่าน 20 นาที · บทนี้คือหัวใจของทั้งเล่ม

คำถามที่คุณจะต้องตอบได้บ่อยที่สุดคือ **"ตัวเลขบนการ์ดนี้มาจากไหน"**
บทนี้ไล่ตามค่า *อุณหภูมิอากาศ* บนหน้า `/dashboard` ตั้งแต่ฐานข้อมูลจนถึงจอ ทีละสถานี

## แผนภาพเส้นทาง

```
  ขาไป (คำขอ)
  ────────────────────────────────────────────────────────────────────────────►
  app/dashboard      services/            services/         next.config.mjs      backend/app/
  page.tsx           sensorService.ts     apiClient.ts      rewrite              main.py
  useEffect()   →    getLiveData()   →    apiRequest()  →   /backend/*      →    @app.get(
                                          แนบ Bearer token  → http://backend:8000  "/stations/
                                                                                   {id}/live")
                                                                                      │
                                                                                      ▼
                                                                            get_wimarc_db()
                                                                            SELECT จาก sensor_1min
                                                                            + updatedata
  ◄────────────────────────────────────────────────────────────────────────────
  ขากลับ (ข้อมูล)
  <SensorCard>   ←   mapLiveData()    ←   response.json()  ←   JSON  ←   schemas.py
  31.2 °C            camelCase            LiveDataApi          snake_case  LiveDataOut
```

**กฎที่ต้องจำ:** ฝั่ง backend ใช้ `snake_case` (`air_temperature`) ฝั่งหน้าเว็บใช้ `camelCase`
(`airTemperature`) จุดแปลงคือ `services/apiMappers.ts` ที่เดียวเท่านั้น

---

## สถานีที่ 1 — หน้าเว็บสั่งดึงข้อมูล

`app/dashboard/page.tsx` มีตัวจับเวลาดึงข้อมูลใหม่ทุก 15 วินาที

```tsx
const POLL_INTERVAL = 15   // วินาที — เซนเซอร์ส่งมาทุก ~1 นาที ดึงถี่กว่าเพื่อให้ดูสด

useEffect(() => {
  if (!selectedStation) return
  const load = () => getLiveData(selectedStation.id).then(setLiveData)
  load()
  const id = setInterval(load, POLL_INTERVAL * 1000)
  return () => clearInterval(id)
}, [selectedStation])
```

## สถานีที่ 2 — service แปลงคำสั่งเป็น API call

`services/sensorService.ts` — ชั้นนี้บาง ๆ ทำหน้าที่ประกอบ URL และเรียก mapper

```ts
export async function getLiveData(stationId: string): Promise<LiveData> {
  const data = await apiRequest<any>(`/stations/${stationId}/live`)
  return mapLiveData(data)
}
```

**ทุกการเรียก API ในระบบต้องผ่านไฟล์ใน `services/` เท่านั้น** ห้ามเรียก `fetch()` ตรง ๆ ในหน้าเว็บ
(มีข้อยกเว้นเดียวคือการเชื่อม Google ใน `AuthContext.tsx`)

## สถานีที่ 3 — apiClient แนบบัตรผ่านและจัดการ error

`services/apiClient.ts` คือแกนกลางที่ทุกคำขอวิ่งผ่าน ทำ 4 อย่าง:

```ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "/backend"

// ① เติม /backend ข้างหน้า path เสมอ
// ② แนบ token จาก localStorage
const token = localStorage.getItem("wimarc_token")
if (token) requestHeaders.set("Authorization", `Bearer ${token}`)

// ③ ถ้าเจอ 401 = บัตรหมดอายุ → ล้างข้อมูลแล้วเด้งกลับหน้าล็อกอิน
if (response.status === 401) { clearAuthStorage(); window.location.href = "/" }

// ④ ถ้าไม่ ok → โยน ApiError ที่มี status + ข้อความจาก backend
throw new ApiError(errorMessage, response.status, errorInfo)
```

การจัดการ error ในหน้าเว็บจึงเขียนแบบนี้ได้:

```ts
try {
  await createFault(input)
} catch (e) {
  if (e instanceof ApiError && e.status === 403) setError("คุณไม่มีสิทธิ์ในสถานีนี้")
  else setError("บันทึกไม่สำเร็จ")
}
```

🔴 **อย่าหลงกลโค้ดที่ตายแล้ว:** ในไฟล์นี้มีตัวแปร `_cache` และฟังก์ชัน `_cacheTTL()`
ที่ *ดูเหมือน* เป็นระบบแคช แต่ `apiRequest()` **ไม่เคยอ่านหรือเขียนมันเลย**
แปลว่าการเรียก `clearApiCache(...)` ทั้ง 7 จุดในระบบไม่ได้ทำอะไรทั้งสิ้น
อย่าเพิ่มการเรียกแคชโดยหวังว่าจะแก้ปัญหาข้อมูลค้าง และอย่าคิดว่า GET ซ้ำ ๆ ราคาถูก
(ตัวที่ทำงานจริงคือ `services/systemConfigCache.ts` คนละไฟล์กัน)

## สถานีที่ 4 — Next.js ส่งต่อไป backend

เบราว์เซอร์ยิงไปที่ `https://www.wimarc.in.th/backend/stations/wimarc1/live`
Next.js เห็น prefix `/backend/` จึงส่งต่อไป `http://backend:8000/stations/wimarc1/live`
ตามที่ตั้งไว้ใน `next.config.mjs` (`backend` คือชื่อ service ใน docker-compose ซึ่ง Docker
แปลงเป็นเลข IP ให้เอง)

## สถานีที่ 5 — FastAPI รับงาน

`backend/app/main.py` บรรทัดที่ 1886

```python
@app.get("/stations/{station_id}/live", response_model=LiveDataOut)
def get_live_data(
    station_id: str,
    current_user: User = Depends(get_current_user),   # ← ต้องล็อกอินก่อน
    wdb: Session = Depends(get_wimarc_db),            # ← ต่อฐานข้อมูลเซนเซอร์ (อ่านอย่างเดียว)
) -> dict:
```

จากนั้นแปลงรหัสสถานีของเว็บให้เป็นรหัสของระบบเซนเซอร์เดิม:

```python
info = _station_to_wimarc_id(station_id)   # "wimarc1" → (1, "sensor")
wimarc_id, source_table = info             # "wimarc1c" → (2, "CAM_client")
```

แล้วยิง SQL ตรงไปที่ตารางเดิม:

```python
row = wdb.execute(
    text("""SELECT date, time, "Temp", "Humid", "Rain", "WindS", "WindD", "Pressure", "Lux"
            FROM sensor_1min s
            WHERE wimarc_id = :wid
            ORDER BY date DESC, time DESC LIMIT 1"""),
    {"wid": wimarc_id},
).mappings().first()
```

**สังเกตว่าใช้ `:wid` แทนการต่อสตริง** — นี่คือการกันช่องโหว่ SQL injection ห้ามเขียนแบบ
`f"WHERE wimarc_id = {wimarc_id}"` เด็ดขาด

## สถานีที่ 6 — คำนวณค่าที่ไม่ได้เก็บไว้

บางค่าไม่ได้อยู่ในฐานข้อมูล แต่คำนวณสด ๆ ตอนตอบ เช่น VPD:

```python
def _calc_vpd(temp_c, rh):
    """Vapour Pressure Deficit (kPa) จากอุณหภูมิ (°C) และความชื้นสัมพัทธ์ (%)"""
    svp = 0.6108 * math.exp(17.27 * temp_c / (temp_c + 237.3))
    return round(svp * (1.0 - rh / 100.0), 3)
```

และความชื้นดินที่ต้องแปลงจากค่า ADC ดิบ:

```python
_SOIL_DRY_ADC = 3800.0   # ค่าตอนอยู่ในอากาศ = 0 %
_SOIL_WET_ADC = 1200.0   # ค่าตอนแช่น้ำ = 100 %

def _adc_to_moisture(adc):
    if adc is None or adc <= 0: return None          # 0 = สายหลุด ไม่ใช่ดินเปียก 100 %
    if adc > _SOIL_ADC_MAX:     return None          # เกินพิสัย = หัววัดเพี้ยน แสดง "—" แทน
    pct = (_SOIL_DRY_ADC - adc) / (_SOIL_DRY_ADC - _SOIL_WET_ADC) * 100.0
    return round(max(0.0, min(100.0, pct)), 1)
```

> บทเรียนสำคัญจากโค้ดนี้: **ค่าที่ผิดพลาดต้องคืน `None` ไม่ใช่ 0**
> เพราะ 0 บนหน้าจอดูเหมือนข้อมูลจริง ส่วน `None` จะกลายเป็น "—" ที่คนอ่านรู้ว่าไม่มีข้อมูล

## สถานีที่ 7 — Pydantic ตรวจและจัดรูปแบบ JSON ขาออก

`backend/app/schemas.py` กำหนดว่า endpoint นี้ตอบอะไรได้บ้าง

```python
class LiveDataOut(BaseModel):
    last_ping: Optional[datetime] = None
    sensor_time: Optional[datetime] = None
    air_temperature: Optional[float] = None
    relative_humidity: Optional[float] = None
    vpd: Optional[float] = None
    soil_moisture1: Optional[float] = None
    image_url: Optional[str] = None
    ...
```

ประโยชน์: ถ้าโค้ดเผลอใส่ฟิลด์ที่ไม่ได้ประกาศไว้ มันจะไม่หลุดออกไป
และถ้าชนิดข้อมูลผิด FastAPI จะฟ้องทันทีตอนพัฒนา ไม่ใช่ไปพังที่หน้าเว็บ

## สถานีที่ 8 — mapper แปลงกลับเป็นภาษาหน้าเว็บ

`services/apiMappers.ts`

```ts
export function mapLiveData(api: LiveDataApi): LiveData {
  return {
    lastPing: api.last_ping ? new Date(api.last_ping) : null,
    airTemperature: api.air_temperature ?? undefined,
    relativeHumidity: api.relative_humidity ?? undefined,
    vpd: api.vpd ?? undefined,
    soilMoisture1: api.soil_moisture1 ?? undefined,
    ...
  }
}
```

ที่นี่ทำ 2 อย่าง: เปลี่ยนชื่อเป็น camelCase และแปลงข้อความวันที่เป็น `Date` object จริง ๆ

## สถานีที่ 9 — วาดลงการ์ด

```tsx
<SensorCard
  title="อุณหภูมิอากาศ"
  value={liveData?.airTemperature}
  unit="°C"
  icon={Thermometer}
/>
```

`?.` แปลว่า "ถ้า `liveData` เป็น null ก็ไม่ต้องพยายามอ่านต่อ" — กันหน้าขาวตอนข้อมูลยังมาไม่ถึง

---

## สรุปเป็นตาราง: แก้ที่ไหนเมื่ออยากเปลี่ยนอะไร

| อยากเปลี่ยน | แก้ที่ |
|---|---|
| ข้อความหัวการ์ด / หน่วย / ไอคอน | `app/dashboard/page.tsx` |
| ความถี่ในการดึงข้อมูล | `POLL_INTERVAL` ใน `app/dashboard/page.tsx` |
| URL ที่เรียก | `services/sensorService.ts` |
| การแนบ token / จัดการ error กลาง | `services/apiClient.ts` |
| สูตรคำนวณ VPD / ความชื้นดิน | `backend/app/main.py` |
| ตาราง/คอลัมน์ที่ไปอ่าน | คำสั่ง SQL ใน `backend/app/main.py` |
| ฟิลด์ที่ยอมให้ตอบออกไป | `backend/app/schemas.py` |
| ชื่อฟิลด์ฝั่งหน้าเว็บ | `services/apiMappers.ts` + `types/index.ts` |

จำตารางนี้ได้ = บทที่ 11 (เพิ่มค่าใหม่) จะกลายเป็นเรื่องง่ายทันที
