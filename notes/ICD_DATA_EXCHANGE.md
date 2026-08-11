# เอกสารควบคุมการเชื่อมต่อระบบ (Interface Control Document — ICD)
## การรับส่งข้อมูลระหว่างระบบของโครงการ WiMaRC

| รายการ | รายละเอียด |
|---|---|
| ชื่อเอกสาร | ICD — การรับส่งข้อมูลระหว่างระบบ (Data Exchange Interface) |
| โครงการ | WiMaRC — ระบบตรวจวัดสภาพอากาศและความชื้นดินเพื่อการเกษตร |
| เวอร์ชันเอกสาร | 1.0 |
| วันที่ | 2026-07-19 |
| สถานะ | ฉบับร่างเพื่อส่งมอบ |
| ระบบอ้างอิง | Server 2 (jasmine) `https://wimarc.in.th` |

> **หมายเหตุความปลอดภัย:** ค่าความลับทั้งหมด (JWT token, API key, รหัสผ่าน, รหัสฐานข้อมูล) ในเอกสารนี้ถูกแทนที่ด้วยตัวอย่าง (`<token>`, `wmk_xxxx`, `********`) — ห้ามใส่ค่าจริงลงในเอกสารที่เผยแพร่

---

## 1. บทนำ

### 1.1 วัตถุประสงค์
เอกสารนี้อธิบายรูปแบบและข้อกำหนดการรับส่งข้อมูลระหว่างส่วนประกอบต่าง ๆ ของระบบ WiMaRC และระบบภายนอกที่มาเชื่อมต่อ เพื่อให้ผู้พัฒนา ผู้ดูแลระบบ และหน่วยงาน/พันธมิตรภายนอก ใช้เป็นข้อกำหนดในการพัฒนาและเชื่อมต่อ (integration contract)

### 1.2 ขอบเขต
ครอบคลุมช่องทางการรับส่งข้อมูล (interface) 3 ช่องทาง:

| รหัส | ช่องทาง | ทิศทาง | โพรโทคอล | การยืนยันตัวตน |
|---|---|---|---|---|
| **A** | ESP Ingest (อุปกรณ์สนาม → เซิร์ฟเวอร์) | เข้า | HTTP POST (form-encoded) | ไม่มี (public, ตาม design) |
| **B** | Frontend ↔ Backend (เว็บแอป) | ภายใน | HTTPS REST/JSON | JWT Bearer |
| **C** | External API (ระบบภายนอก → WiMaRC) | ออก | HTTPS REST/JSON | API Key (`X-Api-Key`) |

### 1.3 คำนิยามและอักษรย่อ

| คำ | ความหมาย |
|---|---|
| API | Application Programming Interface |
| JWT | JSON Web Token — โทเคนยืนยันตัวตนแบบมีลายเซ็น |
| RBAC | Role-Based Access Control — การควบคุมสิทธิ์ตามบทบาท |
| ESP32-CAM / NANO | ไมโครคอนโทรลเลอร์ประจำสถานีในสนาม |
| LoRa | เทคโนโลยีสื่อสารไร้สายระยะไกลระหว่างสถานี |
| ADC | Analog-to-Digital Converter — ค่าดิบจากเซนเซอร์ (raw count) |
| VPD | Vapour Pressure Deficit — ความพร่องแรงดันไอน้ำ (kPa) |
| wimarc_id | รหัสตัวเลขของอุปกรณ์ในฐานข้อมูล legacy (คี่ = สถานีอากาศ, คู่ = สถานีดิน) |

### 1.4 เอกสารอ้างอิง
- `notes/API_ENDPOINTS.md` — รายการ endpoint (ข้อ 8.3.1.2 / 4.5.2)
- `notes/DATA_DICTIONARY_8.3.2.7.md` — พจนานุกรมข้อมูลฐานข้อมูลแอป (ข้อ 8.3.2.7 / 4.6.7)
- `notes/WIMARC-External-API.postman_collection.json` — ชุดทดสอบ External API (Postman)
- `backend/app/main.py`, `backend/app/schemas.py`, `backend/app/models.py` — ซอร์สโค้ด backend
- `/var/www/wimarc/InsertdataW32_main.php`, `_client.php`, `wimarc_ingest_lib.php` — ซอร์ส ingest (PHP)

---

## 2. ภาพรวมสถาปัตยกรรมการเชื่อมต่อ

```
                         [ Interface A ]
  ┌───────────────┐  HTTP POST (form)   ┌──────────────────────┐
  │ อุปกรณ์สนาม     │────────────────────▶│ Apache + PHP ingest   │
  │ ESP32-CAM/NANO │  wimarcID, A–H      │ InsertdataW32_*.php   │
  │ (60 ตัว)       │  src, age           └──────────┬───────────┘
  └───────────────┘                                 │ SQL (pg_query_params)
                                                    ▼
                                        ┌────────────────────────┐
   [ Interface B ]                      │   PostgreSQL 16         │
  ┌───────────┐  HTTPS   ┌───────────┐  │   wimarc_db             │
  │  Browser  │─────────▶│ Next.js   │  │  (updatedata, CAM_main, │
  │ (เว็บแอป)  │◀─────────│  :3000    │  │   CAM_client, sensor,   │
  └───────────┘  JSON    └─────┬─────┘  │   sensor_1min, users…)  │
                     rewrite   │        └────────────┬───────────┘
                    /backend/* ▼                     ▲
                          ┌──────────┐  SQLAlchemy   │
                          │ FastAPI  │───────────────┘
                          │  :8000   │
                          └────┬─────┘
                               ▲  HTTPS + X-Api-Key
                               │  [ Interface C ]
                    ┌──────────┴──────────┐
                    │ ระบบภายนอก/พันธมิตร   │
                    │ (External web app)   │
                    └─────────────────────┘
```

**สภาพแวดล้อม (Environment)**

| รายการ | ค่า |
|---|---|
| โดเมนหลัก | `https://wimarc.in.th` (และ `https://www.wimarc.in.th`) |
| Base URL — Backend/External API | `https://www.wimarc.in.th/backend` |
| Base URL — ESP Ingest | `https://wimarc.in.th/InsertdataW32_main.php` และ `.../InsertdataW32_client.php` |
| รูปแบบข้อมูล | JSON (Interface B, C) · form-urlencoded (Interface A) |
| การเข้ารหัสช่องทาง | TLS/HTTPS (ผ่าน Apache + Let's Encrypt) ยกเว้น ingest ที่อุปกรณ์ยิงผ่าน HTTP ตาม design |

---

## 3. Interface A — ESP Ingest (อุปกรณ์สนาม → เซิร์ฟเวอร์)

### 3.1 ภาพรวม
อุปกรณ์ประจำสถานี (ESP32-CAM/NANO) ส่งค่าตรวจวัดเข้าเซิร์ฟเวอร์ผ่านสคริปต์ PHP ที่ Apache เสิร์ฟโดยตรง (ไม่ผ่าน backend proxy) รองรับการ **สำรองข้อมูลข้ามอุปกรณ์ (LoRa mutual-mirror failover)** — เมื่ออุปกรณ์หนึ่งเงียบ อุปกรณ์คู่จะส่งค่าล่าสุดที่ได้ยินแทน (ไม่รวมรูปภาพ)

### 3.2 Endpoint

| รายการ | สถานีอากาศ (main) | สถานีดิน (client) |
|---|---|---|
| URL | `POST https://wimarc.in.th/InsertdataW32_main.php` | `POST https://wimarc.in.th/InsertdataW32_client.php` |
| Method | POST (ingest) / GET (liveness) | POST (ingest) / GET (liveness) |
| Content-Type | `application/x-www-form-urlencoded` | `application/x-www-form-urlencoded` |
| GET response (liveness) | `"Main Station Active"` | `"Client Station Active"` |

> **สำคัญ:** ตารางปลายทางถูกกำหนดจาก **ประเภทจริงของ `wimarcID`** (คี่ = อากาศ, คู่ = ดิน) ไม่ใช่จากชื่อสคริปต์ที่รับ POST — เพื่อให้ข้อมูลที่ relay ข้ามอุปกรณ์ลงตารางถูกต้อง (`wimarc_id % 2`)

### 3.3 พารามิเตอร์ที่อุปกรณ์ส่ง (POST fields)

| Field | ชนิด | จำเป็น | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|---|---|
| `wimarcID` | integer | ✅ | — | รหัสอุปกรณ์ (ถ้าไม่ส่ง → `"Error: Missing ID"`) |
| `A`–`H` | string | ❌ | `'0'` | ค่าดิบเซนเซอร์ 8 ช่อง (ความหมายตาม §3.4) |
| `src` | string | ❌ | `'direct'` | ที่มาข้อมูล: `direct` = อุปกรณ์ตนเองส่ง, `relay_via_<id>` = อุปกรณ์อื่นส่งแทน |
| `age` | integer | ❌ | `0` | วินาทีนับจากที่ได้ยินต้นทางผ่าน LoRa ล่าสุด (relay เท่านั้น) |

> อุปกรณ์เฟิร์มแวร์เดิมที่ไม่ส่ง `src`/`age` จะใช้ค่าเริ่มต้น `direct`/`0` — เข้ากันได้ย้อนหลังทั้งหมด

### 3.4 การจับคู่ช่องข้อมูลดิบ (A–H) → ค่าที่วัด

**สถานีอากาศ (main, `wimarc_id` คี่)**

| ช่อง | ค่าที่วัด | สูตรแปลง | หน่วย |
|---|---|---|---|
| `A` | ความชื้นสัมพัทธ์ (Humid) | `(A × 12.5 / 500) − 12.5` | % |
| `B` | อุณหภูมิอากาศ (Temp) | `(B × 21.875 / 500) − 66.87` | °C |
| `C` | ความเข้มแสง (Lux) | `C / 44` | lux |
| `D` | ปริมาณฝน (Rain) | `D / 100` | mm |
| `E` | ความกดอากาศ (Pressure) | ใช้ค่าดิบโดยตรง | hPa |
| `F` | ความเร็วลม (WindS) | `(F > 0) ? (F/100)/6.67 : 0` | m/s |
| `G` | แรงดันแบตเตอรี่ | `G / 1000` | V |
| `H` | ทิศทางลม (WindD) | `H × 360 / 5000` | องศา |

> ค่าที่คำนวณเพิ่ม (derived): **VPD** = `svp × (1 − rh/100)` โดย `svp = 0.6108 × exp(17.27×T/(T+237.3))` หน่วย kPa
> **หมายเหตุ:** ช่อง `G` ต้อง `> 0` จึงจะบันทึกประวัติ (record gate) และค่า `B=0` จะได้อุณหภูมิ −66.87°C ซึ่งเป็นสัญญาณ "ไม่มีค่า/เซนเซอร์หลุด" ไม่ใช่ค่าจริง

**สถานีดิน (client, `wimarc_id` คู่)**

| ช่อง | ค่าที่วัด | สูตรแปลง | หน่วย |
|---|---|---|---|
| `A` | ความชื้นดิน 15 cm (soil_moisture1) | `_adc_to_moisture(A)` | % |
| `B` | อุณหภูมิดิน 15 cm (soil_temperature1) | `_raw_to_soil_temp(B)` | °C |
| `C` | ความชื้นดิน 30 cm (soil_moisture2) | `_adc_to_moisture(C)` | % |
| `D` | อุณหภูมิดิน 30 cm (soil_temperature2) | `_raw_to_soil_temp(D)` | °C |
| `E` | อุณหภูมิดิน 30 cm — เฉพาะ wimarc15c (`wimarc_id`=30) ใช้ช่อง `E` แทน `D` | `_raw_to_soil_temp(E)` | °C |

สูตรแปลงค่าดิน:
- `_adc_to_moisture(adc)`: ถ้า `adc ≤ 0` → ไม่มีค่า (null); มิฉะนั้น `pct = (3800 − adc)/(3800 − 1200) × 100` จำกัด 0–100%
- `_raw_to_soil_temp(raw)`: ถ้า `raw ≤ 0` → null; มิฉะนั้น `raw / 40`
- ปริมาณฝนของสถานีดินยืมจากสถานีอากาศคู่กัน (`wimarc_id − 1`, จับคู่เวลา ±10 นาที)

### 3.5 ตารางปลายทางและกติกาการบันทึก

| ประเภท | ตารางที่เขียน | เงื่อนไข/cadence |
|---|---|---|
| อากาศ (main) | `updatedata` (name=`CAM_main`) | ทุกครั้ง (upsert) |
| | `timer` (name=`main_control`) | เฉพาะ `src=direct` |
| | `CAM_main`, `sensor` | ทุก 10 นาที (`นาที==0 && วินาที<30 && G>0`) |
| | `sensor_1min` | ทุก 1 นาที (`วินาที<30 && G>0`) |
| ดิน (client) | `updatedata` (name=`CAM_client`) | ทุกครั้ง (upsert) |
| | `timer` (name=`client_control`) | เฉพาะ `src=direct` |
| | `CAM_client` | ทุก 10 นาที (`นาที==0 && วินาที<30`) |
| | `sensor_1min` | ทุก 1 นาที (`วินาที<30`) |

**กติกา "direct ชนะ relay":** ทุกการ upsert ใช้เงื่อนไข `ON CONFLICT (wimarc_id, slot) DO UPDATE ... WHERE ตาราง.src <> 'direct' OR EXCLUDED.src = 'direct'` — ข้อมูล direct ทับ relay เสมอ ป้องกันค่าซ้ำ/ค่าเก่าทับค่าจริง (`slot` = timestamp ปัดลงตาม cadence, timezone Asia/Bangkok)

### 3.6 การตอบกลับอุปกรณ์ (response)

- **อากาศ:** `<timer_status><new_record> : Processed : `
  - `timer_status` = คำสั่งควบคุมจากตาราง `timer` เฉพาะที่ขึ้นต้นด้วย `run` หรือ `STOP` (จากนั้น reset เป็น `off:0`); relay จะข้ามการรับคำสั่ง
  - `new_record` = `NewRecord` ที่จังหวะ 10 นาทีเมื่อ `G>0`
- **ดิน:** `<current_status>|<timer_status>|<new_record> : Client_Synced : `
  - `current_status` = ack รอบก่อน (`0`/`1`), `new_record` = `NewRecord_Client`

### 3.7 การยืนยันตัวตนและความปลอดภัย
- **เปิด public ไม่มี auth/shared secret** ตาม design ของอุปกรณ์สนาม — เงื่อนไขเดียวคือมี `wimarcID`
- ทุก query ใช้ **prepared statement (`pg_query_params()`)** ป้องกัน SQL injection แล้ว
- ความยาวคอลัมน์ค่าเซนเซอร์จำกัดที่ `varchar(15)` — payload ยาวเกินจะถูก DB ปฏิเสธ (แถวนั้นไม่บันทึก, มีการตรวจ `$res === false` กันไม่ให้ error ล้ม request)
- ความเสี่ยงที่เหลือ: อุปกรณ์ปลอม/ยิง payload มั่ว (data DoS / ค่าปลอม) — การเพิ่ม per-device secret เป็นงานอนาคต

---

## 4. Interface B — Frontend ↔ Backend (เว็บแอปภายใน)

### 4.1 ภาพรวม
เว็บแอป (Next.js) เรียก REST API ของ FastAPI ผ่าน rewrite `/backend/*` ทุกคำขอแนบ JWT ที่ได้จากการล็อกอิน

- **Base URL:** `https://wimarc.in.th/backend`
- **Auth:** `Authorization: Bearer <token>` (ได้จาก `POST /auth/login`)
- **รูปแบบข้อมูล:** JSON (request + response)

### 4.2 การควบคุมสิทธิ์ (RBAC)

| บทบาท | สิทธิ์ |
|---|---|
| **Admin** | เข้าถึงทุกสถานี + หน้าจัดการทั้งหมด |
| **User** | เข้าถึงเฉพาะสถานีใน `permitted_station_ids`, เขียนได้ |
| **Guest** | จำกัดสถานีเหมือน User, อ่านอย่างเดียว |

ระดับสิทธิ์ในตาราง endpoint: **Public** = ไม่ต้องล็อกอิน · **Auth** = ล็อกอิน (role ใดก็ได้) · **Admin** = เฉพาะ Admin · **No-Guest** = ทุก role ยกเว้น Guest

### 4.3 รายการ Endpoint

**1) Authentication**

| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| POST | `/auth/login` | Public | username+password → JWT (rate limit 5/นาที) |
| POST | `/auth/register` | Public | สมัคร Guest รออนุมัติ (3/นาที) |
| POST | `/auth/google` | Public | แลก Google OAuth token → JWT |

**2) Health**

| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| GET | `/health` | Public | สถานะ pass/fail เท่านั้น |
| GET | `/health/detail` | Auth | รายละเอียดระบบ (CPU/mem/DB) |

**3) Stations**

| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| GET | `/stations` | Auth | รายการสถานี (กรองตามสิทธิ์) |
| GET | `/stations/nearest?lat=&lon=` | Auth | สถานีอากาศใกล้สุด |
| GET | `/stations/{id}` | Auth | รายละเอียดสถานี |
| POST | `/stations` | Admin | สร้างสถานี |
| PUT | `/stations/{id}` | Admin | แก้สถานี |
| DELETE | `/stations/{id}` | Admin | ลบสถานี |

**4) Sensor data / Live**

| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| GET | `/stations/{id}/live` | Auth | ค่า real-time ล่าสุด |
| GET | `/stations/{id}/readings` | No-Guest | ข้อมูลย้อนหลัง |
| POST | `/stations/{id}/readings` | No-Guest | บันทึก reading |

**5) Station images (กล้อง)**

| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| GET | `/stations/{id}/images/today` | No-Guest | รูปวันนี้ทุกชั่วโมง |
| GET | `/stations/{id}/images/latest` | No-Guest | รูปล่าสุด |

**6) Forecast (พยากรณ์อากาศ)**

| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| GET | `/stations/{id}/forecast` | Auth | snapshot ล่าสุด |
| GET | `/stations/{id}/forecast/history` | Auth | พยากรณ์ย้อนหลัง N วัน |
| GET | `/stations/{id}/tmd-forecast` | Auth | พยากรณ์กรมอุตุฯ รายวัน |
| GET | `/stations/{id}/hourly-forecast` | Auth | พยากรณ์รายชั่วโมง |
| GET | `/stations/{id}/tmd-warning` | Auth | ประกาศเตือนภัยกรมอุตุฯ |
| POST | `/admin/forecasts/refresh` | Admin | refresh ทุกสถานี |

**7) Plot activities · 8) Users · 9) SIM payments · 10) System config**

| Method | Path | สิทธิ์ |
|---|---|---|
| GET/POST/PUT/DELETE | `/activities`, `/activities/{id}` | Auth / No-Guest |
| GET/POST/PUT/DELETE | `/users`, `/users/{id}` | Admin |
| GET/POST/PUT/DELETE | `/sim-payments`, `/sim-payments/{id}` | Auth / No-Guest |
| GET | `/config/system` | Auth |
| GET | `/config/stations` · PUT `/config` | Admin |

### 4.4 ตัวอย่าง request/response

**POST /auth/login**
```bash
curl -X POST https://wimarc.in.th/backend/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"********"}'
```
```json
HTTP/1.1 200 OK
{
  "token": "<JWT_TOKEN>",
  "user": {
    "id": "user-admin", "username": "admin", "role": "Admin",
    "full_name": "ผู้ดูแลระบบ", "email": "***@***",
    "is_enabled": true, "permitted_station_ids": []
  }
}
```

**GET /stations/{id}/live** — response (`LiveDataOut`, ทุก field nullable ตามชนิดสถานี)
```json
{
  "last_ping": "2026-07-19T19:51:07", "sensor_time": "2026-07-19T19:51:07",
  "air_temperature": 27.5, "relative_humidity": 85.0, "vpd": 0.52,
  "wind_speed": 0.0, "wind_direction": 267.6, "rainfall": 0.0,
  "atmospheric_pressure": 1007.0, "light_intensity": 0, "battery_voltage": 12.81,
  "soil_moisture1": null, "soil_moisture2": null,
  "soil_temperature1": null, "soil_temperature2": null,
  "image_url": "/media/imgMain/wimarc1/20260719_19_M.jpg", "image_time": "2026-07-19T19:50:00"
}
```

> รายละเอียด request/response schema ครบทุก endpoint และตาราง field ดูใน `notes/API_ENDPOINTS.md` (ข้อ 8.3.2.5)

---

## 5. Interface C — External API (ระบบภายนอก → WiMaRC)

### 5.1 ภาพรวม
ระบบภายนอก/พันธมิตรดึงข้อมูลตรวจวัดและพยากรณ์ผ่าน API ที่ยืนยันตัวตนด้วย **API Key** — เปิดเฉพาะ **สถานีอากาศ (weather) เท่านั้น** สถานีดิน (client, ลงท้าย `c`) ไม่ถูกเปิดเผยผ่านช่องทางนี้

- **Base URL:** `https://www.wimarc.in.th/backend`
- **Auth header:** `X-Api-Key: <api_key>`
- **Method:** ทุก data endpoint เป็น **GET**

### 5.2 การยืนยันตัวตนด้วย API Key

| รายการ | รายละเอียด |
|---|---|
| Header | `X-Api-Key: <key>` (ตรวจแบบไม่สนตัวพิมพ์เล็ก/ใหญ่) |
| รูปแบบ key | `wmk_` + สุ่ม 32 ไบต์ (เช่น `wmk_xxxxxxxxxxxxxxxxxxxx`) |
| การจัดเก็บ | เก็บเฉพาะ SHA-256 hash ในฐานข้อมูล — คืน key เต็มครั้งเดียวตอนสร้าง |
| การหมดอายุ | `expires_at` (null = ไม่หมดอายุ) — หมดอายุ → 401 |
| การบันทึกใช้งาน | อัปเดต `last_used_at` + บันทึก log ทุกครั้ง (path, method, ip) |

**ขอบเขตสิทธิ์ (2 มิติ):**
- **`data_scope`** — ประเภทข้อมูลที่อ่านได้: `"sensor"` และ/หรือ `"forecast"` (ค่าเริ่มต้น `["sensor","forecast"]`) — เรียกนอกขอบเขต → 403
- **`allowed_stations`** — รายการ station id ที่อนุญาต: `null` = ทุกสถานีอากาศ, หรือระบุเป็น list — เรียกสถานีนอก list → 403

### 5.3 Endpoint สำหรับดึงข้อมูล (API Key)

| Method | Path | data_scope | คำอธิบาย |
|---|---|---|---|
| GET | `/stations` | — | รายการสถานีอากาศที่เข้าถึงได้ (บังคับ weather เท่านั้น) |
| GET | `/stations/{id}/readings` | sensor | ข้อมูลย้อนหลังของสถานีอากาศ (ใหม่→เก่า) |
| GET | `/stations/readings/latest` | sensor | ค่าล่าสุดของทุกสถานีที่เข้าถึงได้ (object keyed by station_id) |
| GET | `/stations/{id}/forecast` | forecast | พยากรณ์รายวัน snapshot ล่าสุด |

**พารามิเตอร์ `/stations/{id}/readings`:** `limit` (1–50000, default 100), `days` (1–365, optional), `start_date`/`end_date` (YYYY-MM-DD, optional)

> **หมายเหตุ:** endpoint แบบ live/nearest/tmd/hourly/openmeteo และ forecast-refresh **ไม่เปิดให้ API key** (เฉพาะ JWT ภายใน)

### 5.4 วงจรการขอ/อนุมัติ API Key

**ก) ช่องทางสาธารณะ (ขอเอง):**

| Method | Path | Auth | หมายเหตุ |
|---|---|---|---|
| POST | `/api-key-requests` | Public | ยื่นคำขอ (rate limit 5/ชม.) → สถานะ `pending` |

**ข) ช่องทางผู้ดูแล (Admin, JWT):**

| Method | Path | หมายเหตุ |
|---|---|---|
| GET | `/admin/api-key-requests` | ดูคำขอ (กรอง `?status=`) |
| POST | `/admin/api-key-requests/{id}/approve` | อนุมัติ → สร้าง key คืน key เต็ม |
| POST | `/admin/api-key-requests/{id}/reject` | ปฏิเสธ (ระบุ `reason`) |
| POST | `/admin/api-keys` | สร้าง key ตรง |
| GET | `/admin/api-keys` | รายการ key (ไม่มี plaintext) |
| PATCH | `/admin/api-keys/{id}` | แก้ชื่อ/สถานะ/scope/allowed_stations/expires_at |
| DELETE | `/admin/api-keys/{id}` | ลบถาวร |
| GET | `/admin/api-keys/{id}/usage` | log การใช้งาน |

**ค) พอร์ทัลผู้ใช้ภายนอก (Email-OTP, self-service):**

| Method | Path | Auth | หมายเหตุ |
|---|---|---|---|
| POST | `/portal/send-otp` | Public | ส่ง OTP 6 หลักทางอีเมล (3/ชม.) |
| POST | `/portal/verify-otp` | Public | ยืนยัน OTP → token (อายุ 7 วัน) (10/ชม.) |
| GET | `/portal/me` | Portal | ข้อมูลผู้ใช้ |
| GET/POST/DELETE | `/portal/api-keys` | Portal | จัดการ key ของตนเอง (สูงสุด 5 key ที่ active → เกิน = 429) |
| GET | `/portal/api-keys/{id}/usage` | Portal | log การใช้งาน key |

### 5.5 ตัวอย่าง request/response

**GET /stations** (weather เท่านั้น)
```bash
curl https://www.wimarc.in.th/backend/stations \
  -H "X-Api-Key: wmk_xxxxxxxxxxxxxxxxxxxx"
```
```json
HTTP/1.1 200 OK
[
  {
    "id": "wimarc1", "name": "wimarc01 (อากาศ) — ...", "type": "weather",
    "owner_id": "user-wimarc01", "owner_name": "...",
    "latitude": 12.7324913, "longitude": 101.8517318,
    "status": "online", "last_data_time": "2026-07-06T18:10:03",
    "area": "นายายอาม จ.จันทบุรี", "description": "..."
  }
]
```

**GET /stations/wimarc1/readings?limit=2**
```json
[
  {
    "id": "real-1-2026-07-06-181003", "station_id": "wimarc1",
    "timestamp": "2026-07-06T18:10:03",
    "air_temperature": 29.03, "relative_humidity": 78.35, "light_intensity": 1.36,
    "wind_direction": 130.25, "wind_speed": 0.0, "rainfall": 0.0,
    "atmospheric_pressure": 1008.0, "vpd": 0.869,
    "soil_moisture1": null, "soil_moisture2": null,
    "soil_temperature1": null, "soil_temperature2": null
  }
]
```

**GET /stations/wimarc1/forecast**
```json
[
  {
    "id": "om-wimarc1-2026-07-13-...", "station_id": "wimarc1",
    "forecast_date": "2026-07-13", "temperature": 25.6,
    "rain_probability": 100.0, "rainfall": 46.9,
    "description": "พายุฝนฟ้าคะนอง",
    "latitude": 12.7324913, "longitude": 101.8517318
  }
]
```

**กรณี error:**
```json
401 → {"detail": "Not authenticated"}            // ไม่ส่ง key
401 → {"detail": "Invalid or inactive API key"}  // key ผิด/ปิด
403 → {"detail": "Station not in API key's allowed stations"}
404 → {"detail": "Weather station not found"}    // เรียกสถานีดิน
```

### 5.6 Schema (External API)

| Schema | Field (ชนิด, จำเป็น) |
|---|---|
| `ApiKeyRequestCreate` | `name`(str✅), `email`(str✅), `organization`(str❌), `purpose`(str✅) |
| `ApiKeyCreate` | `name`(str✅), `description`(str❌), `allowed_stations`(list❌ null=ทั้งหมด), `expires_at`(datetime❌ null=ไม่หมดอายุ), `data_scope`(list, default `["sensor","forecast"]`) |
| `ApiKeyOut` | `id, name, description, is_active, allowed_stations, data_scope, created_at, expires_at, last_used_at` |
| `ApiKeyCreateResponse` | = `ApiKeyOut` + `key`(str, plaintext ครั้งเดียว) |
| `PortalSendOtp` | `email`(str✅), `name`(str✅), `organization`(str❌) |
| `PortalVerifyOtp` | `email`(str✅), `otp`(str✅) |
| `ApiKeyUsageLogOut` | `id, api_key_id, path, method, ip_address, timestamp` |

---

## 6. พจนานุกรมข้อมูล (Data Dictionary)

### 6.1 ค่าตรวจวัดที่รับส่ง (sensor fields) พร้อมหน่วย

| Field | ความหมาย | หน่วย | ชนิดสถานี |
|---|---|---|---|
| air_temperature | อุณหภูมิอากาศ | °C | อากาศ |
| relative_humidity | ความชื้นสัมพัทธ์ | % | อากาศ |
| light_intensity | ความเข้มแสง | lux | อากาศ |
| wind_speed | ความเร็วลม | m/s | อากาศ |
| wind_direction | ทิศทางลม | องศา (0–360) | อากาศ |
| rainfall | ปริมาณฝน | mm | อากาศ (ดินยืมจากคู่) |
| atmospheric_pressure | ความกดอากาศ | hPa | อากาศ |
| battery_voltage | แรงดันแบตเตอรี่ | V | อากาศ |
| vpd | ความพร่องแรงดันไอน้ำ | kPa | อากาศ (คำนวณ) |
| soil_moisture1 / soil_moisture2 | ความชื้นดิน 15/30 cm | % | ดิน |
| soil_temperature1 / soil_temperature2 | อุณหภูมิดิน 15/30 cm | °C | ดิน |

> ทุก field เป็น nullable — คืน `null` เมื่อไม่ใช่ชนิดสถานีนั้น หรือเซนเซอร์ไม่มีค่า/หลุด

### 6.2 พจนานุกรมข้อมูลระดับฐานข้อมูล
โครงสร้างตารางฐานข้อมูลแอป (`users`, `stations`, `sensor_readings`, `plot_activities`, `station_images`, `sim_payments` ฯลฯ) ดูรายละเอียดฟิลด์/ชนิด/คีย์ ในเอกสาร **`notes/DATA_DICTIONARY_8.3.2.7.md`** (ข้อ 8.3.2.7 / 4.6.7)

---

## 7. การจัดการข้อผิดพลาด (Error Handling)

รูปแบบ error ทุก endpoint (Interface B, C): `{"detail": "<ข้อความ>"}`

| HTTP | ความหมาย |
|---|---|
| 200 | สำเร็จ |
| 201 | สร้างสำเร็จ |
| 204 | ลบสำเร็จ (ไม่มี body) |
| 400 | คำขอไม่ถูกต้อง |
| 401 | ไม่ได้ยืนยันตัวตน / token-key ผิดหรือหมดอายุ |
| 403 | ไม่มีสิทธิ์ (นอก scope / นอก allowed_stations / Guest write / ไม่ใช่ Admin) |
| 404 | ไม่พบข้อมูล (รวมกรณีเรียกสถานีดินผ่าน API key) |
| 409 | ข้อมูลซ้ำ / สถานะไม่ตรงเงื่อนไข |
| 422 | validation ไม่ผ่าน (เช่น data_scope ไม่ถูกต้อง) |
| 429 | เกิน rate limit |

---

## 8. ข้อจำกัดอัตราการเรียก (Rate Limits)

| Endpoint | ขีดจำกัด |
|---|---|
| POST `/auth/login` | 5 / นาที / IP |
| POST `/auth/register` | 3 / นาที / IP |
| POST `/api-key-requests` | 5 / ชั่วโมง / IP |
| POST `/portal/send-otp` | 3 / ชั่วโมง / IP |
| POST `/portal/verify-otp` | 10 / ชั่วโมง / IP |
| External API data GET (4 endpoint) | ไม่มี rate limit ต่อคำขอ — ควบคุมด้วยโควตา 5 key/ผู้ใช้ (portal) |

> **ข้อสังเกตสำหรับการส่งมอบ:** endpoint ดึงข้อมูลของ External API ปัจจุบันยังไม่มี per-request rate limit — หากต้องการจำกัดการใช้งานต่อ key ควรเพิ่มในรอบพัฒนาถัดไป

---

## 9. การจัดการเวอร์ชันและการเปลี่ยนแปลง (Versioning & Change Control)

- **เวอร์ชัน API:** ปัจจุบันไม่มี path versioning (เช่น `/v1/`) — การเปลี่ยนแปลงที่ breaking ต้องแจ้งผู้เชื่อมต่อล่วงหน้าและปรับเอกสารนี้
- **ความเข้ากันได้ย้อนหลัง (Interface A):** อุปกรณ์เฟิร์มแวร์เก่า/ใหม่ต้องใช้งานร่วมกันได้ (field `src`/`age` เป็น optional)
- **การเพิ่ม field:** field ใหม่ใน response ถือเป็น non-breaking — ผู้เชื่อมต่อควรออกแบบให้ยอมรับ field ที่ไม่รู้จัก
- **การควบคุมเอกสาร:** แก้ไขที่ `notes/ICD_DATA_EXCHANGE.md` เพิ่มเวอร์ชันในตารางส่วนหัวทุกครั้ง

---

## 10. ภาคผนวก

### 10.1 การจับคู่ station id ↔ wimarc_id
- `wimarc{N}` (อากาศ) → `wimarc_id = (N−1)×2 + 1` (คี่) → ตาราง `sensor`/`CAM_main`
- `wimarc{N}c` (ดิน) → `wimarc_id = (N−1)×2 + 2` (คู่) → ตาราง `CAM_client`

### 10.2 รหัสสถานะสถานี
- `online` / `offline` — ตัดสินจาก effective timestamp = `max(updatedata heartbeat, sensor data)` เทียบ threshold 30 นาที

### 10.3 เครื่องมือทดสอบ
- ชุดทดสอบ Postman: `notes/WIMARC-External-API.postman_collection.json` (ตัวอย่างเรียก External API ครบทุก endpoint)
- OpenAPI spec: เปิดชั่วคราวที่ `/backend/openapi.json` โดยตั้ง `ENV=dev` (ปิดใน production ตามการ hardening)

### 10.4 หมายเหตุการสร้างเอกสาร (สำหรับผู้ดูแล)
เอกสารนี้อ้างอิงจากซอร์สโค้ดจริง ณ วันที่จัดทำ หากมีการแก้ไข endpoint/schema/สูตรแปลงค่า ให้ปรับเอกสารและเพิ่มเวอร์ชัน

---

*จบเอกสาร*
