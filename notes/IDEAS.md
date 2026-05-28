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
