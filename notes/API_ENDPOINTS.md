# WiMaRC API — Endpoint List (ข้อ 8.3.1.2 / 4.5.2)

Base URL (Server 2): `https://wimarc.in.th/backend`
Auth: JWT Bearer token (`Authorization: Bearer <token>`) — ได้จาก `POST /auth/login`
สิทธิ์: **Public** = ไม่ต้อง login · **Auth** = ต้อง login (role ใดก็ได้) · **Admin** = เฉพาะ Admin · **No-Guest** = ทุก role ยกเว้น Guest (read/write)

---

## 1. Authentication

| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| POST | `/auth/login` | Public | username+password → JWT (rate limit 5/min) |
| POST | `/auth/register` | Public | สมัคร Guest (รออนุมัติ, rate limit 3/min) |
| POST | `/auth/google` | Public | แลก Google OAuth token → JWT |

## 2. Health

| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| GET | `/health` | Public | สถานะ pass/fail เท่านั้น |
| GET | `/health/detail` | Auth | รายละเอียดระบบ (CPU/mem/DB) |

## 3. Stations

| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| GET | `/stations` | Auth | รายการสถานี (กรองตามสิทธิ์ user) |
| GET | `/stations/nearest?lat=&lon=` | Auth | สถานี weather ใกล้สุด (Guest auto-location) |
| GET | `/stations/{id}` | Auth | รายละเอียดสถานี (เช็ค per-station) |
| POST | `/stations` | Admin | สร้างสถานี |
| PUT | `/stations/{id}` | Admin | แก้สถานี |
| DELETE | `/stations/{id}` | Admin | ลบสถานี |

## 4. Sensor data / Live

| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| GET | `/stations/{id}/live` | Auth | ค่า real-time ล่าสุด |
| GET | `/stations/{id}/readings` | No-Guest | ข้อมูลย้อนหลัง (download/historical) |
| POST | `/stations/{id}/readings` | No-Guest | บันทึก reading |

## 5. Station images (กล้อง)

| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| GET | `/stations/{id}/images/today` | No-Guest | รูปวันนี้ทุกชั่วโมง |
| GET | `/stations/{id}/images/latest` | No-Guest | รูปล่าสุด |

## 6. Forecast (พยากรณ์อากาศ)

| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| GET | `/stations/{id}/forecast` | Auth | Open-Meteo snapshot ล่าสุด |
| GET | `/stations/{id}/forecast/history` | Auth | พยากรณ์ย้อนหลัง N วัน |
| POST | `/stations/{id}/forecast/refresh` | Auth | refresh Open-Meteo |
| GET | `/stations/{id}/openmeteo-forecast` | Public | 7 วัน Open-Meteo (รูปแบบ TMD) |
| GET | `/stations/{id}/tmd-forecast` | Auth | พยากรณ์กรมอุตุฯ รายวัน |
| GET | `/stations/{id}/hourly-forecast` | Auth | พยากรณ์รายชั่วโมง |
| GET | `/stations/{id}/tmd-warning` | Auth | ประกาศเตือนภัยกรมอุตุฯ |
| POST | `/admin/forecasts/refresh` | Admin | refresh forecast ทุกสถานี |

## 7. Plot activities (กิจกรรมแปลง)

| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| GET | `/activities` | Auth | รายการกิจกรรม |
| POST | `/activities` | No-Guest | สร้างกิจกรรม |
| PUT | `/activities/{id}` | No-Guest | แก้กิจกรรม |
| DELETE | `/activities/{id}` | No-Guest | ลบกิจกรรม |

## 8. Users (จัดการผู้ใช้)

| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| GET | `/users` | Admin | รายการผู้ใช้ |
| GET | `/users/{id}` | Admin | ผู้ใช้รายคน |
| POST | `/users` | Admin | สร้างผู้ใช้ |
| PUT | `/users/{id}` | Admin | แก้ผู้ใช้ |
| DELETE | `/users/{id}` | Admin | ลบผู้ใช้ |

## 9. SIM payments (จัดการซิม)

| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| GET | `/sim-payments` | Auth | รายการชำระซิม |
| POST | `/sim-payments` | No-Guest | สร้างรายการ |
| PUT | `/sim-payments/{id}` | No-Guest | แก้รายการ |
| DELETE | `/sim-payments/{id}` | No-Guest | ลบรายการ |

## 10. System config

| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| GET | `/config/system` | Auth | ค่า config ระบบ |
| GET | `/config/stations` | Admin | config รายสถานี |
| PUT | `/config` | Admin | บันทึก config |

---

## ตัวอย่าง response จริง (status 200)

### POST /auth/login
**Request:**
```bash
curl -i -X POST https://wimarc.in.th/backend/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"********"}'
```
**Response: `HTTP/1.1 200 OK`**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-admin",
    "username": "admin",
    "role": "Admin",
    "full_name": "ผู้ดูแลระบบ",
    "email": "***@***",
    "is_enabled": true,
    "permitted_station_ids": [...]
  }
}
```

### GET /stations (ต้องมี token)
**Request:**
```bash
curl -i https://wimarc.in.th/backend/stations \
  -H "Authorization: Bearer <TOKEN>"
```
**Response: `HTTP/1.1 200 OK`** — array ของ station objects

### กรณี credentials ผิด (พิสูจน์ว่ามี auth จริง)
**Response: `HTTP/1.1 401 Unauthorized`**
```json
{"detail": "Invalid credentials"}
```

---

> **หมายเหตุความปลอดภัย:** ในเอกสารจริงต้องเบลอ/ตัด `token` และ `password` ออก (เป็น secret).
> Swagger/ReDoc โดยปกติปิดใน production ตาม security hardening — เปิดชั่วคราวที่ `/backend/docs` ขณะทำเอกสาร 8.3.2.1

---

# รายละเอียด Parameter + Request/Response Schema (ข้อ 8.3.2.5 / 4.6.5)

อ้างอิงจาก `backend/app/schemas.py`. ทุก field ที่ `Optional` = ส่งหรือไม่ก็ได้ (nullable)

## Auth

### POST /auth/login
**Request body** (`AuthLogin`):
| field | type | required | คำอธิบาย |
|---|---|---|---|
| username | string | ✅ | ชื่อผู้ใช้ |
| password | string | ✅ | รหัสผ่าน |

**Response 200** (`LoginResponse`): `{ token: string, user: UserOut }`
**Error:** `401` creds ผิด · `429` เกิน rate limit (5/min)

### POST /auth/register
**Request body** (`RegisterRequest`):
| field | type | required | คำอธิบาย |
|---|---|---|---|
| username | string | ✅ | |
| email | string | ✅ | |
| password | string | ✅ | ≥ 8 ตัวอักษร |
| full_name | string | ❌ | default "" |

**Response 201:** `{ message: "pending", username }` (สร้าง Guest รออนุมัติ)
**Error:** `409` username/email ซ้ำ · `422` password สั้น · `429` rate limit (3/min)

### POST /auth/google
**Request body:** `{ access_token: string }` (Google OAuth token)
**Response 200:** `LoginResponse` · **Error:** `401` token ไม่ถูกต้อง · `403` บัญชีถูกปิด

## Stations

### GET /stations
**Query:** `owner_id` (string, optional), `include_all` (bool, optional)
**Response 200:** `StationOut[]`

### GET /stations/nearest
**Query:** `lat` (float, -90..90, **required**), `lon` (float, -180..180, **required**)
**Response 200:** `StationOut` (สถานี weather ใกล้สุด) · **Error:** `404` ไม่มีสถานี

### POST /stations · PUT /stations/{id}
**Request body** (`StationCreate` / `StationUpdate`):
| field | type | required (Create) | คำอธิบาย |
|---|---|---|---|
| id | string | ❌ | gen ให้ถ้าไม่ส่ง |
| name | string | ✅ | |
| type | string | ✅ | `weather` / `soil` |
| owner_id | string | ❌ | เจ้าของ |
| latitude | float | ✅ | |
| longitude | float | ✅ | |
| status | string | ✅ | `online`/`offline` |
| last_data_time | datetime | ❌ | |
| area | string | ✅ | |
| description | string | ✅ | |

(PUT ทุก field เป็น optional — ส่งเฉพาะที่จะแก้)
**Response:** `StationOut` · **Error:** `403` ไม่ใช่ Admin

### StationOut (response shape)
```
id, name, type, owner_id, owner_name, latitude, longitude,
status, last_data_time, area, description
```

## Sensor / Live

### GET /stations/{id}/live
**Response 200** (`LiveDataOut`):
```
last_ping, sensor_time, air_temperature, relative_humidity,
light_intensity, wind_direction, wind_speed, rainfall,
atmospheric_pressure, battery_voltage, vpd,
soil_moisture1, soil_moisture2, soil_temperature1, soil_temperature2,
image_url, image_time
```
(ทุก field nullable — ขึ้นกับชนิดสถานี weather/soil)

### GET /stations/{id}/readings
**Query:** `limit` (int 1..50000, default 100), `days` (int 1..365, optional), `start_date` (YYYY-MM-DD, optional), `end_date` (YYYY-MM-DD, optional)
**Response 200:** `SensorReadingOut[]` · **Error:** `403` Guest

### POST /stations/{id}/readings
**Request body** (`SensorReadingCreate`): ทุก field ของ sensor (optional) + `id` (optional), `timestamp` (optional)
**Response 201:** `SensorReadingOut` · **Error:** `403` Guest · `404` ไม่มีสถานี

## Activities

### POST /activities · PUT /activities/{id}
**Request body** (`PlotActivityCreate` / `PlotActivityUpdate`):
| field | type | required (Create) | คำอธิบาย |
|---|---|---|---|
| id | string | ❌ | |
| station_id | string | ✅ | |
| date | date | ✅ | |
| activity_type | string | ✅ | |
| description | string | ✅ | |
| created_by | string | ✅ | user id |
| created_by_name | string | ✅ | |
| images | string[] | ❌ | URL รูป |

**Response:** `PlotActivityOut` (+ `created_at`) · **Error:** `403` Guest · `404` ไม่พบ (PUT/DELETE)

## Users (Admin)

### POST /users · PUT /users/{id}
**Request body** (`UserCreate` / `UserUpdate`):
| field | type | required (Create) | คำอธิบาย |
|---|---|---|---|
| id | string | ❌ | |
| username | string | ✅ | |
| password | string | ✅ | |
| role | string | ✅ | `Admin`/`User`/`Guest` |
| full_name | string | ✅ | |
| email | string | ✅ | |
| is_enabled | bool | ❌ | default true |
| permitted_station_ids | string[] | ❌ | |
| phone | string | ❌ | |

**Response:** `UserOut` (ไม่มี password) · **Error:** `403` ไม่ใช่ Admin · `409` ซ้ำ

## SIM payments

### POST /sim-payments · PUT /sim-payments/{id}
**Request body** (`SimPaymentCreate` / `SimPaymentUpdate`):
| field | type | required (Create) | คำอธิบาย |
|---|---|---|---|
| id | string | ❌ | |
| station_id | string | ✅ | |
| station_name | string | ❌ | |
| sim_number | string | ✅ | |
| provider | string | ✅ | |
| amount | float | ❌ | default 0 |
| due_date | date | ❌ | |
| status | string | ❌ | |
| paid_date | date | ❌ | |
| notes | string | ❌ | |

**Response:** `SimPaymentOut` · **Error:** `403` Guest

## Forecast

### GET /stations/{id}/forecast → `WeatherForecastOut[]`
```
id, station_id, forecast_date, temperature, rain_probability, rainfall, description
```
### GET /stations/{id}/forecast/history
**Query:** `days` (int 1..90, default 7) → array `{date, temperature, rainfall, rain_probability, description, snapshot_at}`

---

## รหัสสถานะ HTTP ที่ใช้

| Code | ความหมาย |
|---|---|
| 200 | สำเร็จ |
| 201 | สร้างสำเร็จ |
| 204 | ลบสำเร็จ (ไม่มี body) |
| 401 | ไม่ได้ login / token ผิด-หมดอายุ |
| 403 | ไม่มีสิทธิ์ (Guest write / ไม่ใช่ Admin) |
| 404 | ไม่พบข้อมูล |
| 409 | ข้อมูลซ้ำ |
| 422 | validation ไม่ผ่าน |
| 429 | เกิน rate limit |
