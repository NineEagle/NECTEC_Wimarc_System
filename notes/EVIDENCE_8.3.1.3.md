# หลักฐาน 8.3.1.3 — API ดึงข้อมูลจาก Server 1 + Real-time dashboard (ข้อ 4.5.3)

## สิ่งที่ต้องส่ง
1. หน้า dashboard แสดงข้อมูล/รูปจาก Server 1 แบบ live
2. หลักฐาน real-time — แคปตอนข้อมูลอัพเดต หรือ วิดีโอสั้นให้เห็น update
3. API call ที่ดึงจาก Server 1 → request URL + response

---

## 1. Data flow (Server 1 → Server 2 → Browser)

```
Server 1  (host.docker.internal)
 ├─ PostgreSQL wimarc_db : ตาราง CAM_main / CAM_client / sensor / sensor_1min / updatedata   ← ค่า sensor ดิบ
 └─ File server https://wimarc.in.th/imgMain|imgClient/<station>/                              ← รูปกล้อง
        │   backend อ่านผ่าน env: WIMARC_DB_URL (DB) + FILE_SERVER_URL (รูป)
        ▼
Server 2  (Next.js :3000 + FastAPI :8000)
 ├─ GET /backend/stations/{id}/live          → ค่า sensor ล่าสุด + image_url
 └─ GET /backend/stations/{id}/images/today  → รายการรูปวันนี้
        │   dashboard poll ทุก 15 วินาที (มี countdown + pulse บนจอ)
        ▼
Browser  → Real-time dashboard
```

**Env ที่ชี้ไป Server 1** (`docker-compose.yml`):
- `WIMARC_DB_URL = postgresql://...@host.docker.internal:5432/wimarc_db` — sensor DB
- `FILE_SERVER_URL = https://wimarc.in.th` — รูปกล้อง (อ่าน directory listing `imgMain/imgClient`)

**โค้ดอ้างอิง:** `backend/app/main.py` → `get_live_data()` อ่านจาก `sensor_1min` + `updatedata` (Server 1 DB) และ `_latest_image_from_server()` ดึงรูปจาก file server

---

## 2. แคป API call ที่ดึงจาก Server 1

> ใช้ token จาก `POST /auth/login` (ข้อ 8.3.1.2). แทน `<TOKEN>` ด้วย JWT จริง.
> `<id>` = station id เช่น `wimarc1` (อากาศ) หรือ `wimarc1c` (ดิน)

### 2.1 Live sensor data (ดึงจาก Server 1 DB)
```bash
TOKEN="<TOKEN>"
curl -i "https://wimarc.in.th/backend/stations/wimarc1/live" \
  -H "Authorization: Bearer $TOKEN"
```
**คาดหวัง `200 OK`** + body เช่น:
```json
{
  "last_ping": "2026-06-23T15:31:00",
  "sensor_time": "2026-06-23T15:31:00",
  "air_temperature": 31.2,
  "relative_humidity": 68.0,
  "rainfall": 0.0,
  "wind_speed": 1.4,
  "atmospheric_pressure": 1003.2,
  "light_intensity": 45210,
  "vpd": 1.42,
  "image_url": "/media/imgMain/wimarc1/20260623_15_M.jpg",
  "image_time": "2026-06-23T15:30:00"
}
```
→ `sensor_time`/`last_ping` = timestamp จาก Server 1, `image_url` = path รูปบน file server Server 1

### 2.2 รูปกล้องวันนี้ (ดึงจาก file server Server 1)
```bash
curl -i "https://wimarc.in.th/backend/stations/wimarc1/images/today" \
  -H "Authorization: Bearer $TOKEN"
```
**`200 OK`** + array `[{image_url, timestamp}, ...]` — แต่ละ url ชี้ `/media/imgMain/...` (proxy ไป Server 1)

### 2.3 รูปจริงโหลดได้ (พิสูจน์ media proxy → Server 1)
เปิด url รูปตรงๆ ในเบราว์เซอร์ (เอา image_url จากข้อ 2.1):
```
https://wimarc.in.th/media/imgMain/wimarc1/20260623_15_M.jpg
```
→ เห็นรูปกล้องจริง = หลักฐานว่า Server 2 ดึงไฟล์จาก Server 1

---

## 3. แคป real-time (เน้นให้เห็น update)

**วิธี A — record วิดีโอสั้น (แนะนำสุด):**
1. เปิด `https://wimarc.in.th/dashboard` login เป็น user/admin
2. อัดจอ 30–60 วินาที ให้เห็น:
   - มุมจอมี **countdown** นับถอยหลัง + จุด **pulse กระพริบ** ตอน fetch (poll ทุก 15 วิ)
   - ค่า sensor / เวลา `sensor_time` เปลี่ยนเมื่อมีข้อมูลใหม่จาก Server 1
   - รูปกล้องอัพเดต (timestamp บนรูปเลื่อน)

**วิธี B — แคปภาพ 2 รอบเทียบ:**
1. แคปรอบแรก — โฟกัสที่ timestamp + ค่า sensor
2. รอ ~1 นาที (sensor ส่งทุก ~1 นาที) แคปอีกรอบ
3. เทียบ 2 ภาพ → timestamp/ค่าเปลี่ยน = real-time

**วิธี C — DevTools Network (พิสูจน์ทาง technical):**
1. เปิด dashboard → F12 → Network → filter `live`
2. เห็น `GET /backend/stations/.../live` ยิงซ้ำทุก 15 วินาที
3. คลิกดู Response แต่ละครั้ง → ค่า/เวลาต่างกัน
4. แคปทั้ง Network timeline + Response panel

---

## หมายเหตุ
- poll interval = **15 วินาที** (`POLL_INTERVAL` ใน `app/dashboard/page.tsx`); sensor จริงส่งทุก ~1 นาที
- เบลอ `token` / `password` ในทุกภาพก่อนส่งเอกสาร
