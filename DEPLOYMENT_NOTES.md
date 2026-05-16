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

### 11. สิ่งที่ยังค้างอยู่ (ไม่เร่งด่วน)

| รายการ | รายละเอียด |
|---|---|
| `weather_forecasts` migration warning | backend ขอ ALTER TABLE แต่ไม่ใช่ owner — ไม่กระทบการทำงาน แก้ได้ด้วย `ALTER TABLE weather_forecasts OWNER TO wimarc_admin;` |
| Kernel upgrade pending | reboot เมื่อสะดวก (6.8.0-90 → 6.8.0-111) |
| Next.js dev mode | ปัจจุบันรันด้วย `next dev` — สามารถ switch เป็น production build เพื่อความเสถียรและเร็วขึ้น |
| Full-page refresh (HMR) | เพิ่ม WebSocket proxy ใน Apache แล้ว แต่จะหายไปเองถ้า switch เป็น production build |
