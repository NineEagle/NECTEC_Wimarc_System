# WiMaRC Ideas & Future Plans

---

### 1. แยก Database ไปรันบนเครื่อง .200  <!-- (2026-05-28) -->

**เป้าหมาย:** ย้าย PostgreSQL ออกจาก .161 ไปรันบนเครื่อง 203.185.101.200 เพื่อแยก concern และลด load

**แนวทาง:**
- ทั้งสองเครื่องอยู่ใน same datacenter (latency 0.3ms, TTL=64) ต่อกันได้โดยตรง
- เปลี่ยน `DATABASE_URL` และ `WIMARC_DB_URL` ใน `.env` ให้ชี้ไปที่ IP ของ .200
- บน .200: `ufw allow from 203.185.101.161 to any port 5432` + `ufw deny 5432`
- ไม่ต้องเปลี่ยน code — แค่ env var เท่านั้น

**สถานะ:** IN PROGRESS — อยู่ระหว่างเตรียมย้าย

**ข้อมูลที่รู้แล้ว:**
- .161 (203.185.101.161) = jasmine — รัน Frontend (Next.js) + Backend (FastAPI) + PostgreSQL อยู่ตอนนี้
- .200 (203.185.101.200) = เครื่องปลายทาง — ping ได้ latency 0.3ms TTL=64 → same datacenter same network
- ต่อกันได้โดยตรงผ่าน private network ไม่ผ่าน internet

**สิ่งที่ยังต้องรู้ก่อนเริ่ม (ถามตอน session ต่อไป):**
1. .200 มี OS อะไร, มี PostgreSQL ติดตั้งแล้วมั้ย หรือเป็นเครื่องเปล่า
2. ขนาด DB ปัจจุบัน — รัน `sudo -u postgres psql -c "\l+"` บน .161

**แผนการย้าย (draft):**
1. ติดตั้ง PostgreSQL บน .200 (ถ้ายังไม่มี)
2. สร้าง user `wimarc_admin` + database `wimarc_db` บน .200
3. dump DB จาก .161 → restore บน .200
4. ตั้ง UFW บน .200: allow 5432 จาก .161 เท่านั้น
5. เปลี่ยน `DATABASE_URL` และ `WIMARC_DB_URL` ใน `.env` ให้ชี้ไป .200
6. rebuild backend + test
7. ถ้าโอเค ลบ PostgreSQL ออกจาก .161

---

### 2. Telegram Bot แจ้งเตือนจาก WiMaRC  <!-- (2026-05-28) -->

**เป้าหมาย:** Bot Telegram แจ้งเตือน event ต่างๆ จากระบบ เช่น station offline, sensor ผิดปกติ, CPU สูง

**แนวทาง:** ยังไม่ได้ออกแบบ — รอ session ถัดไป

**สถานะ:** IDEA
