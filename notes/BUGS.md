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

### 2. download export ใช้ date range ผิด (hardcode 7 วัน)  <!-- (2026-06-01) -->

**ปัญหา:** export CSV ออกมาเสมอเป็นข้อมูล 7 วันล่าสุด ไม่สนใจ date range ที่ user เลือก
**สาเหตุ:** `handleExport` ใน `app/download/page.tsx` เรียก `getSensorReadings(id, 7)` hardcode — ไม่ได้ใช้ `startDate`/`endDate`
**แก้ไข:** เปลี่ยนเป็น `getSensorReadingsByDateRange(id, startDate, endDate)`
**commit:** `bba2886`

### 3. activities DropdownMenuItem เปิด dialog ไม่ได้  <!-- (2026-06-01) -->

**ปัญหา:** กด ดูรายละเอียด / แก้ไข / ลบ ใน dropdown บางครั้ง modal ไม่เปิด หรือ dialog ค้าง
**สาเหตุ:** shadcn DropdownMenu ปิดตัวและ steal focus ก่อน dialog เปิด — event propagation พัง
**แก้ไข:** เพิ่ม `onSelect={(e) => e.preventDefault()}` ทุก DropdownMenuItem ที่เปิด modal/dialog
**commit:** `bba2886`

### 4. compare เปรียบเทียบสถานีดิน — กราฟว่างเปล่า  <!-- (2026-06-01) -->

**ปัญหา:** เลือก "สถานีดิน" ใน compare page กราฟและ metric selector แสดงค่าเป็น 0 ทั้งหมด
**สาเหตุ:** `METRICS` มีแค่ weather metrics (airTemperature ฯลฯ) — ไม่มี soilMoisture/soilTemperature
**แก้ไข:** เพิ่ม soil metrics ใน `WEATHER_METRICS` array + `visibleMetrics` filter ตาม sensorType + auto-reset metric เมื่อ sensorType เปลี่ยน
**commit:** `bba2886`

### 5. Google OAuth session ทับ session ของ password login  <!-- (2026-06-04) -->

**ปัญหา:** (1) login ด้วย user ทั่วไป (username/password) แล้ว refresh — แสดงเป็น admin แทน (2) refresh แล้ว logout กะทันหัน

**สาเหตุ:** NextAuth Google session ของ admin ยังค้างในเบราว์เซอร์ → `sessionStatus === "authenticated"` → code เรียก `/auth/google` และได้ JWT ของ admin กลับมา ทับ session ของ user ปกติ ถ้า Google fetch fail → `catch` ลบ `wimarc_user`+`wimarc_token` ทิ้งแม้ว่า session password จะยังดีอยู่

**แก้ไข:** เพิ่ม `wimarc_auth_method` ("password" / "google") ใน localStorage
- `authService.ts` → set `"password"` หลัง login สำเร็จ
- `AuthContext.tsx` Google sync → ข้ามถ้า `authMethod === "password"` (return early + `setIsLoading(false)`)
- `catch` → ลบ session เฉพาะเมื่อเป็น Google session เท่านั้น
- `logout()` → ลบ `wimarc_auth_method` ด้วย

**commit:** `a390597`

### 6. Config ที่ admin save ไม่ update ใน user pages  <!-- (2026-06-04) -->

**ปัญหา:** admin เปลี่ยนหน่วย/ค่าใน ตั้งค่าระบบ และกด save แต่หน้า dashboard/historical/compare ยังแสดงค่าเก่า

**สาเหตุ:** มี cache 2 ชั้น ที่ไม่ถูก clear หลัง PUT `/config`:
1. `apiClient._cache` — GET cache TTL 5 นาที สำหรับ `/config/*`
2. `systemConfigCache._cache` — module-level ไม่มี TTL (loads once per page session)
`saveConfig()` ไม่มีโค้ดที่ clear ทั้งสองชั้นเลย

**แก้ไข:**
- `app/config/page.tsx` → หลัง `saveConfig()` สำเร็จ เรียก `invalidateConfigCache()` + `clearApiCache("/config")` ทันที
- `services/systemConfigCache.ts` → เพิ่ม TTL 5 นาที เพื่อให้ user บน browser อื่นได้ config ใหม่โดยอัตโนมัติ

**commit:** `f2a272b`

### 7. หน่วย (unit) ใน dashboard/historical/compare ไม่เปลี่ยนตาม config  <!-- (2026-06-04) -->

**ปัญหา:** admin เปลี่ยนหน่วย (เช่น lux → klux) ใน ตั้งค่าระบบ แล้ว save แต่ dashboard/historical/compare ยังแสดงหน่วยเดิม

**สาเหตุ:** หน่วยทุกตัวใน JSX เป็น hardcode string เช่น `unit="lux"`, `unit="°C"`, `unit="m/s"` ไม่ได้อ่านจาก `sysConfig.conversions[key].unit` เลย แม้ว่า historical จะโหลด sysConfig แล้วก็ตาม

**แก้ไข:**
- `app/dashboard/page.tsx` → เพิ่ม `sysConfig` state + โหลดใน useEffect + เปลี่ยนทุก `unit=` ให้อ่านจาก `sysConfig.conversions.KEY.unit`
- `app/historical/page.tsx` → sysConfig มีอยู่แล้ว แก้แค่ `unit=` ใน HistoricalChart JSX
- `app/compare/page.tsx` → เพิ่ม sysConfig state + เปลี่ยน `WEATHER_METRICS` constant เป็น `buildWeatherMetrics(sysConfig)` function เพื่อให้ label ใน selector ก็อัปเดตด้วย

**commit:** `029a414`

### 8. GET /config/system ถูก block ด้วย require_admin — user เสมอได้ default unit  <!-- (2026-06-04) -->

**ปัญหา:** แม้ frontend อ่าน unit จาก sysConfig แล้ว แต่ unit ยังไม่เปลี่ยน

**สาเหตุ:** `GET /config/system` ใช้ `require_admin` → user ทั่วไปได้ 403 → `getSystemConfig()` catch error แล้ว return `defaultSystem()` ซึ่งมี `unit: "lux"` hardcode → หน้า user เห็น unit เดิมเสมอ ไม่ว่า admin จะ save อะไรก็ตาม

**แก้ไข:** `backend/app/main.py` — เปลี่ยน `GET /config/system` จาก `require_admin` → `get_current_user` (ทุก user ที่ login อ่านได้ แต่ PUT `/config` ยังต้อง admin)

**commit:** `ebd3986`

### 11. CSV header ไม่ตรงกับ label ที่ tick สำหรับ soil sensor  <!-- (2026-06-04) -->

**ปัญหา:** หน้า Download → tick "ความชื้นดิน 15cm / 30cm" หรือ "อุณหภูมิดิน 15cm / 30cm" แล้ว export CSV — header ในไฟล์แสดงเป็น "ความชื้นดิน 1/2" และ soilTemperature1/2 หายไปทั้งหมด

**สาเหตุ:** `services/exportService.ts` switch statement ใน `exportSensorDataToCSV()`:
- `soilMoisture1` → "ความชื้นดิน 1 (%)" (ผิด)
- `soilMoisture2` → "ความชื้นดิน 2 (%)" (ผิด)
- `soilTemperature1` / `soilTemperature2` → ไม่มี case

**แก้ไข:** `services/exportService.ts` — แก้ label เป็น "15cm/30cm" และเพิ่ม case สำหรับ soilTemperature1/2; แก้ daily aggregate headers ด้วย

**commit:** `(next commit)`
