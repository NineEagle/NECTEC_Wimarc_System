# 8.3.1.9 (ตามข้อ 4.5.9) — เอกสารระบบรับส่งข้อมูลระหว่าง Web Application และฐานข้อมูล

**โครงการ:** WiMaRC — ระบบสถานีตรวจวัดสภาพอากาศและความชื้นดิน
**วันที่จัดทำ:** 26 กรกฎาคม 2569
**อ้างอิงโค้ด:** `backend/app/db.py`, `backend/app/models.py`, `backend/app/main.py`, `/var/www/wimarc/dblink.php`, `/var/www/wimarc/wimarc_ingest_lib.php`

---

## 1. บทนำและขอบเขต

เอกสารนี้อธิบายกลไกการรับส่งข้อมูล (data exchange) ระหว่างชั้น **web application** กับ **ฐานข้อมูล PostgreSQL** ของระบบ WiMaRC โดยครอบคลุมเฉพาะ:

- FastAPI backend (`backend/app/`)
- Next.js frontend (เรียกผ่าน backend เท่านั้น ไม่เชื่อม DB ตรง)
- PHP legacy ingest layer (`/var/www/wimarc/*.php`)

**นอกขอบเขต** (กล่าวถึงเพียงสั้น ๆ ในข้อ 6): External API/API-key portal สำหรับผู้ใช้ภายนอก และการรับข้อมูลจากอุปกรณ์ ESP32-CAM ภาคสนาม ซึ่งมีเอกสารเฉพาะแยกต่างหาก

---

## 2. สถาปัตยกรรมการเชื่อมต่อฐานข้อมูล

| รายการ | รายละเอียด |
|---|---|
| Database engine | PostgreSQL 16 |
| ORM | SQLAlchemy 2.0.36 (`backend/requirements.txt`) |
| DB driver | psycopg2-binary 2.9.10 |
| Physical database | `wimarc_db` ตัวเดียว — แต่แยก **logic** เป็น 2 engine/session |

### 2.1 App DB session (`get_db`)

- ไฟล์: `backend/app/db.py`
- Connection string: อ่านจาก env var `DATABASE_URL` (`create_engine(DATABASE_URL, pool_pre_ping=True)`)
- ใช้กับตาราง app-side ทั้งหมด (users, stations, activities, ฯลฯ — ดูข้อ 4.1)
- อ่าน/เขียนได้ปกติผ่าน ORM

### 2.2 Legacy sensor DB session (`get_wimarc_db`)

- ไฟล์เดียวกัน (`backend/app/db.py`)
- Connection string: อ่านจาก env var `WIMARC_DB_URL` (fallback ในโค้ดเป็นค่า default สำหรับ dev เท่านั้น: `postgresql+psycopg2://********:********@localhost:5433/wimarc_db`)
- ใช้กับตาราง legacy sensor เท่านั้น (`CAM_main`, `CAM_client`, `sensor`, `sensor_1min`, `updatedata` — ดูข้อ 4.2)
- **Read-only จากฝั่ง app** — backend ไม่มี endpoint ใดเขียนกลับเข้าตารางกลุ่มนี้ (การเขียนทำโดย PHP ingest layer เท่านั้น ดูข้อ 2.3)

ทั้งสอง engine สร้างจาก `create_engine(..., pool_pre_ping=True)` แยกกันคนละตัวแปร (`engine` / `wimarc_engine`) และมี `SessionLocal` / `WimarcDBSession` แยกกัน — endpoint ใดต้องใช้ทั้งสองฐานพร้อมกัน (เช่นอ่านค่า live) จะ inject ทั้ง `db: Session = Depends(get_db)` และ `wdb: Session = Depends(get_wimarc_db)` เข้า handler เดียวกัน

**การโหลด credential:** `db.py` เรียก `load_dotenv()` 2 ครั้ง — จาก `backend/.env` ก่อน แล้วจาก `../../.env` (root) ด้วย `override=False` — ค่าที่ตั้งไว้ครั้งแรกจะไม่ถูกทับ ในทางปฏิบัติไฟล์ root `.env` คือค่าที่ใช้งานจริงบน production

### 2.3 PHP legacy → ฐานข้อมูล

ไฟล์ PHP legacy (`/var/www/wimarc/*.php`) เชื่อมต่อฐานข้อมูลโดยตรงด้วย `pg_connect()` ไม่ผ่าน ORM:

```php
// /var/www/wimarc/dblink.php
$conn = pg_connect("
  host=localhost
  port=5432
  dbname=wimarc_db
  user=wimarc_admin
  password=********
");
```

ไฟล์นี้ถูก `include` โดยสคริปต์รับข้อมูลจากอุปกรณ์ (`InsertdataW32_main.php`, `InsertdataW32_client.php` และอื่น ๆ) เพื่อขอ connection handle เดียวกัน

> **หมายเหตุ:** credential ใน `dblink.php` เป็นค่า hardcode ในไฟล์ (ไม่ผ่าน environment variable เหมือนฝั่ง FastAPI) — เป็นข้อจำกัดที่ทราบอยู่แล้วของ legacy layer นี้

---

## 3. วิธีการรับส่งข้อมูล

| วิธี | ใช้กับ | ตัวอย่างจริงในโค้ด |
|---|---|---|
| **ORM CRUD** (SQLAlchemy `Session`) | ตาราง app DB (users/stations/activities/ฯลฯ) | `create_station()` ใน `main.py`: `db.query(Station).filter(...)`, `db.add(station)`, `db.commit()`, `db.refresh(station)` |
| **Raw parameterized SQL** (`sqlalchemy.text()`) | ตาราง legacy sensor DB (อ่านอย่างเดียว) | `_real_readings_from_wimarc_db()` ใน `main.py` (บรรทัด ~448–520): `text("SELECT ... FROM sensor s WHERE s.wimarc_id = :wid ... LIMIT :limit")` แล้ว `wdb.execute(sql, params)` — bind ผ่าน dict `params` เสมอ ไม่ใช้ string concatenation ค่าที่มาจากผู้ใช้ |
| **Raw SQL ฝั่ง app DB** (สำหรับตารางที่สร้างเองตอน startup) | `system_config`, `station_config` | `db.execute(text("SELECT value FROM system_config WHERE key = 'main'"))` |
| **pg_query_params()** (PHP) | เขียนตาราง legacy สำหรับ ingest | `wimarc_ingest_lib.php` → `wimarc_upsert_updatedata()`: `pg_query_params($conn, 'UPDATE updatedata SET ... WHERE wimarc_id=$12 ...', [$date, $time, ..., $device_id, $name])` — placeholder แบบ positional (`$1..$13`) ทั้งหมด |

**Connection pooling / session ต่อ request:**
- ทั้งสอง engine ตั้ง `pool_pre_ping=True` เพื่อตรวจสุขภาพ connection ก่อนใช้งานจริง (กัน connection ที่หลุดไปแล้วจาก DB idle timeout)
- ใช้ SQLAlchemy connection pool มาตรฐาน (ค่า default ของ `create_engine`, ไม่ได้ปรับ `pool_size`/`max_overflow` เพิ่ม)
- FastAPI dependency `get_db()` / `get_wimarc_db()` เปิด session ใหม่ทุก request (`yield db`) และปิดเสมอใน `finally: db.close()` — ไม่มี session ค้างข้าม request

---

## 4. ตารางที่เกี่ยวข้อง

### 4.1 App DB tables (ผ่าน ORM, `backend/app/models.py`)

| ตาราง | ใช้เก็บ |
|---|---|
| `users` | บัญชีผู้ใช้, role, สิทธิ์เข้าถึงสถานี (`permitted_station_ids`) |
| `stations` | ข้อมูลสถานี (พิกัด, ประเภท, เจ้าของ, สถานะ) |
| `sensor_readings` | ค่าตรวจวัด (ฝั่ง app — บันทึกเสริมจาก endpoint `POST /stations/{id}/readings`) |
| `plot_activities` | กิจกรรมแปลง/บันทึกภาคสนาม |
| `station_images` | รูปภาพกล้องสถานี (metadata) |
| `sim_payments` | การชำระค่าซิมการ์ดอุปกรณ์ |
| `weather_forecasts` | พยากรณ์อากาศ (snapshot จาก Open-Meteo) |
| `api_keys`, `api_key_requests`, `external_users`, `api_key_usage_logs`, `email_otps` | ระบบ API key/portal ภายนอก (นอกขอบเขตเอกสารนี้) |
| `system_config`, `station_config` | ค่า config ระบบ/รายสถานี (สร้างด้วย raw SQL ตอน startup ไม่ใช่ ORM model) |

### 4.2 Legacy sensor DB tables (raw SQL เท่านั้น, read-only จาก backend)

| ตาราง | ใช้เก็บ |
|---|---|
| `CAM_main` | ข้อมูลดิบจากสถานีอากาศ (main/odd wimarc_id) |
| `CAM_client` | ข้อมูลดิบจากสถานีดิน (client/even wimarc_id) |
| `sensor` | ข้อมูลอากาศ cadence 10 นาที — ตารางหลักที่ backend อ่านไปแสดงกราฟ/ตารางย้อนหลัง |
| `sensor_1min` | ข้อมูลอากาศ cadence 1 นาที — backend JOIN เฉพาะคอลัมน์ความกดอากาศ (`E`) เพราะ `sensor.Pressure` เก็บค่าผิด |
| `updatedata` | แถวข้อมูล "ล่าสุด" ต่อ 1 อุปกรณ์ (`wimarc_id` + `name`) ใช้เป็นแหล่งข้อมูล live หลัก |
| `wimarc_info` | ตาราง mapping สถานี (ไม่ได้ query ตรงจาก backend — ใช้สูตรคำนวณแทนใน `_station_to_wimarc_id()` โดยอิงโครงสร้างเดิมของตารางนี้: `id=(N-1)*2+1`→main, `id=(N-1)*2+2`→client) |

---

## 5. ความปลอดภัยการเข้าถึงฐานข้อมูล

| มาตรการ | รายละเอียด |
|---|---|
| **Credential ผ่าน environment variable** | ฝั่ง FastAPI: `DATABASE_URL`, `WIMARC_DB_URL` เป็น env var ไม่ hardcode ในโค้ด (ยกเว้น legacy `dblink.php` ที่ยัง hardcode — ดูข้อ 2.3) |
| **จำกัด network access** | `pg_hba.conf` เปิดรับเฉพาะ docker subnet (`172.17.0.0/16` / `172.18.0.0/16`) ด้วย `md5` auth เท่านั้น; UFW ปิด port 5432 จาก Anywhere (`5432 DENY Anywhere`), เปิดเฉพาะ docker subnet — เข้าจากภายนอกต้องผ่าน SSH tunnel |
| **Least privilege ระดับ user** | user `postgres` (superuser) ถูกล็อก shell เป็น `nologin` — เข้าใช้ DB ได้เฉพาะผ่าน `sudo -u postgres psql` บนเครื่อง ไม่มี interactive shell ให้ผู้บุกรุกยึดต่อได้แม้เจาะ credential สำเร็จ |
| **Parameterized query / prepared statement** | FastAPI ใช้ `sqlalchemy.text()` พร้อม named bind (`:wid`, `:limit`, ...) หรือ ORM query เสมอ — ไม่มีจุดใด concatenate string จาก input ผู้ใช้เข้า SQL โดยตรง; PHP ingest layer ใช้ `pg_query_params()` positional placeholder (`$1..$n`) ทุก query ใน `wimarc_ingest_lib.php` |
| **Historical fix ที่เกี่ยวข้อง** | เดิม PHP ingest (`InsertdataW32_main.php`/`_client.php`) เคย insert ด้วย string interpolation ตรง ๆ (SQL injection ได้) — แก้แล้วโดยเปลี่ยนทุก query เป็น `pg_query_params()` (ดู `notes/SECURITY.md` #17) |

---

## 6. ตัวอย่าง Data Flow

### 6.1 อ่านค่าข้อมูล live

```
Browser
  → Next.js apiClient.apiRequest()  (services/apiClient.ts)
  → GET /backend/stations/{id}/live  (Next.js rewrite → FastAPI)
  → FastAPI handler: Depends(get_wimarc_db) → wdb
  → raw parameterized SQL: SELECT ... FROM updatedata WHERE wimarc_id = :wid AND name = :name
    (fallback: CAM_main / CAM_client / sensor ถ้า updatedata ไม่มีข้อมูลสด)
  → map เป็น JSON (snake_case) → services/apiMappers.ts แปลงเป็น camelCase
  → แสดงผลใน dashboard (poll ทุก 60 วิ, cache ฝั่ง client 30 วิ)
```

### 6.2 CRUD ข้อมูลสถานี (เขียน app DB)

```
Next.js (app/admin/.../add-station)
  → POST /backend/stations  (Next.js rewrite → FastAPI)
  → FastAPI create_station(): Depends(get_db) → db
  → ORM: db.query(Station)... → db.add(Station(...)) → db.commit() → db.refresh()
  → INSERT ลงตาราง stations (app DB)
  → คืน StationOut (Pydantic) → frontend
```

### 6.3 (สังเขป) การนำเข้าข้อมูลจากอุปกรณ์ — นอกขอบเขต

ESP32-CAM ยิง HTTP POST ตรงมาที่ `InsertdataW32_main.php` / `InsertdataW32_client.php` (ไม่ผ่าน FastAPI, ไม่มี auth ตาม design เดิมสำหรับอุปกรณ์ภาคสนาม) → เรียกฟังก์ชันใน `wimarc_ingest_lib.php` → `pg_query_params()` เขียนลง `updatedata` / `CAM_main` / `CAM_client` / `sensor` / `sensor_1min` โดยตรง รายละเอียดเพิ่มเติมอยู่ในเอกสาร ingest/ESP32 แยกต่างหาก
