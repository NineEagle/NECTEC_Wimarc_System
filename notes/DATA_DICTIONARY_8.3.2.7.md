# Data Dictionary — WiMaRC App Database (ข้อ 8.3.2.7 / 4.6.7)

DB: `wimarc_db` (PostgreSQL, engine `DATABASE_URL`)
Key: **PK** = Primary Key · **FK** = Foreign Key · **UK** = Unique · **IDX** = Indexed
อ้างอิงจาก `backend/app/models.py`

---

## 1. `users` — ผู้ใช้ระบบ

| Field | Type | Null | Key | คำอธิบาย |
|---|---|---|---|---|
| id | VARCHAR | NO | PK | รหัสผู้ใช้ (เช่น `user-admin`, `u-xxxxxxxx`) |
| username | VARCHAR | NO | UK, IDX | ชื่อผู้ใช้ (unique) |
| password | VARCHAR | NO | | รหัสผ่าน hash ด้วย bcrypt |
| role | VARCHAR | NO | | สิทธิ์: `Admin` / `User` / `Guest` |
| full_name | VARCHAR | NO | | ชื่อ-นามสกุล |
| email | VARCHAR | NO | | อีเมล |
| is_enabled | BOOLEAN | NO | | เปิดใช้งานบัญชี (default true; Guest สมัครเอง = false รออนุมัติ) |
| permitted_station_ids | JSONB | NO | | array station id ที่เข้าถึงได้ (User/Guest) |
| phone | VARCHAR | YES | | เบอร์โทร |
| created_at | TIMESTAMPTZ | NO | | วันเวลาสร้าง (default now) |

## 2. `stations` — สถานีตรวจวัด

| Field | Type | Null | Key | คำอธิบาย |
|---|---|---|---|---|
| id | VARCHAR | NO | PK | รหัสสถานี (เช่น `wimarc1`, `wimarc1c`) |
| name | VARCHAR | NO | IDX | ชื่อสถานี |
| type | VARCHAR | NO | | ประเภท: `weather` (อากาศ) / `soil` (ดิน) |
| owner_id | VARCHAR | YES | FK→users.id | เจ้าของสถานี |
| latitude | FLOAT | NO | | ละติจูด |
| longitude | FLOAT | NO | | ลองจิจูด |
| status | VARCHAR | NO | | `online` / `offline` |
| last_data_time | TIMESTAMPTZ | YES | | เวลาข้อมูลล่าสุด |
| area | VARCHAR | NO | | พื้นที่/จังหวัด |
| description | TEXT | NO | | รายละเอียด |

## 3. `sensor_readings` — ค่าตรวจวัด (app-side records)

| Field | Type | Null | Key | คำอธิบาย |
|---|---|---|---|---|
| id | VARCHAR | NO | PK | รหัส reading |
| station_id | VARCHAR | NO | FK→stations.id, IDX | สถานี |
| timestamp | TIMESTAMPTZ | NO | | เวลาที่วัด (default now) |
| air_temperature | FLOAT | YES | | อุณหภูมิอากาศ (°C) |
| relative_humidity | FLOAT | YES | | ความชื้นสัมพัทธ์ (%) |
| light_intensity | FLOAT | YES | | ความเข้มแสง (lux) |
| wind_direction | FLOAT | YES | | ทิศลม (°) |
| wind_speed | FLOAT | YES | | ความเร็วลม (m/s) |
| rainfall | FLOAT | YES | | ปริมาณฝน (mm) |
| atmospheric_pressure | FLOAT | YES | | ความกดอากาศ (hPa) |
| vpd | FLOAT | YES | | Vapour Pressure Deficit (kPa) |
| soil_moisture1 | FLOAT | YES | | ความชื้นดินชั้น 15 cm (%) |
| soil_moisture2 | FLOAT | YES | | ความชื้นดินชั้น 30 cm (%) |

## 4. `plot_activities` — กิจกรรมแปลง

| Field | Type | Null | Key | คำอธิบาย |
|---|---|---|---|---|
| id | VARCHAR | NO | PK | รหัสกิจกรรม |
| station_id | VARCHAR | NO | FK→stations.id, IDX | สถานี/แปลง |
| date | DATE | NO | | วันที่ทำกิจกรรม |
| activity_type | VARCHAR | NO | | ประเภทกิจกรรม |
| description | TEXT | NO | | รายละเอียด |
| created_by | VARCHAR | NO | FK→users.id | ผู้บันทึก |
| created_by_name | VARCHAR | NO | | ชื่อผู้บันทึก (denormalized) |
| created_at | TIMESTAMPTZ | NO | | เวลาบันทึก (default now) |
| images | JSONB | NO | | array URL รูปแนบ |

## 5. `station_images` — รูปกล้องสถานี (app-side records)

| Field | Type | Null | Key | คำอธิบาย |
|---|---|---|---|---|
| id | VARCHAR | NO | PK | รหัสรูป |
| station_id | VARCHAR | NO | FK→stations.id, IDX | สถานี |
| image_url | TEXT | NO | | URL/path รูป |
| timestamp | TIMESTAMPTZ | NO | | เวลาถ่าย (default now) |

## 6. `sim_payments` — การชำระค่าซิม

| Field | Type | Null | Key | คำอธิบาย |
|---|---|---|---|---|
| id | VARCHAR | NO | PK | รหัสรายการ |
| sim_number | VARCHAR | NO | | หมายเลขซิม |
| provider | VARCHAR | NO | | ผู้ให้บริการ |
| amount | FLOAT | NO | | จำนวนเงิน |
| station_id | VARCHAR | NO | FK→stations.id | สถานีที่ใช้ซิม |
| station_name | VARCHAR | YES | | ชื่อสถานี (denormalized) |
| due_date | DATE | YES | | กำหนดชำระ |
| status | VARCHAR | YES | | สถานะชำระ |
| paid_date | DATE | YES | | วันที่ชำระ |
| notes | TEXT | YES | | หมายเหตุ |

## 7. `weather_forecasts` — พยากรณ์อากาศ (snapshot)

| Field | Type | Null | Key | คำอธิบาย |
|---|---|---|---|---|
| id | VARCHAR | NO | PK | รหัส forecast |
| station_id | VARCHAR | NO | FK→stations.id, IDX | สถานี |
| forecast_date | DATE | NO | IDX | วันที่พยากรณ์ |
| temperature | FLOAT | NO | | อุณหภูมิ (°C) |
| rain_probability | FLOAT | NO | | โอกาสฝนตก (%) |
| rainfall | FLOAT | NO | | ปริมาณฝน (mm) |
| description | VARCHAR | NO | | คำอธิบายสภาพอากาศ |
| created_at | TIMESTAMPTZ | YES | IDX | เวลาเก็บ snapshot (timeline พยากรณ์) |

---

## ตารางเสริม (สร้างด้วย raw SQL ตอน startup)

| ตาราง | Field | Type | Key | คำอธิบาย |
|---|---|---|---|---|
| `system_config` | key | VARCHAR | PK | คีย์ config ระบบ |
| | value | JSONB | NO | ค่า config |
| `station_config` | station_id | VARCHAR | PK | สถานี |
| | config | JSONB | NO | config รายสถานี |
