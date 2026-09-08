# บทที่ 08 — FastAPI เท่าที่ต้องรู้

> อ่าน 25 นาที

ฝั่ง backend เขียนด้วย **Python** บนกรอบงาน **FastAPI** ใช้ **SQLAlchemy** คุยกับฐานข้อมูล
และ **Pydantic** ตรวจข้อมูลเข้า-ออก

โค้ดเกือบทั้งหมดอยู่ในไฟล์เดียว: `backend/app/main.py` (3,113 บรรทัด)
ไฟล์ใหญ่แต่เรียงเป็นระเบียบ

## แผนผังของ main.py

| บรรทัดโดยประมาณ | มีอะไร |
|---|---|
| 1–60 | import ทั้งหมด |
| 63–140 | ระบบ JWT, การเข้ารหัสรหัสผ่าน, การจำกัดจำนวนคำขอ |
| 131–140 | `require_admin()`, `require_not_guest()` — ตัวตรวจสิทธิ์ |
| 240–260 | ตัวตรวจสิทธิ์ระดับสถานี `_can_write_station()` |
| 256–270 | สร้าง `app = FastAPI(...)` |
| 334–440 | ฟังก์ชันช่วย: แมปรหัสสถานี, คำนวณ VPD, แปลง ADC → ความชื้นดิน |
| 445–610 | อ่านข้อมูลจริงจากฐานข้อมูลเซนเซอร์เดิม |
| 611–650 | middleware: ตรวจ token, ลบ header ที่บอกชนิดเซิร์ฟเวอร์, CORS |
| 653–700 | งานเบื้องหลัง (พยากรณ์อากาศทุก 12 ชม.) + งานตอนสตาร์ท |
| 876–3113 | **endpoint ทั้ง 64 เส้นทาง** |

หาเส้นทางที่ต้องการได้เร็ว ๆ ด้วย:

```bash
grep -n '^@app\.' backend/app/main.py
```

---

## 1. Endpoint หน้าตาเป็นอย่างไร

```python
@app.get("/stations/{station_id}", response_model=StationOut)
def get_station(
    station_id: str,                              # ← มาจาก URL
    include_all: bool = False,                    # ← มาจาก query string ?include_all=true
    current_user: User = Depends(get_current_user),  # ← ใครเรียก (จาก token)
    db: Session = Depends(get_db),                # ← การเชื่อมฐานข้อมูล
) -> Station:
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    return station
```

องค์ประกอบ 5 อย่าง:

| ส่วน | หน้าที่ |
|---|---|
| `@app.get(...)` | บอกว่า method อะไร path อะไร |
| `{station_id}` ใน path | ค่าที่เปลี่ยนได้ ส่งเข้ามาเป็นพารามิเตอร์ของฟังก์ชัน |
| `response_model=` | รูปแบบ JSON ขาออก (ประกาศใน `schemas.py`) |
| `Depends(...)` | ขอของที่ต้องใช้ FastAPI จัดหาให้อัตโนมัติ |
| `raise HTTPException` | ตอบ error พร้อม status code ที่ถูกต้อง |

## 2. Depends คืออะไร

`Depends` = "ก่อนรันฟังก์ชันนี้ ช่วยเตรียมของให้หน่อย" ในระบบนี้มี 4 ตัวที่ใช้บ่อย

| ตัว | ได้อะไรมา | ล้มเหลวแล้วเกิดอะไร |
|---|---|---|
| `Depends(get_db)` | การเชื่อมฐานข้อมูลของแอป (อ่าน/เขียนได้) | — |
| `Depends(get_wimarc_db)` | การเชื่อมฐานข้อมูลเซนเซอร์เดิม (อ่านอย่างเดียว) | — |
| `Depends(get_current_user)` | object ผู้ใช้ที่ล็อกอินอยู่ | ตอบ 401 |
| `Depends(require_admin)` | ผู้ใช้ที่เป็น Admin เท่านั้น | ตอบ 403 |
| `Depends(require_not_guest)` | ใครก็ได้ที่ไม่ใช่ Guest | ตอบ 403 |

ตัวอย่างจริงจากระบบ:

```python
@app.get("/faults", response_model=List[StationFaultOut])
def list_faults(
    station_id: Optional[str] = None,
    _: User = Depends(require_admin),      # ← หน้านี้ Admin เท่านั้น
    db: Session = Depends(get_db),
):
```

## 3. การยืนยันตัวตน — และกับดักสำคัญ

ระบบมี middleware ตรวจ token ที่ `main.py` บรรทัด 619:

```python
@app.middleware("http")
async def _jwt_auth_middleware(request: Request, call_next):
    path = request.url.path
    if (path in _OPEN_PATHS or ... 
        or request.method == "OPTIONS"
        or request.method == "GET"):        # ← สังเกตบรรทัดนี้ให้ดี
        return await call_next(request)
    # นอกนั้นต้องมี Bearer token ที่ถูกต้อง
```

🔴 **กับดักที่ต้องรู้ก่อนเขียน endpoint ใหม่:**
middleware นี้ **ปล่อยคำขอแบบ GET ผ่านหมดโดยไม่ตรวจ token**
การป้องกัน GET ทั้งหมดมาจาก `Depends(get_current_user)` ที่ประกาศไว้ในแต่ละ endpoint เอง

แปลว่า ถ้าคุณเพิ่ม `@app.get(...)` ใหม่แล้ว **ลืมใส่ `Depends(get_current_user)`
เส้นทางนั้นจะเปิดให้คนทั้งโลกเรียกได้ทันที** โดยไม่มีอะไรฟ้อง

> เขียน endpoint GET ใหม่ทุกครั้ง ให้ถามตัวเองว่า "ใครควรเรียกได้" แล้วใส่ `Depends` ให้ตรงเสมอ

เส้นทางที่ตั้งใจเปิดสาธารณะมีแค่:
`/health`, `/auth/login`, `/auth/google`, `/auth/register`, `/api-key-requests`,
`/portal/send-otp`, `/portal/verify-otp`

## 4. RBAC — สิทธิ์ 3 ระดับ

| บทบาท | เห็นสถานีไหน | ทำอะไรได้ |
|---|---|---|
| **Admin** | ทุกสถานี | ทุกอย่าง รวมหน้า admin ทั้งหมด |
| **User** | เฉพาะที่อยู่ใน `permitted_station_ids` | ดูและแก้ข้อมูลของสถานีตัวเอง |
| **Guest** | เฉพาะที่ได้รับมอบหมาย (ถ้าไม่มี ระบบหาสถานีใกล้สุดจากพิกัด) | ดูอย่างเดียว และเข้าได้แค่หน้า `/dashboard` |

การตรวจสิทธิ์มี 3 ชั้น ต้องมีครบทุกชั้น:

```python
# ชั้นที่ 1 — ระดับ endpoint
def create_fault(current_user: User = Depends(require_admin), ...):

# ชั้นที่ 2 — ระดับรายการข้อมูล (ผู้ใช้คนนี้มีสิทธิ์ในสถานีนี้ไหม)
def _require_write_station(user: User, station_id: str) -> None:
    if not _can_write_station(user, station_id):
        raise HTTPException(status_code=403, detail="No permission for this station")

# ชั้นที่ 3 — ที่มาของข้อมูลต้องมาจาก token ไม่ใช่จาก client
fault = StationFault(
    created_by=current_user.id,             # ← ห้ามรับค่านี้จาก payload เด็ดขาด
    created_by_name=current_user.full_name,
)
```

ฝั่งหน้าเว็บมี `utils/permissions.ts` ที่ตรรกะเหมือนกัน **แต่นั่นเป็นแค่การซ่อนปุ่มให้ดูเรียบร้อย**
ของจริงคือฝั่ง backend เสมอ

## 5. Pydantic schema — ประตูตรวจข้อมูล

`backend/app/schemas.py` มี 3 แบบต่อ 1 เรื่อง

```python
class StationFaultBase(BaseModel):     # ฟิลด์ที่ใช้ร่วมกัน
    station_id: str
    device: str
    symptom: str
    note: Optional[str] = None

class StationFaultCreate(StationFaultBase):   # ขาเข้า ตอนสร้างใหม่
    id: Optional[str] = None

class StationFaultUpdate(BaseModel):          # ขาเข้า ตอนแก้ (ทุกฟิลด์ไม่บังคับ)
    device: Optional[str] = None
    symptom: Optional[str] = None

class StationFaultOut(StationFaultBase):      # ขาออก
    id: str
    created_by_name: str
    created_at: datetime
    occurrence_no: int = 0                    # คำนวณตอนอ่าน ไม่ได้เก็บในตาราง
    model_config = ConfigDict(from_attributes=True)   # ← แปลงจาก object ของ SQLAlchemy ได้
```

ถ้าคนยิงข้อมูลมาไม่ครบหรือผิดชนิด FastAPI ตอบ 422 ให้เองพร้อมบอกว่าฟิลด์ไหนผิด
โดยที่คุณไม่ต้องเขียน if ตรวจเอง

## 6. Model — ตารางในฐานข้อมูล

`backend/app/models.py` หนึ่ง class = หนึ่งตาราง

```python
class StationFault(Base):
    __tablename__ = "station_faults"

    id = Column(String, primary_key=True)
    station_id = Column(String, ForeignKey("stations.id"), index=True, nullable=False)
    device = Column(String, nullable=False, index=True)
    symptom = Column(Text, nullable=False)
    images = Column(JSONB, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
```

การ query ด้วย SQLAlchemy:

```python
db.query(StationFault).all()                                      # ทั้งหมด
db.query(StationFault).filter(StationFault.device == "rain").all() # กรอง
db.query(User).filter(User.id == user_id).first()                  # ตัวแรกหรือ None

db.add(obj); db.commit(); db.refresh(obj)   # เพิ่ม → บันทึก → อ่านค่าที่ DB เติมให้กลับมา
db.delete(obj); db.commit()                 # ลบ
```

🔴 **ลืม `db.commit()` = ข้อมูลไม่ถูกบันทึก** และจะไม่มี error ใด ๆ ฟ้อง

## 7. สิ่งที่ทำงานอยู่เบื้องหลัง

| กลไก | ทำอะไร | ตั้งไว้ที่ |
|---|---|---|
| **Rate limit** | จำกัดจำนวนคำขอต่อ IP กันการยิงถล่ม ตอบ 429 เมื่อเกิน | `slowapi` — `_limiter` |
| **CORS** | อนุญาตเฉพาะโดเมนที่กำหนดใน `CORS_ORIGINS` | middleware |
| **ซ่อน header** | ลบ `Server:` ออกจากทุกคำตอบ ไม่บอกใบ้ชนิดเซิร์ฟเวอร์ | `_remove_server_header` |
| **ปิดหน้า docs** | `/docs`, `/redoc`, `/openapi.json` เปิดเฉพาะตอน `ENV=dev` | ตอนสร้าง `FastAPI(...)` |
| **งานพยากรณ์อากาศ** | ดึง Open-Meteo ทุก 12 ชั่วโมงเก็บลงตาราง | `_daily_forecast_refresh()` |
| **บังคับมี JWT_SECRET** | ถ้าไม่ตั้งค่า backend จะไม่ยอมสตาร์ทเลย | บรรทัด ~80 |

## 8. ขั้นตอนตอนสตาร์ท (`on_startup`)

1. `Base.metadata.create_all()` — สร้าง **ตารางที่ยังไม่มี**
2. รัน `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` ที่เขียนไว้เองทีละคำสั่ง
3. `seed_data()` — ใส่ข้อมูลตั้งต้น 30 สวน **เฉพาะตอนตารางว่างเปล่า**
4. แปลงรหัสผ่านที่ยังเป็นข้อความธรรมดาให้เป็น bcrypt

🔴 **เรื่องสำคัญที่สุดในบทนี้:** `create_all()` สร้างเฉพาะ *ตารางใหม่*
มัน **ไม่เพิ่มคอลัมน์ให้ตารางที่มีอยู่แล้ว** ถ้าคุณเพิ่ม `Column` ใน `models.py` เฉย ๆ
คอลัมน์นั้นจะไม่เกิดขึ้นจริงในฐานข้อมูล และ endpoint จะพังตอนอ่าน
วิธีที่ถูกต้องอยู่ในบทที่ 09

## 9. คำสั่งที่ใช้บ่อยตอนทำงานฝั่ง backend

```bash
# แก้โค้ดแล้วต้อง build ใหม่เสมอ (ไม่มี volume mount)
docker compose build backend && docker compose up -d backend

# ดู log
docker compose logs -f backend

# เข้าไปดูข้างใน container
docker compose exec backend sh

# หา endpoint
grep -n '^@app\.' backend/app/main.py | grep faults
```
