# WiMaRC Ideas & Future Plans

---

### 1. แยก Database ไปรันบนเครื่อง .200  <!-- (2026-05-28) -->

**เป้าหมาย:** ย้าย PostgreSQL ออกจาก .161 ไปรันบนเครื่อง 203.185.101.200 เพื่อแยก concern และลด load

**แนวทาง:**
- ทั้งสองเครื่องอยู่ใน same datacenter (latency 0.3ms, TTL=64) ต่อกันได้โดยตรง
- เปลี่ยน `DATABASE_URL` และ `WIMARC_DB_URL` ใน `.env` ให้ชี้ไปที่ IP ของ .200
- บน .200: `ufw allow from 203.185.101.161 to any port 5432` + `ufw deny 5432`
- ไม่ต้องเปลี่ยน code — แค่ env var เท่านั้น

**สถานะ:** IN PROGRESS — รอลงมือ (plan ครบแล้ว)

**โครงสร้างใหม่หลังย้าย:**
```
ESP32-CAM (60 ตัว)
    ↓ HTTP POST (ไม่เปลี่ยน)
.161 (wimarc-app)
    Apache → PHP → pg_connect(host=.200:5432)  ← TCP DB connection โดยตรง
    FastAPI → SQLAlchemy(host=.200:5432)
    Next.js (frontend)
        ↓ TCP :5432
.200 (wimarc-api)
    PostgreSQL 16 — wimarc_db
```
ESP32 ไม่ต้อง upload ใหม่ — ยิงมา .161 เหมือนเดิม PHP แค่เปลี่ยน host ใน connection string

**ข้อมูล .200 ที่รู้แล้ว:**
- Ubuntu, Python 3.12, 16GB RAM, 100GB disk, latency 0.3ms จาก .161
- SSH: `wimarc@203.185.101.200` password `wimarc@nectec`
- wimarc-metrics agent รันอยู่บน port 8081 (ติดตั้งแล้ว)
- **ยังไม่มี PostgreSQL** — ต้องติดตั้งใหม่

**ไฟล์ที่ต้องแก้บน .161 (4 จุด):**
1. `/var/www/wimarc/dblink.php` — เปลี่ยน `host=localhost` → `host=203.185.101.200`
2. `/var/www/WiMaRC/.env` — เปลี่ยน `DATABASE_URL` + `WIMARC_DB_URL` ชี้ไป .200
3. UFW บน .200 — `allow from 203.185.101.161 to any port 5432`
4. `pg_hba.conf` บน .200 — เพิ่ม allow จาก .161

**หมายเหตุ:** `dblink-backup.php` hardcode `localhost` แยกต่างหาก — ตรวจด้วยว่ายังใช้งานอยู่มั้ย

**Plan ย้าย (5 phase):**
1. ติดตั้ง PostgreSQL บน .200 + สร้าง user/db
2. `pg_dump` จาก .161 → `scp` → restore บน .200
3. UFW + pg_hba บน .200
4. สลับ connection (.161): แก้ dblink.php + .env + rebuild backend (~1 min downtime)
5. ตรวจโอเค → ลบ PostgreSQL ออกจาก .161

---

### 2. Telegram Bot แจ้งเตือนจาก WiMaRC  <!-- (2026-05-28) -->

**เป้าหมาย:** Bot Telegram แจ้งเตือน event ต่างๆ จากระบบ เช่น station offline, sensor ผิดปกติ, CPU สูง

**แนวทาง:** ยังไม่ได้ออกแบบ — รอ session ถัดไป

**สถานะ:** IDEA

---

### 3. รายการปรับปรุง UI/feature รอบใหญ่ (backlog)  <!-- (2026-05-29) -->

**เป้าหมาย:** ปรับปรุงหลายหน้าตาม requirement ที่ user รวบรวมมา — ยังไม่เริ่มทำ รอ user สั่งเริ่มทีละข้อ

**confirmed กับ user ครบแล้ว:**
- กราฟน้ำฝน: ซ้อน **น้ำฝนเป็นกราฟแท่ง (bar)** บนกราฟความชื้นดิน 15cm + 30cm แบบ ComposedChart dual Y-axis (ความชื้น = area/line, น้ำฝน = bar) — ไม่ใช่เส้น
- สีแดง VPD: เอาออกทั้ง historical และ daily
- ปุ่ม card → sensor graph: จาก dashboard ไปหน้า historical
- ตารางสถานีอากาศแสดงชื่อ: หน้า historical (raw data)
- "กราฟย่อเป็น 1 → ตารางเวลาย่อย" = เรื่องเดียวกับ autoscale (เลือก 1 วัน แกน X รายชั่วโมง) ไม่ใช่งานแยก

**open point เล็กน้อย (เคลียร์ตอนลงมือ):** กราฟ "ปริมาณน้ำฝน" เดี่ยวเดิม (historical L318) จะเก็บไว้หรือลบ เพราะน้ำฝนย้ายไปอยู่ใน ComposedChart ของกราฟดินแล้ว

**กลุ่ม A — ชัดแล้ว พร้อมทำ (ส่วนใหญ่อยู่ historical):**
1. ~~ซ้อนน้ำฝนบนกราฟดิน 15/30cm (dual axis)~~ ✓ DONE (commit cb946ba)
2. ~~กราฟน้ำฝนเดี่ยว area → bar~~ ✓ DONE
3. MiniStat ดิน เพิ่มบอกความลึก 15cm/30cm — already done (label มี 15cm/30cm อยู่แล้ว)
4. ~~เอาสีแดง VPD ออก 2 หน้า~~ ✓ DONE
5. ~~autoscale: เลือก 1 วัน → แกน X รายชั่วโมง~~ ✓ DONE
6. ~~ย้าย section พยากรณ์ย้อนหลังไปล่างสุด หลัง raw data~~ ✓ DONE
7. ~~ตาราง raw data สถานีอากาศ แสดงชื่อแทน id~~ ✓ DONE
8. ~~dashboard card เพิ่มปุ่มไป historical~~ ✓ DONE
9. ฟอนต์การ์ดหลักเหมือนกันทั้งระบบ — `globals.css` + components (ข้ามไปก่อน — ยังไม่ชัดเจน)
10. ~~users: ปุ่ม activate/deactivate~~ ✓ DONE (commit 2e9feb3)
11. ~~system-status: ยุบ 60 → 30 แปลง~~ ✓ DONE (grouped view เป็น default อยู่แล้ว)
12. ~~compare: กราฟไม่มีข้อมูล → ซ่อน~~ ✓ DONE (commit 2e9feb3)

**กลุ่ม B — bug ต้องไล่หาสาเหตุก่อน:**
13. ~~download: เลือกวันที่ไม่ตรง~~ ✓ DONE (commit bba2886)
14. ~~activities: ปุ่มมี bug~~ ✓ DONE — onSelect preventDefault (commit bba2886)
15. ~~compare: bug เปรียบเทียบดิน~~ ✓ DONE — เพิ่ม soil metrics (commit bba2886)
16. ~~download: data ที่โหลดออกผิด~~ ✓ DONE — root cause เดียวกับ #13 (commit bba2886)

**กลุ่ม C — ต้อง design/คุยต่อ:**
17. VPD threshold: หน้า admin config (เก็บค่า + เอาไปใช้ที่กราฟ) — หน้าใหม่ + backend
18. download: ออกแบบหน้าใหม่ — เสนอ layout ก่อน
19. จัดการซิม: เพิ่ม/แก้ไขได้ — `sim_payments` table + backend + `app/payments/page.tsx`
20. solution monitoring ความเรียบร้อยระบบ — design (ต่อจาก miner incident)

**สถานะ:** IN PROGRESS — กลุ่ม A ข้อ 1-12 DONE ยกเว้นข้อ 9 (font), เหลือกลุ่ม B + C

---

### 4. เพิ่มสถานี: เลือกพิกัดบนแผนที่ (interactive map picker)  <!-- (2026-06-01) -->

**เป้าหมาย:** ตอนเพิ่มสถานีใหม่ ให้วาง/เลือกพิกัด lat/lng บนแผนที่ Google Maps ได้โดยตรง แล้วขึ้นหมุดทันที + สถานีที่มีอยู่แล้วก็แก้พิกัดได้

**ทำได้ — ใช้ Google Maps ที่ integrate แล้ว (`@vis.gl/react-google-maps`)**

**แนวทาง:**
- `app/admin/add-station/page.tsx` — ปัจจุบันมีแค่ Input ตัวเลข lat/lng (L181/185) + line 61 เป็น "Simulate API Call" (ยังไม่ wire backend จริง)
- เพิ่ม `<GoogleMap>` พร้อม draggable AdvancedMarker:
  - คลิกบนแผนที่ → วางหมุด → fill lat/lng ลง input อัตโนมัติ
  - พิมพ์ lat/lng ใน input → หมุดเลื่อนตาม (two-way sync)
  - ลากหมุด → อัปเดต lat/lng
- โหมดแก้ไข: หน้า edit station โหลดพิกัดเดิม แสดงหมุด ลากแก้ได้
- ต้อง wire backend: `POST /stations` (add) + `PATCH /stations/{id}` (edit) — ตรวจว่ามี endpoint จริงหรือยัง (ตอนนี้ add-station เป็น mockup)

**เกี่ยวข้องกับ backlog #3:** ปุ่ม "เพิ่มสถานีใหม่" อยู่ใน system-status (L202)

**สถานะ:** IDEA
