# Security Fixes - 2026-05-19

## สิ่งที่ทำไป

### 1. CRITICAL — /backend/health leaks system internals
- **ป้องกัน:** Unauthenticated attacker รู้ CPU/mem/disk, DB names, Docker hostname, SSL error message จาก file server
- **Attack scenario:** Attacker hits `/backend/health` without credentials → gets internal architecture map
- **ไฟล์ที่แก้:** `backend/app/main.py` (lines 394-455 in patched version)
- **Diff สำคัญ:**
  ```python
  # เดิม — GET /health เปิด public, return ทุก field รวม SSL error
  - result["file_server"] = f"error: {e}"  # leak error message

  # ใหม่ — GET /health return แค่ pass/fail
  + @app.get("/health")
  + def health_check(...) -> JSONResponse:
  +     # returns {"status":"ok"} or {"status":"error"} only

  # ใหม่ — GET /health/detail ต้องมี JWT
  + @app.get("/health/detail")
  + def health_check_detail(current_user: User = Depends(get_current_user), ...):
  +     # returns full details, but file_server error = "error" not the exception message
  ```
- **Verify:**
  ```bash
  curl https://wimarc.in.th/backend/health           # → {"status":"ok"}
  curl https://wimarc.in.th/backend/health/detail    # → HTTP 401
  ```

---

### 2. HIGH — NEXTAUTH_URL pointed to localhost in production
- **ป้องกัน:** Google OAuth callback URL ผิด → OAuth login พัง / attacker ดู `signinUrl: http://localhost:3000/...` รู้ว่า NEXTAUTH_URL ยังเป็น localhost
- **Attack scenario:** OAuth phishing ผ่าน misconfigured callback URL
- **ไฟล์ที่แก้:**
  - `.env` line 4
  - `docker-compose.yml` line 19-20
- **Diff สำคัญ:**
  ```
  # .env
  - NEXTAUTH_URL=http://localhost:3000
  + NEXTAUTH_URL=https://www.wimarc.in.th

  # docker-compose.yml
  - NEXTAUTH_URL: "http://localhost:3000"
  + NEXTAUTH_URL: "https://www.wimarc.in.th"
  + NEXTAUTH_URL_INTERNAL: "http://localhost:3000"
  ```
- **Verify:**
  ```bash
  curl https://wimarc.in.th/api/auth/providers
  # → "signinUrl":"https://www.wimarc.in.th/api/auth/signin/google"
  ```

---

### 3. MEDIUM — FastAPI Swagger/ReDoc/OpenAPI public
- **ป้องกัน:** Attacker enumerate ทุก endpoint, schema, data types จาก `/backend/docs`
- **Attack scenario:** API reconnaissance → targeted injection/auth bypass attempts
- **ไฟล์ที่แก้:** `backend/app/main.py` line 84
- **Diff สำคัญ:**
  ```python
  - app = FastAPI(title="WiMaRC API", version="0.1.0")
  + _is_dev = os.getenv("ENV", "production").lower() == "dev"
  + app = FastAPI(...,
  +     docs_url="/docs" if _is_dev else None,
  +     redoc_url="/redoc" if _is_dev else None,
  +     openapi_url="/openapi.json" if _is_dev else None,
  + )
  ```
- **Verify:**
  ```bash
  curl -I https://wimarc.in.th/backend/docs        # → HTTP 404
  curl -I https://wimarc.in.th/backend/openapi.json # → HTTP 404
  ```

---

### 4. LOW — Server banner disclosure (Next.js + FastAPI headers)

#### 4a. Next.js X-Powered-By removed
- **ไฟล์ที่แก้:** `next.config.mjs` line 3
- **Diff สำคัญ:**
  ```js
  + poweredByHeader: false,
  ```
- **Verify:** `curl -I https://wimarc.in.th/` → no `X-Powered-By: Next.js`

#### 4b. FastAPI `server` header removed
- **ไฟล์ที่แก้:** `backend/app/main.py` — added `_remove_server_header` middleware
- **Diff สำคัญ:**
  ```python
  + @app.middleware("http")
  + async def _remove_server_header(request, call_next):
  +     response = await call_next(request)
  +     if "server" in response.headers:
  +         del response.headers["server"]
  +     return response
  ```
- **Verify:** `curl -I https://wimarc.in.th/backend/health` → no `server:` header

#### 4c. Apache ServerTokens/ServerSignature — ✅ DONE (verified live 2026-08-11)
- **ไฟล์ที่แก้:** `/etc/apache2/conf-available/security.conf`
- Backup at: `/tmp/security.conf.bak.20260519`
- New config at: `/tmp/security.conf.new`
- **รันคำสั่งนี้:**
  ```bash
  sudo cp /tmp/security.conf.new /etc/apache2/conf-available/security.conf
  sudo apache2ctl configtest && sudo systemctl reload apache2
  ```
- **Verify:** `curl -I https://wimarc.in.th/` → `Server: Apache` (no version)
- **ยืนยันแล้ว 2026-08-11:** `curl -sI https://wimarc.in.th/` คืน `Server: Apache` เปล่า ไม่มี version/OS → apply แล้วจริง

---

### 5. LOW — Security headers missing — ✅ DONE (verified live 2026-08-11)
- **ป้องกัน:** Clickjacking (X-Frame-Options), MIME sniffing, Referrer leaks, HSTS enforcement, CSP
- **ไฟล์ที่แก้:** `/etc/apache2/sites-available/wimarc-in-th.conf`
- Backup at: `/tmp/wimarc-in-th.conf.bak.20260519`
- New config at: `/tmp/wimarc-in-th.conf.new`
- **รันคำสั่งนี้:**
  ```bash
  sudo cp /tmp/wimarc-in-th.conf.new /etc/apache2/sites-available/wimarc-in-th.conf
  sudo apache2ctl configtest && sudo systemctl reload apache2
  ```
- **Verify:**
  ```bash
  curl -I https://wimarc.in.th/ | grep -iE "strict-transport|x-content|x-frame|referrer|permissions|content-security"
  ```
- **ยืนยันแล้ว 2026-08-11 — header ครบทุกตัวมาจริงบน production:**
  ```
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://maps.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://maps.googleapis.com https://maps.gstatic.com https://*.googleapis.com https://*.gstatic.com https://*.google.com https://*.googleusercontent.com; connect-src 'self' https://accounts.google.com https://maps.googleapis.com https://maps.gstatic.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-src 'none'; frame-ancestors 'none'
  ```

---

## SSL issue ที่ยังไม่ได้แก้ — ผลเสียถ้าปล่อย

ใน `/backend/health` เดิม (ก่อนแก้) มี error message:
```
"file_server": "error: <urlopen error [SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: Hostname mismatch, certificate is not valid for 'host.docker.internal'>"
```

**ผลเสียถ้าปล่อย:**
- **Feature พัง:** Backend เรียก file server ที่ `http://host.docker.internal` (HTTP ไม่ใช่ HTTPS) — แต่ urllib ดูเหมือนพยายาม HTTPS แล้ว cert ไม่ตรง hostname `host.docker.internal` → feature list/access รูปกล้องจาก file server ใช้ไม่ได้หรือ fallback เงียบ
- **Info disclosure:** Error message leak internal architecture (Docker network, hostname, file server แยก service) — **ได้แก้แล้วใน Fix 1 โดยซ่อน error message ออกจาก public response**
- **Production stability:** Log เต็มด้วย SSL error ทุก health check → ยากดู log จริง
- **MITM risk (low):** ถ้ามี `verify=False` workaround ใน HTTP client → MITM ใน Docker network ได้ (risk ต่ำแต่ไม่ควรมี)
- **User-facing impact:** Feature upload/download หรือ preview รูปกล้อง อาจพัง หรือใช้ fallback path อื่น
- **Risk level:** MEDIUM (internal network แต่กระทบ feature + เคยมี info disclosure)

**แนะนำให้แก้ภายหลัง:**
- ตรวจสอบ `FILE_SERVER_URL` ใน docker-compose.yml — ตั้งเป็น `http://host.docker.internal` (HTTP) แต่ urllib อาจถูก redirect → HTTPS โดย Apache port 80 rule — ควรเปลี่ยนเป็น URL ที่ bypass redirect หรือเรียกตรงผ่าน internal path
- หรือใช้ `http://127.0.0.1` แทน `host.docker.internal` ถ้า Apache bind บน 127.0.0.1 ด้วย

---

## Vuln ที่ยังเหลือ / ต้องทำต่อ

- [x] Apache ServerTokens Prod + ServerSignature Off — **ทำแล้ว ยืนยัน live 2026-08-11:** `curl -sI https://wimarc.in.th/` → `Server: Apache` เปล่า (ดู #4c)
- [x] Security headers (HSTS/CSP/X-Frame/etc.) — **ทำแล้ว ยืนยัน live 2026-08-11:** HSTS (มี `preload`), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, CSP เต็มรูปแบบ มาครบทุกตัว (ดู #5 สำหรับค่า header จริง)
- [ ] SSL cert mismatch (file server `host.docker.internal`) — รอ decision: ใช้ HTTP internally / เปลี่ยน hostname / internal CA

---

## Test commands รวม

```bash
# Fix 1: Public health — no internal details
curl https://wimarc.in.th/backend/health
# Expected: {"status":"ok"}

# Fix 1: Detail health — requires auth
curl -s -o /dev/null -w "%{http_code}" https://wimarc.in.th/backend/health/detail
# Expected: 401

# Fix 2: NEXTAUTH_URL correct
curl -s https://wimarc.in.th/api/auth/providers | python3 -m json.tool | grep signinUrl
# Expected: "signinUrl": "https://www.wimarc.in.th/api/auth/signin/google"

# Fix 3: Docs disabled
curl -s -o /dev/null -w "%{http_code}" https://wimarc.in.th/backend/docs
# Expected: 404

# Fix 4: No banner headers
curl -sI https://wimarc.in.th/ | grep -iE "x-powered-by|server:"
# Expected: Server: Apache (no version, after sudo step)
# Already done: no X-Powered-By

# Fix 5: Security headers (after sudo step)
curl -sI https://wimarc.in.th/ | grep -iE "strict-transport|x-content|x-frame|referrer|permissions|content-security"
```

---

## Rollback

```bash
# Backend
cp /var/www/WiMaRC/backend/app/main.py.bak.20260519 /var/www/WiMaRC/backend/app/main.py
docker compose build backend && docker compose up -d backend

# Frontend
cp /var/www/WiMaRC/next.config.mjs.bak.20260519 /var/www/WiMaRC/next.config.mjs
docker compose build frontend && docker compose up -d frontend

# .env + docker-compose
cp /var/www/WiMaRC/.env.bak.20260519 /var/www/WiMaRC/.env
cp /var/www/WiMaRC/docker-compose.yml.bak.20260519 /var/www/WiMaRC/docker-compose.yml
docker compose up -d frontend

# Apache (requires sudo)
sudo cp /tmp/wimarc-in-th.conf.bak.20260519 /etc/apache2/sites-available/wimarc-in-th.conf
sudo cp /tmp/security.conf.bak.20260519 /etc/apache2/conf-available/security.conf
sudo systemctl reload apache2
```

### 6. CRITICAL — Cryptominer malware (usbipdate) บน postgres user  <!-- (2026-05-28) -->

**ป้องกัน:** หยุด cryptominer ที่กิน CPU 1468% และปิดช่องโหว่ที่ทำให้ติดซ้ำได้

**สาเหตุ:** port 5432 เคย ALLOW จาก Anywhere — ผู้โจมตีเข้าถึง postgres user ได้ ติดตั้ง malware เมื่อ 2026-05-20
- Binary: `/tmp/.perf.c/usbipdate` (ELF statically linked) แฝงตัวเป็น process ชื่อ `postgres`
- Persistence: crontab `*/3 * * * * /var/lib/postgresql/.config/cron/perfcc`
- Staging dir: `/var/lib/postgresql/.atmp/tmp/.applocal.xdiag/`

**แก้ไข:**
- `sudo kill -9 <PID>` — หยุด miner process
- `sudo rm -rf /tmp/.perf.c/` — ลบ binary
- `sudo rm -rf /var/lib/postgresql/.atmp/` — ลบ staging
- `sudo crontab -u postgres -r` — ลบ crontab persistence
- `sudo rm -rf /var/lib/postgresql/.config/ /var/lib/postgresql/.local/` — ลบ scripts
- `ALTER USER postgres PASSWORD '...'` — เปลี่ยน password
- `sudo ufw delete allow 5432/tcp` (rule #4 และ #10) — ลบ rule ที่เปิด 5432 จาก Anywhere
- UFW ที่ถูกต้อง: `5432 ALLOW 172.18.0.0/16` + `5432 DENY Anywhere`

**commit:** `274af63` — security: remove cryptominer, fix UFW port 5432

### 7. MEDIUM — postgres user มี login shell  <!-- (2026-05-28) -->

**ป้องกัน:** ถ้า port 5432 เปิดอีกครั้งโดยบังเอิญ ผู้โจมตีจะเจาะและรัน command ได้เหมือนเดิม

**แก้ไข:** ล็อก shell ของ postgres user ไม่ให้ login ได้
```bash
sudo usermod -s /usr/sbin/nologin postgres
```
- PostgreSQL service ยังทำงานปกติ (`sudo -u postgres psql` ยังได้)
- ตัด interactive login ออก — ผู้โจมตีเจาะ postgres ได้แต่รัน shell ไม่ได้

**สถานะ:** ✅ ดำเนินการแล้ว 2026-05-28

### 8. LOW — วิธีเข้า PostgreSQL จากภายนอกที่ปลอดภัย  <!-- (2026-05-28) -->

**ป้องกัน:** ไม่เปิด port 5432 สู่ internet อีก ใช้ SSH Tunnel แทน

**วิธีใช้ DBeaver/VS Code Database:**
- SSH tab: `wimarc.in.th:22` user `opas`
- Main tab: `localhost:5432` user `wimarc_admin` db `wimarc_db`
- Advanced → Remote host: `127.0.0.1`, Remote port: `5432`

**สาเหตุ:** port 22 (SSH) ออกแบบมาสำหรับ public internet + เข้ารหัส, port 5432 ไม่ได้ออกแบบมาสำหรับ public

### 9. CRITICAL — Cryptominer self-healing: /dev/shm + multiple binary names  <!-- (2026-05-28) -->

**ป้องกัน:** Cryptominer respawn ซ้ำแม้ลบ crontab และไฟล์แล้ว เพราะมี backup copies หลายจุด

**Persistence chain ที่พบ:**
- `/tmp/.perf.c/` → `/tmp/.dfbi` (dropper) → `/tmp/.xdiag/` (staging, มี Tor C2)
- `/dev/shm/libfsnldev.so`, `/dev/shm/libpprocps.so` — miner 11MB ปลอมเป็น shared library, ตั้ง `chattr +i` เองป้องกันการลบ
- ชื่อ process เปลี่ยนทุกครั้ง: `usbipdate` → `apport-collectt` → `py3compilemandb` → `netstatscsi_log` → `javavm64`

**แก้ไข:**
1. `chattr -i` ถอด immutable แล้ว `rm -f` ลบ miner ใน /dev/shm
2. Block ทุก path ด้วย `chattr +i` empty file
3. `mount -o remount,noexec /dev/shm` + เพิ่มใน fstab ถาวร
4. UFW block outbound: port 3333/5555/9001/14444 (mining pools) + IP 178.254.22.120, 45.84.107.84
5. `/root/miner_monitor.sh` — script kill miner auto ทุก 1 นาที ผ่าน root crontab
6. `chattr +i /var/lib/postgresql/` — ป้องกัน malware สร้าง directory ใหม่

**commit:** `dfa8eec` — fix: FILE_SERVER_URL + miner cleanup complete

### 13. CRITICAL — 6 backend vulnerabilities patched  <!-- (2026-06-07) -->

**ป้องกัน:** 6 ช่องโหว่แยกกัน ดูรายละเอียดด้านล่าง

**FIX-1 — Leaked secrets in git (CRITICAL)**
- `.env.bak.20260519` ถูก track ใน git มี `JWT_SECRET`, `NEXTAUTH_SECRET`, `TMD_API_KEY` จริง
- **แก้ไข:** `git rm --cached .env.bak.20260519`, เพิ่ม `.env.bak*` ใน `.gitignore`
- เนื้อหาเดิมเก็บใน `notes/security-removed-archive.md`

**FIX-2 — Unauthenticated sensor/forecast/activity endpoints (HIGH)**
- `/live`, `/readings`, `/forecast`, `/forecast/history`, `/images/*`, `/tmd-forecast`, `/hourly-forecast`, `/tmd-warning`, `/activities`, `/sim-payments` ทั้งหมดเปิด GET โดยไม่ต้องล็อกอิน
- **แก้ไข:** เพิ่ม `current_user: User = Depends(get_current_user)` ทุก endpoint ที่ยังไม่มี; เพิ่ม `require_admin` ให้ `POST /admin/forecasts/refresh`

**FIX-3 — Rate limit bypass via X-Forwarded-For spoofing (HIGH)**
- `_get_real_ip()` trust `X-Forwarded-For` header → attacker ส่ง header ปลอมเพื่อเลี่ยง rate limit
- **แก้ไข:** ลบ X-Forwarded-For lookup ออก ใช้ `request.client.host` เท่านั้น

**FIX-4 — Unauthenticated POST /stations/{id}/readings (HIGH)**
- JWT middleware whitelist มี `POST /stations/{id}/readings` → ใครก็สามารถ inject ข้อมูล sensor ปลอมได้
- **แก้ไข:** ลบบรรทัดนั้นออกจาก whitelist

**FIX-5 — CORS wildcard * (MEDIUM)**
- CORS เปิด `allow_origins=["*"]` → ทุก origin เรียก API ได้
- **แก้ไข:** อ่านจาก `CORS_ORIGINS` env var, default เป็น `["https://www.wimarc.in.th"]`

**FIX-6 — Hardcoded internal IP in source code (LOW)**
- `http://203.185.101.200:8081/metrics` hardcode ใน `/health/detail`
- **แก้ไข:** ย้ายไป `WIMARC_API_METRICS_URL` env var; ถ้าไม่ set ก็ข้าม block นั้น

**ไฟล์ที่แก้:** `backend/app/main.py`, `.gitignore`
**commit:** `78bd783` — security: patch 6 backend vulnerabilities + remove leaked env backup

### 14. MEDIUM — Guest role ไม่ read-only + role value ไม่ตรง  <!-- (2026-06-12) -->

**ป้องกัน:** Guest (รวมที่สมัครเอง) เขียน/ลบข้อมูล cross-station + role mismatch ทำให้ permission logic เพี้ยน

**ปัญหาที่พบจาก audit:**
- Register เขียน `role="G"` แต่ทั้งระบบเช็ค `"Guest"` → frontend `canEditData` ฯลฯ อ่าน role ไม่ตรง = permission gate ไม่ทำงานตามตั้งใจ
- Backend ไม่มี gate แยก Guest vs User — Guest POST/PUT/DELETE activities + sim-payments ได้ (อาศัย client-side ซ่อนอย่างเดียว, bypass ผ่าน API ตรงได้)
- `POST /stations/{id}/readings` ไม่มี auth dependency เลย → inject sensor ปลอมได้

**แก้ไข (`backend/app/main.py`):**
- fix `role="G"` → `"Guest"` + startup migration normalize rows เดิม
- เพิ่ม `require_not_guest` dependency บังคับ Guest read-only: ใส่ที่ images, `GET /readings`, write ทั้งหมด (activities/sim-payments create/update/delete, readings POST)
- helper `_can_read_station` (Guest อ่าน live/forecast ได้ทุกสถานี แต่เขียนไม่ได้)

**ยังเหลือ (out of scope งานนี้):** IDOR — User role แก้/ลบ activities + sim-payments ของสถานีที่ไม่อยู่ใน `permitted_station_ids` ได้ (write endpoints ยังไม่เช็ค per-station ownership, เช็คแค่ login). ควร patch แยก

**commit:** `78572de` — feat: Guest mode — nearest-station by geolocation + read-only RBAC

### 15. HIGH — Code-level scan: IDOR (write) + role="G" bypass + auth/config hardening  <!-- (2026-07-04) -->

**ป้องกัน:** ช่องโหว่ระดับโค้ดที่ ZAP passive scan ตรวจไม่เจอ (authorization logic) — พบจากการ review `backend/app/main.py` ทั้งไฟล์ ปิดช่องที่ทำให้ user เขียน/ลบข้อมูลข้ามสถานี และคนทั่วไปที่มีบัญชี Google หลุด guest gate

**ปัญหาที่พบ + แก้ไข (`backend/app/main.py`):**

- **H1 (HIGH) — `google_login` สร้าง user `role="G"`** ([main.py](../backend/app/main.py) เดิมบรรทัด ~1040) แต่ทั้งระบบเช็ค `"Guest"` → `require_not_guest` (เช็ค `== "Guest"`) และ frontend `canEditData` (เช็ค `!== "Guest"`) ปล่อยผ่านทั้งคู่ = ใครมีบัญชี Google → login → ได้ account `role="G"`, `is_enabled=True` → เขียน/ลบ activities/sim-payments/readings ของทุกสถานีได้ (register แก้เป็น `"Guest"` แล้วแต่ google_login ยังสร้าง `"G"` ใหม่ทุก signup หลัง server start). **แก้:** `role="G"` → `role="Guest"`

- **H2 (HIGH) — IDOR/BOLA write endpoints ไม่เช็คเจ้าของสถานี** — `require_not_guest` เช็คแค่ role → User ทั่วไปแก้/ลบข้อมูลของแปลงคนอื่นได้ทั้งหมด (คือ IDOR ที่ entry #14 ระบุว่ายังเหลือ). **แก้:** เพิ่ม helper `_can_write_station` / `_require_write_station` (Admin=ทุกสถานี, User=เฉพาะ `permitted_station_ids`, Guest=ห้าม) แล้วบังคับที่: `POST /stations/{id}/readings`, `POST/PUT/DELETE /activities`, `POST/PUT/DELETE /sim-payments` (PUT เช็คทั้งสถานีเดิมและสถานีปลายทางถ้าย้าย)

- **H2b — ปลอม attribution** — `POST /activities` รับ `created_by`/`created_by_name` จาก payload. **แก้:** ตั้งค่าจาก `current_user.id` / `current_user.full_name` ฝั่ง server แทน

- **M2 (MEDIUM) — `GET /stations/{id}/openmeteo-forecast` เปิด public** (ไม่มี auth dependency + JWT middleware ปล่อย GET). **แก้:** เพิ่ม `Depends(get_current_user)`

- **M3 (MEDIUM) — Google access token ไม่ตรวจ `aud`** (confused-deputy: token ของแอปอื่น replay เข้าได้). **แก้:** เพิ่มตรวจ `aud` ผ่าน `oauth2.googleapis.com/tokeninfo` — เปิดใช้เมื่อ set `GOOGLE_CLIENT_ID` ใน env ของ backend (opt-in กันพัง prod). **ต้องทำต่อ:** เพิ่ม `GOOGLE_CLIENT_ID: "${GOOGLE_CLIENT_ID:-}"` ใน backend service ของ `docker-compose.yml` (ตอนนี้มีแค่ frontend)

- **M4 (MEDIUM) — JWT_SECRET fallback เป็น dev default** — ถ้า env หลุด แอปจะเงียบๆ ใช้ secret สาธารณะ → ปลอม admin JWT ได้. **แก้:** fail-closed — raise ตอน startup ถ้า secret เป็น default และ `ENV != dev` (prod มี `JWT_SECRET` ใน `.env` อยู่แล้ว → ไม่กระทบ)

- **LOW — DB error string รั่ว** ที่ `/config/system`, `/config/stations`, `PUT /config` (`f"DB error: {e}"`). **แก้:** log ฝั่ง server, คืน message กลางๆ

**Accepted-risk (จงใจไม่แก้):** read endpoints (`/live`, `/readings`, `/activities` list, `/sim-payments` list) ยังเปิดให้ user ที่ login อ่านข้ามสถานีได้ — เพราะหน้า compare/overview พึ่งพา (ดู [BUGS.md](BUGS.md) #14). ถ้าจะปิดต้อง refactor frontend ให้ไม่อ่านข้ามสถานีก่อน

**ยังไม่ทำ:** อัป `next@16.0.10` → `≥16.2.6` (dependency CVE, ต้อง test), rate-limit granularity หลัง reverse proxy (M5, design tradeoff)

**Deploy:** ✅ deployed 2026-07-04 — build image จาก **context แยก** (HEAD `78572de` + fix ผมล้วน 84 บรรทัด) tag `wimarc-backend:latest` แล้ว `docker compose up -d --no-build --force-recreate backend`. เหตุที่ไม่ build จาก working tree ตรงๆ: ตอนนั้น working tree มีฟีเจอร์ **API-key auth ของ dev อีกคน (WIP, uncommitted, ~300 บรรทัด)** ปนอยู่ — จงใจ deploy เฉพาะ fix security ไม่พ่วง WIP. Verify prod: `/backend/health`=200, `/openmeteo` no-token=401, prod container `ApiKey in dir(m)=False`, `_require_write_station=True`.

⚠️ **caveat:** production ตอนนี้ = HEAD + fix ผม (ไม่มี api_keys). **working tree ยังมี fix ผม + api_keys WIP ปนกัน (ยังไม่ commit)** — ครั้งต่อไปที่ใครรัน `docker compose build backend` จาก working tree จะ rebuild พร้อม api_keys ทับ image นี้. ควร commit ให้เรียบร้อย: แยก fix security กับ api_keys เป็นคนละ commit
⚠️ **ก่อนใช้งานจริง:** ตรวจว่า User (non-admin) ที่ต้องแก้ activities/payments มี `permitted_station_ids` ครบ ไม่งั้นโดน 403
⚠️ Google `aud` check: เพิ่ม `GOOGLE_CLIENT_ID` เข้า backend env ใน `docker-compose.yml` แล้ว (resolve เป็นค่าจริง ตรงกับ frontend) — check ทำงาน live

**commit:** (ยังไม่ commit — deployed ผ่าน isolated image build)

### 16. CRITICAL — JWT_SECRET + รหัส DB หลุดอยู่ใน public GitHub repo  <!-- (2026-07-16) -->

**ป้องกัน:** ใครก็ได้ที่เปิด GitHub อ่าน `JWT_SECRET` ที่ production ใช้จริง แล้วเซ็น JWT ปลอมเป็น `Admin` เข้าถึง API ทั้งระบบได้ — **ยืนยันของจริงแล้ว:** token ที่เซ็นด้วย secret ที่หลุด เรียก `GET /users` ได้ `HTTP 200`

**สิ่งที่พบ (16 ก.ค. 2569):**
- repo `Iliketoeatsalmon/WiMaRC` เป็น **public** (`"private": false` จาก GitHub API)
- `notes/DEPLOYMENT_NOTES.md` (tracked) เก็บ `JWT_SECRET` ที่ **fingerprint ตรงกับ `.env` บน production เป๊ะ** + รหัส postgres superuser + รหัส `wimarc_admin`
- `notes/security-removed-archive.md` (tracked) มีอีก 1 จุด
- อยู่บน `origin/main` มาตั้งแต่ **15 มิ.ย. 2569 (~1 เดือน)** → ต้องถือว่าหลุดจริงและถูกมองเห็นแล้ว
- ช่องโหว่นี้หลุดรอดจาก SECURITY.md #13 FIX-1 ที่ลบแค่ `.env.bak` ออกจาก git แต่ไม่ได้ตรวจว่า DEPLOYMENT_NOTES.md เองก็มี secret ชุดเดียวกัน

**แก้ไข (ทำแล้ว):**
- **หมุน `JWT_SECRET` ใหม่** (`secrets.token_hex(32)`) → เขียนทับใน `.env` → `docker compose up -d --force-recreate backend` (ไม่ต้อง rebuild เพราะ compose ส่งเข้าเป็น env var)
- redact secret ออกจาก `notes/DEPLOYMENT_NOTES.md` + `notes/security-removed-archive.md` แทนด้วย `<redacted>` (ยกเว้น `docker-compose.yml` ที่ยังต้องใช้รหัส DB จริงต่อ)
  **⚠️ แก้ข้อความนี้ (2026-08-11):** ใน `notes/security-removed-archive.md` redact จริงแค่ `JWT_SECRET` บรรทัดเดียว — `TMD_API_KEY` กับ `NEXTAUTH_SECRET` ยังเป็นค่าจริง plaintext ค้างอยู่ในไฟล์ tracked จนถึง 2026-08-11 จึงเพิ่ง redact (ดู #18)
- **verify:** token secret เก่า → `401` ✓ · token ใหม่ → `200` ✓ · `/health` → `200` ✓
- **ผลข้างเคียงที่ยอมรับแล้ว:** ผู้ใช้ทุกคนถูก logout ต้อง login ใหม่

**⚠️ การ redact ไม่ได้ลบ secret ออกจาก git history** — history ยังมีค่าเดิมและเปิดสาธารณะมาเดือนกว่า การหมุน secret จึงเป็นการแก้จริงเพียงอย่างเดียว

**สถานะข้อที่เหลือ (อัปเดต 2026-07-16):**

- [x] **เปลี่ยน repo เป็น private** — ทำแล้ว เจ้าของกดเอง ยืนยันว่า anonymous เข้าไม่ได้ (GitHub API + หน้าเว็บ → `404`) จากนั้นจึง push งานนี้ขึ้นไป (ก่อนหน้านี้จงใจไม่ push เพราะ SECURITY.md ฉบับนี้ + รายงาน ZAP/pentest จะกลายเป็นแผนที่ให้ผู้โจมตีบน repo public)

- [ ] **หมุนรหัส postgres — ACCEPTED-RISK: เจ้าของตัดสินใจไม่หมุน (2026-07-16)**
  รหัส `postgres` (superuser) + `wimarc_admin` ยังเป็นค่าเดิมที่เคยอยู่ใน public git history ~1 เดือน (15 มิ.ย. – 16 ก.ค. 2569) และยังฝัง inline ใน `DATABASE_URL` ของ `docker-compose.yml`
  **ข้อควรรู้:** การทำ repo private ไม่ย้อนอดีต — ใครที่โคลนหรืออ่านไว้ก่อนหน้ายังถือรหัสอยู่
  **ตัวลดความเสี่ยงที่มีอยู่แล้ว:** UFW ปิด port 5432 จาก Anywhere อนุญาตเฉพาะ docker subnet (ดู #6) + `postgres` user เป็น `nologin` (ดู #7) → เข้าจากภายนอกตรง ๆ ไม่ได้
  **ถ้าเปลี่ยนใจ:** `ALTER USER` ทั้งสอง + ย้ายรหัสจาก `docker-compose.yml` ไปเป็น `${VAR}` ใน `.env` + `docker compose up -d --force-recreate backend`

- [ ] **หมุน** `NEXTAUTH_SECRET` / `TMD_API_KEY` — ตรวจแล้ว 2026-08-11: **หลุดจริงทั้งคู่ · redact ในเอกสารแล้ว แต่ยังไม่หมุนค่าจริงใน `.env`**
  ทั้งสองค่าใน `notes/security-removed-archive.md` (tracked) ตรงกับค่าที่ container รันอยู่จริง ณ 2026-08-11 แบบ byte-identical → เป็นค่า production ทั้งคู่ อยู่ใน repo ตลอดช่วงที่เป็น public (~1 เดือน)
  redact ออกจากไฟล์แล้ว 2026-08-11 แต่ **ยังไม่ได้หมุนค่าจริง** — ดู #18 และ checklist ท้าย `notes/security-removed-archive.md`

- [ ] git history rewrite (BFG / filter-repo) — ทางเลือก; ความจำเป็นลดลงหลัง repo เป็น private แล้ว

**commit:** `21ef6a0`

### 17. HIGH — SQL injection ใน legacy PHP ingest endpoints (InsertdataW32_main.php / _client.php)  <!-- (2026-07-18) -->

**ป้องกัน:** ทั้ง 2 ไฟล์เดิม insert ค่าจาก `$_POST` (wimarcID, A-H) ลง SQL ด้วย string interpolation ตรง ๆ (`pg_query($conn, "... wimarc_id='$device_id' ...")`) ไม่มี escape/parameterize เลยสักจุด — endpoint เปิด public ให้ ESP อัปโหลดได้โดยไม่ auth ใด ๆ (ตาม design เดิม สำหรับ device ในสนาม) ทำให้ใครก็ได้ที่ยิง POST มาที่ URL นี้ (ไม่ต้องมี token) แทรก SQL ได้ทันที เจอระหว่างแก้ไข ingest layer ให้รองรับ [LoRa mutual-mirror failover](DEPLOYMENT_NOTES.md) #67 (ต้องแก้บรรทัด INSERT เดิมอยู่แล้วเลยปิดช่องโหว่นี้ไปพร้อมกัน ไม่ใช่ scope แยก)

**แก้ไข:** เปลี่ยนทุก query ในทั้ง 2 ไฟล์ (รวมไฟล์ shared ใหม่ `wimarc_ingest_lib.php`) จาก `pg_query()` + string interpolation → `pg_query_params()` พร้อม placeholder (`$1,$2,...`) ทั้งหมด ครอบคลุม `updatedata`, `timer`, `CAM_main`, `CAM_client`, `sensor`, `sensor_1min`

**ยังเปิด public ตามเดิม (by design):** endpoint ยังไม่มี auth เพราะ ESP32-CAM ในสนามยิง POST ตรงไม่มี token — ความเสี่ยงที่เหลือคือ device ปลอม/ยิง payload มั่วได้ (DoS เชิงข้อมูล, ปลอมค่า sensor) แต่ไม่ใช่ SQL injection แล้ว การเพิ่ม auth (เช่น shared secret ต่อ device) เป็นงานแยก ไม่ได้ทำในรอบนี้

**tested:** ยิง `A=1' OR '1'='1` และ `A=1'); DROP TABLE updatedata; --` ผ่าน `$_POST` จริงเข้า endpoint ที่ deploy อยู่ — ทั้งคู่ถูกเก็บเป็น literal string ใน column (`SELECT "A" FROM updatedata` ได้ค่า `1' OR '1'='1` ตรงตัว) ไม่มี SQL ถูก execute, `updatedata`/schema ทั้งหมดยังอยู่ครบ (`information_schema.tables` count ปกติ) — ดู test log เต็มใน [DEPLOYMENT_NOTES.md](DEPLOYMENT_NOTES.md) #67

**bug ที่เจอระหว่างเทส (แก้ไปด้วย):** payload ที่ยาวเกิน column limit (`character varying(15)`) ทำให้ `pg_query_params()` คืนค่า `false` แล้วโค้ดเดิมเรียก `pg_affected_rows($res)`/`pg_num_rows()`/`pg_fetch_assoc()` ต่อทันทีโดยไม่เช็คก่อน — PHP8 throw `TypeError` ที่ไม่ได้ดักไว้ = **fatal error ทำให้ request นั้นล้มทั้งเส้น** (ไม่กระทบ request อื่นหรือ container แต่ response เสียหายสำหรับ request ที่ payload ผิดปกติ) แก้โดยเช็ค `$res === false` ก่อนเรียกทุกจุดใน `wimarc_ingest_lib.php`

**commit:** ไม่มี — `/var/www/wimarc` ไม่ใช่ git repo (ดู #67); ไฟล์เดิม backup ไว้ก่อนแก้

### 18. HIGH — `TMD_API_KEY` + `NEXTAUTH_SECRET` ยังเป็นค่า production plaintext ใน notes ที่ track ใน git  <!-- (2026-08-11) -->

**ป้องกัน:** `notes/security-removed-archive.md` เป็นไฟล์ที่ **track ใน git** และเก็บค่าจริงของ 2 secret ไว้แบบ plaintext มาตลอด — #16 (2026-07-16) เขียนไว้ว่า redact secret ออกจากไฟล์นี้แล้ว แต่จริง ๆ redact แค่ `JWT_SECRET` บรรทัดเดียว อีก 2 บรรทัดถูกมองข้าม

**สิ่งที่พบ (11 ส.ค. 2569):**
- บรรทัด 10 `TMD_API_KEY` — ตรวจแล้วตรงกับค่าที่ backend container ใช้อยู่จริง ณ ตอนนี้แบบ byte-identical (JWT ตัวนี้ `exp` = 2027-05-16 ยังไม่หมดอายุ)
- บรรทัด 12 `NEXTAUTH_SECRET` — ตรวจแล้วตรงกับค่าที่ frontend container ใช้อยู่จริงแบบ byte-identical
- บรรทัด 11 `JWT_SECRET` — redact จริงและหมุนไปแล้วตั้งแต่ #16 ไม่ต้องทำอะไรเพิ่ม
- repo เป็น public ~15 มิ.ย. – 16 ก.ค. 2569 (~1 เดือน) → **ต้องถือว่าค่าทั้งสองหลุดแล้ว** เหมือน `JWT_SECRET`

**ผลกระทบถ้าปล่อย:**
- `TMD_API_KEY` — ใครก็ได้ยิง API กรมอุตุฯ ในนามบัญชีเรา กิน quota (60 req/min, 100k datapoints/เดือน) จน forecast ของระบบล่ม
- `NEXTAUTH_SECRET` — ใช้เซ็น/ถอด NextAuth session cookie ของฝั่ง frontend คนที่ถือค่านี้ปลอม session cookie ได้

**แก้ไข (ทำแล้วรอบนี้):**
- redact ทั้ง 2 บรรทัดใน `notes/security-removed-archive.md` ด้วยรูปแบบเดียวกับบรรทัด `JWT_SECRET` เดิม + เพิ่ม checklist การหมุนไว้ท้ายไฟล์นั้น
- แก้ข้อความที่ผิดใน #16 (บอกว่า redact ครบแล้ว) และติ๊ก checkbox "ตรวจ + หมุน NEXTAUTH_SECRET / TMD_API_KEY" ว่าตรวจแล้ว = หลุดจริง
- sweep ทั้งโฟลเดอร์ `notes/` (รวมไฟล์ untracked `DOC_8.3.1.9_WEBAPP_DB.md`, `FAILOVER.md`, `ICD_DATA_EXCHANGE.md`) หา credential อื่น — **ไม่พบเพิ่ม** ที่เหลือเป็น placeholder ทั้งหมด (`********`, `<TOKEN>`, `<JWT_TOKEN>`, `wmk_xxxx`, `wmk_YOUR_API_KEY_HERE`, `PGPASSWORD='***'`, `<redacted — ดู SECURITY.md #16>`) และ `notes/API_ENDPOINTS.md:113` เป็นแค่ JWT header ตัดสั้น (`{"alg":"HS256","typ":"JWT"}` base64 — ไม่ใช่ความลับ)

**⚠️ ยังไม่ได้ทำ — งานของเจ้าของเซิร์ฟเวอร์:**
- [ ] ขอ `TMD_API_KEY` ใหม่จากกรมอุตุฯ → เขียนทับใน `.env` → recreate backend
- [ ] หมุน `NEXTAUTH_SECRET` (`openssl rand -base64 32`) → เขียนทับใน `.env` → recreate frontend (**ผลข้างเคียง:** Google OAuth session ทุกคนหลุด ต้อง login ใหม่)

การ redact **ไม่ลบค่าออกจาก git history** — history ยังมีค่าเต็ม การหมุนค่าจริงเท่านั้นที่แก้ปัญหาได้ (เหมือนที่ #16 เขียนไว้)

**commit:** (ยังไม่ commit — working tree changes)

---

## 📑 ภาคผนวก — ดัชนีเลขลำดับที่ข้าม (erratum)  <!-- (2026-08-11) -->

> เพิ่มต่อท้ายเท่านั้น — **ไม่ได้แก้เลขของ entry เดิม** เพราะ note/commit อื่นอ้างถึงเลขเหล่านี้อยู่

- ไฟล์นี้ **ไม่มี `### 10.`, `### 11.`, `### 12.`** — ลำดับเดินจาก #9 (2026-05-28) ข้ามไป #13 (2026-06-07) ไม่ใช่ entry ที่หายหรือถูกลบ ถ้าเจอการอ้าง "SECURITY #10/#11/#12" ที่ไหน แปลว่าอ้างผิด
- ที่เหลือ (#1–#9, #13–#18) เลขไม่ซ้ำกัน ไม่กำกวม
- **เลขถัดไปที่ควรใช้เมื่อเพิ่ม entry ใหม่:** `### 19.`

### 19. CRITICAL — SQL injection ไม่ต้อง login ที่ `view_table.php` + ช่องเดียวกันในไฟล์ control  <!-- (2026-08-11) -->

**ป้องกัน:** `/var/www/wimarc/view_table.php` รับ `$_GET['station_no']` ดิบ โดย guard เดิมเป็น `(int)$station_num < 1` ซึ่ง `(int)"1'"` = 1 ผ่านได้ แล้วเอาไปต่อ string ตรง ๆ ใน `WHERE wi.set_name = '$db_search_name'` ผ่าน `pg_query()` — endpoint นี้เปิดสาธารณะ (Apache exempt prefix `view`) และ `dblink.php` เชื่อมเป็น `wimarc_admin` ที่ SELECT ตาราง `users` / `api_keys` / `external_users` ได้ พิสูจน์จากอินเทอร์เน็ตจริง: `?station_no=1%27` → HTTP 500 (syntax error), `?station_no=1%27%20--%20` → HTTP 200 (ปิดคอมเมนต์สำเร็จ)
พบเพิ่มระหว่างกวาดทั้งไดเรกทอรี: `InsertdataW32control_CAMA.php` / `_CAMV.php` มี pattern เดียวกัน (interpolate `$_POST['A'..'H']` เข้า INSERT) — ยังใช้โจมตีไม่ได้เพราะตาราง `CAMAcontrol`/`CAMVcontrol` ไม่มีอยู่จริง (statement แรก parse ไม่ผ่าน → Postgres ยกเลิกทั้ง batch) แต่ "ตารางไม่มี" ไม่ใช่มาตรการป้องกัน

**แก้ไข:**
- `view_table.php` — guard เป็น `ctype_digit((string)$station_num)`, สร้างชื่อจาก `(int)$station_num`, แปลง 8 query เป็น `pg_query_params()` (SQL เป็น single-quoted string เพื่อไม่ให้ PHP กิน `$1`), LIMIT/OFFSET cast int, เพิ่ม guard `$res !== false` ก่อน `pg_fetch_*`
- `InsertdataW32_A/_B/_CAMA/_CAMV/_client.php`, `uploadCAMVold_client.php` — แปลงเป็น `pg_query_params()` ทุกจุดที่มี request data (ชื่อตารางที่ interpolate เป็น literal คงที่ทั้งหมด)
- `InsertdataW32control_CAMA.php` / `_CAMV.php` — แปลง INSERT เป็น bound params + guard `pg_fetch_assoc`
- ทุกไฟล์เพิ่ม `?? ''` ให้ `$_POST` เพื่อไม่ให้ค่าที่หายกลายเป็น SQL NULL ชน NOT NULL (พฤติกรรมเดิมคือ empty string)
- backup ก่อนแก้ไว้ที่ `/var/www/wimarc/.bak-20260811/` (chmod 700, `Require all denied`, ยิงจากภายนอกได้ 404)

**tested:** `php -l` ผ่านทั้ง 9 ไฟล์ · request ปกติทุก `type` ยังได้ข้อมูลครบเท่าเดิม (main 9451B, client, cam_main) · injection ทุกแบบ (`1'`, `1' -- `, `1' OR '1'='1`, `UNION SELECT ... FROM users--`, `-1`, `abc`) ตกที่ JSON "ไม่พบสถานี" 96B ไม่ถึง SQL · grep ทั้งไดเรกทอรีไม่เหลือ request data ใน `pg_query` แล้ว · ingest จาก ESP ไม่สะดุด (`sensor_1min` 231-401 แถว/5 นาที ตลอดช่วงแก้)

**ยังไม่ได้ทำ (ต้อง superuser):** แยก DB role สำหรับ PHP ให้เห็นเฉพาะตาราง legacy sensor — ตอนนี้ PHP กับ backend ยังใช้ `wimarc_admin` ร่วมกันซึ่งเห็นทุกตาราง

**commit:** `(no commit — working tree changes)`

---

### 20. HIGH — เคลียร์ CVE ของ dependency ทั้ง stack + container รันเป็น root  <!-- (2026-08-19) -->

**ที่มา:** scanner ภายนอกรายงาน 11 รายการ ตรวจของจริงทีละรายการแล้วพบว่ามีทั้งของจริง ของที่ประเมินผิด และของที่ scanner **ไม่ได้แจ้งแต่หนักกว่า**

**ป้องกัน:**

*Backend* — สแกนทุก package ที่ pin ด้วย OSV (ไม่ใช่แค่ตัวที่ scanner แจ้ง) เจอ 29 advisories รวม:
- `starlette 0.41.3` → **14 advisories** ตัวที่ scanner จัดเป็น Critical คือ `GHSA-86qp-5c8j-p5mr` — ไม่ validate `Host` header ทำให้ poison `request.url.path` ได้ แล้ว **bypass การเช็คสิทธิ์ที่อิง path** ซึ่งกระทบเราตรงๆ เพราะ `_jwt_auth_middleware` ตัดสินใจจาก path
- `PyJWT 2.10.1` → **13 advisories** (scanner ไม่แจ้ง) ที่กระทบเราจริงคือ accept `crit` header ที่ไม่รู้จัก และ algorithm allow-list bypass — เป็น lib ที่ตรวจ token ของทุก request
- `python-dotenv 1.0.1` → 2 advisories

*Frontend* — `pnpm audit` 49 → 0:
- `next 16.0.10` → **31 advisories** รวม SSRF ที่ scanner แจ้ง (*SSRF in rewrites via attacker-controlled destination hostname*) ซึ่งตรงกับที่เราใช้ rewrites จริงใน `next.config.mjs`
- `next-auth 4.24.13` → **CRITICAL** (email normalizer validate ก่อน Unicode normalize) + getToken โยน exception กับ Bearer ที่ผิดรูป + PKCE/state/nonce cookie ไม่ผูกกับ transaction
- transitive: `sharp` (libvips CVE), `lodash` (`_.template` code injection), `postcss` (path traversal + XSS), `nanoid`, `uuid`

*Container รันเป็น root* — ยืนยันด้วย `docker exec id` ว่าทั้ง frontend และ backend เป็น `uid=0` และ Dockerfile ทั้ง 3 ไฟล์ไม่มี `USER` เลย

*`.next/dev` ถูก track ใน git* — 4 รายการ "exposed secrets" ของ scanner มาจากตรงนี้ ไฟล์ถูก commit ตั้งแต่ commit แรก (`8bbc4b6 template`) **ก่อน** ที่ `.next` จะเข้า `.gitignore` ซึ่ง gitignore ไม่มีผลย้อนหลังกับไฟล์ที่ track แล้ว

**แก้ไข:**
- `backend/requirements.txt` — `fastapi 0.115.6 → 0.141.1` (จำเป็น: 0.115.6 ล็อก `starlette<0.42.0` แก้ starlette เดี่ยวๆ ไม่ได้), pin `starlette==1.6.0`, `PyJWT→2.13.0`, `python-dotenv→1.2.2`
- `package.json` — `next→16.2.11`, `next-auth→^4.24.15`, `postcss→^8.5.26` + `pnpm.overrides` สำหรับ `sharp ^0.35.3` / `nanoid ^3.3.18` / `lodash ^4.18.1` / `uuid ^11.1.1`
- `backend/Dockerfile` — สร้าง `appuser` (uid 10001) + `USER appuser`
- `Dockerfile.frontend.prod` / `Dockerfile.frontend` — `USER node` (uid 1000), `chown` `.next` เพราะ `next start` เขียน `.next/cache`
- `git rm` `.next/dev` ทั้งหมดออกจาก tracking

**ผลตรวจหลังแก้:** backend OSV = **0** · frontend `pnpm audit` = **No known vulnerabilities found**

**หมายเหตุประเมินผลกระทบ:** preview key ใน `.next/dev/prerender-manifest.json` ที่หลุดเป็น secret จริง แต่เทียบ hash แล้ว**ไม่ตรง**กับที่ production ใช้ (production `next build` ใหม่ใน Docker ทุกครั้ง) → ค่าที่หลุดเป็นของ dev build เก่า ใช้โจมตีไม่ได้

**commit:** `b02eb36` — fix(security): clear all dependency CVEs, run containers non-root, untrack .next

---

### 21. CRITICAL — `TMD_API_KEY` + `NEXTAUTH_SECRET` ยัง**ไม่ได้หมุน** (ต่อจาก #18)  <!-- (2026-08-19) -->

**ป้องกัน:** #18 (2026-08-11) บันทึกว่าทั้งสองค่าหลุดตอน repo เป็น public และเขียน checklist ให้หมุน — ตรวจวันนี้พบว่า **checklist ยังค้างทั้งสองข้อ** ค่าที่อยู่ใน git history ยังเป็นค่าที่ production ใช้อยู่จริง

**หลักฐาน (เทียบด้วย sha256 ไม่เปิดค่า):**
```
TMD_API_KEY       history=695993217ddf  ปัจจุบัน=695993217ddf  ❌
NEXTAUTH_SECRET   history=a12852a8c733  ปัจจุบัน=a12852a8c733  ❌
JWT_SECRET        history=107221278dab  ปัจจุบัน=5f4d57a3f387  ✅ หมุนแล้ว
```
commit `78bd7830` ที่มีค่าเต็มยังอยู่บน `origin/main`

**แก้ไข (ทำได้บางส่วน):**
- ✅ ลบ `.env.bak.20260519` ออกจาก disk
- ❌ **ยังไม่หมุน** — `TMD_API_KEY` ต้องขอ key ใหม่จากกรมอุตุฯ (external) · `NEXTAUTH_SECRET` เขียน `.env` ถูกบล็อกโดย permission ของ agent

**สถานะ: ยังเปิดอยู่** — ดูคำสั่งที่ต้องรันใน `notes/security-removed-archive.md` ท้ายไฟล์
