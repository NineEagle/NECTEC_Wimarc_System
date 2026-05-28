# WiMaRC Ideas & Future Plans

---

### 1. แยก Database ไปรันบนเครื่อง .200  <!-- (2026-05-28) -->

**เป้าหมาย:** ย้าย PostgreSQL ออกจาก .161 ไปรันบนเครื่อง 203.185.101.200 เพื่อแยก concern และลด load

**แนวทาง:**
- ทั้งสองเครื่องอยู่ใน same datacenter (latency 0.3ms, TTL=64) ต่อกันได้โดยตรง
- เปลี่ยน `DATABASE_URL` และ `WIMARC_DB_URL` ใน `.env` ให้ชี้ไปที่ IP ของ .200
- บน .200: `ufw allow from 203.185.101.161 to any port 5432` + `ufw deny 5432`
- ไม่ต้องเปลี่ยน code — แค่ env var เท่านั้น

**สถานะ:** IDEA

---

### 2. Telegram Bot แจ้งเตือนจาก WiMaRC  <!-- (2026-05-28) -->

**เป้าหมาย:** Bot Telegram แจ้งเตือน event ต่างๆ จากระบบ เช่น station offline, sensor ผิดปกติ, CPU สูง

**แนวทาง:** ยังไม่ได้ออกแบบ — รอ session ถัดไป

**สถานะ:** IDEA
