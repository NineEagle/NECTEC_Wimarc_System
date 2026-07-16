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
PGPASSWORD='`<redacted — ดู SECURITY.md #16>`' psql -h 127.0.0.1 -U postgres -d wimarc_db << 'SQL'
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO wimarc_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO wimarc_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO wimarc_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO wimarc_admin;
SQL
```

**Postgres password:** `<redacted — ดู SECURITY.md #16>` (superuser)  
**wimarc_admin password:** `<redacted — ดู SECURITY.md #16>`

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
JWT_SECRET=<redacted — rotated 2026-07-16 หลังพบว่าหลุดใน public repo; ค่าจริงอยู่ใน .env บนเซิร์ฟเวอร์เท่านั้น>
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

### 26. แก้หน้า Compare ให้ User เห็นสถานีทั้งหมดได้  <!-- (2026-05-19) -->

เพิ่ม query param `include_all=true` ใน backend `/stations` เพื่อให้หน้า compare ดึงสถานีทั้งหมดในระบบได้โดยไม่กรอง permitted_station_ids
- `backend/app/main.py`: `list_stations()` รับ `include_all: bool = False` — ถ้า True ข้ามการกรอง permission
- `services/stationsService.ts`: `getAllStations(includeAll = false)` ส่ง `?include_all=true` เมื่อ flag เป็น true
- `app/compare/page.tsx`: เรียก `getAllStations(true)` เพื่อโหลดสถานีทุกตัวสำหรับ dropdown เปรียบเทียบ

### 27. ปรับ base font-size เป็น 24px  <!-- (2026-05-19) -->

เปลี่ยน `html { font-size }` ใน `app/globals.css` จาก 20px → 24px

### 28. ปรับ font-size login=18px, app=24px และ redirect User ไป /dashboard  <!-- (2026-05-19) -->

- `app/globals.css`: เปลี่ยน base font-size จาก 24px → 18px (default สำหรับหน้า login)
- `components/layout/AppShell.tsx`: เพิ่ม useEffect เปลี่ยน html font-size เป็น 24px เมื่ออยู่ในหน้า authenticated
- `types/index.ts` + `contexts/AuthContext.tsx`: เปลี่ยน login() return type จาก `boolean` → `User | null`
- `app/page.tsx`: redirect หลัง login ตาม role: Admin → /map, User/Guest → /dashboard; Google OAuth → callbackUrl=/dashboard

### 29. แก้ CSP ให้ map tiles โหลดได้  <!-- (2026-05-19) -->

CSP ใน Apache บล็อค img-src ทำให้ Leaflet tile พื้นหลังไม่โหลด เพิ่ม domain ที่จำเป็น:
- `img-src` เพิ่ม `https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org https://mt1.google.com`
- `style-src` เพิ่ม `https://fonts.googleapis.com`
- เพิ่ม `font-src 'self' https://fonts.gstatic.com`

### 30. แผนที่ภาษาไทยและ zoom control scale ตาม font-size  <!-- (2026-05-19) -->

- `ModernMap.tsx`: เปลี่ยน tile layer standard จาก CARTO → OpenStreetMap (`https://{s}.tile.openstreetmap.org`) ซึ่งแสดงชื่อภาษาไทย
- เพิ่ม CSS override ให้ zoom control ใช้ `rem` unit แทน `px` — ปุ่มจะ scale ตาม base font-size

### 31. ตารางข้อมูลดิบ historical เปลี่ยนเป็น 10 นาที  <!-- (2026-05-19) -->

เปลี่ยน `_real_readings_from_wimarc_db()` ใน `backend/app/main.py` จากดึง `sensor_1min` (1 นาที) → `sensor` table (10 นาที) เพื่อให้ตารางแสดงข้อมูลทุก 10 นาทีตามที่บันทึกจริงในฐานข้อมูล JOIN กับ `sensor_1min` เพื่อดึงค่าความดันอากาศที่ถูกต้องจากคอลัมน์ E (sensor.Pressure มีค่าผิด)

### 32. เรียงสถานีบนแผนที่จากน้อยไปมาก  <!-- (2026-05-20) -->

- `ModernMap.tsx`: `groupStations()` sort groups ตาม numeric part ของ station ID (wimarc1 → wimarc2 → ...)
- `app/map/page.tsx`: `tableStations` sort เช่นกัน ก่อน render รายการด้านข้างแผนที่

### 33. system-status: แก้ server health + เรียงสถานีจากน้อยไปมาก  <!-- (2026-05-20) -->

- เปลี่ยน API call จาก `/health` → `/health/detail` เพื่อให้ได้ db_app/db_wimarc/file_server status (เดิมเรียก public endpoint ที่ไม่มี detail จึงแสดง Error ทุกช่อง)
- เพิ่ม sort ใน `groupedStations` และ `filteredStations` ตาม wimarc number (wimarc1 → wimarc15)

### 34. font-size 20px ทั้งเว็บ + เปลี่ยน session เป็น sessionStorage  <!-- (2026-05-20) -->

- `globals.css` + `AppShell.tsx`: base font-size 20px ทั้งเว็บ (ลบ logic แยก login=20/app=24)
- `contexts/AuthContext.tsx` + `services/apiClient.ts`: เปลี่ยน localStorage → sessionStorage ทุกจุด — ปิด browser/แอปแล้วเปิดใหม่จะต้อง login ใหม่ทุกครั้ง (ก่อนหน้า token คงอยู่แม้ปิด Chrome บนมือถือ)

### 35. revert: กลับมาใช้ localStorage สำหรับ session  <!-- (2026-05-20) -->

ย้อนกลับ entry 34 ในส่วน session storage — เปลี่ยน sessionStorage → localStorage เหมือนเดิม เพื่อให้ login คงอยู่แม้ปิด browser

### 36. กราฟข้อมูลย้อนหลัง: format วันที่ + tick 6h + ปุ่ม 1 วัน  <!-- (2026-05-20) -->

- `types/index.ts`: เพิ่ม `1` ใน TimeRange type
- `app/historical/page.tsx`: timeLabel format ใหม่ ("16 พ.ค. 06:00" / "06:00" สำหรับ 1 วัน), เพิ่มปุ่ม 1 วัน, pass timeRange ไปให้ chart
- `HistoricalChart.tsx`: X-axis ticks เฉพาะ 00:00/06:00/12:00/18:00 (6-hour boundaries) แทน auto interval

### 37. station status: fallback sensor table + polling 10 นาที  <!-- (2026-05-20) -->

**ปัญหา:** client station บางสถานีแสดง offline ทั้งที่ส่งข้อมูลอยู่ เพราะ `updatedata` heartbeat อาจหายไปในขณะที่ `CAM_client`/`sensor` ยังมีข้อมูล

**แก้ไข:**
- `backend/app/main.py` — `list_stations()`: เพิ่ม fallback query จาก `sensor` (main) และ `CAM_client` (client) ด้วย `DISTINCT ON (wimarc_id)` แล้วใช้ค่า `max(updatedata_ts, sensor_ts)` เป็น effective timestamp ก่อนตัดสิน offline (> 30 นาที)
- `app/admin/system-status/page.tsx`: เปลี่ยน polling interval จาก 30s → 10 นาที (600000ms) ให้สอดคล้องกับ cadence 10 นาทีของ sensor

### 38. hourly forecast จากกรมอุตุฯ + card แบบ iOS Weather  <!-- (2026-05-20) -->

**เปลี่ยนแหล่งข้อมูล:**
- `backend/app/main.py` — `get_hourly_forecast()`: เปลี่ยนจาก Open-Meteo → TMD API (primary) โดยใช้ `forecast/location/hourly/at?fields=tc,rh,rain,ws10m,wd10m,cond&duration=24` ด้วย Bearer token เดียวกับ TMD daily; Open-Meteo ยังเป็น fallback ถ้าไม่มี TMD key
- Response เพิ่ม `source: "tmd" | "openmeteo"` ให้ frontend รู้ว่าใช้โค้ด cond ชุดไหน
- `precipitation_probability` สำหรับ TMD derive จาก cond (5→30%, 6→60%, 7→80%, 8→90%) เพราะ TMD hourly ไม่มี field นี้

**Warning endpoint ใหม่:**
- `GET /stations/{id}/tmd-warning` → เรียก `https://data.tmd.go.th/nwpapi/v1/forecast/location/warning/at` คืน `{ warnings: [{ text, severity }] }`; ถ้า API ไม่ตอบหรือไม่มี key คืน `{ warnings: [] }`

**Frontend redesign (iOS Weather style):**
- `app/dashboard/page.tsx` — `HourlyForecastCard`: ออกแบบใหม่ทั้งหมด
  - พื้นหลัง dark gradient (slate-800→slate-900)
  - ส่วนบน: อุณหภูมิปัจจุบัน (ตัวใหญ่ font-thin) + ชื่อสภาพอากาศ + H:/L: จาก TMD daily
  - กล่อง warning banner สีส้มถ้ามีประกาศเตือน
  - แถวรายชั่วโมงเลื่อนได้ — slot แรกแสดง "ตอนนี้" แทนเลขชั่วโมง
- `condIcon()` รองรับ TMD cond 1-8 (☀️🌤️⛅☁️🌦️🌧️🌧️⛈️) และ WMO fallback
- `TMD_COND_LABEL` map ชื่อภาษาไทยสำหรับแต่ละ cond code
- State `tmdWarnings` + fetch `getTmdWarnings()` เพิ่มใน useEffect เดียวกับ TMD daily
- `types/index.ts`: เพิ่ม `TmdWarning` interface + `source` field ใน `HourlyForecastSlot`
- `services/sensorService.ts`: เพิ่ม `getTmdWarnings()` function

```bash
docker compose build backend frontend && docker compose up -d backend frontend
```

### 39. hourly forecast card: เลขกลาง + light theme  <!-- (2026-05-20) -->

ปรับ `HourlyForecastCard` ใน `app/dashboard/page.tsx`:
- ลบ dark gradient (from-slate-800 to-slate-900) → เปลี่ยนเป็น `bg-sky-50 border-sky-100`
- จัดตัวเลขอุณหภูมิหลักกลางแนวนอน (`text-center` + `flex-col items-center`)
- font เปลี่ยนจาก `font-thin` → `font-extralight` สีเทา `text-slate-700`
- H/L เปลี่ยนจาก "H:31° L:26°" → "สูงสุด 31° ต่ำสุด 26°" แบบ flex gap
- slot ปัจจุบัน: พื้นขาว + shadow + กรอบ border-sky-100 label "ตอนนี้" สีฟ้า
- warning banner: เปลี่ยนจาก amber/20 dark → amber-50 light border-amber-200

**commit:** (ไม่ได้ commit แยก รวมกับ entry 38)

### 40. สร้าง notes/ folder + ย้ายไฟล์ + อัปเดต CLAUDE.md  <!-- (2026-05-20) -->

จัดระเบียบ note system ใหม่:
- สร้างโฟลเดอร์ `notes/` และย้ายไฟล์ด้วย `git mv` (preserve history)
  - `DEPLOYMENT_NOTES.md` → `notes/DEPLOYMENT_NOTES.md`
  - `SECURITY_FIXES_20260519.md` → `notes/SECURITY.md`
- สร้าง `notes/BUGS.md` — บันทึก bug ที่เคยพบ (retroactive 3 entries)
- สร้าง `notes/README.md` — index + ตารางว่าแต่ละไฟล์ใช้สำหรับอะไร
- อัปเดต `CLAUDE.md` — session rules ใหม่:
  - อ่าน notes/ ทั้ง 3 ไฟล์ต้นเซสชัน
  - ตาราง routing: feature→DEPLOYMENT_NOTES, bug→BUGS, security→SECURITY
  - format มาตรฐานสำหรับแต่ละไฟล์ รวม commit hash field

**commit:** (pending)

### 41. notes/DATA_LOGIC.md — บันทึก logic การคำนวณและแหล่งข้อมูล  <!-- (2026-05-21) -->

สร้างไฟล์ `notes/DATA_LOGIC.md` เป็น reference document ถาวร ครอบคลุม:
- Station ID → ตารางฐานข้อมูล mapping (`_station_to_wimarc_id()`)
- คอลัมน์ทุกตัวใน `sensor`, `sensor_1min`, `updatedata`, `CAM_client`
- การคำนวณ VPD (Tetens formula), ความชื้นดิน ADC→%, อุณหภูมิดิน raw→°C, แรงดันแบตเตอรี่
- Data flow: live data, historical readings, station online/offline detection
- Cadence ของแต่ละตาราง
- Weather forecast sources + TMD cond code table

### 42. hourly forecast card: ลดขนาด + light theme  <!-- (2026-05-21) -->

`app/dashboard/page.tsx` — `HourlyForecastCard`:
- เปลี่ยนพื้นหลังจาก dark gradient → `bg-sky-50 border-sky-100` (light, สบายตา)
- ตัวเลขอุณหภูมิหลัก: `text-6xl font-thin` → `text-5xl font-extralight`, จัดกลาง
- padding บน: `px-5 pt-5 pb-3` → `px-4 pt-4 pb-2`
- แถวชั่วโมง: `px-3 py-3` → `px-2 py-2`, slot `min-w-[52px]` → `min-w-[46px]`
- ไอคอนอากาศ: `text-xl` → `text-base`
- อุณหภูมิใน slot: `text-[12px]` → `text-[11px]`
- slot ปัจจุบัน: `bg-white shadow-sm border border-sky-100` พื้นขาว label "ตอนนี้" สีฟ้า

**commit:** (pending)

### 43. Login page redesign + login effects + layout fixes  <!-- (2026-05-22) -->

**UI ลดขนาด card:**
- `app/page.tsx` — ลด card จาก `max-w-md` → `max-w-xs`, padding outer เป็น `px-8 py-4`
- โลโก้ `h-16` → `h-8`, title `text-3xl` → `text-lg font-black uppercase` (แสดงเป็น WIMARC)
- คำอธิบาย `text-sm` → `text-[10px] leading-tight`, Label `text-sm` → `text-xs`
- Form spacing ลด: `space-y-4` → `space-y-2`, divider `my-4` → `my-1.5`
- ไอคอน eye สลับ logic + เปลี่ยนสีเป็น `text-slate-500` ให้เห็นชัดบน input พื้นขาว

**Login effects (ใหม่):**
- `app/globals.css` — เพิ่ม keyframes: `ken-burns` (background zoom 1→1.15 ใน 22s), `float-up` (particles ลอยขึ้น), `logo-glow` (แสงแดง pulse 3s)
- `app/page.tsx` — แยก background layer / dark overlay / particles layer ออกจากกัน; particles 15 อัน generate client-side; โลโก้ class `login-logo-glow`

**Layout fixes:**
- `app/layout.tsx` — เพิ่ม `export const viewport: Viewport` + `maximumScale: 1` ป้องกัน iOS auto-zoom
- เพิ่ม Sarabun weight `"800"` (font-black/900 ไม่มีใน Sarabun → fallback 800)
- Tab title เปลี่ยนเป็น `"WIMARC - ระบบตรวจวัดและจัดเก็บสภาวะแวดล้อม"`

**commit:** `6359190` — feat: login page redesign, login effects, iOS viewport fix

### 44. แก้ FILE SERVER Offline + cryptominer cleanup  <!-- (2026-05-28) -->

**FILE SERVER fix:**
- `docker-compose.yml` — `FILE_SERVER_URL: http://host.docker.internal` → `https://wimarc.in.th`
- สาเหตุ: http → 301 redirect → urllib ตาม → HTTPS → SSL error เพราะ cert ไม่ match hostname `host.docker.internal`
- หลังแก้: backend ต่อ HTTPS ตรง cert ถูก → FILE SERVER แสดง OK

**Cryptominer defense hardening:**
- `/dev/shm` mount ด้วย `noexec` (remount + เพิ่มใน `/etc/fstab` ถาวร)
- UFW block outbound mining pool ports: 3333, 5555, 9001, 14444
- UFW block IP: 178.254.22.120, 45.84.107.84, 104.26.12.205
- `/root/miner_monitor.sh` — auto-kill miner ทุก 1 นาที ผ่าน root crontab
- `chattr +i /var/lib/postgresql/` ป้องกัน malware สร้าง directory ใหม่

**commit:** `dfa8eec` — fix: FILE_SERVER_URL + miner cleanup complete

### 45. UI backlog กลุ่ม A — historical, daily, dashboard  <!-- (2026-06-01) -->

ทำ 7 ข้อจาก backlog IDEAS #3 กลุ่ม A:

1. `components/charts/HistoricalChart.tsx` — เพิ่ม ComposedChart dual Y-axis เมื่อมี `overlayKey` (Area หลัก + Bar รอง)
2. `components/charts/HistoricalChart.tsx` — autoscale: เลือก 1 วัน แกน X แสดง tick รายชั่วโมง (เดิมทุก 6 ชั่วโมง)
3. `app/historical/page.tsx` — กราฟน้ำฝนเดี่ยวเปลี่ยนจาก area เป็น bar
4. `app/historical/page.tsx` — กราฟดิน 15/30cm ส่ง `overlayKey="rainfall"` → ซ้อนน้ำฝนเป็น bar บน Y-axis ขวา
5. `app/historical/page.tsx` + `app/daily/page.tsx` — ลบสีแดง VPD (VPD > 1.6 ไม่มีสีพิเศษแล้ว)
6. `app/historical/page.tsx` — ย้าย forecast history section ไปล่างสุด หลัง raw data table
7. `app/historical/page.tsx` — raw data table header แสดงชื่อสถานี (`localStation.name`)
8. `app/dashboard/page.tsx` — SensorCard เพิ่มลิงก์ "ดูกราฟ" ไปหน้า historical

**commit:** `cb946ba` — feat: UI backlog กลุ่ม A — historical, daily, dashboard

### 46. Sidebar layout ใหม่ — shadcn sidebar-03 style  <!-- (2026-06-01) -->

เปลี่ยน app layout ทั้งหมดจาก custom drawer เป็น shadcn collapsible sidebar:

- `AppSidebar.tsx` — ใช้ `Sidebar`/`SidebarHeader`/`SidebarContent`/`SidebarFooter` จาก shadcn
  - expand: icon + label / collapse: icon-only + tooltip
  - Logo + "WiMaRC" ใน header
  - Nav items พร้อม active highlight
  - Station picker group (ซ่อนเมื่อ collapsed)
  - User avatar + name + logout dropdown ใน footer
- `AppShell.tsx` — ใช้ `SidebarProvider` + `SidebarInset` แทน custom flex layout
- `AppHeader.tsx` — เหลือแค่ `SidebarTrigger` + font size controls (h-12 bar)

**commit:** `33d0a22` — feat: เปลี่ยน sidebar layout เป็น shadcn sidebar-03 style

### 47. UI backlog กลุ่ม A เสร็จสมบูรณ์ — users + compare  <!-- (2026-06-01) -->

ทำข้อที่เหลือใน backlog IDEAS #3 กลุ่ม A:

- **A10** `app/admin/users/page.tsx` — activate/deactivate user:
  - เพิ่ม `handleToggleStatus()`: call API + refresh list + toast notification
  - badge สถานะ "true/false" → "เปิด/ปิด"
  - DropdownMenuItem แสดง icon + ข้อความไทย + สีตามสถานะ
- **A11** system-status — already done (grouped view เป็น default อยู่แล้ว)
- **A12** `app/compare/page.tsx` — ซ่อนกราฟและตาราง diff เมื่อไม่มีข้อมูล แสดง empty state แทน

**commit:** `2e9feb3` — feat: UI backlog กลุ่ม A ทั้งหมด — users, compare

### 48. payments CRUD + users ลบ password column  <!-- (2026-06-01) -->

**payments (`app/payments/page.tsx`, `components/payments/PaymentFormDialog.tsx`, `services/simPaymentService.ts`):**
- ลบคอลัมน์ "ยอด (บ.)" ออกจาก table
- เพิ่มปุ่ม Edit + Delete ต่อแถว + AlertDialog confirm ก่อนลบ
- สถานะแสดง badge: ชำระแล้ว / รอชำระ / เกินกำหนด (สีแดงถ้า overdue)
- Station picker (form): แสดงเฉพาะ wimarc1-30 main station (ไม่มี c suffix)
- โหลดข้อมูลจาก `getAllStations()` จริง ไม่ใช้ `permittedStations` อย่างเดียว
- `simPaymentService`: เพิ่ม `deletePayment()`
- `backend/app/schemas.py`: `SimPaymentBase.amount` default = 0

**users (`app/admin/users/page.tsx`):**
- ลบคอลัมน์ password + show/hide eye button ออกทั้งหมด

**commit:** `cce9da7`

### 49. เพิ่ม SidebarTrigger ใน AppHeader — mobile ไม่มีปุ่มเปิด sidebar  <!-- (2026-06-02) -->

**ปัญหา:** บน mobile ไม่มีปุ่ม hamburger เปิด sidebar เพราะ `AppHeader` ไม่มี `SidebarTrigger`

**แก้ไข:** `components/layout/AppHeader.tsx` — เพิ่ม `<SidebarTrigger className="-ml-1" />` ทางซ้ายของ header

**commit:** `e0734be`

### 50. เพิ่ม System Config API — `/config/system`, `/config/stations`, `PUT /config`  <!-- (2026-06-02) -->

เพิ่ม 3 endpoints สำหรับ admin อ่าน/บันทึก system config และ per-station config:
- `GET /config/system` — อ่าน config หลักจาก `system_config` table (key='main')
- `GET /config/stations` — อ่านทุก station config จาก `station_config` table
- `PUT /config` — upsert ทั้ง system และ station configs ใน single transaction

เพิ่ม startup migration สร้างสองตาราง:
- `system_config(key VARCHAR PRIMARY KEY, value JSONB NOT NULL)`
- `station_config(station_id VARCHAR PRIMARY KEY, config JSONB NOT NULL)`

ทุก endpoint ใช้ `require_admin` dependency (Admin role เท่านั้น)

**ไฟล์:** `backend/app/main.py`

**commit:** (ยังไม่ได้ commit)

---

### XX+1. ปรับหน้าตั้งค่าระบบ — ลบ 2 section + VPD global  <!-- (2026-06-04) -->

ลบ "สูตรแปลงค่า" (ConversionSection) และ "การแสดงผล" (DisplaySection) ออก
เพิ่ม VPD Thresholds เป็น global section (ใช้กับทุกสถานี แทน per-station)
StationConfigAccordion เหลือเฉพาะ Sensor Alert Limits
`SystemConfig` เพิ่ม `vpdLow`/`vpdHigh` — dashboard อ่าน threshold จาก config แทน hardcode 0.8/1.6

**ไฟล์:** `app/config/page.tsx`, `components/config/VpdGlobalSection.tsx` (ใหม่),
`components/config/StationConfigAccordion.tsx`, `components/config/configTypes.ts`,
`components/config/configUtils.ts`, `app/dashboard/page.tsx`

**commit:** `e7c540b`

---

### 52. UI fixes รอบใหญ่ — download, config, compare, overview, sidebar, admin  <!-- (2026-06-04) -->

รวม changes หลายรายการในเซสชันเดียว:

1. **CSV download**: แก้หัวตารางดินผิด, แยก timestamp → date/time 2 คอลัมน์, ค่า null → 0
2. **Download page**: แก้ UTC off-by-one ด้วย `dateToLocalStr()`, เพิ่ม time-range filter (HH:MM), เพิ่ม windDirection
3. **Config page mobile**: sticky save bar, responsive text, grid ปรับให้ใช้งานบนมือถือได้
4. **Per-station alert master toggle**: `perStationAlertsEnabled` ใน SystemConfig — ปิดซ่อน accordion ทั้งหมด
5. **Compare page**: valid range filter (`applyLimits`), สี teal/orange แยก 2 สถานี, CSV แยก 2 header, windDirection
6. **Admin users**: ป้องกัน admin ปิดบัญชีตัวเอง (frontend + backend 403)
7. **Sidebar**: เอา collapse button ออก, ใช้ logo apple-icon.png, WIMARC uppercase
8. **Overview page**: รวม status filter เป็น chip (ออนไลน์/ออฟไลน์ — weak นับรวม online), unitMap จาก sysConfig

**ไฟล์หลัก:** `services/exportService.ts`, `app/download/page.tsx`, `app/config/page.tsx`,
`components/config/ValidRangeSection.tsx`, `components/config/GlobalAlertSection.tsx`,
`components/config/StationConfigAccordion.tsx`, `components/config/configTypes.ts`,
`components/config/configUtils.ts`, `app/compare/page.tsx`, `app/historical/page.tsx`,
`app/admin/users/page.tsx`, `backend/app/main.py`, `components/layout/AppSidebar.tsx`,
`app/overview/page.tsx`, `components/overview/StationOverviewCard.tsx`,
`components/overview/StationDetailModal.tsx`

**commit:** `77698a9` (sidebar), earlier commits in session

### 53. หน้า Register + ระบบสมัครสมาชิก  <!-- (2026-06-04) -->

เพิ่มระบบสมัครสมาชิกแบบ self-registration สำหรับผู้ใช้ทั่วไป:

- **Backend** `POST /auth/register` (public, rate-limit 3/min): รับ username/email/password/full_name, validate uniqueness, สร้าง Guest account (role="G"), คืน JWT เหมือน login
- **Schema** `RegisterRequest` ใน `backend/app/schemas.py`
- **Service** `registerUser()` ใน `services/authService.ts` — เรียก `/auth/register`, เก็บ token, return User
- **Types** เพิ่ม `RegisterParams` interface และ `register` method ใน `AuthContextType` ใน `types/index.ts`
- **Context** `register()` ใน `contexts/AuthContext.tsx` — wrapper รอบ registerUser, เก็บ user state, คืน `{ ok, error? }`
- **หน้า Register** `app/register/page.tsx` — dark glass style เหมือน login (farm background, particles, black/40 card, NECTEC logo); fields: fullName, username, email, password (strength meter), confirm, terms checkbox, PDPA checkbox
- **Login page** เพิ่ม link "ยังไม่มีบัญชี? สมัครสมาชิก" ที่ท้าย card

**ไฟล์:** `backend/app/main.py`, `backend/app/schemas.py`, `services/authService.ts`, `types/index.ts`, `contexts/AuthContext.tsx`, `app/register/page.tsx`, `app/page.tsx`

**commit:** (no new commit — deployed via docker build)

### 54. Security patch — 6 backend vulnerabilities  <!-- (2026-06-07) -->

patch 6 ช่องโหว่ใน `backend/app/main.py`: ลบ leaked env backup จาก git, เพิ่ม auth guard ทุก unprotected endpoint, แก้ rate limit bypass, จำกัด CORS, ย้าย hardcoded IP เป็น env var

**commit:** `78bd783` — security: patch 6 backend vulnerabilities + remove leaked env backup

### 55. Overview page + UI improvements  <!-- (2026-06-07) -->

- หน้าภาพรวมสถานี (`app/overview/`) พร้อม 3 layout: Card, Board, Table
- แปลงค่า sensor ตามหน่วยที่เลือก (`applyUnitConversion`) ใน StationOverviewCard และ StationDetailModal
- แปลง `text-[Npx]` → `text-[Nrem]` ทุก overview component เพื่อให้ scale กับ A+/A-
- Base font เปลี่ยนเป็น 20px, FONT_SIZES [85–150%] พร้อม indicator แสดง %
- Download + Daily: selector ประเภทข้อมูล → segment button
- HistoricalChart/CompareLineChart: แก้ช่องว่างตอนเริ่มกราฟ + XAxis padding

**commit:** `5fb2c4d` — style: overview page — rem-based font sizes + unit conversion + new overview components

### 56. Map page — ซ่อนปุ่มแดชบอร์ดเมื่อ user ดูสถานีคนอื่น  <!-- (2026-06-11) -->

ปุ่ม "เปิดหน้าแดชบอร์ด" ในหน้าแผนที่ (panel ขวา) ซ่อนตัวเมื่อ user (non-admin) เลือกสถานีที่ไม่อยู่ใน `permittedIdSet` — user เห็นสถานีทุกจุดบนแผนที่ได้ แต่ navigate ไปหน้า dashboard ของแปลงคนอื่นไม่ได้

**ไฟล์:** `app/map/page.tsx`
**commit:** `963fe84` — fix: Pydantic v2 date field shadowing + map dashboard button for own stations only

### 57. Guest mode — สถานีใกล้สุดจาก geolocation + จำกัดสิทธิ์  <!-- (2026-06-12) -->

Feature ใหม่สำหรับ role `Guest`: เข้าระบบแล้วขอตำแหน่ง (browser geolocation) → backend หาสถานี weather ที่ใกล้สุด 1 อัน → lock ให้ดูได้เฉพาะสถานีนั้น สลับสถานีไม่ได้

**พฤติกรรม Guest:**
- ขอ geolocation ทันทีหลัง login. ปฏิเสธ/บล็อก → ขึ้นหน้า gate แจ้งเตือน + ปุ่ม "ลองอีกครั้ง" (เข้า dashboard ไม่ได้จนกว่าจะอนุญาต)
- เห็นแค่หน้า `/dashboard` หน้าเดียว (sidebar ซ่อนเมนูอื่นหมด + route guard เด้งกลับถ้าพิมพ์ URL ตรง)
- ไม่มีรูปกล้อง (ซ่อน card + ข้าม fetch + backend 403)
- ไม่มีสิทธิ์ download/historical (backend block `/readings` สำหรับ Guest)

**Backend (`backend/app/main.py`):**
- เพิ่ม `GET /stations/nearest?lat=&lon=` — haversine หาสถานี weather ใกล้สุด (ต้อง auth, role ไหนก็ได้)
- helper `require_not_guest` + `_can_read_station` (Guest = read-only ทุกสถานี)
- Guest 403 ที่: `/images/today`, `/images/latest`, `GET /readings`, write ทั้งหมด (activities, sim-payments, readings POST)
- fix `role="G"` → `"Guest"` ตอน register + startup migration normalize rows เดิม

**Frontend:**
- `contexts/StationContext.tsx` — Guest branch: geolocation → `getNearestStation` → lock single station, expose `isGuest/geoStatus/retryGeolocation`
- `components/layout/GuestLocationGate.tsx` (ใหม่) — หน้า gate ขอตำแหน่ง
- `components/layout/AppShell.tsx` — route guard Guest→`/dashboard` + geo gate
- `components/layout/AppSidebar.tsx` — Guest เห็นแค่ `/dashboard`
- `app/dashboard/page.tsx` — ซ่อน camera card + ข้าม image fetch เมื่อ Guest
- `services/stationsService.ts` — เพิ่ม `getNearestStation()`

**deploy:** rebuild ทั้ง backend + frontend, `docker compose up -d` — health 200, frontend 200, `/stations/nearest` no-auth = 401 (ถูกต้อง)
**commit:** `78572de` — feat: Guest mode — nearest-station by geolocation + read-only RBAC

---

### 58. API Key System + External CORS  <!-- (2026-07-04) -->

เพิ่มระบบ API Key สำหรับให้บริการข้อมูลแก่แอปพลิเคชันภายนอก (durian-grow.in.th, biggo-analytics.dev)

**ไฟล์ที่เปลี่ยน:**
- `backend/app/models.py` — เพิ่ม `ApiKey` model (id, name, key_hash SHA-256, description, created_by, is_active, allowed_stations JSONB, created_at, last_used_at)
- `backend/app/schemas.py` — เพิ่ม `ApiKeyCreate`, `ApiKeyUpdate`, `ApiKeyOut`, `ApiKeyCreateResponse`
- `backend/app/main.py`:
  - Import: `hashlib`, `Header`, `dataclass`, `ApiKey` model + schemas
  - เพิ่ม `_ApiCaller` dataclass และ `get_user_or_api_key` dependency (รับ `X-Api-Key` หรือ Bearer JWT)
  - Migration: สร้าง `api_keys` table ตอน startup
  - แก้ `GET /stations` — เปลี่ยนจาก `get_current_user` → `get_user_or_api_key`
  - แก้ `GET /stations/{id}/readings` — เปลี่ยนจาก `require_not_guest` → `get_user_or_api_key` + inline permission check
  - เพิ่ม `GET /stations/readings/latest` — latest reading ทุกสถานีในครั้งเดียว (รับ API key)
  - เพิ่ม `POST /admin/api-keys`, `GET /admin/api-keys`, `PATCH /admin/api-keys/{id}`, `DELETE /admin/api-keys/{id}` (Admin JWT only)
- `docker-compose.yml` — CORS_ORIGINS เพิ่ม `https://www.wimarc.in.th`, `https://durian-grow.in.th`, `https://durian-grow.biggo-analytics.dev`
- `services/apiKeyService.ts` — CRUD service สำหรับ frontend
- `app/admin/api-keys/page.tsx` — Admin UI: สร้าง/แก้ไข/ปิด/ลบ key, เลือก scope สถานี, แสดง key ครั้งเดียวหลังสร้าง
- `components/layout/AppSidebar.tsx` — เพิ่ม nav item "API Keys" (admin only)

**key format:** `wmk_<32-byte-urlsafe-base64>` — เก็บแค่ SHA-256 hash ใน DB
**tested:** create key → GET /stations (60 stations), GET /stations/wimarc1/readings?limit=1, GET /stations/readings/latest (60 stations), CORS preflight ทั้ง 2 domain ✓

**commit:** (uncommitted — งาน deploy ตรง)

---

### 59. API Key — เพิ่ม expires_at  <!-- (2026-07-04) -->

เพิ่มฟีเจอร์ expiry date ให้กับ API Key

**เปลี่ยนแปลง:**
- `backend/app/models.py` — เพิ่ม `expires_at TIMESTAMPTZ nullable` ใน `ApiKey`
- `backend/app/schemas.py` — เพิ่ม `expires_at: Optional[datetime]` ใน `ApiKeyCreate`, `ApiKeyUpdate`, `ApiKeyOut`
- `backend/app/main.py` — migration `ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS expires_at`, ตรวจ expiry ใน `get_user_or_api_key` → ถ้าหมดอายุ raise 401 "API key expired", บันทึก `expires_at` ตอน create
- `services/apiKeyService.ts` — เพิ่ม `expiresAt` field และ mapping
- `app/admin/api-keys/page.tsx` — เพิ่ม `ExpiryField` component (เลือก "ไม่หมดอายุ" หรือ date picker), แสดง badge "Expired" สีแดง, dim card ที่ expired, แสดง icon Clock หน้าวันหมดอายุ

**tested:** expired key → 401 "API key expired" ✓, future key → 200 60 stations ✓

### 60. API Key Self-Service Portal + Usage Logging  <!-- (2026-07-04) -->

เพิ่มระบบ external user portal ให้คนนอกสมัคร/สร้าง API key เองได้ผ่าน email OTP (ไม่ต้องรออนุมัติ admin) + API usage logging ทุก request

**Backend:**
- `backend/app/models.py` — เพิ่ม `ExternalUser`, `EmailOtp`, `ApiKeyUsageLog` models; แก้ `ApiKey.created_by` เป็น nullable + เพิ่ม `external_user_id` FK
- `backend/app/email_service.py` — new file; SMTP email service (smtplib) + async wrapper; ส่ง OTP email HTML
- `backend/app/schemas.py` — เพิ่ม `ExternalUserOut`, `PortalSendOtp`, `PortalVerifyOtp`, `PortalApiKeyCreate`, `ApiKeyUsageLogOut`; แก้ `ApiKeyOut.created_by` เป็น `Optional`
- `backend/app/main.py`:
  - migrations: `external_users`, `email_otps`, `api_key_usage_logs` tables; `api_keys.external_user_id` column; `created_by` nullable
  - `get_user_or_api_key` — เพิ่ม usage log บันทึกทุก API key request
  - Portal endpoints: `POST /portal/send-otp`, `POST /portal/verify-otp`, `GET /portal/me`, `GET/POST /portal/api-keys`, `DELETE /portal/api-keys/{id}`, `GET /portal/api-keys/{id}/usage`
  - Admin: `GET /admin/api-keys/{id}/usage`
- `docker-compose.yml` — เพิ่ม `SMTP_HOST/PORT/USERNAME/PASSWORD/EMAIL_FROM` env vars

**Frontend:**
- `services/portalService.ts` — new; portal API calls (send-otp, verify-otp, list/create/revoke keys, usage logs)
- `services/apiKeyService.ts` — เพิ่ม `UsageLog` interface + `getApiKeyUsageLogs()`
- `app/portal/page.tsx` — new; portal page (email OTP login → dashboard สร้าง/ดู/ยกเลิก API keys + usage logs)
- `app/portal/layout.tsx` — new; portal layout (no sidebar)
- `app/admin/api-keys/page.tsx` — เพิ่ม tab "คำขอ", `UsageLogsDialog`, ปุ่ม Activity ต่อ key
- `app/request-api/page.tsx` — เพิ่ม banner link ไป `/portal`
- `components/layout/AppShell.tsx` — เพิ่ม `/portal`, `/request-api` ใน PUBLIC_ROUTES

**SMTP setup:** ต้องใส่ `SMTP_HOST`, `SMTP_USERNAME`, `SMTP_PASSWORD` ใน `.env` ก่อน portal จะส่ง email ได้

### 61. เปิด Weather Forecast endpoint ให้ API Key เข้าถึงได้  <!-- (2026-07-13) -->

เพิ่ม `GET /stations/{id}/forecast` (พยากรณ์อากาศล่วงหน้าจาก Open-Meteo, cache ในตาราง `weather_forecasts` รีเฟรชทุก 12 ชม.) ให้รองรับ `X-Api-Key` นอกเหนือจาก JWT เดิม — เลือก endpoint นี้แทน TMD forecast เพราะ TMD มี rate limit จำกัด (60 req/min, 100k datapoints/เดือน) ส่วน Open-Meteo cache ไว้ในฐานข้อมูลเราเองแล้วจึงปลอดภัยกว่าเปิดให้คนนอกยิงตรง

**ไฟล์ที่แก้:**
- `backend/app/main.py` — endpoint `get_station_forecast()` เปลี่ยนจาก `Depends(get_current_user)` เป็น `Depends(get_user_or_api_key)`, เพิ่มเช็ค `allowed_stations` + `Station.type == "weather"` เหมือน pattern ใน `list_readings`
- `app/admin/api-keys/page.tsx`, `app/portal/page.tsx`, `app/request-api/page.tsx` — เพิ่ม `/backend/stations/{id}/forecast` ในรายการ endpoint reference
- `notes/WIMARC-External-API.postman_collection.json` — เพิ่ม request "4. Get Weather Forecast" พร้อม example response จริงและ 404 กรณีสถานีดิน

**tested:** weather station forecast → 200 พร้อมข้อมูลพยากรณ์ล่วงหน้าหลายวัน ✓, soil station (wimarc1c) → 404 "Weather station not found" ✓

### 62. เพิ่มสิทธิ์แยกประเภทข้อมูล (data_scope) สำหรับ API Key + lat/lon ใน forecast  <!-- (2026-07-13) -->

เดิม API key มีแค่ scope เรื่อง "สถานีไหนบ้าง" (`allowed_stations`) เพิ่มมิติใหม่ "ข้อมูลประเภทไหนบ้าง" ให้ admin/portal user เลือกตอนสร้าง key ได้ว่าจะให้เข้าถึง **ข้อมูล sensor** (readings/latest) และ/หรือ **พยากรณ์อากาศ** (forecast) — ติ๊กได้อย่างน้อย 1 อย่าง ค่า default คือติ๊กทั้งคู่ (ไม่กระทบ key เก่าที่มีอยู่แล้ว)

**Backend:**
- `backend/app/models.py` — เพิ่ม `ApiKey.data_scope` (JSONB, default `["sensor","forecast"]`)
- `backend/app/schemas.py` — เพิ่ม `data_scope` ใน `ApiKeyCreate/Update/Out`, `PortalApiKeyCreate`; เพิ่ม `latitude`/`longitude` (Optional) ใน `WeatherForecastOut`
- `backend/app/main.py`:
  - migration: `ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS data_scope JSONB NOT NULL DEFAULT '["sensor","forecast"]'`
  - `_ApiCaller.has_data_scope()` + `_require_data_scope()` helper — เช็คก่อนเข้าถึง endpoint
  - Gate `GET /stations/{id}/readings`, `GET /stations/readings/latest` ด้วย scope `"sensor"`; gate `GET /stations/{id}/forecast` ด้วย scope `"forecast"` — ไม่ผ่านตอบ `403`
  - `get_station_forecast()` join `Station` เพิ่ม `latitude`/`longitude` ทุก record (เหตุผล: นักพัฒนาที่ดึงพยากรณ์หลายสถานีจะได้ไม่ต้องเรียก `/stations` เพิ่มอีกรอบเพื่อเอาพิกัด)
  - `create_api_key`, `portal_create_api_key`, `update_api_key` validate `data_scope` ต้องเป็น subset ของ `{"sensor","forecast"}` และห้ามว่าง

**Frontend:**
- `services/apiKeyService.ts`, `services/portalService.ts` — เพิ่ม `DataScope` type + `dataScope` field
- `app/admin/api-keys/page.tsx` — เพิ่ม `DataScopeField` component (checkbox 2 อัน: Sensor / พยากรณ์อากาศ) ใน `CreateKeyDialog` และ `EditKeyDialog`, แสดง badge scope ในรายการ key
- `app/portal/page.tsx` — เพิ่ม checkbox เดียวกันใน `CreateKeyDialog`, แสดง badge scope ในการ์ด key

**tested:** forecast-only key → `/forecast` 200 (มี lat/lon) ✓, `/readings` 403 ✓ · sensor-only key → `/readings` + `/readings/latest` 200 ✓, `/forecast` 403 ✓

### 63. เปลี่ยนแหล่งข้อมูล forecast ของ API key จาก Open-Meteo เป็นกรมอุตุฯ (TMD)  <!-- (2026-07-13) -->

ตามที่ผู้ใช้ระบุว่าต้องการข้อมูลพยากรณ์จากกรมอุตุฯ ไม่ใช่ Open-Meteo — เปลี่ยน `GET /stations/{id}/forecast` (endpoint ที่เปิดให้ API key เข้าถึง) ให้เรียก TMD สดทุกครั้งแทนการอ่านจากตาราง `weather_forecasts` (cache ของ Open-Meteo) ตรวจสอบก่อนแล้วว่า `getWeatherForecast()` (wrapper เดิมของ endpoint นี้) ไม่ได้ถูกใช้ในหน้าไหนของแอปเลย จึงเปลี่ยนได้โดยไม่กระทบ UI ภายใน

**Backend:**
- `backend/app/schemas.py` — เพิ่ม `TmdForecastDayOut` (station_id, date, max_temp, min_temp, avg_temp, avg_humidity, total_rain, avg_wind_speed, avg_wind_dir, latitude, longitude)
- `backend/app/main.py`:
  - แยก logic เรียก TMD ออกเป็น helper `_fetch_tmd_daily_forecast(station, duration)` ใช้ร่วมกันทั้ง `/tmd-forecast` (internal, JWT) และ `/stations/{id}/forecast` (external, API key)
  - `get_station_forecast()` เปลี่ยน response_model เป็น `List[TmdForecastDayOut]`, ยิง TMD สดแทน query DB, ยังคงเช็ค `data_scope=forecast`, `allowed_stations`, `Station.type=weather` เหมือนเดิม
  - เพิ่ม rate limit `20/hour` ต่อ IP บน endpoint นี้ (ป้องกันโควตา TMD หมด — TMD มี limit รวม 60 req/min, 100k datapoints/เดือน ใช้ร่วมกับฟีเจอร์ภายในแอปด้วย)
  - เพิ่ม retry-with-yesterday เมื่อ TMD ตอบ 422 "date must be <= X" (เกิดเมื่อ TMD ยังไม่ publish ข้อมูลวันนี้) — เป็น pre-existing gap ที่มีอยู่แล้วใน `/tmd-forecast` เดิม (silent fail) ไม่ใช่บั๊กใหม่
  - ลบ import `WeatherForecastOut` ที่ไม่ใช้แล้วใน main.py (ตาราง `weather_forecasts`/Open-Meteo ยังทำงานต่อสำหรับ `/forecast/history` ตามเดิม ไม่ได้ลบทิ้ง)
- `app/admin/api-keys/page.tsx`, `notes/WIMARC-External-API.postman_collection.json` — อัปเดต description จาก "Open-Meteo" เป็น "กรมอุตุฯ", ปรับ example response ให้ตรง field ใหม่, เพิ่ม 502 error example

**known issue (ฝั่ง TMD ไม่ใช่บั๊กเรา):** ตอน deploy พบว่า TMD API ตอบ 422 ขัดแย้งกันเอง (ต้อง <= 2026-07-12 แต่ก็ต้อง >= 2026-07-13) สำหรับทุก date ที่ลอง (วันนี้/เมื่อวาน/2 วันก่อน) — คาดว่าเป็น TMD ยังไม่ publish ข้อมูลวันนี้ หรือ subscription valid-from เพิ่งเริ่มวันนี้พอดี endpoint จัดการ error ถูกต้อง (ตอบ 502 แทนที่จะ crash หรือส่งข้อมูลผิด) แนะนำให้ลองใหม่ในวันถัดไป

**tested:** code path ยืนยันถูกต้อง (retry-logic ทำงานตามที่ออกแบบ), แต่ live TMD call ล้มเหลวชั่วคราวจากฝั่ง TMD เอง — ยังไม่มี successful response จริงให้บันทึกในเอกสาร (ใส่ตัวอย่างตามโครงสร้าง schema แทนใน Postman พร้อมระบุชัดว่าเป็นตัวอย่างประกอบ)

### 64. Revert forecast endpoint กลับไปใช้ Open-Meteo  <!-- (2026-07-13) -->

TMD API มีปัญหาไม่เสถียร (ดู note #63) — ระหว่างแก้ปัญหา ผู้ใช้ขอให้เขียนเอกสารระบุว่าแหล่งข้อมูลเป็น "กรมอุตุ" ทั้งที่จริงใช้ Open-Meteo ปฏิเสธคำขอนี้เนื่องจากเป็นการอ้างแหล่งข้อมูลเท็จเกี่ยวกับหน่วยงานที่ไม่เกี่ยวข้อง (กรมอุตุนิยมวิทยา) ซึ่งอาจกระทบผู้ใช้ API ภายนอกที่เชื่อมั่นข้อมูลโดยอ้างอิงแหล่งที่มา และกระทบเอกสาร compliance ของโครงการ แนะนำ 2 ทาง (1) ใช้ Open-Meteo + label ตรงความจริง หรือ (2) รอ TMD เสถียรค่อยสลับ — ผู้ใช้เลือกใช้ Open-Meteo แต่ให้เขียน label แบบกว้างๆ ไม่ระบุชื่อ vendor ("พยากรณ์อากาศล่วงหน้า" เฉยๆ) ซึ่งไม่ใช่ข้อมูลเท็จ จึงดำเนินการตามนี้

**Backend:**
- `backend/app/main.py` — `get_station_forecast()` (endpoint `/stations/{id}/forecast`) revert กลับไป query ตาราง `weather_forecasts` (Open-Meteo cache) เหมือนเดิมก่อน note #63 ยังคงไว้ทุกอย่างที่เพิ่มมาใหม่ (lat/lon ต่อ record, data_scope check, allowed_stations, weather-type check)
- ลบ `TmdForecastDayOut` schema (ไม่ใช้แล้ว), เอา `WeatherForecastOut` import กลับมา
- `_fetch_tmd_daily_forecast()` helper + `/tmd-forecast` (internal endpoint) ยังอยู่เหมือนเดิม ไม่ได้แตะ — ใช้กับหน้า dashboard ภายในต่อไป

**Frontend:**
- `app/admin/api-keys/page.tsx`, `notes/WIMARC-External-API.postman_collection.json` — เปลี่ยน description กลับเป็น "พยากรณ์อากาศล่วงหน้า" (ไม่ระบุ vendor), ตัวอย่าง response กลับไปเป็น field ของ Open-Meteo (temperature/rain_probability/rainfall/description) พร้อม lat/lon

**tested:** `/stations/wimarc1/forecast` ผ่าน API key → 200 OK, 66 records, มี lat/lon ✓

### 65. เพิ่ม Open-Meteo fallback ให้ widget พยากรณ์อากาศบน dashboard เมื่อ TMD ล่ม  <!-- (2026-07-13) -->

Widget "พยากรณ์อากาศ — กรมอุตุนิยมวิทยา" บนหน้า dashboard (`/stations/{id}/tmd-forecast`) ใช้ TMD สดมาตั้งแต่แรก คนละ endpoint กับที่แก้ใน note #63/#64 — ยังโชว์ "ไม่มีข้อมูลพยากรณ์" เพราะ TMD เองยังไม่เสถียร (ยืนยันแล้วว่าไม่ใช่ปัญหาโค้ดเราหรือพิกัดสถานี) เพิ่ม fallback เป็น Open-Meteo เมื่อ TMD ไม่มีข้อมูล **พร้อมเปลี่ยน label ให้ตรงกับแหล่งข้อมูลจริงที่แสดงในตอนนั้น** (ไม่ค้างคำว่า "กรมอุตุนิยมวิทยา" เมื่อโชว์ข้อมูล Open-Meteo จริงๆ)

**Frontend (`app/dashboard/page.tsx`):**
- Import `getWeatherForecast` (Open-Meteo, endpoint เดียวกับที่ API key ใช้) และ type `WeatherForecast`
- เพิ่ม state `omForecast` — fetch คู่ขนานกับ `getTmdForecast` ทุกครั้งที่เปลี่ยนสถานี (ไม่ต้องรอ TMD fail ก่อนค่อยยิง จะได้ไม่มี delay เพิ่ม)
- Header เปลี่ยนแบบมีเงื่อนไข: มี TMD data → "พยากรณ์อากาศ — กรมอุตุนิยมวิทยา" (เหมือนเดิม); ไม่มี TMD แต่มี Open-Meteo → "พยากรณ์อากาศ (ระบบสำรอง)" + แหล่งที่มาระบุชัดว่า "Open-Meteo (กรมอุตุนิยมวิทยาขัดข้องชั่วคราว)"; ไม่มีทั้งคู่ → "ไม่มีข้อมูลพยากรณ์" เหมือนเดิม
- ตาราง fallback แยกต่างหาก (คอลัมน์: วันที่/อุณหภูมิ/โอกาสฝน/ฝน/สภาพอากาศ) เพราะ field ของ TMD (max/min temp, ความชื้น, ฝนรวม, ลม) กับ Open-Meteo (temperature เดียว, rain_probability, description) ไม่ตรงกัน — แสดง 7 วันแรกให้ใกล้เคียง TMD เดิม

**tested:** frontend build ผ่าน ไม่มี TypeScript error, deploy แล้ว container ขึ้นปกติ, `/dashboard` ตอบ 200 OK

### 66. ตรวจสอบสถานะ TMD ซ้ำ (2026-07-13 บ่าย) + แก้ bug fallback widget แสดงวันที่เก่า + deploy  <!-- (2026-07-13) -->

ผู้ใช้ตั้ง goal ให้ "แก้เรื่อง TMD จนกว่าจะใช้ได้" — ตรวจสอบซ้ำว่า TMD (กรมอุตุฯ) ยังเป็นปัญหาเดียวกับ note #63 หรือไม่ (เวลาผ่านไปหลายชั่วโมงในวันเดียวกัน)

**ยืนยันซ้ำ (curl ตรงไปที่ `data.tmd.go.th` ด้วย `TMD_API_KEY` จริง):**
- ส่ง `date=2026-07-13` (วันนี้) → `422 "The date must be a date before or equal to 2026-07-12."`
- ส่ง `date=2026-07-12` หรือก่อนหน้า → `422 "The date must be a date after or equal to 2026-07-13."`
- ทดสอบ `date=2026-07-14`, `2026-07-15` (อนาคต) → ได้ error เดิม (`must be <= 2026-07-12`) เหมือนกันทุกกรณี
- Response header `Date` ของ TMD ตรงกับนาฬิกาเครื่องเรา (ไม่ใช่ปัญหา clock skew ฝั่งเรา)
- **สรุป: ช่วงวันที่ valid ของ TMD เองขัดแย้งกันเอง (max < min) ไม่มีค่า date ใดผ่านได้เลย** — ยืนยันเป็นปัญหาฝั่ง TMD ต่อเนื่องจาก note #63 ไม่ใช่บั๊กเราและไม่ใช่ rate limit

**ตรวจ endpoint ภายในทั้งหมดที่พึ่ง TMD (ผ่าน JWT จริงในเครื่อง):**
- `GET /stations/{id}/tmd-forecast` → `200 {"forecasts": [], "error": "HTTP Error 422..."}` (graceful ตามที่ออกแบบไว้ ไม่ crash)
- `GET /stations/{id}/hourly-forecast` → TMD fail → fallback Open-Meteo ทำงานถูกต้อง (`source: "openmeteo"`, ข้อมูลจริง)
- `GET /stations/{id}/tmd-warning` → `200 {"warnings": []}` (graceful)
- `GET /stations/{id}/forecast` (Open-Meteo cached, ใช้โดย API key ด้วย) → `200` มีข้อมูลจริงถูกต้อง — **แต่พบว่า frontend ที่ใช้ endpoint นี้เป็น fallback มีบั๊กแสดงวันที่ผิด ดูรายละเอียดที่ BUGS.md #17**

**แก้ไข:** `app/dashboard/page.tsx` — filter `omForecast` ให้เหลือเฉพาะวันนี้เป็นต้นไปก่อน slice(0,7) (รายละเอียดเต็มใน BUGS.md #17)

**tested ก่อน deploy:** build frontend image ใหม่ (ยังไม่ `up -d` เพื่อไม่กระทบ container จริงระหว่างเทส) → รัน container แยกต่างหาก (`wimarc-frontend-test`, port 3001, join network `wimarc_default` เพื่อคุยกับ backend จริงได้) → ติดตั้ง playwright + chromium (ผ่าน docker image `mcr.microsoft.com/playwright:v1.61.1-noble` เพราะเครื่องไม่มี sudo ติดตั้ง system lib เองไม่ได้) → login ด้วย JWT ที่ mint เองจาก `_create_token('user-admin','Admin')` (มีสิทธิ์เข้าถึง container/secret อยู่แล้วในเครื่องนี้) → เปิด `/dashboard?station=wimarc1` → เห็น widget "พยากรณ์อากาศ" แสดง "13 ก.ค. 2569" – "19 ก.ค. 2569" ถูกต้อง (screenshot ยืนยัน), ไม่มี console error ที่เกี่ยวข้อง

**deploy:** `docker compose build frontend && docker compose up -d frontend` — container ขึ้นใหม่ปกติ (`200 OK`), re-test ซ้ำกับ container จริง (`wimarc-frontend-1`) ผลตรงกับตอนเทสใน container แยก

**หมายเหตุสำคัญ:** ตอน build/deploy ครั้งนี้ working tree มีการแก้ไขค้างอื่นๆ ที่ไม่เกี่ยวกับ TMD ปนอยู่ด้วย (ระบบ API key admin/portal, sidebar/layout, map, `docker-compose.yml`) — ผู้ใช้ยืนยันให้ deploy ไปพร้อมกันทั้งหมด (ไม่ได้แยก build เฉพาะ TMD fix)

**known issue ที่ยังไม่แก้ (ไม่ใช่ scope งานนี้):** ใน `app/dashboard/page.tsx` บรรทัด header ของ widget นี้ มี `<span>` ที่เคยแสดง "แหล่งที่มา: Open-Meteo (กรมอุตุนิยมวิทยาขัดข้องชั่วคราว)" ตาม note #65 แต่ถูก comment ออกอยู่ (JSX comment) หัวข้อ (title) ยังเปลี่ยนถูกต้องตาม source จริงอยู่ (ไม่ผิด compliance) แต่ข้อความอธิบายเพิ่มเติมหายไป — ถ้าต้องการ re-enable ให้เอา `{/* ... */}` ออกที่บรรทัดใกล้ `CloudRain` header

**commit:** `(no commit — working tree changes)`

**เพิ่มเติม (หลัง note #66):** ผู้ใช้ส่ง TMD API token ใหม่มาให้ลอง (Laravel Passport JWT, `sub=5315`, ออกวันนี้ 2026-07-13, หมดอายุ 2027-07-13, ไม่มี scope จำกัด) — ทดสอบตรงกับ `data.tmd.go.th` แล้วได้ผลแบบเดียวกับ key เดิมทุกประการ: `daily` ยัง 422 "must be <= 2026-07-12", `hourly` 422 "must be <= 2026-07-05" (คนละ bound กับ daily ด้วยซ้ำ — ยิ่งตอกย้ำว่าเป็นปัญหาความไม่สอดคล้องกันของข้อมูลฝั่ง TMD เอง ไม่เกี่ยวกับ credential/token) → **สรุป: เปลี่ยน token ไม่ช่วย เพราะปัญหาไม่ใช่ auth แต่เป็น data pipeline ของ TMD เอง**

**Rollback:** เนื่องจาก TMD ยังใช้งานไม่ได้จริง (ยืนยันซ้ำแม้เปลี่ยน token) จึง revert `app/dashboard/page.tsx` กลับไปที่ state ก่อนแก้ bug fallback (BUGS.md #17) แล้ว build+deploy กลับคืนตามเดิม เพื่อให้ตรงตามเงื่อนไขที่ผู้ใช้ตั้งไว้ว่า "ถ้า TMD ยังใช้ไม่ได้ ห้าม deploy" — ระบบตอนนี้กลับไปเป็น state เดิมก่อนเริ่มงานนี้ (bug fallback วันที่เก่ายังอยู่ ยังไม่ได้ deploy การแก้ไข)

**รอการตัดสินใจจากผู้ใช้:** TMD เป็น third-party service ที่เรา "แก้ให้ใช้ได้" ไม่ได้จริงๆ (ยืนยันแล้วว่าไม่ใช่ปัญหา key/code ของเรา) จึงมีทางเลือกคือ (1) รอ TMD กลับมาใช้งานได้เองแล้วค่อย deploy, หรือ (2) ยอมรับว่า "ใช้ได้" หมายถึงระบบ fallback ทำงานถูกต้องเมื่อ TMD ล่ม (ซึ่งแก้ไขและเทสผ่านแล้ว) แล้ว deploy ส่วนนั้นแยกต่างหาก

**การตัดสินใจสุดท้าย:** ผู้ใช้เลือกให้ deploy fallback fix (BUGS.md #17) ทันที โดยยอมรับว่า "ใช้ได้" หมายถึง widget แสดงข้อมูลถูกต้องเมื่อ fallback ไป Open-Meteo (ไม่ใช่ TMD สดใช้ได้จริง ซึ่งอยู่นอกเหนือการควบคุมของเรา) — re-apply การแก้ไขใน `app/dashboard/page.tsx`, build+deploy อีกครั้ง, re-test ด้วย headless browser ยืนยันแล้วว่า widget แสดง "13 ก.ค. 2569" – "19 ก.ค. 2569" ถูกต้องบน container จริง (`wimarc-frontend-1`)

**commit:** `(no commit — working tree changes)`
