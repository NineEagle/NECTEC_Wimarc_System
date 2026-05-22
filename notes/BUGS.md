# Bug Log — WiMaRC

บันทึก bug ที่พบและวิธีแก้ไข เรียงตามวันที่

---

### 1. Client station แสดง offline ทั้งที่ส่งข้อมูลอยู่  <!-- (2026-05-20) -->

**ปัญหา:** สถานี client (`wimarc{N}c`) แสดงสถานะ offline ทั้งที่ sensor ยังส่งข้อมูลเข้า `CAM_client` ปกติ

**สาเหตุ:** `list_stations()` ใช้แค่ `updatedata` heartbeat ในการตัดสิน online/offline — ถ้า heartbeat หายไปชั่วคราว (device restart ฯลฯ) แต่ sensor data ยังไหลอยู่ จะถูกตัดสินว่า offline ผิด

**แก้ไข:**
- `backend/app/main.py` — เพิ่ม fallback query จาก `sensor` (main) และ `CAM_client` (client) ด้วย `DISTINCT ON (wimarc_id) WHERE date IN (:today, :yesterday)` เพื่อไม่ให้ scan ทั้งตาราง
- ใช้ `max(updatedata_ts, sensor_ts)` เป็น effective timestamp ก่อนตัดสิน offline (threshold 30 นาที)

**commit:** `b873c25`

---

### 2. DISTINCT ON sensor table ทำให้ CPU พุ่ง 1500%  <!-- (2026-05-20) -->

**ปัญหา:** Query แรกของ bug #1 ใช้ `DISTINCT ON (wimarc_id)` โดยไม่มี WHERE clause → PostgreSQL scan ทั้งตารางหลักล้าน row → CPU 1500%+

**สาเหตุ:** ไม่มี index บน `wimarc_id` + ไม่กรอง date range

**แก้ไข:** เพิ่ม `WHERE date IN (:today, :yesterday)` ใน query ทั้ง sensor และ CAM_client ทำให้ scan เฉพาะ 2 partition ล่าสุด → CPU กลับปกติ

**commit:** `b873c25`

---

### 3. Leaflet popup ปุ่ม Dashboard ไม่ navigate  <!-- (2026-05-20) -->

**ปัญหา:** ปุ่ม "แดชบอร์ด" ใน map popup กด แล้วไม่ไปหน้า dashboard

**สาเหตุ:** Leaflet intercept click event บน `<a href>` ภายใน popup ก่อนที่ browser จะ follow link

**แก้ไข:** `components/maps/ModernMap.tsx` — เปลี่ยนจาก `<Button asChild><a href>` → `<button onClick={() => { window.location.href = ... }}>` เพื่อ bypass Leaflet interception

**commit:** `b873c25`

---
