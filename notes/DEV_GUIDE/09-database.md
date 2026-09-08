# บทที่ 09 — ฐานข้อมูล 2 ตัว

> อ่าน 20 นาที

ระบบนี้ต่อฐานข้อมูล **2 ทาง** ทั้งที่เป็นฐานข้อมูล PostgreSQL ตัวเดียวกัน
เหตุผลคือแยกความรับผิดชอบ: ตารางของเว็บกับตารางของอุปกรณ์คนละชุด และชุดหลัง **ห้ามเขียน**

| ทาง | ฟังก์ชัน | env | ใช้กับ | สิทธิ์ |
|---|---|---|---|---|
| ฐานข้อมูลของแอป | `get_db()` | `DATABASE_URL` | ผู้ใช้ สถานี กิจกรรม พยากรณ์ API key | อ่าน + เขียน |
| ฐานข้อมูลเซนเซอร์เดิม | `get_wimarc_db()` | `WIMARC_DB_URL` | ข้อมูลดิบจากอุปกรณ์ | **อ่านอย่างเดียว** |

ประกาศไว้ที่ `backend/app/db.py`:

```python
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)

wimarc_engine = create_engine(WIMARC_DB_URL, pool_pre_ping=True)
WimarcDBSession = sessionmaker(bind=wimarc_engine)
```

🔴 **กฎเหล็ก:** ห้ามเขียนลงตารางฝั่งเซนเซอร์เดิมเด็ดขาด เพราะ PHP ฝั่งอุปกรณ์เป็นเจ้าของข้อมูลนั้น
ถ้าเขียนทับ ข้อมูลจริงจากสวนจะเสียหายและกู้ไม่ได้

---

## ตารางของแอป (13 ตาราง — แก้ได้)

ประกาศใน `backend/app/models.py` แต่ละ class คือหนึ่งตาราง

| ตาราง | เก็บอะไร |
|---|---|
| `users` | ผู้ใช้ระบบ, บทบาท, สถานีที่มีสิทธิ์ (`permitted_station_ids` เป็น JSONB) |
| `stations` | ข้อมูลสถานี: ชื่อ พิกัด พื้นที่ เจ้าของ สถานะ |
| `sensor_readings` | ค่าที่เว็บบันทึกเอง (ของจริงจากอุปกรณ์อยู่ในฐานข้อมูลเดิม) |
| `plot_activities` | กิจกรรมแปลง พร้อมรูปแนบไม่เกิน 3 รูป |
| `station_images` | รูปจากกล้อง |
| `sim_payments` | รอบชำระค่าซิมของแต่ละสถานี |
| `weather_forecasts` | พยากรณ์จาก Open-Meteo เก็บทุก 12 ชั่วโมง |
| `station_faults` | บันทึกอุปกรณ์เสีย (คนกรอกเองล้วน) |
| `api_keys` | คีย์สำหรับระบบภายนอก (เก็บเป็นค่าแฮช ไม่เก็บคีย์จริง) |
| `api_key_requests` | คำขอคีย์ที่รออนุมัติ |
| `api_key_usage_logs` | บันทึกการเรียกใช้ของแต่ละคีย์ |
| `external_users` | ผู้ใช้ภายนอกที่ยืนยันตัวด้วย OTP อีเมล |
| `email_otps` | รหัส OTP (เก็บเป็นค่าแฮช พร้อมเวลาหมดอายุ) |

มีอีก 2 ตารางที่สร้างด้วยคำสั่ง SQL ตรง ๆ ตอนสตาร์ท ไม่ได้ประกาศใน `models.py`:
`system_config` (ค่าตั้งค่าระบบทั้งเว็บ) และ `station_config` (ค่าตั้งค่าราย 1 สถานี)

## ตารางเซนเซอร์เดิม (อ่านอย่างเดียว)

| ตาราง | เก็บอะไร | ความถี่ |
|---|---|---|
| `updatedata` | ค่าดิบล่าสุดของทุกบอร์ด ช่อง `A`–`H` + เวลาที่ติดต่อล่าสุด | ~1 นาที |
| `sensor_1min` | ค่าที่ถอดรหัสแล้วของสถานีอากาศ (`Temp`, `Humid`, `Rain`, `WindS`, `WindD`, `Lux`, `E`=ความกดอากาศ) | ~1 นาที |
| `sensor` | เหมือน `sensor_1min` แต่เก็บทุก 10 นาที ใช้ทำกราฟย้อนหลัง | ~10 นาที |
| `CAM_client` | ค่าดิบของสถานีดิน (ความชื้น/อุณหภูมิดิน 2 ระดับ) | ~10 นาที |
| `CAM_main` | ชื่อกลุ่มของบอร์ดหลักที่ใช้อ้างอิงใน `updatedata` | — |
| `wimarc_info` | ทะเบียนบอร์ด: `id`, `set_name`, `type` (`M` = หลัก / `C` = ลูก) | — |

> **ข้อควรรู้:** ค่าความกดอากาศใน `sensor.Pressure` เก็บผิด โค้ดจึงต้อง `LEFT JOIN sensor_1min`
> เพื่อดึงคอลัมน์ `E` มาใช้แทน — เห็นได้ที่ `main.py` บรรทัด ~482 อย่าเผลอ "แก้ให้ง่ายขึ้น"
> โดยตัด JOIN นี้ทิ้ง

## การแมปรหัสสถานี — สูตรที่ต้องจำ

รหัสสถานีของเว็บกับรหัสของอุปกรณ์คนละระบบกัน แปลงด้วย `_station_to_wimarc_id()`

```
wimarc{N}     →  wimarc_id = (N-1)*2 + 1   ตารางที่อ่าน: sensor / sensor_1min
wimarc{N}c    →  wimarc_id = (N-1)*2 + 2   ตารางที่อ่าน: CAM_client
```

ตัวอย่าง:

| รหัสบนเว็บ | wimarc_id | ตาราง | เป็นสถานีอะไร |
|---|---|---|---|
| `wimarc1` | 1 | `sensor` / `sensor_1min` | อากาศ |
| `wimarc1c` | 2 | `CAM_client` | ดิน |
| `wimarc5` | 9 | `sensor` | อากาศ |
| `wimarc10c` | 20 | `CAM_client` | ดิน |

```python
def _station_to_wimarc_id(station_id: str):
    m = re.match(r"wimarc(\d+)c$", station_id)          # ลูก (ดิน)
    if m: return ((int(m.group(1)) - 1) * 2 + 2, "CAM_client")
    m = re.match(r"wimarc(\d+)$", station_id)           # หลัก (อากาศ)
    if m: return ((int(m.group(1)) - 1) * 2 + 1, "sensor")
    return None
```

---

## เปิดดูฐานข้อมูลด้วย psql

```bash
psql -h localhost -U wimarc_admin -d wimarc_db
```

คำสั่งที่ใช้บ่อย (พิมพ์ใน psql):

```sql
\dt                       -- ดูรายชื่อตารางทั้งหมด
\d station_faults         -- ดูโครงสร้างตาราง
\q                        -- ออก

-- ผู้ใช้ทั้งหมดพร้อมบทบาท
SELECT id, username, role, is_enabled FROM users ORDER BY role;

-- สถานีที่ยังส่งข้อมูลอยู่
SELECT id, name, status, last_data_time FROM stations ORDER BY id;

-- ค่าล่าสุดของบอร์ด wimarc_id = 1
SELECT * FROM updatedata WHERE wimarc_id = 1;

-- ค่าเซนเซอร์ 5 แถวล่าสุดของสถานี 1
SELECT date, time, "Temp", "Humid", "Rain"
FROM sensor_1min WHERE wimarc_id = 1
ORDER BY date DESC, time DESC LIMIT 5;

-- นับจำนวนบันทึกอุปกรณ์เสียแยกตามอุปกรณ์
SELECT device, COUNT(*) FROM station_faults GROUP BY device ORDER BY 2 DESC;
```

🔴 **ก่อนพิมพ์ `UPDATE` หรือ `DELETE` ในฐานข้อมูลจริง** ให้รัน `SELECT` ด้วยเงื่อนไขเดียวกันก่อนเสมอ
เพื่อดูว่าจะโดนกี่แถว และควรอยู่ในธุรกรรม:

```sql
BEGIN;
DELETE FROM station_faults WHERE id = 'fault-abc123';
-- ตรวจจำนวนแถวที่ได้ ถ้าถูกต้อง:
COMMIT;
-- ถ้าผิด:
ROLLBACK;
```

---

## วิธีเพิ่มคอลัมน์ใหม่ (สำคัญมาก)

โปรเจกต์นี้ **ไม่ได้ใช้ระบบ migration สำเร็จรูป** (ไม่มี Alembic) ตอนสตาร์ทมันเรียก
`Base.metadata.create_all()` ซึ่ง **สร้างเฉพาะตารางที่ยังไม่มี** และ **ไม่แตะตารางเดิมเลย**

ดังนั้นการเพิ่ม `Column` ใน `models.py` เฉย ๆ ไม่ทำให้คอลัมน์นั้นเกิดขึ้นจริง

**ขั้นตอนที่ถูกต้อง — ทำครบ 3 ข้อ:**

**1) ประกาศใน `models.py`**

```python
class Station(Base):
    ...
    altitude = Column(Float, nullable=True)     # ← คอลัมน์ใหม่
```

**2) เพิ่มคำสั่ง ALTER ใน `on_startup()` ของ `main.py`** (ทำตามแบบที่มีอยู่แล้ว)

```python
try:
    with engine.begin() as conn:
        conn.execute(text(
            "ALTER TABLE stations ADD COLUMN IF NOT EXISTS altitude DOUBLE PRECISION"
        ))
    print("[migration] stations.altitude: ok")
except Exception as e:
    print(f"[migration] stations.altitude: {e}")
```

ต้องมี `IF NOT EXISTS` เสมอ เพราะโค้ดนี้จะถูกรันทุกครั้งที่ backend สตาร์ท

**3) build backend ใหม่แล้วดู log ว่าไม่มี error**

```bash
docker compose build backend && docker compose up -d backend
docker compose logs --tail=50 backend | grep migration
```

ตัวอย่างของจริงที่ทำแบบนี้ไว้แล้วในระบบ: `weather_forecasts.created_at` และ `users.phone`

---

## ข้อควรระวังเรื่องเวลา

- ตารางเซนเซอร์เดิมเก็บ `date` และ `time` **แยกกันเป็นข้อความ** ตามเวลาไทย (UTC+7)
- ตารางของแอปเก็บเป็น `TIMESTAMP WITH TIME ZONE` ตามมาตรฐาน
- โค้ดที่กรองช่วงเวลาจึงต้องบวก 7 ชั่วโมงก่อนเทียบ เห็นได้ที่ `BKK_OFFSET = timedelta(hours=7)`
  ใน `_real_readings_from_wimarc_db()`

ถ้าเจอกราฟที่ข้อมูลเลื่อนไป 7 ชั่วโมง ให้มาดูตรงนี้เป็นที่แรก
