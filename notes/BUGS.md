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

### 12. หน่วยแสง (lux/klux) ไม่เปลี่ยนตาม UnitSection ที่ตั้งค่าในหน้า Config  <!-- (2026-06-06) -->

**ปัญหา:** Admin เปลี่ยน `conversions.light.unit` เป็น "klux" ใน UnitSection แล้ว Save แต่ dashboard/daily/historical/compare/overview ยังแสดงเป็น "lux"

**สาเหตุ:** มีสอง field แยกกัน — `conversions.light.unit` (ควบคุมโดย UnitSection) และ `lightUnit` (field ใหม่ที่เพิ่มแยกไปโดยไม่ได้ซิงค์กัน) หน้าต่างๆ ใช้ `sysConfig.lightUnit` แต่ user แก้ผ่าน `conversions.light.unit`

**แก้ไข:**
- ลบ `lightUnit` field ออกจาก `SystemConfig` interface (`configTypes.ts`)
- ลบ `lightUnit: "lux"` ออกจาก `defaultSystem()` (`configUtils.ts`)
- ลบ lightUnit SectionCard และ `Sun` import ออกจาก `app/config/page.tsx`
- เปลี่ยนทุกหน้าที่ใช้ `sysConfig.lightUnit` → `sysConfig.conversions.light.unit` (dashboard, daily, historical, compare, overview)

**commit:** `(no commit — working tree changes)`

### 13. UI chrome ขยายตามฟอนต์ที่ 150% zoom บนมือถือ  <!-- (2026-06-07) -->

**ปัญหา:** เมื่อผู้ใช้กด A+ จนถึง 150% (base font = 33px) ปุ่ม segment toggle, selector bar, และ stat card ขยายใหญ่มากบนมือถือ เพราะใช้ rem-based classes (`py-1.5 text-sm h-8 h-9`) ที่ scale ตาม root font-size
**สาเหตุ:** UI chrome elements ใช้ Tailwind rem classes ซึ่ง scale กับ A+/A- feature จึงทำให้ใหญ่กว่าที่ควรเป็น
**แก้ไข:**
- `StationTypeToggle.tsx` — เปลี่ยนจาก `py-1.5 text-sm` เป็น inline style `{ padding: '5px 10px', fontSize: 12 }`
- `historical/page.tsx` — selector bar container เพิ่ม `style={{ fontSize: 13 }}`, time range buttons → inline style, SelectTrigger → `style={{ height: 32 }}`
- `download/page.tsx` — segment toggle buttons → inline style fixed px
- `compare/page.tsx` — selector bar container `style={{ fontSize: 13 }}`, segment buttons + time range buttons → inline style, SelectTriggers → `style={{ height: 32 }}`
- `activities/page.tsx` — filter bar container `style={{ fontSize: 13 }}`, SelectTriggers → `style={{ height: 32 }}`
- `admin/system-status/page.tsx` — stat card count เปลี่ยนจาก `text-3xl` เป็น inline style `{ fontSize: 28 }`, filter bar container + inputs → fixed px height
**commit:** `(no commit — working tree changes)`

### 14. User ไม่สามารถใช้หน้าเปรียบเทียบสถานีได้  <!-- (2026-06-10) -->

**ปัญหา:** User role ไม่สามารถดูหรือเปรียบเทียบสถานีอื่นได้ หน้า compare แสดง "ต้องมีสถานีอย่างน้อย 2 จุด"
**สาเหตุ:** Security patch commit `78bd783` เพิ่ม `mapShareLocations` gate เข้าไปใน `list_stations()` — ทำให้ `include_all=True` ใช้ได้เฉพาะเมื่อ `mapShareLocations=True` ใน system config แต่ config มีค่า `False` จึงทำให้ non-admin users เห็นเฉพาะสถานีตัวเอง → `allGroups.length < 2`
**แก้ไข:** `backend/app/main.py` — revert `list_stations()` กลับ logic เดิม `elif not include_all:` (ข้าม permission filter เมื่อ `include_all=True`) เหมือน deployment note #26 ที่ออกแบบไว้ เพราะ sensor readings endpoint ไม่มี permission check อยู่แล้ว
**commit:** `(no commit — working tree changes)`

### 15. Compare page live cards แสดงค่า "—" เมื่อเลือกสถานีดิน  <!-- (2026-06-10) -->

**ปัญหา:** ตอนเลือก "สถานีดิน" ใน compare page live data cards แสดงเป็น "—" ทั้งหมด
**สาเหตุ:** Live cards hardcode แสดง field อากาศ (`airTemperature`, `relativeHumidity`, `vpd`, `rainfall`) เสมอโดยไม่สนใจ `sensorType` — สถานีดิน (CAM_client) ไม่มี field เหล่านี้
**แก้ไข:** `app/compare/page.tsx` — refactor live cards section ให้ switch field ตาม `sensorType`: ถ้า client → แสดง soilTemperature1/2, soilMoisture1/2 พร้อม unit จาก sysConfig; ถ้า main → แสดง airTemperature, relativeHumidity, vpd, rainfall
**commit:** `(no commit — working tree changes)`

### 16. แก้ไขบันทึกกิจกรรมแปลงไม่ได้ — 422 Unprocessable Entity  <!-- (2026-06-11) -->

**ปัญหา:** กดบันทึกการแก้ไขกิจกรรมแล้วได้ error "Unprocessable Entity" ทุกครั้ง
**สาเหตุ:** Pydantic v2 name shadowing bug — ใน `PlotActivityUpdate` field ชื่อ `date: Optional[date]` ทำให้ `date` ใน annotation อ้างถึงตัว field เอง (แทนที่จะเป็น `datetime.date`) ส่งผลให้ Pydantic ตีความว่า field รับค่าได้แค่ `None` เท่านั้น → 422 ทุกครั้งที่ส่ง date จริง bug เดียวกันเกิดกับทุก schema ที่มี field ชื่อ `date: date` หรือ `forecast_date: date`
**แก้ไข:** `backend/app/schemas.py` — เปลี่ยน import `from datetime import date as Date, datetime` และแทน annotation ทั้งหมดเป็น `Date` แทน `date`
**commit:** `963fe84` — fix: Pydantic v2 date field shadowing + map dashboard button for own stations only

### 17. Widget "พยากรณ์อากาศ" fallback แสดงวันที่เก่า 2 เดือน (พ.ค.) แทนสัปดาห์ปัจจุบัน  <!-- (2026-07-13) -->

**ปัญหา:** ระหว่างตรวจสอบ TMD (กรมอุตุฯ) ที่ยังใช้งานไม่ได้ (ดู DEPLOYMENT_NOTES #63) พบว่า fallback widget ที่เพิ่มไว้ใน note #65 (Open-Meteo เมื่อ TMD ล่ม) แสดงวันที่ผิด — ตารางโชว์ "15 พ.ค. 2569" ถึง "21 พ.ค. 2569" แทนที่จะเป็นสัปดาห์ปัจจุบัน (13-19 ก.ค. 2569)
**สาเหตุ:** `GET /stations/{id}/forecast` (endpoint เดียวกับที่ API key ใช้) คืนค่า **ทุก snapshot ย้อนหลังทั้งหมด** เรียงจากเก่าไปใหม่ (ตั้งแต่วันแรกที่เริ่ม cache คือ 15 พ.ค.) ไม่ใช่แค่ 7 วันข้างหน้าแบบ TMD — โค้ด frontend เดิมทำ `omForecast.slice(0, 7)` จึงได้ 7 record แรกสุด (เก่าที่สุด) แทนที่จะเป็น 7 วันข้างหน้า
**แก้ไข:** `app/dashboard/page.tsx` — filter `data.filter(d => d.forecastDate >= todayStart)` ก่อน setState ให้ `omForecast` มีเฉพาะวันนี้เป็นต้นไป แล้วค่อย `.slice(0, 7)` ตามเดิม
**tested:** build frontend image ผ่าน, รันใน container แยก (`wimarc-frontend-test`, port 3001, ไม่แตะ containerจริง) ด้วย headless browser (playwright ผ่าน docker `mcr.microsoft.com/playwright`) login เป็น Admin → `/dashboard?station=wimarc1` → widget แสดง "13 ก.ค. 2569" ถึง "19 ก.ค. 2569" ถูกต้อง (screenshot ยืนยันแล้ว) จากนั้น deploy ขึ้นจริง (`docker compose up -d frontend`) และ re-test ซ้ำกับ container จริง (`wimarc-frontend-1`) ได้ผลตรงกัน
**commit:** `(no commit — working tree changes)`

### 18. wimarc15c อุณหภูมิดิน 30cm แสดง 125.8°C  <!-- (2026-07-16) -->

**ปัญหา:** สถานีดิน wimarc15c แสดงอุณหภูมิดิน 30cm เป็น 125.8°C ทั้งบน dashboard และกราฟย้อนหลัง (สถานีอื่นปกติ ~24-25°C)
**สาเหตุ:** อุปกรณ์ของ wimarc15c ต่อโพรบอุณหภูมิ 30cm เข้าช่อง `E` ไม่ใช่ `D` เหมือนสถานีอื่น — คอลัมน์ `D` ของสถานีนี้เก็บค่าคงที่ ~5030 (แรงดัน rail) พอเข้าสูตร `_raw_to_soil_temp` (หาร 40) จึงได้ 125.8°C ตรวจเทียบแล้ว: wid=4/6/20/40 มี `D`≈990 (อุณหภูมิจริง) และ `E`=5030 (ค่าคงที่) ส่วน wid=30 สลับกัน
**แก้ไข:** `backend/app/main.py` — เพิ่ม `_SOIL_TEMP2_CHANNEL = {30: "E"}` + helper `_soil_temp2_channel(wimarc_id)` (default `"D"`) ใช้เลือกคอลัมน์ที่ 3 จุด: `_real_readings_from_wimarc_db()` (กราฟย้อนหลัง), live path จาก `updatedata`, live fallback จาก `CAM_client` — เพิ่ม `"E"` ใน SELECT ทั้ง 3 query
**tested:** ก่อน rebuild เทียบไฟล์ในคอนเทนเนอร์กับ working tree ยืนยันว่า diff = การแก้นี้ล้วน ไม่มีงานค้างอื่นปน · หลัง deploy: live wimarc15c → `soil_temperature2` = 25.4°C (จาก E=1015) ✓ · control wimarc2c → 24.6°C ยังใช้ `D` ✓ · `_soil_temp2_channel(30)="E"`, `(4)="D"` ✓ · health 200 ✓
**หมายเหตุ:** แถวย้อนหลังก่อน ~13:20 ของ 16 ก.ค. ยังแสดง 125.8°C เพราะตอนนั้นอุปกรณ์เก่าเขียนค่าคงที่ลงช่อง `E` ด้วย (ข้อมูลเดิมใน DB เป็นแบบนั้นจริง แก้ย้อนหลังไม่ได้) ค่าจะถูกต้องตั้งแต่จุดที่สลับสายเป็นต้นไป
**commit:** `21ef6a0`

### 18. wimarc15c อุณหภูมิดิน 30cm แสดง 125.8°C  <!-- (2026-07-16) -->

**ปัญหา:** สถานีดิน wimarc15c แสดงอุณหภูมิดิน 30cm เป็น 125.8°C ทั้งบน dashboard และกราฟย้อนหลัง

**สาเหตุ:** อุปกรณ์ของ wimarc15c ต่อโพรบอุณหภูมิ 30cm เข้าช่อง **E** ไม่ใช่ **D** เหมือนสถานีอื่น — คอลัมน์ `D` ของสถานีนี้เก็บค่าคงที่ ~5030 (แรงดัน rail) พอผ่านสูตร `_raw_to_soil_temp` (raw ÷ 40) จึงได้ 125.8°C
เทียบสถานีปกติ (wid 2/4/6/20/40): `D`≈990 → ~24.8°C และ `E`=5030 เป็นค่าคงที่ — ของ wimarc15c สลับกันพอดี

**แก้ไข:** `backend/app/main.py` — เพิ่ม `_SOIL_TEMP2_CHANNEL = {30: "E"}` + helper `_soil_temp2_channel(wimarc_id)` (default `"D"`) แล้วใช้เลือกคอลัมน์ที่ **3 จุด** พร้อมเพิ่ม `"E"` ใน SELECT ทั้ง 3 query:
1. `_real_readings_from_wimarc_db()` — กราฟ/ตารางย้อนหลัง
2. live path จาก `updatedata`
3. live fallback จาก `CAM_client`

**tested:** rebuild + `docker compose up -d backend` → `/health` 200 · live `wimarc15c` → `soil_temperature2` = **25.4°C** (จาก E=1015) ✓ · control `wimarc2c` → 24.6°C ยังใช้ `D` ไม่กระทบ ✓ · `_soil_temp2_channel(30)="E"`, `(4)="D"` ✓
ก่อน rebuild เทียบ `main.py` ในคอนเทนเนอร์กับ working tree แล้ว — ต่างกันเฉพาะการแก้นี้ ไม่มีงานค้างอื่นปนขึ้น deploy

**หมายเหตุ:** แถวย้อนหลังก่อน ~13:20 ของ 16 ก.ค. ยังแสดง 125.8°C เพราะตอนนั้นอุปกรณ์เก่าเขียนค่าคงที่ลงช่อง `E` ด้วย (ข้อมูลเดิมใน DB เป็นแบบนั้นจริง แก้ย้อนหลังไม่ได้) — ค่าถูกต้องตั้งแต่ 13:20 เป็นต้นไป

**commit:** `21ef6a0` — feat: API key system + external portal, security patches, wimarc15 soil temp fix  <!-- แก้ 2026-08-11: เดิมเขียนว่า "(no commit — working tree changes)" ซึ่งผิด; ยืนยันด้วย `git log -S'_SOIL_TEMP2_CHANNEL' -- backend/app/main.py` → 21ef6a0 -->

### 19. system-status: การ์ด WIMARC-API แสดง OFFLINE ตลอด ทั้งที่เครื่อง .200 ทำงานปกติ  <!-- (2026-07-18) -->

**ปัญหา:** หน้า `/admin/system-status` การ์ด "wimarc-api" (203.185.101.200) ขึ้น OFFLINE สีแดงตลอด ไม่มี CPU/RAM/Disk แสดงจริง แม้เครื่อง .200 จะรันปกติและมี wimarc-metrics agent อยู่แล้ว (ดู [IDEAS.md](IDEAS.md) #1)

**สาเหตุ:** `docker-compose.yml` ตั้ง `WIMARC_API_METRICS_URL: "http://203.185.101.200:8081"` เป็น root path — แต่ metrics agent เสิร์ฟข้อมูลที่ path `/metrics` เท่านั้น (root → HTTP 404) `backend/app/main.py` `health_check_detail()` เรียก `urllib.request.urlopen(_metrics_url, ...)` ตรงๆ ไม่มีการต่อ `/metrics` เพิ่ม → 404 → `except Exception` → `result["server_api"] = "error"` → frontend แสดง OFFLINE เสมอ (bug นี้น่าจะมีมาตั้งแต่ SECURITY.md #13 FIX-6 ที่ย้าย URL จาก hardcode `.../metrics` ไป env var แต่ตอนตั้งค่าใน docker-compose.yml ตัด `/metrics` ท้าย URL หายไป)

**แก้ไข:** `docker-compose.yml` — เปลี่ยน `WIMARC_API_METRICS_URL` เป็น `"http://203.185.101.200:8081/metrics"`

**tested:** `curl http://203.185.101.200:8081/metrics` จากเครื่อง .161 → HTTP 200 พร้อม JSON จริง (`cpu_percent`, `mem_used_mb` ฯลฯ) ส่วน root path → HTTP 404 ยืนยัน root cause · หลังแก้ + `docker compose up -d --force-recreate backend` (env var only ไม่ต้อง rebuild) → เข้าไปใน container รันตรรกะเดียวกับโค้ด (`urllib.request.urlopen` ไปที่ URL ใหม่) → HTTP 200 ได้ข้อมูลจริงกลับมา · `/backend/health` → 200 ปกติ

**commit:** `(no commit — working tree changes)`

### 20. Client station โชว์ความชื้นดิน 100% + อุณหภูมิดิน 0°C (zero-row จากอุปกรณ์)  <!-- (2026-07-19) -->

**ปัญหา:** สถานีดิน (client, `wimarc{N}c`) บางสถานีแสดงบน dashboard/กราฟย้อนหลังเป็น ความชื้นดิน 100% แต่อุณหภูมิดิน 0°C พร้อมกัน — ตอนตรวจมี 13 สถานีที่ "แถวล่าสุด" เป็นแบบนี้ (wimarc_id 6,8,30,34,36,42,44,46,50,52,54,56,60)

**สาเหตุ:** อุปกรณ์ ESP บางจังหวะส่ง reading ที่คอลัมน์ `A/B/C/D/E` เป็น `0` ทั้งแถว (no-signal / โพรบหลุดชั่วขณะ — device ส่ง payload ว่าง) เก็บลง `CAM_client` และ `updatedata` เป็น string `"0"` จริง ฟังก์ชันแปลงค่าไม่ได้กัน 0:
- `_adc_to_moisture(0)` = (3800−0)/(3800−1200)×100 = 146% → clamp เหลือ **100%** (ADC จริงตอนดินอิ่มน้ำ ~1200 ไม่มีทางเป็น 0)
- `_raw_to_soil_temp(0)` = 0÷40 = **0°C** (โพรบจริงอ่าน ~980–1015 → 24–25°C ดินไม่มีทางเป็น 0°C)
Live path หลัก (จาก `updatedata` [main.py](../backend/app/main.py):1879) มี guard `row["A"] not in (None,"0","z")` กันไว้แล้ว — พอ A="0" มันเด้งไปเข้า **fallback (`CAM_client` row ล่าสุด) ซึ่งไม่มี guard** จึงเอา zero-row มาแปลงเป็น 100%/0 · ส่วน `_real_readings_from_wimarc_db()` (กราฟ/ตารางย้อนหลัง) ก็ไม่มี guard เช่นกัน → zero-row ทุกแถวเป็น spike 100%/0

**แก้ไข:** `backend/app/main.py` — (1) guard 0/ติดลบในฟังก์ชันแปลงค่า: `_adc_to_moisture` และ `_raw_to_soil_temp` คืน `None` เมื่อ input `<= 0` (ครอบทุก path: live primary per-channel, fallback, historical — zero-row กลายเป็นช่องว่าง/`—` แทนค่าเพี้ยน) · (2) live fallback query เพิ่ม `WHERE "A" NOT IN ('0','z','') AND "A" IS NOT NULL` ให้ดึง row ค่าดีล่าสุด → การ์ด live โชว์ค่าล่าสุดที่อ่านได้จริง แทน "—" ตอนอุปกรณ์ส่ง 0 ชั่วคราว

**tested:** rebuild + `docker compose up -d backend` → `/health` 200 · unit-test สูตร: `adc(0)/temp(0)=None`, `adc(2567)=47.4/temp(1012)=25.3` ✓ · live (mint admin JWT ใน container) สถานีที่เคยเพี้ยน → wimarc3c 49.6/43.8% 27.5/24.5°C @12:20 (last-good แทน zero-row 12:40), wimarc15c temp2=25.6°C (ยังใช้ช่อง E ตาม #18 ✓), wimarc18c/30c ค่าจริงหมด · control wimarc1c/2c ไม่กระทบ โชว์ค่า live ปัจจุบัน · historical wimarc3c: zero-row 41 แถว → null gaps, **0 แถวที่ยังเป็น 100%/0** ✓
**หมายเหตุ:** แถวย้อนหลังที่เป็น zero-row จะขาดช่วงในกราฟ (ถูกต้องกว่า spike) — ข้อมูลดิบใน DB ยังเป็น 0 อยู่ (แก้ย้อนหลังไม่ได้) แค่ไม่ตีความเป็นค่าจริงอีกต่อไป

**commit:** `(no commit — working tree changes)`

### 21. ค่าเฉลี่ยรายวันบางสถานีสูงผิดปกติ — ไม่มีการกรอง outlier ก่อนหาค่าเฉลี่ย  <!-- (2026-08-01) -->

**ปัญหา:** หน้า `/daily` ("ค่าเฉลี่ยรายวัน") บางสถานี/บางวัน แสดงค่าเฉลี่ยสูงผิดปกติ ทั้งที่หน้า `/historical` และ `/compare` ของสถานี+วันเดียวกันแสดงค่าปกติ (หรือมีช่องว่างแทนค่าที่หลุดช่วง)

**สาเหตุ:** `services/sensorService.ts` `getDailyAggregates()` (บรรทัด 83-118) มี parameter `limits` สำหรับกรอง reading ที่หลุดช่วง min/max ตาม `sysConfig.limits` (`inLimits()` บรรทัด 11-14) ก่อนคำนวณเฉลี่ย — แต่เป็น optional และไม่มีผู้เรียกส่งเข้ามาเลย: `app/daily/page.tsx:120` และ `app/download/page.tsx:302` (CSV export) เรียกแค่ 2 arg โดยไม่ส่ง `sysConfig.limits` ต่างจาก `/historical` ([app/historical/page.tsx:277-289](../app/historical/page.tsx#L277-L289)) และ `/compare` ที่ทำ pattern เดียวกันและใช้งานอยู่แล้ว ผลคือ reading ผิดปกติ (sensor รวน, สาย probe หลุดชั่วขณะ, หรือ legacy garbage อย่างกรณี wimarc15c 125.8°C ก่อนแก้ #18) ไหลเข้าไปรวมในค่าเฉลี่ยรายวันตรงๆ โดยไม่ถูกกรองทิ้งเหมือนหน้าอื่น ดึงค่าเฉลี่ยของวันนั้นให้สูงผิดปกติ (ทุก metric ที่มี limit config ไม่ใช่แค่ soil temp)

**สิ่งที่เจอเพิ่มระหว่างตรวจ (ไม่ได้แก้ในรอบนี้ เพราะไม่กระทบ user จริง):** `app/download/page.tsx:206` `isDailyType` hardcode เป็น `false` ตลอด — ไม่มี `dataType` ใน `DATA_TYPES` ที่ map มาเป็น daily ได้เลย branch `getDailyAggregates` ใน useEffect (บรรทัด 310+) จึงเป็น dead code ที่ UI เรียกไม่ถึงอยู่แล้วในปัจจุบัน

**แก้ไข:**
- `app/daily/page.tsx:120` — ส่ง `sysConfig.limits` เป็น arg ที่ 3 ของ `getDailyAggregates()` + เพิ่ม `sysConfig.limits` เข้า dependency array ของ useEffect (บรรทัด 125) เพื่อ re-fetch เมื่อ config โหลดเสร็จ/เปลี่ยน
- `app/download/page.tsx` — เพิ่ม `sysConfig` state + `loadSystemConfig()` useEffect (ไม่เคยมีมาก่อนในไฟล์นี้), ส่ง `sysConfig.limits` เข้า `getDailyAggregates()` บรรทัด 311 + เพิ่มเข้า dependency array ของ useEffect เพื่อความสอดคล้อง แม้ branch นี้จะยังเป็น dead code อยู่ก็ตาม

**tested:** `docker compose build frontend` ผ่าน (type-check ผ่าน ไม่มี error ใหม่, ทุกหน้ารวม `/daily` `/download` compile เป็น static route ปกติ) → `docker compose up -d frontend` → `curl 127.0.0.1:3000/` → 200 → log แสดง `✓ Ready` ปกติ ไม่มี error

**commit:** `(no commit — working tree changes)`

### 22. บันทึกกิจกรรมแปลงไม่ได้ — 500 Internal Server Error (ทุก write endpoint ที่ใช้ require_not_guest)  <!-- (2026-08-10) -->

**ปัญหา:** กด "บันทึก" กิจกรรมแปลง (สร้างใหม่) แล้วขึ้น internal server error ทุกครั้ง — log พบ `AttributeError: 'NoneType' object has no attribute 'role'` ที่ `main.py:2057` (`create_activity`)

**สาเหตุ:** commit `21ef6a0` (2026-07-16, "feat: API key system...") แก้ `require_not_guest()` ตอน merge งานที่รันอยู่จริงบน production เข้า git แล้วพลาดลบบรรทัด `return current_user` ทิ้ง — ฟังก์ชันยัง raise 403 ให้ Guest ถูกต้อง แต่ตอน role อื่น (Admin/User) ผ่านเงื่อนไข กลับไม่ `return` อะไรเลย → คืนค่า `None` โดย implicit ทุก endpoint ที่ใช้ `current_user: User = Depends(require_not_guest)` จึงได้ `current_user = None` เสมอ (ยกเว้น Guest ที่โดน 403 ก่อนถึงจุดนั้น) พอโค้ดใน endpoint แตะ `current_user.xxx` (เช่น `_require_write_station(current_user, ...)`, `current_user.id`, `current_user.full_name`) จึงพัง — กระทบทุก write endpoint: create/update/delete activity, create/update/delete sim payment, get today/latest station image

**แก้ไข:** `backend/app/main.py` บรรทัด 130-134 — เพิ่ม `return current_user` กลับเข้าไปท้าย `require_not_guest()`

**tested:** rebuild + `docker compose up -d backend` → `/health` 200 · mint JWT admin ในคอนเทนเนอร์ → `POST /activities` → 201 (เดิม 500) พร้อม `created_by`/`created_by_name` ตรงกับ user จริง · `PUT /activities/{id}` → 200 · `DELETE /activities/{id}` → 204 · ลบ test record ทิ้งแล้ว · log หลัง rebuild ไม่มี `AttributeError`/`Traceback` อีก

**commit:** `(no commit — working tree changes)`

---

## 📑 ภาคผนวก — ดัชนีแก้ความกำกวมของเลขลำดับ (erratum)  <!-- (2026-08-11) -->

> เพิ่มต่อท้ายเท่านั้น — **ไม่ได้แก้เลขของ entry เดิม** เพราะมี note/commit อื่นอ้างถึงเลขเหล่านี้อยู่ การไล่เลขใหม่จะทำให้ cross-reference ทั้งหมดพัง
> ใช้ตารางนี้เวลาเจอการอ้าง "#2", "#3", "#18" แล้วไม่แน่ใจว่าหมายถึงอันไหน

**เลขที่ซ้ำ**

| เลข | บรรทัด (ณ 2026-08-11) | วันที่ | หัวข้อ | อ้างถึงแบบไม่กำกวม |
|---|---|---|---|---|
| 2 | 21 | 2026-05-20 | DISTINCT ON sensor table ทำให้ CPU พุ่ง 1500% | **#2 (2026-05-20)** |
| 2 | 45 | 2026-06-01 | download export ใช้ date range ผิด (hardcode 7 วัน) | **#2 (2026-06-01)** |
| 3 | 33 | 2026-05-20 | Leaflet popup ปุ่ม Dashboard ไม่ navigate | **#3 (2026-05-20)** |
| 3 | 52 | 2026-06-01 | activities DropdownMenuItem เปิด dialog ไม่ได้ | **#3 (2026-06-01)** |
| 18 | 187 | 2026-07-16 | wimarc15c อุณหภูมิดิน 30cm แสดง 125.8°C | **#18 (ฉบับแรก)** |
| 18 | 196 | 2026-07-16 | wimarc15c อุณหภูมิดิน 30cm แสดง 125.8°C | **#18 (ฉบับที่สอง)** |

**หมายเหตุเรื่อง #18:** ทั้งสอง entry คือ **bug ตัวเดียวกัน** (wimarc15c ต่อโพรบ 30cm เข้าช่อง `E`) ถูกบันทึกซ้ำสองรอบ เนื้อหาตรงกัน ต่างกันแค่รายละเอียดการเขียน — ไม่ใช่คนละ bug
ช่อง **commit** ของ #18 ฉบับที่สองเดิมเขียนว่า `(no commit — working tree changes)` ซึ่ง **ผิด** — งานนี้อยู่ใน `21ef6a0` จริง (พิสูจน์ด้วย `git log -S'_SOIL_TEMP2_CHANNEL' -- backend/app/main.py`) แก้ให้ถูกแล้ว 2026-08-11

**เลขที่ข้าม:** ไฟล์นี้ไม่มี `### 9.` และ `### 10.` — ข้ามไปเลย ไม่ใช่ entry ที่หายไป (ลำดับเดินจาก #8 ไป #11) ถ้าเจอการอ้าง "BUGS #9" หรือ "#10" ที่ไหน แปลว่าอ้างผิด

**เลขถัดไปที่ควรใช้เมื่อเพิ่ม entry ใหม่:** `### 23.`

### 23. ชุดแก้ bug จาก audit ทั้งระบบ — relay misattribution, ค่าเซ็นเซอร์ปลอม, logout, และอื่น ๆ  <!-- (2026-08-11) -->

**ปัญหา:** audit แบบ read-only ทั้งระบบพบ 66 ประเด็นที่ยืนยันแล้ว รอบนี้แก้ที่แก้ได้ทั้งหมด

**สาเหตุ + แก้ไข (เรียงตามความรุนแรง):**

1. **wimarc01 แสดงข้อมูลฟาร์มอื่น** — firmware ฝั่ง relay POST มาด้วย `wimarcID=1` เสมอไม่ว่าต้นทางเป็นสถานีไหน ทำให้ `wimarc_id=1` รับข้อมูลจาก **15 relay ต่างกัน** (สถานีอื่นรับแค่ 1) และ 68% ของแถวเป็นของฟาร์มอื่น · คิวรี live/historical ไม่ได้กรอง `src` → `backend/app/main.py` เพิ่ม `_SRC_DIRECT` = `(src IS NULL OR src = 'direct')` ใช้ที่ 8 จุด (live main, live client fallback, historical sensor + JOIN sensor_1min, CAM_client, rain, และ `list_stations` ทั้ง sensor/CAM_client) — ต้องมี `IS NULL` เพราะแถวเก่าก่อนมีคอลัมน์ `src` เป็น NULL **ต้นเหตุจริงอยู่ที่ firmware ยังไม่ได้แก้**
2. **wimarc04c ความชื้นดิน 30cm = 0.0% ปลอม** — probe หลุด calibration (ADC ~4472 > dry 3800) สูตรได้ -25.8% แล้วถูก clamp เป็น 0.0 · เพิ่ม `_SOIL_ADC_MAX` (dry+200) ใน `_adc_to_moisture()` และ `_SOIL_TEMP_RAW_MAX`=2400 (60°C) ใน `_raw_to_soil_temp()` → คืน `None` แสดง "—" แทน
3. **`limits.light.max` = 115000 (lux) แต่ข้อมูลเป็น klux** → outlier filter ไม่เคยกรองอะไรเลย ค่า 1400 klux หลุดเข้าค่าเฉลี่ย `/daily` · UPDATE `system_config` เป็น 200 klux + ลบ key ขยะ `lightUnit`
4. **logout ไม่หลุดจริงสำหรับผู้ใช้ Google** — ไม่มี `signOut()` ที่ไหนเลยในโค้ด, cookie NextAuth ค้าง → effect sync มินต์ token ใหม่ให้ · `contexts/AuthContext.tsx` เรียก `signOut({redirect:false})` เมื่อเป็น Google session
5. **401 ลบ `wimarc_auth_method` ทิ้ง** → บน shared machine ที่มี Google cookie ค้าง จะถูก sync กลับเข้าเป็น Google identity · `services/apiClient.ts` คงค่า `"password"` ไว้ข้าม forced logout + รวม key list เป็น `clearAuthStorage()`
6. **สวิตช์ Portal ในหน้า admin กดไม่ได้** — `setPortalEnabled` จาก useState shadow ทับ import ตัวเดียวกัน → เรียก state setter ได้ undefined แล้ว throw · `app/admin/api-keys/page.tsx` เปลี่ยนชื่อ
7. **`POST /stations/{id}/forecast/refresh` ไม่มี role guard** (write endpoint เดียวที่ขาด) · เพิ่ม `require_not_guest` + `_require_write_station`
8. **`end_date` เดี่ยว ๆ ถูกเมินเงียบ ๆ** ใน `GET /stations/{id}/readings` → คืนข้อมูลวันนี้ให้ request ที่ขอบบนอยู่ 7 เดือนก่อน พร้อม 200 OK · ย้าย `dt_end` ออกมานอก branch
9. **`_DUMMY_HASH` เสียรูป** (54 chars, bcrypt ต้องการ 53) → verify throw ใน 0.086ms แทน 244ms = timing defence เป็น no-op · แทนด้วย bcrypt hash ที่ถูกต้อง
10. **API key `expires_at` เทียบข้าม timezone** — `.replace(tzinfo=None)` เทียบกับ `utcnow()` ทำให้ key หมดอายุยังใช้ได้อีก ~7 ชม. · เทียบแบบ aware ด้วย `datetime.now(timezone.utc)`
11. **0 lux กลางคืนหายจากการ์ด live** — `float(lux) if lux else None` ตัด 0.0 ทิ้งด้วย truthiness ขณะที่ `/readings` คืน 0.0 · เปลี่ยนเป็น `is not None`
12. **`Promise.all` ไม่มี catch → หน้าค้าง skeleton ถาวร** ถ้า `/stations` ล้ม · `contexts/StationContext.tsx` + 5 หน้า ใส่ try/catch/finally และ export `loadError` แล้ว wire เข้า dashboard/historical/download ให้ขึ้น "โหลดรายชื่อสถานีไม่สำเร็จ" แทนการบอกผู้ใช้ว่าหมดสิทธิ์เข้าถึงสถานี
13. **TMD warning ตายเงียบ** — path `forecast/location/warning/at` ไม่มีอยู่จริง (404 เท่ากับ path มั่ว ขณะที่ `daily/at` 200) แต่ code คืน `{"warnings": []}` ซึ่งแยกไม่ออกจาก "ไม่มีเตือนภัย" · เพิ่ม field `available`/`error` (additive — frontend อ่าน `warnings` อย่างเดียว) + log ระดับ warning · **ยังไม่รู้ endpoint ที่ถูกต้อง ฟีเจอร์นี้ยังใช้ไม่ได้**
14. อื่น ๆ: `/daily` ลบคอลัมน์ "ช่วงกลางวัน" ที่ hardcode "12:00" ทุกแถว · 4 หน้าเลิกเรียก `/users` ที่ 403 เสมอสำหรับ role User แล้วใช้ `owner_name` ที่ station ส่งมาให้อยู่แล้ว · `/daily` `/download` เลิก fetch ซ้ำด้วย `limitsKey` memo · `configService` deep-merge จริงตามที่คอมเมนต์บอก · เลิกกลืน exception ใน readings fallback (log แทน) · TMD error ไม่สะท้อน `str(exc)` กลับไปให้ caller

**tested:** build ทั้ง backend + frontend ผ่าน → deploy → `/health` 200 · live: wimarc01 แสดงค่าตัวเอง 30.12°C @09:27 (เดิมโชว์ของฟาร์มอื่น), wimarc4c `soil_moisture2=None` แต่ 15cm ยังได้ 52.9%, wimarc15c ยังอ่านช่อง E ถูก (24.9°C ตาม #18), wimarc2 control ไม่กระทบ · write endpoints POST 201 / PUT 200 / DELETE 204 · `forecast/refresh` admin 200, guest 403 · unauth `/stations` `/users` `/activities` `/config/system` → 401 ทั้งหมด · ทุกหน้า frontend 200 (12 หน้า) · ยืนยันก่อนแก้ว่า filter `src` ไม่ทำให้สถานีไหนข้อมูลหาย และ guard ค่าเซ็นเซอร์ซ่อนเฉพาะช่องที่เสียจริง (moisture 1 สถานี, temp 1 สถานี, ไม่มีค่าถูกต้องถูกตัด)

**หมายเหตุ:** เจ้าของยอมรับแล้วว่ากราฟ wimarc01 จะมีช่องว่างวันที่ 2, 4, 5 ส.ค. (ไม่มี direct เลย) และค่า live ตอนกลางคืนอาจเก่าหลายชั่วโมง — แลกกับการไม่แสดงข้อมูลฟาร์มอื่นเป็นของตัวเอง

**commit:** `6323384` — feat: Guest station assignment, request deletion, audit fixes  <!-- แก้ 2026-08-11: งานนี้ถูก commit พร้อมกันใน 6323384 -->

---

### 24. Login ด้วย Google ไม่ได้ทั้งระบบ — `GOOGLE_CLIENT_SECRET` เป็น Maps API key  <!-- (2026-08-11) -->

**ปัญหา:** กดปุ่ม "เข้าสู่ระบบด้วย Google" แล้วเด้งกลับหน้า login เฉยๆ ไม่มี session เกิดขึ้น เป็นกับทุกบัญชี ไม่ใช่เฉพาะ Guest — login ด้วย username/password ยังปกติ

**สาเหตุ:** `.env` บรรทัด 6 `GOOGLE_CLIENT_SECRET` ถูกใส่ค่าเป็น **Google Maps API key** (`AIzaSy…`, 39 ตัว) แทน OAuth client secret (`GOCSPX-…`, 35 ตัว) — สองค่านี้หน้าตาใกล้เคียงกันมากและอยู่ติดกันในไฟล์ (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` อยู่บรรทัด 7) น่าจะ copy ผิดช่อง (`.env` แก้ล่าสุด 2026-07-16 ตรงกับ commit `21ef6a0`)

Fail path: กดปุ่ม → เด้งไป Google consent ได้ปกติ (client_id ถูก) → Google เด้งกลับพร้อม code → NextAuth แลก code เป็น token โดยส่ง client_secret → Google ปฏิเสธ `invalid_client` → `pages.signIn: "/"` เด้งกลับหน้า login โดยไม่มี session

**หลักฐาน:** `docker compose logs frontend` → `[next-auth][error][OAUTH_CALLBACK_ERROR] invalid_client (The provided client secret is invalid.)` · backend log `POST /auth/google` = 401 ทุกครั้งติดกัน 72 ชม. ไม่มี 200 เลย ขณะที่ `POST /auth/login` 200 ตลอด (401 ที่ backend เป็นผลพลอยได้จาก NextAuth session เก่าที่ access token หมดอายุแล้ว mint ใหม่ไม่ได้)

**แก้ไข:**
1. สร้าง OAuth client ใหม่ชื่อ `wimarcgoogle` (client id `443294304362-…`) → ใส่ client id + secret (`GOCSPX-…`) ลง `.env` บรรทัด 5-6
2. Google Console → Authorized redirect URIs แก้จาก `https://www.wimarc.in.th/` เป็น `https://www.wimarc.in.th/api/auth/callback/google` (ค่าเดิมเป็น root จะได้ `redirect_uri_mismatch` แทน — ค่าที่ถูกยืนยันจาก `GET /api/auth/providers` field `callbackUrl`)
3. `docker compose up -d --force-recreate frontend backend` — ต้อง recreate **backend ด้วย** เพราะ backend เอา `GOOGLE_CLIENT_ID` ไปตรวจ `aud`/`azp` ของ access token ใน `/auth/google` ถ้า id ไม่ตรงจะ 401 audience mismatch

**tested:** `GET /api/auth/providers` คืน callbackUrl ถูก · ยิง `accounts.google.com/o/oauth2/v2/auth` ด้วย client_id + redirect_uri จริง (ไม่ส่ง secret) ได้ 302 → หน้า sign-in ของ Google (ถ้า URI ไม่ตรงจะได้ 400 `redirect_uri_mismatch`) · login จริง 02:56 น. → `POST /auth/google 200 OK`, ไม่มี `invalid_client` ใน log อีก

**ที่ยังไม่ได้แก้:** `contexts/AuthContext.tsx:82-88` ตอน `/auth/google` ตอบ error จะล้างแค่ localStorage ไม่ได้เรียก `signOut()` ล้าง cookie ของ NextAuth → ถ้ามี session Google เก่าค้างอยู่ หน้าเว็บจะยิง token ที่ตายแล้วซ้ำทุกครั้งที่ reload วนไม่จบ (หลุดได้ด้วยการกดปุ่ม login Google ใหม่เพื่อทับ token) — ดู IDEAS.md

**commit:** `(no commit — .env ไม่ได้เข้า git)`

---

### 25. ลบ API key ที่เคยถูกใช้งานแล้วไม่ได้ — 500 ForeignKeyViolation  <!-- (2026-08-11) -->

**ปัญหา:** admin กดลบ API key ในหน้า `/admin/api-keys` แล้วขึ้น toast "ลบไม่สำเร็จ" — เกิดกับ key ที่เคยยิง request สำเร็จอย่างน้อย 1 ครั้ง (คือ key ที่ใช้งานจริงทุกตัว) key ที่เพิ่งสร้างแล้วยังไม่เคยใช้ลบได้ปกติ จึงไม่เคยถูกจับได้ตอนพัฒนา

**สาเหตุ:** `delete_api_key()` เรียก `db.delete(ak)` ตรงๆ ทั้งที่มี 2 ตาราง FK ชี้มาที่ `api_keys.id` — `api_key_usage_logs.api_key_id` (**NOT NULL**) และ `api_key_requests.api_key_id` (nullable) ทุกครั้งที่ key ถูกใช้จะมีแถว log เพิ่ม → Postgres ปฏิเสธ DELETE:

```
sqlalchemy.exc.IntegrityError: (psycopg2.errors.ForeignKeyViolation)
update or delete on table "api_keys" violates foreign key constraint
"api_key_usage_logs_api_key_id_fkey" on table "api_key_usage_logs"
```

**แก้ไข:** `backend/app/main.py` `delete_api_key()` — ลบ `ApiKeyUsageLog` ของ key นั้นก่อน (log อยู่ต่อไม่ได้เพราะคอลัมน์ NOT NULL) แล้ว set `api_key_requests.api_key_id = NULL` (เก็บแถวคำขอไว้เป็นประวัติการอนุมัติ ตัดแค่ลิงก์) จากนั้นค่อย `db.delete(ak)`

**พบตอน:** เก็บกวาด key ทดสอบของงาน #76 (DEPLOYMENT_NOTES) — เป็น bug ที่มีอยู่ก่อนหน้า ไม่ได้เกิดจากงานนั้น ระหว่างนั้นมี key ทดสอบค้างบน production ชั่วคราว จึง `PATCH is_active=false` ปิดใช้งานทันที (auth path เช็ค `ApiKey.is_active.is_(True)` ที่ main.py บรรทัด ~185) แล้วลบทิ้งหลัง deploy ตัวแก้

**tested:** ลบ `ak-3ec3c027c8` (เคยยิง 2 request) → เดิม 500 · หลังแก้ 204 · จำนวน API key กลับมาเท่าก่อนทดสอบ (4 ตัว)

**commit:** `6323384` — feat: Guest station assignment, request deletion, audit fixes

### 26. convertToCSV ไม่ escape ขึ้นบรรทัดใหม่  <!-- (2026-09-04) -->

**ปัญหา:** ถ้าค่าในช่องใดมีการขึ้นบรรทัดใหม่ ไฟล์ CSV ที่ export ออกมาจะแตกแถว —
1 record กลายเป็น 2 บรรทัด ทำให้คอลัมน์ที่เหลือเลื่อนผิดตำแหน่งทั้งหมด

**สาเหตุ:** `convertToCSV()` ใน `services/exportService.ts` เช็คแค่ `,` และ `"`
แต่ไม่เช็ค `\n` / `\r` ค่าที่มีบรรทัดใหม่จึงไม่ถูกครอบ quote
กระทบทุก export ที่รับค่าจาก `<Textarea>` (กิจกรรมแปลง ช่อง description และ
อุปกรณ์เสีย ช่องอาการ/หมายเหตุ) — เป็นบั๊กแฝงมาก่อน เพิ่งเจอตอนทำ CSV ของอุปกรณ์เสีย

**แก้ไข:** เปลี่ยนเงื่อนไขเป็น regex `/[",\n\r]/` ใน `services/exportService.ts`
ค่าที่มีบรรทัดใหม่จะถูกครอบ quote ตามมาตรฐาน CSV ตัวอ่านจึงมองเป็นฟิลด์เดียว

**commit:** `5ae84dc` — feat(faults): drop repair date, add CSV export, resurface the log
