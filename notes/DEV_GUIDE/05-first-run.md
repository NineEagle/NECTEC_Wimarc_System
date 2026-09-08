# บทที่ 05 — รันระบบครั้งแรก

> ทำ 30 นาที

มี 3 วิธีรัน เลือกตามสถานการณ์:

- **วิธี A** — รันแบบเดียวกับของจริงด้วย Docker (ใช้บนเซิร์ฟเวอร์)
- **วิธี B** — พัฒนาในเครื่องตัวเอง แก้แล้วเห็นผลทันที (ใช้ตอนเขียนโค้ด)
- **วิธี C** — รันเฉพาะหน้าเว็บ (ใช้ตอนแก้แค่หน้าตา)

---

## วิธี A — รันแบบเดียวกับของจริง (Docker)

```bash
cd /var/www/WiMaRC
docker compose up -d          # เปิดทั้ง frontend และ backend
docker compose ps             # ต้องเห็น 2 แถว สถานะ Up
docker compose logs -f        # ดู log สด ๆ (ออกด้วย Ctrl+C — ไม่ได้ปิด container)
docker compose down           # ปิดทั้งหมด
```

ผลลัพธ์ที่ควรได้: container ชื่อ `wimarc-frontend-1` และ `wimarc-backend-1` สถานะ `Up`
พอร์ตผูกไว้ที่ `127.0.0.1:3000` และ `127.0.0.1:8000`

> ผูกกับ `127.0.0.1` แปลว่าเข้าจากภายนอกตรง ๆ ไม่ได้ ต้องผ่าน Apache เท่านั้น — ตั้งใจให้เป็นแบบนั้น

**ข้อควรรู้:** โหมดนี้ **ไม่มี hot reload** แก้โค้ดแล้วหน้าเว็บจะไม่เปลี่ยนจนกว่าจะ build image ใหม่
(ดูบทที่ 13) เพราะ image เป็น production build ที่คอมไพล์ทุกหน้าไว้ล่วงหน้าแล้ว

---

## วิธี B — พัฒนาในเครื่องตัวเอง

โหมดนี้ frontend จะ **hot reload** คือแก้ไฟล์แล้วหน้าเว็บอัปเดตเองใน 1–2 วินาที
ส่วนฐานข้อมูลยังต่อไปที่เซิร์ฟเวอร์จริงผ่านอุโมงค์ SSH

```bash
cd /var/www/WiMaRC
./start.sh
```

สคริปต์นี้ทำ 4 อย่างตามลำดับ (ถ้าอยากรันเองทีละขั้นก็ได้ผลเหมือนกัน):

1. ปิดโปรเซสที่ค้างอยู่บนพอร์ต 5433, 8001, 8000, 3000
2. เปิดอุโมงค์ SSH ไปเซิร์ฟเวอร์ — พอร์ต `5433` ต่อฐานข้อมูล, `8001` ต่อรูปจากกล้อง
3. ติดตั้งไลบรารี Python แล้วรัน backend:
   `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
4. ติดตั้งไลบรารีหน้าเว็บแล้วรัน `pnpm dev` → เปิด `http://localhost:3000`

ทั้ง backend (`--reload`) และ frontend (`pnpm dev`) จะโหลดโค้ดใหม่เองเมื่อไฟล์เปลี่ยน
กด `Ctrl+C` ครั้งเดียวเพื่อปิดทั้งชุด (สคริปต์เก็บกวาดให้เอง)

---

## วิธี C — รันเฉพาะหน้าเว็บ

ใช้ตอนแก้แค่หน้าตา และมี backend รันอยู่แล้วที่พอร์ต 8000

```bash
pnpm install     # ครั้งแรกครั้งเดียว หรือเมื่อ package.json เปลี่ยน
pnpm dev         # เปิด http://localhost:3000
```

> **ถ้าไม่มี backend รันอยู่:** หน้าเว็บจะเปิดได้ แต่ล็อกอินไม่ผ่านและทุกการ์ดจะว่างเปล่า
> เพราะ `/backend/*` ถูกส่งต่อไป `http://localhost:8000` ซึ่งไม่มีใครรับ — ไม่ใช่บั๊ก

---

## ตรวจว่ารันสำเร็จจริง — 3 ขั้น

ทำตามลำดับ ถ้าขั้นไหนพัง ให้หยุดแก้ก่อน อย่าข้าม

```bash
# 1) backend มีชีวิตไหม — ต้องได้ JSON กลับมา
curl -s http://localhost:8000/health

# 2) ล็อกอินได้ token ไหม (ใส่บัญชีที่ขอมา)
curl -s -X POST http://localhost:8000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"YOUR_USER","password":"YOUR_PASS"}'

# 3) เอา token ที่ได้ไปขอข้อมูลสด
TOKEN=<วางค่า token ที่ได้จากข้อ 2>
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/stations/wimarc1/live
```

ข้อ 3 ต้องได้ JSON ที่มี `air_temperature`, `relative_humidity`, `vpd`, `last_ping` ฯลฯ
ถ้าได้ครบแปลว่าทั้งสายเชื่อมกันหมดแล้ว: FastAPI → ฐานข้อมูล → กลับมาเป็น JSON

จากนั้นเปิดเบราว์เซอร์ไปที่ `http://localhost:3000` แล้วล็อกอินด้วยบัญชีเดียวกัน
ควรเห็นหน้า `/dashboard` พร้อมการ์ดค่าต่าง ๆ

---

## เทคนิค curl ที่จะใช้ตลอดทั้งเล่ม

`curl` คือเครื่องมือดีบักที่ดีที่สุดของคุณ เวลาหน้าเว็บไม่ขึ้นข้อมูล **ให้ยิง curl ก่อนเสมอ**

- curl ได้ข้อมูล → ปัญหาอยู่ฝั่งหน้าเว็บ
- curl ไม่ได้ข้อมูล → ปัญหาอยู่ฝั่ง backend หรือฐานข้อมูล

แค่นี้ก็ตัดพื้นที่ค้นหาไปครึ่งหนึ่งแล้ว

เก็บ token ไว้ในตัวแปรจะสะดวกกว่า:

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"YOUR_USER","password":"YOUR_PASS"}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')

# ใช้ซ้ำได้ 24 ชั่วโมง
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/stations | head -c 400
```

---

## การอ่าน log

```bash
docker compose logs -f frontend       # เฉพาะหน้าเว็บ
docker compose logs -f backend        # เฉพาะ backend
docker compose logs --tail=100 backend   # ย้อนหลัง 100 บรรทัด
```

log ของ backend จะแสดงทุกคำขอที่เข้ามาพร้อม status code เช่น

```
INFO:  172.18.0.3:54321 - "GET /stations/wimarc1/live HTTP/1.1" 200 OK
INFO:  172.18.0.3:54322 - "POST /faults HTTP/1.1" 403 Forbidden
```

เห็น `403` แปลว่าคำขอไปถึงแล้วแต่สิทธิ์ไม่พอ ไม่ใช่ระบบพัง — คนละเรื่องกับ `500`

---

## ปัญหาที่เจอบ่อยตอนรันครั้งแรก

| อาการ | สาเหตุ | วิธีแก้ |
|---|---|---|
| `port is already allocated` | มีอะไรรันค้างบนพอร์ตนั้น | `docker compose down` หรือ `lsof -ti:3000 \| xargs kill -9` |
| backend ไม่สตาร์ท ขึ้นข้อความเรื่อง `JWT_SECRET` | ไม่มีไฟล์ `.env` หรือค่าว่าง | ขอไฟล์ `.env` มาวางที่รากโปรเจกต์ |
| ล็อกอินแล้วเด้งกลับหน้าแรกทันที | token หมดอายุ หรือ `JWT_SECRET` คนละค่ากับตอนออก token | ล็อกอินใหม่ |
| หน้าเว็บขึ้นแต่ทุกการ์ดว่าง | backend ไม่ได้รัน | ตรวจด้วย `curl http://localhost:8000/health` |
| `pnpm: command not found` | ยังไม่ได้เปิด corepack | `sudo corepack enable && corepack prepare pnpm@9.12.3 --activate` |
| `permission denied` ตอนสั่ง docker | ยังไม่ได้อยู่ในกลุ่ม docker | `sudo usermod -aG docker $USER` แล้ว logout/login |
