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

#### 4c. Apache ServerTokens/ServerSignature — ⚠️ PENDING SUDO
- **ไฟล์ที่แก้:** `/etc/apache2/conf-available/security.conf`
- Backup at: `/tmp/security.conf.bak.20260519`
- New config at: `/tmp/security.conf.new`
- **รันคำสั่งนี้:**
  ```bash
  sudo cp /tmp/security.conf.new /etc/apache2/conf-available/security.conf
  sudo apache2ctl configtest && sudo systemctl reload apache2
  ```
- **Verify:** `curl -I https://wimarc.in.th/` → `Server: Apache` (no version)

---

### 5. LOW — Security headers missing — ⚠️ PENDING SUDO
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

- [ ] Apache ServerTokens Prod + ServerSignature Off — **รอ `sudo cp /tmp/security.conf.new /etc/apache2/conf-available/security.conf && sudo systemctl reload apache2`**
- [ ] Security headers (HSTS/CSP/X-Frame/etc.) — **รอ `sudo cp /tmp/wimarc-in-th.conf.new /etc/apache2/sites-available/wimarc-in-th.conf && sudo apache2ctl configtest && sudo systemctl reload apache2`**
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

**commit:** _(ยังไม่ commit)_
