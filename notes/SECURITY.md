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
