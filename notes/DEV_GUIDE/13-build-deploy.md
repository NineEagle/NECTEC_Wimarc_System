# บทที่ 13 — Build และ Deploy

> อ่าน 20 นาที · เป็นบทที่ต้องเปิดดูซ้ำบ่อยที่สุด

## กฎข้อเดียวที่ต้องจำ

> **แก้โค้ดฝั่งไหน ต้อง build ฝั่งนั้นใหม่เสมอ**
> ทั้ง frontend และ backend ไม่มี volume mount โค้ดถูกคัดลอกเข้า image ตอน build เท่านั้น

| แก้อะไร | ต้องทำ |
|---|---|
| ไฟล์ใน `app/`, `components/`, `services/`, `types/`, `utils/`, `contexts/`, `hooks/`, `lib/` | build frontend |
| `next.config.mjs`, `package.json`, `app/globals.css` | build frontend |
| ไฟล์ใน `backend/app/`, `backend/requirements.txt` | build backend |
| `docker-compose.yml` ช่อง `environment:` | แค่ `docker compose up -d` (ไม่ต้อง build) |
| `docker-compose.yml` ช่อง `args:` ของ build | **ต้อง build ใหม่** |
| ไฟล์ `.env` | `docker compose up -d` ใหม่ (ค่าที่เป็น `NEXT_PUBLIC_*` ต้อง build frontend ด้วย) |
| Apache config | `sudo apachectl configtest && sudo systemctl reload apache2` |
| ไฟล์ใน `notes/` | ไม่ต้องทำอะไร |

---

## คำสั่ง deploy มาตรฐาน

```bash
cd /var/www/WiMaRC

# แก้เฉพาะหน้าเว็บ
docker compose build frontend && docker compose up -d frontend

# แก้เฉพาะ backend
docker compose build backend && docker compose up -d backend

# แก้ทั้งสองฝั่ง
docker compose build backend frontend && docker compose up -d
```

เวลาที่ใช้: backend ประมาณ 30 วินาที – 1 นาที · frontend ประมาณ 1–3 นาที
(frontend นานกว่าเพราะต้องคอมไพล์ทุกหน้าไว้ล่วงหน้า)

ระหว่าง `up -d` เว็บจะสะดุดไม่กี่วินาทีตอนสลับ container — ทำนอกเวลาเร่งด่วนถ้าเลือกได้

---

## 🔴 ค่าที่ถูกฝังตอน build (build-time)

ค่า 5 ตัวนี้ถูกอ่านตอน build **ห้ามคาดหวังว่าจะแก้ได้ตอนรัน**

| ค่า | ตั้งที่ไหน |
|---|---|
| `BACKEND_PROXY_URL` | `args:` ใน `docker-compose.yml` หรือ `ARG` ใน `Dockerfile.frontend.prod` |
| `MEDIA_PROXY_URL` | เหมือนกัน |
| `NEXT_PUBLIC_SHOW_TOR_LABELS` | `args:` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | `args:` (อ่านจาก `.env` ผ่าน `${...}`) |
| `NEXT_PUBLIC_GOOGLE_MAP_ID` | `args:` |

ค่าเริ่มต้นที่ฝังอยู่ในตอนนี้: `BACKEND_PROXY_URL=http://backend:8000` (ชื่อ service ใน
docker-compose ซึ่ง Docker แปลงเป็น IP ให้เอง) และ `MEDIA_PROXY_URL=http://host.docker.internal`
(Apache บนเครื่องแม่ ใช้ดึงรูปจากกล้อง)

อาการเวลาพลาดข้อนี้: แก้ค่าใน `environment:` แล้ว restart แต่พฤติกรรมไม่เปลี่ยนเลย —
เพราะค่าที่ใช้จริงถูกฝังไว้ตั้งแต่ตอน build image

---

## ขั้นตอน deploy เต็มรูปแบบ

```bash
# 1) ดูให้แน่ใจว่าไม่มีอะไรค้างอยู่ใน working tree
cd /var/www/WiMaRC
git status

# 2) commit งานของคุณก่อน (ดูรูปแบบข้อความในบทที่ 15)
git add -A
git commit -m "feat(harvest): add harvest log page"

# 3) build + up
docker compose build backend frontend && docker compose up -d

# 4) ดู log ทันทีว่าไม่มี error ตอนสตาร์ท
docker compose logs --tail=50 backend
docker compose logs --tail=30 frontend

# 5) ตรวจสุขภาพ
curl -s http://localhost:8000/health
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000     # ต้องได้ 200

# 6) เปิดเว็บจริงแล้วกด Ctrl+Shift+R ตรวจหน้าที่แก้
```

## หลัง deploy ต้องตรวจอะไรบ้าง

- [ ] หน้าที่แก้ทำงานถูกต้อง
- [ ] `/dashboard` ยังขึ้นค่าปกติ (หน้าที่ผู้ใช้เข้ามากที่สุด)
- [ ] ล็อกอิน/ล็อกเอาต์ได้ ทั้งรหัสผ่านและ Google
- [ ] เปิดจากมือถือแล้วเมนูยังกดได้
- [ ] `docker compose ps` ทั้ง 2 ตัวยัง `Up` ไม่ใช่ `Restarting`

`Restarting` วนไปเรื่อย = สตาร์ทไม่ผ่าน ให้ดู `docker compose logs backend` ทันที
สาเหตุที่พบบ่อยคือ `.env` หาย ทำให้ `JWT_SECRET` ว่างและ backend ปฏิเสธการสตาร์ท

---

## วิธีย้อนกลับเมื่อ deploy แล้วพัง

**แบบที่ 1 — ย้อน commit (ใช้บ่อยที่สุด)**

```bash
git log --oneline -5           # หาว่า commit ก่อนหน้าคืออะไร
git revert <hash>              # สร้าง commit ใหม่ที่ยกเลิกการแก้นั้น
docker compose build frontend backend && docker compose up -d
```

ใช้ `git revert` ไม่ใช่ `git reset --hard` เพราะ revert เก็บประวัติไว้ครบ
คนที่มาดูทีหลังจะเห็นว่าเคยมีอะไรและถูกถอนออกเพราะอะไร

**แบบที่ 2 — กลับไปใช้ image เดิมชั่วคราว**

Docker เก็บ image เก่าไว้ (ชื่อจะกลายเป็น `<none>`)

```bash
docker images | head            # หา IMAGE ID ของตัวก่อนหน้า
docker tag <IMAGE_ID> wimarc-frontend:latest
docker compose up -d frontend
```

วิธีนี้เร็วที่สุด ใช้กู้หน้าเว็บก่อนแล้วค่อยไปหาสาเหตุ

---

## เมื่อ build ล้มเหลว

| ข้อความ error | สาเหตุ | แก้ |
|---|---|---|
| `Export ... doesn't exist in target module` ตอน build frontend | ชื่อไอคอน lucide สะกดผิด | ตรวจชื่อจริง (ดูคำสั่งด้านล่าง) |
| `Module not found: Can't resolve '@/...'` | path ผิด หรือลืมสร้างไฟล์ | ตรวจชื่อไฟล์และตัวพิมพ์เล็ก-ใหญ่ |
| `ERR_PNPM_OUTDATED_LOCKFILE` | แก้ `package.json` แต่ไม่ได้อัปเดต lockfile | รัน `pnpm install` แล้ว commit `pnpm-lock.yaml` ด้วย |
| `ModuleNotFoundError` ตอน build backend | ลืมใส่ไลบรารีใน `requirements.txt` | เพิ่มพร้อมระบุเวอร์ชัน |
| `no space left on device` | image เก่าเต็มดิสก์ | `docker image prune -f` |

ตรวจชื่อไอคอนก่อน build:

```bash
docker run --rm wimarc-frontend node -e \
  "const l=require('lucide-react');console.log(Object.keys(l).filter(k=>/pack/i.test(k)))"
```

> **หมายเหตุ:** `next.config.mjs` ตั้ง `typescript: { ignoreBuildErrors: true }`
> ดังนั้น error ของ TypeScript **ไม่ทำให้ build ล้ม** แต่ชื่อ import ที่ไม่มีจริง **ทำให้ล้มแน่นอน**

---

## หน้าที่ของ Apache (นาน ๆ แก้ที)

ไฟล์ `/etc/apache2/sites-available/wimarc-in-th.conf` ทำ 3 อย่าง

1. **บังคับ HTTPS** ทุกเส้นทาง ยกเว้น path ของอุปกรณ์ (ESP32 ส่งผ่าน HTTP เท่านั้น)
2. **ส่งต่อทุกอย่างที่เหลือไปที่ Next.js** `ProxyPass / http://127.0.0.1:3000/`
3. **ชี้ `/media/imgMain` และ `/media/imgClient`** ไปที่โฟลเดอร์รูปจริงบนดิสก์

```bash
sudo nano /etc/apache2/sites-available/wimarc-in-th.conf
sudo apachectl configtest              # ต้องขึ้น Syntax OK ก่อนเสมอ
sudo systemctl reload apache2          # reload ไม่ตัดการเชื่อมต่อที่ค้างอยู่
```

🔴 **ห้ามลบ `Options Indexes`** ออกจากส่วนของโฟลเดอร์รูป — backend หารูปล่าสุด
ด้วยการอ่าน directory listing จาก Apache ถ้าปิดตัวเลือกนี้ **รูปจะหายทั้งระบบ**

---

## เมื่อเซิร์ฟเวอร์ reboot

ทั้ง 2 container ตั้ง `restart: unless-stopped` จึงกลับมาเองอัตโนมัติ
สิ่งที่ต้องตรวจหลังเครื่องกลับมา:

```bash
docker compose ps                  # ทั้งคู่ต้อง Up
systemctl status postgresql        # ฐานข้อมูลต้องทำงาน
systemctl status apache2           # เว็บเซิร์ฟเวอร์ต้องทำงาน
curl -s http://localhost:8000/health
```

## ดูแลพื้นที่ดิสก์

การ build บ่อย ๆ ทำให้ image เก่าค้าง

```bash
docker system df                   # ดูว่าใช้ไปเท่าไหร่
docker image prune -f              # ลบ image ที่ไม่มีชื่อและไม่มีใครใช้
```

🔴 อย่ารัน `docker system prune -a` ตอน container กำลังทำงาน — มันจะลบ image ที่ใช้อยู่ด้วย
ถ้าเน็ตมีปัญหาแล้ว build ใหม่ไม่ได้ เว็บจะล่มยาว
