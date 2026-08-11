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

### 5. DB reliability roadmap หลัง replica setup — WAL archiving/PITR, ทำไมยังไม่ทำ auto-failover  <!-- (2026-07-17) -->

**บริบท:** ต่อจาก replica hot-standby ที่ตั้งไว้แล้ว (ดู [DEPLOYMENT_NOTES.md](DEPLOYMENT_NOTES.md) #69) — วางแผนขั้นถัดไปสำหรับความน่าเชื่อถือของ DB แบ่งเป็น 2 ระดับ

**🟡 Safety net ราคาถูก (ทำต่อจาก to-do ค้างใน #69):**
- `max_slot_wal_keep_size='8GB'` บน jasmine (primary) — กัน orphaned slot กิน disk ถ้า replica หลุดการเชื่อมต่อนาน
- Pin เวอร์ชัน PostgreSQL ให้ทั้งสองเครื่องเท่ากันเสมอ (ปัจจุบัน 16.14 ทั้งคู่) — ถ้าเครื่องใดเครื่องหนึ่ง apt upgrade ไปก่อนอาจทำให้ replication พังจาก version mismatch

**เป้าหมาย (ขั้นสูง, แล้วแต่ต้องการ RPO ดีขึ้น):**
- **WAL archiving / PITR** — ปัจจุบันถ้าลบ table ผิดตอนบ่าย เสียข้อมูลได้ถึง ~24 ชม. (dump ล่าสุดคือตี 2 จาก daily backup ใน #69) ถ้าทำ WAL archiving จะกู้คืนย้อนไปวินาทีไหนก็ได้ ตรงกับโจทย์ "กันลบผิด" ที่สุด — แต่ setup เพิ่มขึ้นพอควร (ต้องมี WAL archive storage แยก + ตั้ง `archive_mode`/`archive_command` + เครื่องมือ PITR restore)

**ตัดสินใจแล้ว — ยังไม่ทำ auto-failover:** ⚠️ ไม่ทำ auto-failover (Patroni/repmgr) บน 2-node เปล่า ๆ ตอนนี้ — เสี่ยง split-brain ถ้าไม่มี witness node ตัวที่ 3 การ failover มือ + runbook ที่มีอยู่แล้ว ([FAILOVER.md](FAILOVER.md)) เหมาะกับ scale นี้มากกว่า

**สถานะ:** IDEA — safety net 2 ข้อรอ execute (ติด sudo/SSH access ดู [DEPLOYMENT_NOTES.md](DEPLOYMENT_NOTES.md) รอบถัดไป), WAL archiving/PITR ยังไม่เริ่ม, auto-failover จงใจไม่ทำตอนนี้

### 6. เอกสารส่งมอบ TOR 6 ไฟล์ถูกลบออกจาก working tree — ตัดสินใจว่าจะกู้คืนหรือ commit การลบ  <!-- (2026-08-11) -->

**เป้าหมาย:** ให้เจ้าของตัดสินใจว่าเอกสารส่งมอบ 6 ไฟล์นี้จะเอากลับมาหรือจะลบถาวร — ตอนนี้อยู่ในสถานะกำกวม (`git status` เป็น `D` แต่ยังไม่ commit) และทำให้มี **ลิงก์เสีย** ในเอกสารที่ยังใช้งานอยู่

**สิ่งที่พบ:** ทั้ง 6 ไฟล์ยังอยู่ครบใน git ที่ commit `6bc604d` (2026-07-16) แต่ถูกลบออกจาก working tree โดย**ไม่มี note ไหนอธิบายว่าลบทำไม**:

| ไฟล์ | เอกสารข้อ |
|---|---|
| `notes/DATA_DICTIONARY_8.3.2.7.md` | 8.3.2.7 — พจนานุกรมข้อมูล |
| `notes/ER_DIAGRAM_8.3.2.6.md` | 8.3.2.6 — ER diagram |
| `notes/EVIDENCE_8.3.1.3.md` | 8.3.1.3 — หลักฐานประกอบ |
| `notes/OWASP_TOP10_8.3.2.3.md` | 8.3.2.3 — OWASP Top 10 |
| `notes/TEST_CASES_UAT_8.3.2.2.md` | 8.3.2.2 — test case / UAT |
| `notes/VULN_SCAN_8.3.2.4.md` | 8.3.2.4 — vulnerability scan |

**ลิงก์ที่เสียอยู่ตอนนี้:** `notes/ICD_DATA_EXCHANGE.md` บรรทัด ~46 และ ~464 ชี้ไปที่ `DATA_DICTIONARY_8.3.2.7.md` ที่ไม่มีในดิสก์แล้ว — ยังไม่ได้แก้ลิงก์ เพราะถ้ากู้ไฟล์คืนลิงก์จะถูกต้องเองทันที (แก้ลิงก์ตอนนี้อาจต้องแก้กลับ)

**แนวทาง (เลือกอย่างใดอย่างหนึ่ง):**
1. **กู้คืน** (ถ้ายังต้องส่งมอบ / ยังอยากให้ลิงก์ใช้ได้):
   ```bash
   git checkout HEAD -- notes/DATA_DICTIONARY_8.3.2.7.md notes/ER_DIAGRAM_8.3.2.6.md \
     notes/EVIDENCE_8.3.1.3.md notes/OWASP_TOP10_8.3.2.3.md \
     notes/TEST_CASES_UAT_8.3.2.2.md notes/VULN_SCAN_8.3.2.4.md
   ```
2. **ลบถาวร** — commit การลบ พร้อมเขียนเหตุผลใน DEPLOYMENT_NOTES.md **และ** แก้ลิงก์ทั้ง 2 จุดใน `ICD_DATA_EXCHANGE.md` ไม่ให้ค้างเป็นลิงก์เสีย

ไม่ว่าเลือกทางไหน ไฟล์เดิมยังกู้ได้เสมอด้วย `git show 6bc604d:notes/<ชื่อไฟล์>`

**สถานะ:** IDEA — **รอเจ้าของตัดสินใจ** ยังไม่ได้กู้คืนและยังไม่ได้ commit การลบ (เป็นการตัดสินใจของเจ้าของ ไม่ใช่งาน cleanup อัตโนมัติ)

### 7. `notes/รายงานงวดที่ 3-2.pdf` (41 MB) — เพิ่ม .gitignore ไว้ก่อน รอเจ้าของยืนยัน  <!-- (2026-08-11) -->

**เป้าหมาย:** กันไม่ให้ไฟล์ PDF 41 MB หลุดเข้า git history ถาวรโดยไม่ตั้งใจ

**สิ่งที่พบ (11 ส.ค. 2569):** `notes/รายงานงวดที่ 3-2.pdf` ขนาด ~41 MB เป็น untracked binary และ **ไม่ถูก `.gitignore` จับเลย** (`git check-ignore` ไม่ match) → `git add .` ครั้งเดียวก็ฝังลง history ถาวร ปัจจุบัน `.git` ทั้งโฟลเดอร์เพียง ~88 MB — ไฟล์เดียวนี้จะทำให้โตขึ้นเกือบ 50% และ **ลบออกทีหลังไม่ได้ถ้าไม่ rewrite history** (BFG / filter-repo) ซึ่งต้อง force-push ทับ

**แนวทาง (ทำไปแล้วรอบนี้):** เพิ่มกฎ `notes/*.pdf` ใน `.gitignore` พร้อม comment อธิบายและวิธี override

**⚠️ ต้องให้เจ้าของยืนยัน:** เจ้าของเคยบอกว่า "อยาก commit ทุกอย่าง" — กฎนี้จึง**ขัดกับความตั้งใจเดิม** ตั้งใจใส่ไว้เป็น safety net ไม่ใช่การตัดสินใจแทน ถ้ายืนยันว่าต้องการ PDF ใน git จริง เลือกได้:
- `git add -f "notes/รายงานงวดที่ 3-2.pdf"` — บังคับเพิ่มครั้งเดียว โดยกฎยังกัน PDF อื่นอยู่
- ลบบรรทัด `notes/*.pdf` ออกจาก `.gitignore` — กลับไปเหมือนเดิมทั้งหมด
- **แนะนำ:** ใช้ Git LFS ถ้าต้องเก็บรายงานใน repo จริง ๆ จะได้ไม่บวมใน history

**สถานะ:** IN PROGRESS — กฎ `.gitignore` ใส่แล้ว **รอเจ้าของตัดสินใจว่าจะ override หรือไม่**

---

### 8. ล้าง NextAuth cookie เมื่อ `/auth/google` ตอบ error  <!-- (2026-08-11) -->

**เป้าหมาย:** ตัดลูป "login ไม่ได้แบบเงียบๆ" เมื่อ Google access token ใน NextAuth session หมดอายุหรือใช้ไม่ได้

**ปัญหาปัจจุบัน:** `contexts/AuthContext.tsx:82-88` ตอน `POST /auth/google` ล้มเหลว จะเรียกแค่ `clearAuthStorage()` (ล้าง localStorage) แต่ **ไม่ล้าง cookie ของ NextAuth** → `sessionStatus` ยังเป็น `authenticated` → effect เดิมยิง token ที่ตายแล้วซ้ำทุกครั้งที่ reload → 401 → ล้าง localStorage → วนไปเรื่อยๆ ไม่มีอะไรบอกผู้ใช้ว่าเกิดอะไรขึ้น (เจอตอน debug BUGS #24 — backend log เต็มไปด้วย `POST /auth/google 401` ซ้ำๆ จาก session ค้าง)

**แนวทาง:** ใน `.catch()` เรียก `signOut({ redirect: false })` ด้วยเมื่อ `wimarc_auth_method !== "password"` เพื่อฆ่า session cookie ทิ้ง แล้วให้ผู้ใช้เริ่ม OAuth flow ใหม่สะอาดๆ · ทางเลือกที่ดีกว่าระยะยาวคือทำ refresh-token flow ใน `lib/authOptions.ts` (เก็บ `account.refresh_token` + `expires_at` ใน JWT แล้ว refresh เมื่อใกล้หมดอายุ) — Google access token อายุแค่ 1 ชม. แต่ NextAuth session อยู่ 30 วัน ช่องว่างนี้คือต้นเหตุ

**สถานะ:** IDEA
