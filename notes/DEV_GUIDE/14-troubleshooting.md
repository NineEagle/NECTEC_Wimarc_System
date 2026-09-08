# บทที่ 14 — แก้ปัญหา + กับดักที่ทุกคนเจอ

> เปิดดูตอนมีปัญหา ไม่ต้องอ่านรวดเดียว

## วิธีคิดเวลาเจอปัญหา — ไล่ทีละสถานี

อย่าเดา ให้ไล่จากปลายทางกลับมาต้นทาง:

```
① เบราว์เซอร์เห็นอะไร   → DevTools (F12) แท็บ Console และ Network
② คำขอไปถึง backend ไหม → docker compose logs -f backend
③ backend ตอบถูกไหม     → curl ที่ endpoint นั้นตรง ๆ
④ ข้อมูลในฐานข้อมูลถูกไหม → psql แล้ว SELECT ดูของจริง
```

หยุดที่สถานีแรกที่ผลไม่ตรงกับที่คิด นั่นคือจุดที่ต้องแก้

## เครื่องมือ 4 อย่างที่ต้องใช้เป็น

**1) DevTools ของเบราว์เซอร์** — กด F12

- แท็บ **Console** — ข้อความ error สีแดงจาก JavaScript
- แท็บ **Network** — ทุกคำขอที่ยิงออกไป กดดู status code และ response จริง
- แท็บ **Application → Local Storage** — ดูว่ามี `wimarc_token`, `wimarc_user` อยู่ไหม

**2) log ของ container**

```bash
docker compose logs -f backend
docker compose logs --tail=100 frontend
```

**3) curl** — ดูบทที่ 05

**4) psql** — ดูบทที่ 09

---

## ตารางอาการ → สาเหตุ → วิธีแก้

| อาการ | สาเหตุที่พบบ่อยที่สุด | วิธีแก้ |
|---|---|---|
| แก้โค้ดแล้วหน้าเว็บไม่เปลี่ยน | ยังไม่ได้ build image ใหม่ | `docker compose build frontend && docker compose up -d frontend` |
| แก้แล้ว build แล้วยังไม่เปลี่ยน | เบราว์เซอร์ใช้ไฟล์เก่าในแคช | กด `Ctrl+Shift+R` หรือเปิดหน้าต่างส่วนตัว |
| เปลี่ยนค่าใน `environment:` แล้วไม่มีผล | ค่านั้นเป็น build-time (`NEXT_PUBLIC_*`, `BACKEND_PROXY_URL`) | ย้ายไปแก้ที่ `args:` แล้ว build ใหม่ |
| ล็อกอินแล้วเด้งกลับหน้าแรกทันที | token หมดอายุ (24 ชม.) หรือ `JWT_SECRET` เปลี่ยน | ล็อกอินใหม่ · ถ้ายังไม่หาย ตรวจว่า `.env` ครบ |
| ทุกคำขอได้ 401 | ไม่มี token ใน localStorage | ล้าง localStorage แล้วล็อกอินใหม่ |
| ได้ 403 ทั้งที่ล็อกอินแล้ว | บทบาทไม่พอ หรือไม่มีสิทธิ์ในสถานีนั้น | ตรวจ `role` และ `permitted_station_ids` ในตาราง `users` |
| ได้ 422 | ข้อมูลที่ส่งไปผิดรูปแบบ | อ่าน `detail` ใน response มันบอกชื่อฟิลด์ที่ผิด |
| ได้ 429 | ยิงคำขอถี่เกินขีดจำกัด | รอสักครู่ · อย่าใส่ polling ถี่เกินจำเป็น |
| เพิ่มฟิลด์ใน backend แล้ว แต่ JSON ไม่มีให้ | ลืมประกาศใน `schemas.py` | เพิ่มฟิลด์ใน class `*Out` |
| เพิ่ม `Column` ใน `models.py` แล้ว endpoint พัง | `create_all()` ไม่เพิ่มคอลัมน์ให้ตารางเดิม | เพิ่ม `ALTER TABLE ... IF NOT EXISTS` ใน `on_startup` (บทที่ 09) |
| `clearApiCache()` แล้วข้อมูลยังค้าง | ฟังก์ชันนั้นเป็นโค้ดที่ตายแล้ว ไม่ได้ทำอะไร | โหลดข้อมูลใหม่ด้วยการเรียก service อีกครั้ง |
| build frontend ล้มที่ชื่อ import | ชื่อไอคอน lucide สะกดผิด | ตรวจชื่อจริงด้วยคำสั่งในบทที่ 13 |
| รูปจากกล้องหายทั้งระบบ | Apache ปิด `Options Indexes` ในโฟลเดอร์รูป | เปิดกลับแล้ว `systemctl reload apache2` |
| แผนที่ขึ้นแต่เป็นสีเทาเปล่า | CSP บล็อกโดเมนของ tile | เพิ่มโดเมนใน CSP ของ Apache (เคยแก้ไว้แล้ว ดู DEPLOYMENT 84) |
| กราฟข้อมูลเลื่อนไป 7 ชั่วโมง | ลืมบวก/ลบ offset เวลาไทย | ดู `BKK_OFFSET` ใน `main.py` |
| ค่าความชื้นดินขึ้น 100 % ทั้งที่หัววัดหลุด | ค่า ADC = 0 ถูกตีความว่าดินเปียก | โค้ดปัจจุบันคืน `None` แล้ว — ถ้าเจออีกแปลว่ามีคนแก้ผิด |
| ยอดน้ำฝนรายวันสูงผิดปกติหลายร้อย มม. | ฝั่งอุปกรณ์ไม่ได้รีเซ็ตตัวนับ ทำให้ค่าเป็นยอดสะสม | เป็นปัญหาฝั่งเฟิร์มแวร์ ดู `notes/TRAINING_2026-09-08.html` |
| `docker compose up` ขึ้น `port is already allocated` | มีโปรเซสเดิมค้าง | `docker compose down` แล้วลองใหม่ |
| container วน `Restarting` | สตาร์ทไม่ผ่าน มัก `.env` หาย | `docker compose logs backend` อ่านบรรทัดสุดท้าย |
| CSV เปิดใน Excel แล้วคอลัมน์เพี้ยน | ค่ามีจุลภาคหรือขึ้นบรรทัดใหม่แต่ไม่ได้ครอบ quote | ใช้เงื่อนไข `/[",\n\r]/` (บั๊กนี้เคยเกิดจริง) |

---

## เมื่อหน้าเว็บขาวทั้งหน้า

แปลว่า JavaScript พังตั้งแต่ตอน render เปิด Console แล้วดูบรรทัดแรกของ error

สาเหตุที่พบบ่อย 3 อย่าง:

1. **อ่าน property ของค่าที่เป็น null** — `station.name` ตอน `station` ยังเป็น `null`
   → แก้ด้วย `station?.name` หรือเช็ก `if (!station) return ...` ก่อน
2. **ใช้ตัวแปรก่อนประกาศ** — วาง `useEffect` ไว้ก่อนบรรทัดที่ประกาศตัวแปรที่มันใช้
   จะได้ `ReferenceError: Cannot access '...' before initialization` (เคยเกิดจริงในหน้าแผนที่)
3. **ลืม `"use client"`** — ใช้ `useState` ในไฟล์ที่ยังเป็น server component

---

## เมื่อข้อมูลไม่ตรงกับความจริง

ไล่ย้อนตามเส้นทางในบทที่ 07:

```bash
# ① ของจริงในฐานข้อมูลเป็นอะไร
psql -h localhost -U wimarc_admin -d wimarc_db \
  -c 'SELECT date, time, "Temp" FROM sensor_1min WHERE wimarc_id = 1 ORDER BY date DESC, time DESC LIMIT 3;'

# ② backend ตอบอะไร
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/stations/wimarc1/live | python3 -m json.tool

# ③ หน้าเว็บได้อะไร → DevTools → Network → คลิก request → แท็บ Response
```

ต่างกันตรงไหน = ผิดตรงนั้น

---

## คำสั่งฉุกเฉิน

```bash
# รีสตาร์ททุกอย่าง
cd /var/www/WiMaRC && docker compose restart

# รีสตาร์ทเฉพาะตัวเดียว
docker compose restart backend

# ดูว่าเครื่องยังมีพื้นที่ไหม
df -h && docker system df

# ดูว่าอะไรกินซีพียู
top -b -n 1 | head -20

# ตรวจว่าใครยึดพอร์ต 3000 อยู่
sudo lsof -i :3000
```

---

## เมื่อแก้ไม่ได้จริง ๆ

1. อ่าน `notes/BUGS.md` — ปัญหาที่เคยเจอ 27 ข้อพร้อมสาเหตุและวิธีแก้ อาจเป็นเรื่องเดียวกัน
2. อ่าน `notes/DEPLOYMENT_NOTES.md` — ดูว่ามีใครเพิ่งเปลี่ยนอะไรในบริเวณนั้นหรือเปล่า
3. `git log --oneline -20` แล้ว `git show <hash>` ดูว่าการเปลี่ยนล่าสุดทำอะไรไว้
4. ถ้าเว็บล่มอยู่ **ให้กู้ก่อนด้วยการย้อน commit (บทที่ 13) แล้วค่อยหาสาเหตุ**
   ผู้ใช้ 30 สวนรออยู่ การหาสาเหตุทำทีหลังได้
