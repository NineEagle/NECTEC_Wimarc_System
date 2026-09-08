# บทที่ 16 — งานแรกของคุณ + cheat sheet

> ทำ 1–2 วัน

## แบบฝึกหัด 5 ชิ้น เรียงจากง่ายไปยาก

ทำครบทั้ง 5 ชิ้นแล้วถือว่าคุณดูแลระบบนี้ต่อได้จริง ทำบนเครื่องตัวเองก่อน (โหมด `./start.sh`)
อย่าเพิ่งแตะเครื่องจริงจนกว่าจะถึงชิ้นที่ 5

### ชิ้นที่ 1 — เปลี่ยนข้อความ (30 นาที)

เปลี่ยนชื่อเมนู "ค่าเฉลี่ยรายวัน" เป็น "สรุปรายวัน"

- แก้ที่ `components/layout/AppSidebar.tsx` → `navItems`
- **เป้าหมายที่ได้:** รู้ว่าเมนูมาจากไหน และเห็นผลของ hot reload

### ชิ้นที่ 2 — อ่านโค้ดแล้วตอบคำถาม (1 ชั่วโมง ไม่ต้องแก้อะไร)

ตอบคำถาม 5 ข้อนี้ให้ได้ พร้อมบอกชื่อไฟล์และเลขบรรทัดประกอบ:

1. ค่า "ความชื้นสัมพัทธ์" บนหน้า dashboard มาจากตารางอะไร คอลัมน์ไหน
2. หน้า `/dashboard` ดึงข้อมูลใหม่ทุกกี่วินาที ตั้งไว้ที่ตัวแปรชื่ออะไร
3. ผู้ใช้บทบาท Guest เข้าหน้าไหนได้บ้าง โค้ดที่บังคับอยู่ไฟล์ไหน
4. ระบบเตะผู้ใช้ออกเมื่อไม่ขยับกี่นาที เขียนไว้ที่ไหน
5. `wimarc7c` แปลงเป็น `wimarc_id` เท่าไหร่ และอ่านจากตารางอะไร

> เฉลยอยู่ในบทที่ 07, 08 และ 09 — แต่ให้ลองหาจากโค้ดจริงก่อน

### ชิ้นที่ 3 — เพิ่มหน้าใหม่ (2 ชั่วโมง)

ทำตามบทที่ 10 แต่เปลี่ยนโจทย์: ทำหน้า `/summary` ที่แสดงจำนวนสถานีทั้งหมด
จำนวนที่ออนไลน์ และจำนวนที่ออฟไลน์ เป็นการ์ด 3 ใบ

- ใช้ `permittedStations` จาก `useStation()`
- นับด้วย `.filter(s => s.status === "online").length`
- **เป้าหมายที่ได้:** สร้างหน้า + เมนู + เข้าใจ context

### ชิ้นที่ 4 — เพิ่มค่าใหม่ (3 ชั่วโมง)

ทำตามบทที่ 11 ให้ครบทั้ง 6 จุด แล้วทดสอบด้วย `curl` ทุกขั้น

- **เป้าหมายที่ได้:** เข้าใจเส้นทางข้อมูลทั้งสาย และการ build 2 ฝั่ง

### ชิ้นที่ 5 — แก้บั๊กจริงแล้ว deploy (ครึ่งวัน)

หยิบงานจริงสักชิ้นจาก `notes/IDEAS.md` ที่สถานะยังเป็น `IDEA` หรือถามผู้ดูแลว่ามีอะไรค้างอยู่
แล้วทำให้ครบวงจร:

1. แก้โค้ด
2. ทดสอบในเครื่องตัวเอง
3. commit ตามรูปแบบในบทที่ 15
4. build + deploy บนเครื่องจริง
5. ตรวจหลัง deploy ตามเช็กลิสต์บทที่ 13
6. จดบันทึกลง `notes/` ให้ถูกไฟล์ พร้อมเลข commit

- **เป้าหมายที่ได้:** ครบวงจรการทำงานของโปรเจกต์นี้

---

## Cheat sheet — คำสั่งที่ใช้บ่อยที่สุด

### รันและ deploy

```bash
cd /var/www/WiMaRC

docker compose up -d                                   # เปิดระบบ
docker compose down                                    # ปิดระบบ
docker compose ps                                      # ดูสถานะ
docker compose logs -f backend                         # ดู log สด
docker compose restart backend                         # รีสตาร์ท

docker compose build frontend && docker compose up -d frontend   # deploy หน้าเว็บ
docker compose build backend  && docker compose up -d backend    # deploy backend
docker compose build backend frontend && docker compose up -d    # deploy ทั้งคู่

./start.sh                                             # โหมดพัฒนาในเครื่องตัวเอง
pnpm dev                                               # เฉพาะหน้าเว็บ
pnpm build                                             # ทดลอง build โดยไม่ใช้ Docker
```

### ตรวจสุขภาพระบบ

```bash
curl -s http://localhost:8000/health                   # backend ยังไหวไหม
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000    # frontend ตอบ 200 ไหม
docker compose ps                                      # container ทั้งคู่ Up ไหม
systemctl status postgresql apache2                    # บริการบนเครื่องแม่
df -h && docker system df                              # พื้นที่ดิสก์
```

### ทดสอบ API

```bash
# ขอ token
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"USER","password":"PASS"}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')

# ใช้ token
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/stations | python3 -m json.tool
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/stations/wimarc1/live | python3 -m json.tool

# ดูเฉพาะ status code
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $TOKEN" http://localhost:8000/faults
```

### ค้นหาในโค้ด

```bash
grep -rn "ค่าที่หา" app/ components/ services/    # ค้นในหน้าเว็บ
grep -n '^@app\.' backend/app/main.py             # รายการ endpoint ทั้งหมด
grep -n 'def _' backend/app/main.py               # ฟังก์ชันช่วยทั้งหมด
grep -c '^### ' notes/BUGS.md                     # เลขลำดับล่าสุดของบันทึก
```

### ฐานข้อมูล

```bash
psql -h localhost -U wimarc_admin -d wimarc_db

# ในคำสั่งเดียว
psql -h localhost -U wimarc_admin -d wimarc_db -c 'SELECT id, username, role FROM users;'
```

### git

```bash
git status
git diff
git add -A && git commit -m "feat(x): ..."
git log --oneline -10
git show <hash>
git revert <hash>
git push origin main
```

---

## เส้นทางเรียนรู้หลังจบเล่มนี้

| อยากเก่งเรื่อง | อ่าน/ทำอะไรต่อ |
|---|---|
| React ให้ลึกขึ้น | เอกสารทางการ react.dev ส่วน "Thinking in React" และ hooks |
| Next.js App Router | เอกสาร nextjs.org ส่วน App Router (โปรเจกต์นี้ใช้ Next.js 16) |
| FastAPI | เอกสาร fastapi.tiangolo.com — ตัวอย่างครบและอ่านง่าย |
| SQL / PostgreSQL | ฝึกด้วยฐานข้อมูลจริงในบทที่ 09 แล้วค่อยไปหัวข้อ index กับ query plan |
| ระบบนี้โดยเฉพาะ | อ่าน `notes/DEPLOYMENT_NOTES.md` ทั้งไฟล์ — เห็นวิวัฒนาการทั้งหมดของระบบ |

---

## ปิดท้าย

สามสิ่งที่ถ้าจำได้จะไม่พลาดเรื่องใหญ่:

1. **แก้โค้ดแล้วต้อง build ใหม่เสมอ** ทั้งสองฝั่งไม่มี volume mount
2. **การตรวจสิทธิ์ของจริงอยู่ฝั่ง backend เท่านั้น** การซ่อนปุ่มในหน้าเว็บไม่ใช่ความปลอดภัย
3. **จดบันทึกทุกครั้งที่ทำเสร็จ** คนถัดไป (ซึ่งอาจเป็นตัวคุณเองในอีก 3 เดือน) จะขอบคุณ

ระบบนี้มีผู้ใช้จริง 30 สวนพึ่งพาข้อมูลอยู่ทุกวัน เวลาจะแก้อะไรบนเครื่องจริง
ให้ทดสอบในเครื่องตัวเองก่อนเสมอ และเตรียมวิธีย้อนกลับไว้ล่วงหน้า
