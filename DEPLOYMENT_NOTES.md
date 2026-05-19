# WiMaRC Deployment Notes
**Server:** jasmine (203.185.101.161 / wimarc.in.th)  
**OS:** Ubuntu 24.04  
**Stack:** Apache + Let's Encrypt + PostgreSQL 16 + Docker

---

## สิ่งที่ทำไปทั้งหมด

---

### 1. ติดตั้ง Docker (Docker CE จาก official repo)

Ubuntu 24.04 ไม่มี `docker-compose-plugin` ใน default apt repo ต้องเพิ่ม Docker official repo ก่อน:

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu noble stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker opas
```

---

### 2. PostgreSQL — Grant permissions ให้ wimarc_admin

legacy DB `wimarc_db` มี tables บางส่วนที่ owner คือ `postgres` ไม่ใช่ `wimarc_admin`  
ทำให้ backend connect ได้แต่ SELECT/INSERT ไม่ได้ → ต้อง grant:

```bash
PGPASSWORD='Wimarc@2026' psql -h 127.0.0.1 -U postgres -d wimarc_db << 'SQL'
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO wimarc_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO wimarc_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO wimarc_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO wimarc_admin;
SQL
```

**Postgres password:** `Wimarc@2026` (superuser)  
**wimarc_admin password:** `wimarc@dmin`

---

### 3. PostgreSQL — เปิด Docker subnet ใน pg_hba.conf

เพื่อให้ container เชื่อมต่อ Postgres บน host ได้ผ่าน `172.17.0.1`:

```bash
echo "host    wimarc_db    wimarc_admin    172.17.0.0/16    md5" \
  | sudo tee -a /etc/postgresql/16/main/pg_hba.conf
sudo systemctl reload postgresql
```

---

### 4. docker-compose.yml — สิ่งที่เปลี่ยนจากต้นฉบับ

ไฟล์ต้นฉบับมีปัญหาหลายจุดสำหรับ production บน server นี้:

| สิ่งที่เปลี่ยน | เหตุผล |
|---|---|
| ลบ `db` service ออก | ชน port 5432 กับ legacy Postgres |
| ลบ `wimarc-api` service ออก | build context `./wimarc-api` ไม่มีใน repo |
| ลบ `wimarc-redis` service ออก | dependency ของ wimarc-api ที่ไม่มีแล้ว |
| เปลี่ยน `DATABASE_URL` | จาก `postgres:5533` → `wimarc_admin:wimarc%40dmin@host.docker.internal:5432/wimarc_db` |
| เปลี่ยน `CORS_ORIGINS` | จาก `http://localhost:3000` → `https://wimarc.in.th` |
| เปลี่ยน `FILE_SERVER_URL` | จาก `http://host.docker.internal:8001` → `http://host.docker.internal` (Apache port 80) |
| เปลี่ยน `MEDIA_PROXY_URL` | จาก `http://host.docker.internal:8001` → `http://host.docker.internal` |
| เปลี่ยน `JWT_SECRET` | ใช้ random hex จาก `openssl rand -hex 32` |
| ลบ `TMD_PROXY_URL` ออก | ชี้ไป wimarc-api ที่ไม่มีแล้ว |

---

### 5. .env ที่ /var/www/WiMaRC/.env

```
TMD_API_KEY=
JWT_SECRET=262b537d4b75855fbebffd97b5357190a24e0c3f08bdc45ce4c66e3e069ee77a
```

---

### 6. Apache — /etc/apache2/sites-available/wimarc-in-th.conf

ต้อง enable modules ก่อน:
```bash
sudo a2enmod proxy proxy_http proxy_wstunnel rewrite
```

**config ปัจจุบัน** (อยู่ที่ `/tmp/wimarc-in-th.conf` สำรองไว้ด้วย):

```apache
<VirtualHost *:80>
    ServerName wimarc.in.th
    ServerAlias *.wimarc.in.th
    DocumentRoot /var/www/wimarc

    <Directory /var/www/wimarc>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    # ESP32 ส่งผ่าน HTTP — ต้องให้ PHP ทำงานได้โดยตรง ห้าม redirect
    <LocationMatch "^/(InsertdataW32|checkTimer|uploadCAM|uploadCAMV|uploadIMG|uploadCAM_main|uploadCAM_client|view|dblink|linenotifySIM|test|export01|createtable|droptable|imgMain|imgClient)">
        ProxyPass !
    </LocationMatch>

    # อื่นๆ → redirect HTTPS
    RewriteEngine On
    RewriteCond %{REQUEST_URI} !^/(InsertdataW32|checkTimer|uploadCAM|uploadCAMV|uploadIMG|uploadCAM_main|uploadCAM_client|view|dblink|linenotifySIM|test|export01|createtable|droptable|imgMain|imgClient)
    RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L]
</VirtualHost>

<VirtualHost *:443>
    ServerName wimarc.in.th
    ServerAlias *.wimarc.in.th
    DocumentRoot /var/www/wimarc

    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/wimarc.in.th/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/wimarc.in.th/privkey.pem

    <Directory /var/www/wimarc>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    # รูปกล้อง — map /media/imgMain/ และ /media/imgClient/ ตรงไปยังไฟล์จริง
    Alias /media/imgMain /var/www/wimarc/imgMain
    Alias /media/imgClient /var/www/wimarc/imgClient

    <Directory /var/www/wimarc/imgMain>
        Options Indexes FollowSymLinks
        AllowOverride None
        Require all granted
    </Directory>
    <Directory /var/www/wimarc/imgClient>
        Options Indexes FollowSymLinks
        AllowOverride None
        Require all granted
    </Directory>

    ProxyPreserveHost On

    # WebSocket สำหรับ Next.js HMR
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/(.*) ws://127.0.0.1:3000/$1 [P,L]

    # Legacy PHP + static dirs + media — ห้าม proxy ไป Next.js
    ProxyPassMatch ^/(InsertdataW32[^/]*\.php|checkTimer[^/]*\.php|checkTimerLORA[^/]*\.php|uploadCAM[^/]*\.php|uploadCAMV[^/]*\.php|uploadIMG\.php|uploadCAM_main\.php|uploadCAM_client\.php|view[^/]*\.php|dblink[^/]*\.php|linenotifySIM\.php|test\.php|export01\.php|createtable\.php|droptable\.php|imgMain(/.*)?|imgClient(/.*)?|media(/.*)?|favicon\.ico)$ !

    # Next.js frontend
    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/
</VirtualHost>
```

**หมายเหตุสำคัญ:** ไม่มี `ProxyPass /api/` → FastAPI  
เพราะ frontend ใช้ `/backend/` prefix ซึ่ง Next.js rewrite ไปหา FastAPI เอง  
และ NextAuth ใช้ `/api/auth/*` ซึ่งต้องให้ Next.js จัดการ

---

### 7. รูปกล้อง (IMAGE_URL flow)

- Backend สร้าง `image_url` เป็น `/media/imgMain/{folder}/{filename}`
- Next.js rewrite `/media/:path*` → `http://host.docker.internal/:path*` (Apache port 80)
- Apache port 80 redirect → HTTPS
- Browser follow → Apache port 443 → Alias → `/var/www/wimarc/imgMain/`
- `FILE_SERVER_URL=http://host.docker.internal` ให้ backend list รูปจาก Apache directory listing

---

### 8. แก้ไข backend — delete user cascade

**ปัญหา:** ลบ user ไม่ได้เพราะ `stations.owner_id` FK constraint  
**แก้ที่:** `backend/app/main.py` ฟังก์ชัน `delete_user`:

```python
db.query(Station).filter(Station.owner_id == user_id).update({"owner_id": None}, synchronize_session=False)
db.flush()
db.delete(user)
db.commit()
```

**สำคัญ:** backend ไม่มี volume mount — ทุกครั้งที่แก้ code ต้อง rebuild:
```bash
docker compose up -d --build backend
```

frontend มี volume mount `.:/app` จึง hot-reload อัตโนมัติ

---

### 9. แก้ไข frontend

| ไฟล์ | สิ่งที่เปลี่ยน |
|---|---|
| `app/page.tsx` | เปลี่ยน logo จาก `durian-logo.svg` (กรอบวงกลม) → `apple-icon.png` (ไม่มีกรอบ) |
| `app/layout.tsx` | เพิ่ม `icons: { icon: "/apple-icon.png" }` ใน metadata สำหรับ tab browser |
| `app/admin/users/page.tsx` | ปรับ delete confirmation dialog เป็นภาษาไทย แสดงชื่อ user ที่จะลบ |

---

### 10. การ run และ maintain

```bash
# เริ่ม / หยุด
cd /var/www/WiMaRC
docker compose up -d          # start
docker compose down           # stop
docker compose logs -f        # ดู logs realtime

# แก้โค้ด frontend → hot reload อัตโนมัติ (มี volume mount)
# แก้โค้ด backend → ต้อง rebuild เสมอ:
docker compose up -d --build backend

# แก้ Apache config
sudo cp /tmp/wimarc-in-th.conf /etc/apache2/sites-available/wimarc-in-th.conf
sudo apachectl configtest && sudo systemctl reload apache2

# Reboot server (kernel pending upgrade)
# containers จะ restart อัตโนมัติเพราะตั้ง restart: unless-stopped
sudo reboot
```

---

### 11. แก้ไข TMD (กรมอุตุนิยมวิทยา) forecast

**ปัญหา:** backend เรียก `forecast/location/hourly/at` ด้วย `duration=168` แต่ TMD จำกัดไว้ที่ 48 → ได้รับ HTTP 422

**แก้:** เปลี่ยนเป็น `forecast/location/daily/at` พร้อม `duration=7` ได้ 7 วันโดยตรง

```python
# backend/app/main.py — endpoint ใหม่
url = (
    f"https://data.tmd.go.th/nwpapi/v1/forecast/location/daily/at"
    f"?lat={round(station.latitude, 4)}&lon={round(station.longitude, 4)}"
    f"&fields=tc_max,tc_min,rh,rain,ws10m,wd10m"
    f"&date={now.strftime('%Y-%m-%d')}&duration=7"
)
```

**Fields ที่ TMD daily รองรับทั้งหมด:** `tc`, `tc_max`, `tc_min`, `rh`, `rain`, `ws10m`, `wd10m`, `psfc`, `slp`, `cond`, `cloudlow`, `cloudmed`, `cloudhigh`  
**TMD API limit:** 60 req/นาที, 100,000 datapoints/เดือน — เรียกเฉพาะตอนเปลี่ยนสถานี

ยังต้อง rebuild backend หลังแก้:
```bash
docker compose build backend && docker compose up -d backend
```

---

### 12. เพิ่ม features ฝั่ง UI

| Feature | รายละเอียด |
|---|---|
| ปุ่ม A-/A+ | มุมขวาบน header — ปรับขนาดตัวหนังสือ 6 ระดับ (85%–125%) บันทึกใน localStorage |
| การ์ดพยากรณ์วันนี้ | เพิ่ม label ชื่อค่า (อุณหภูมิ, ฝนสะสม, ความชื้น, ลม) และแสดงสูงสุด/ต่ำสุด (แดง/น้ำเงิน) |
| ตารางพยากรณ์ 7 วัน | แสดง maxTemp/minTemp แทน avgTemp พร้อม `types/index.ts` เพิ่ม field |

---

### 13. Switch frontend จาก dev → production build ✅

**ปัญหา:** รัน `next dev` บน production → compile ทุกหน้าครั้งแรก ใช้ 2–4 วินาที

**แก้:** เปลี่ยน `docker-compose.yml` ให้ใช้ `Dockerfile.frontend.prod` (pre-build ทุกหน้า)

```yaml
frontend:
  build:
    context: .
    dockerfile: Dockerfile.frontend.prod
    args:
      NEXT_PUBLIC_SHOW_TOR_LABELS: "1"
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: ""
  environment:
    BACKEND_PROXY_URL: "http://backend:8000"
    NEXTAUTH_SECRET: "${NEXTAUTH_SECRET:-dev-secret-change-me}"
    NEXTAUTH_URL: "http://localhost:3000"
```

**ต้องเพิ่มใน `.env`:**
```
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
```

**ผลลัพธ์:** ทุกหน้าตอบภายใน 10–16ms (เทียบกับ 2–4s เดิม)

**rebuild frontend:**
```bash
docker compose build frontend && docker compose up -d frontend
```

**หมายเหตุ:** หลัง switch prod build — WebSocket HMR ใน Apache ไม่จำเป็นแล้ว แก้โค้ด frontend ต้อง rebuild เสมอ (เหมือน backend)

---

### 14. สิ่งที่ยังค้างอยู่ (ไม่เร่งด่วน)

| รายการ | รายละเอียด |
|---|---|
| `weather_forecasts` migration warning | backend ขอ ALTER TABLE แต่ไม่ใช่ owner — ไม่กระทบการทำงาน แก้ได้ด้วย `ALTER TABLE weather_forecasts OWNER TO wimarc_admin;` |
| Kernel upgrade pending | reboot เมื่อสะดวก (6.8.0-90 → 6.8.0-111) |

---

### 15. ปรับสี StationTypeToggle ให้ปุ่มที่เลือกเด่นชัด (2026-05-19)

**ไฟล์:** `components/layout/StationTypeToggle.tsx`

**เปลี่ยน:** ปุ่มที่ active จาก `bg-background text-foreground` → `bg-primary text-primary-foreground`  
ปุ่มที่ไม่ได้เลือกยังคงเป็น `text-muted-foreground` บน `bg-muted` เหมือนเดิม  
ผลลัพธ์: ปุ่มที่เลือกแสดงสี primary (น้ำเงิน) เห็นความแตกต่างชัดเจน

ต้อง rebuild frontend:
```bash
docker compose build frontend && docker compose up -d frontend
```

---

### 16. เปลี่ยนรูปแบบวันที่ในตารางพยากรณ์อากาศ (2026-05-19)

**ไฟล์:** `app/dashboard/page.tsx` line 538

**เปลี่ยน:** format วันที่จาก `{ weekday: "short", day: "numeric", month: "short" }` (ได้ "อังคาร 19 พ.ค.")  
→ `{ day: "numeric", month: "long", year: "numeric" }` (ได้ "19 พฤษภาคม 2568")  
locale `th-TH` แสดงปีเป็น พ.ศ. อัตโนมัติ

ต้อง rebuild frontend:
```bash
docker compose build frontend && docker compose up -d frontend
```

---

### 17. เพิ่มหน่วยในสถิติ ล่าสุด/เฉลี่ย/ต่ำ/สูง ของกราฟ HistoricalChart (2026-05-19)

**ไฟล์:** `components/charts/HistoricalChart.tsx` บรรทัด 57-60

**เปลี่ยน:** เพิ่ม `{unit}` ต่อท้ายค่าในทุก span (ล่าสุด, เฉลี่ย, ต่ำ, สูง)  
`unit` prop ถูกส่งมาจากทุก chart ที่ใช้ `HistoricalChart` อยู่แล้ว เช่น `°C`, `%`, `kPa`  
ผลลัพธ์: แสดงเป็น "ล่าสุด 81.8%" แทนที่จะเป็น "ล่าสุด 81.8"

ต้อง rebuild frontend:
```bash
docker compose build frontend && docker compose up -d frontend
```

---

### 18. ทำ format วันที่ในหน้าข้อมูลย้อนหลังให้เหมือนกัน (2026-05-19)

**ไฟล์:** `app/historical/page.tsx`

**ปัญหา:** ตารางพยากรณ์ (วันที่ column) ใช้ `formatThaiDateWeekday` → แสดงวันในสัปดาห์นำหน้า เช่น "ศุกร์ 15 พฤษภาคม พ.ศ. 2569"  
ในขณะที่ตารางข้อมูลดิบ (วัน/เวลา column) ใช้ `formatThaiDateTime` → "19 พฤษภาคม พ.ศ. 2569 10:10" (ไม่มีวันในสัปดาห์)

**แก้:** เปลี่ยน `formatThaiDateWeekday(d.date)` → `formatThaiDate(d.date)` ใน forecast table  
อัปเดต import: ลบ `formatThaiDateWeekday` เพิ่ม `formatThaiDate`

ต้อง rebuild frontend:
```bash
docker compose build frontend && docker compose up -d frontend
```

---

### 19. ปรับกราฟ x-axis เอียง + label "วันที่" และย้ายหน่วยตารางไปที่ header (2026-05-19)

**ไฟล์:** `app/daily/page.tsx`

**กราฟ x-axis (ทุก XAxis ในหน้า — 5 จุด):**
- ย่อ `dateLabel` จาก "19 พฤษภาคม พ.ศ. 2569" → "19 พ.ค." (ใช้ `month: "short"`) เพื่อไม่ให้ label ทับกัน
- เพิ่ม `tick={{ angle: -35, textAnchor: "end" }}` ให้ label เอียง
- เพิ่ม `height={65}` เพื่อรองรับ label เอียง
- เพิ่ม `label={{ value: "วันที่", position: "insideBottomRight" }}` บอกแกน x

**ตารางค่าเฉลี่ยรายวัน:**
- เพิ่มหน่วยที่ header: อุณหภูมิเฉลี่ย (°C), ต่ำสุด/สูงสุด (°C), ความชื้นเฉลี่ย (%), VPD เฉลี่ย (kPa), ช่วงกลางวัน (ชม.), ชื้นดิน (%), อุณหภูมิดิน (°C)
- ลบหน่วยออกจาก data cell ทุกช่อง (°C, %, mm, m/s, ชม.)

ต้อง rebuild frontend:
```bash
docker compose build frontend && docker compose up -d frontend
```

---

### 20. ซ่อน camera gallery และปรับ dropdown ใน activities page ตาม role/จำนวน station (2026-05-19)

**ไฟล์:** `app/activities/page.tsx`

**เงื่อนไข `showCameraGallery`:** แสดง section ภาพถ่ายสถานี ก็ต่อเมื่อ admin หรือมี weather station มากกว่า 1 สถานี  
User ที่มี station เดียวจะไม่เห็น section นี้ และจะไม่มีการ fetch รูปโดยไม่จำเป็น

**Dropdown "all" label:** Admin → "สถานีทั้งหมด" | User/Guest → "ทุกสถานีที่ได้รับอนุญาต"

ต้อง rebuild frontend:
```bash
docker compose build frontend && docker compose up -d frontend
```

---

### 21. ปรับ label สถานะแผนที่ และ format station ID (2026-05-19)

**ไฟล์:** `app/map/page.tsx`, `components/maps/ModernMap.tsx`

**Label สถานะ (STATUS_CFG + legend):**
- สีเหลือง: "อากาศ online ดิน offline" → "สถานีอากาศ Online, สถานีดิน Offline"
- สีส้ม: "อากาศ offline ดิน online" → "สถานีอากาศ Offline, สถานีดิน Online"

**Station ID format (`fmtStationId`):**
- "wimarc2" → "Wimarc02" (zero-pad เลข, mixed case แทน ALL CAPS)
- "wimarc10" → "Wimarc10", "wimarc2c" → "Wimarc02c"
- ใช้ในทั้ง: panel header ขวา, ตาราง wimarc_id, popup badge บนแผนที่

ต้อง rebuild frontend:
```bash
docker compose build frontend && docker compose up -d frontend
```

---

### 22. เพิ่ม VpdInfoButton — tooltip อธิบาย VPD ทุกจุดในระบบ (2026-05-19)

**ไฟล์ใหม่:** `components/ui/VpdInfoButton.tsx`  
วงกลมสีเขียวเล็กที่มี icon "i" — hover/click แสดง tooltip: "ค่าความต่างของแรงดันไอน้ำในอากาศกับภายในใบพืช"

**ใส่ใน:**
- `app/dashboard/page.tsx` — SensorCard ที่ `type="vpd"` (ใต้ชื่อ card)
- `app/compare/page.tsx` — CompareSensorCard title + checkbox label "VPD (kPa)"
- `app/daily/page.tsx` — chart title "VPD รายวัน" + table header "VPD เฉลี่ย (kPa)"
- `app/historical/page.tsx` — table header "VPD (kPa)"
- `app/map/page.tsx` — label "VPD:" ใน detail panel
- `components/maps/ModernMap.tsx` — label "VPD" ใน popup

ต้อง rebuild frontend:
```bash
docker compose build frontend && docker compose up -d frontend
```

---

### 23. Security hardening — ปิด health leak, แก้ NextAuth URL, ปิด docs, ซ่อน banner  <!-- (2026-05-19) -->

แก้ช่องโหว่ความปลอดภัย 5 ข้อ (CRITICAL→LOW):

1. **CRITICAL /health leak** — แยก `GET /health` (public, return `{"status":"ok"}` เท่านั้น) กับ `GET /health/detail` (ต้องมี JWT) — ไม่ expose CPU/mem/disk/DB/SSL error อีกต่อไป
2. **HIGH NEXTAUTH_URL** — เปลี่ยนจาก `http://localhost:3000` → `https://www.wimarc.in.th` ใน `.env` และ `docker-compose.yml` — OAuth callback URL ถูกต้องแล้ว
3. **MEDIUM FastAPI docs** — disable `/docs`, `/redoc`, `/openapi.json` ใน production ด้วย env var `ENV=dev` toggle ใน `main.py`
4. **LOW Server banner** — ปิด `X-Powered-By: Next.js` (`poweredByHeader: false` ใน `next.config.mjs`) และ strip `server` header จาก FastAPI ด้วย middleware
5. **LOW Security headers** — Apache vhost + security.conf: `ServerTokens Prod`, `ServerSignature Off`, HSTS/X-Content-Type/X-Frame/CSP/Referrer-Policy — **ต้องรัน `sudo cp` สองคำสั่งใน `SECURITY_FIXES_20260519.md` ก่อน headers จะมีผล**

**Files แก้:** `backend/app/main.py`, `.env`, `docker-compose.yml`, `next.config.mjs`
**Files รอ sudo:** `/tmp/wimarc-in-th.conf.new` → sites-available, `/tmp/security.conf.new` → conf-available
**Rebuilt:** backend + frontend
**Report:** `SECURITY_FIXES_20260519.md`

---

### 24. Security hardening round 2 — V1–V5 pentest findings  <!-- (2026-05-19) -->

แก้ช่องโหว่ที่ pentest พบ 5 ข้อ (CRITICAL→HIGH):

1. **CRITICAL V1+V3 /users dump + password leak** — เพิ่ม `require_admin` dependency บนทุก `/users/*` endpoint; ลบ field `password` ออกจาก `UserOut` schema → login response + user list ไม่มี password อีกต่อไป
2. **CRITICAL V2 plaintext passwords** — เพิ่ม `passlib[bcrypt]==1.7.4` + `bcrypt==3.2.2`; migration ใน `on_startup` hash password ทุก user ที่ยังเป็น plaintext เป็น `$2b$12$...`; `create_user`/`update_user` hash ก่อน save; `login` ใช้ `_pwd_ctx.verify()` แทน `==`; Google OAuth users ได้ random unusable hash
3. **HIGH V4 /stations unauth GPS dump** — เพิ่ม `get_current_user` dependency บน `GET /stations` + `GET /stations/{id}`; non-Admin ได้เห็นแค่ `permitted_station_ids` ของตัวเอง; write endpoints require Admin
4. **HIGH V5 login brute-force** — เพิ่ม `slowapi==0.1.9` rate limiter: 5 req/min per IP; ใช้ `X-Forwarded-For` จาก Apache; implement constant-time verify (prevent timing oracle)

**Files แก้:** `backend/requirements.txt`, `backend/app/schemas.py`, `backend/app/main.py`
**Rebuilt:** backend
**Verify:**
- `GET /backend/users` → 401 ✓
- `POST /backend/auth/login` response → ไม่มี password field ✓
- `GET /backend/stations` → 401 ✓
- login attempt 6 → 429 ✓
- passwords ใน DB → `$2b$12$...` prefix ✓

---

### 25. แก้ dashboard ค้าง skeleton สำหรับ User role  <!-- (2026-05-19) -->

**ปัญหา:** หลัง security hardening round 2 (entry 24) — `GET /users` ต้องการ Admin role → User role ได้รับ 403  
`StationContext.load()` เรียก `Promise.all([getAllStations(), getAllUsers()])` โดยไม่มี try/catch  
เมื่อ `getAllUsers()` throw ApiError(403) → `Promise.all` reject → `setIsLoading(false)` ไม่ถูกเรียก → dashboard ค้าง skeleton ตลอด

**แก้:** `contexts/StationContext.tsx` line 50:
```js
// เดิม
const [stations, users] = await Promise.all([getAllStations(), getAllUsers()])

// ใหม่
const [stations, users] = await Promise.all([
  getAllStations(),
  getAllUsers().catch(() => [] as User[]),
])
```

**ผลลัพธ์:** User role ที่ไม่มีสิทธิ์ดู /users จะได้ `users = []` (ไม่มี clientList filtering) แต่สถานีโหลดได้ปกติ  
Admin ยังคงได้รับ users list ตามปกติ

**รวม rebuild:** frontend (พร้อมกับ entry 22 VpdInfoButton, StationTypeToggle, และ UI updates จาก entry 15–22)

```bash
docker compose build frontend && docker compose up -d frontend
```
