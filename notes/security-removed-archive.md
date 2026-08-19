# WiMaRC — Security Removed / Archived Content

## Removed Files

### `.env.bak.20260519` — Leaked env backup (removed from git tracking 2026-06-07)

Full content of the file before untracking:

```
TMD_API_KEY=<redacted 2026-08-11 — ยังไม่หมุน ต้องหมุนด่วน (ดู note ท้ายไฟล์); ค่าจริงอยู่ใน .env บนเซิร์ฟเวอร์เท่านั้น>
JWT_SECRET=<redacted — rotated 2026-07-16 หลังพบว่าหลุดใน public repo; ค่าจริงอยู่ใน .env บนเซิร์ฟเวอร์เท่านั้น>
NEXTAUTH_SECRET=<redacted 2026-08-11 — ยังไม่หมุน ต้องหมุนด่วน (ดู note ท้ายไฟล์); ค่าจริงอยู่ใน .env บนเซิร์ฟเวอร์เท่านั้น>
NEXTAUTH_URL=http://localhost:3000
```

**Action taken:** `git rm --cached .env.bak.20260519` — file kept locally but removed from git tracking. `.env.bak*` added to `.gitignore`.

## Removed Code

### `_get_real_ip` X-Forwarded-For trust — removed 2026-06-07

Original function (replaced with `request.client.host` only):

```python
def _get_real_ip(request: Request) -> str:
    """Real client IP — trust Apache's X-Forwarded-For (backend only reachable via proxy)."""
    fwd = request.headers.get("X-Forwarded-For", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"
```

**Reason:** X-Forwarded-For is trivially spoofable by the client, allowing rate limit bypass.

### JWT middleware POST /readings whitelist — removed 2026-06-07

Original line in `_jwt_auth_middleware` (removed):

```python
or (request.method == "POST" and re.match(r"^/stations/[^/]+/readings$", path))
```

**Reason:** Allowed unauthenticated writes to sensor readings table.

### Hardcoded internal IP in `/health/detail` — moved to env var 2026-06-07

Original code:

```python
    # --- Wimarc-API server (.200) metrics ---
    try:
        with urllib.request.urlopen("http://203.185.101.200:8081/metrics", timeout=3) as r:
            api_data = json.loads(r.read().decode())
            result["server_api"] = "ok"
            result["api_cpu_percent"] = api_data.get("cpu_percent")
            result["api_mem_used_mb"] = api_data.get("mem_used_mb")
            result["api_mem_total_mb"] = api_data.get("mem_total_mb")
            result["api_mem_percent"] = api_data.get("mem_percent")
            result["api_disk_used_gb"] = api_data.get("disk_used_gb")
            result["api_disk_total_gb"] = api_data.get("disk_total_gb")
            result["api_disk_percent"] = api_data.get("disk_percent")
    except Exception:
        result["server_api"] = "error"
```

**Replaced with:** reads `WIMARC_API_METRICS_URL` env var; block is skipped entirely if env var is unset/empty.

## Removed Endpoints

_(none removed — all endpoints retained, access control added)_

---

## ⚠️ Redaction erratum — TMD_API_KEY / NEXTAUTH_SECRET  <!-- (2026-08-11) -->

SECURITY.md #16 (2026-07-16) บอกว่า redact secret ออกจากไฟล์นี้แล้ว — **จริงเฉพาะ `JWT_SECRET`**
`TMD_API_KEY` (บรรทัด 10) กับ `NEXTAUTH_SECRET` (บรรทัด 12) ยังเป็น **ค่าจริงแบบ plaintext ใน git-tracked file** เรื่อยมาจนถึงวันนี้ เพิ่ง redact 2026-08-11

**ยืนยันแล้วว่าเป็นค่า production จริง:** ทั้งสองค่าที่เคยอยู่ในไฟล์นี้ตรงกับค่าที่ container รันอยู่จริง ณ 2026-08-11 แบบ byte-identical
(`TMD_API_KEY` = ค่าเดียวกับที่ backend ใช้, หมดอายุ 2027-05-16 · `NEXTAUTH_SECRET` = ค่าเดียวกับที่ frontend ใช้)

**ต้องถือว่าหลุดแล้วทั้งคู่:** repo เป็น public ตั้งแต่ ~15 มิ.ย. 2569 ถึง 16 ก.ค. 2569 (~1 เดือน) และการ redact วันนี้ **ไม่ลบค่าออกจาก git history** — history ยังมีค่าเต็มอยู่

**ต้องทำ (งานของ operator — ยังไม่ได้ทำในรอบนี้):**
- [ ] ขอ `TMD_API_KEY` ใหม่จากกรมอุตุฯ → เขียนทับใน `.env` → `docker compose up -d --force-recreate backend` (ผลข้างเคียง: ไม่มี — key ใช้เรียก TMD ขาออกอย่างเดียว)
- [ ] หมุน `NEXTAUTH_SECRET` (`openssl rand -base64 32`) → เขียนทับใน `.env` → recreate frontend (ผลข้างเคียง: NextAuth session ของ Google OAuth ทุกคนถูก invalidate ต้อง login ใหม่)

---

## สถานะ ณ 2026-08-19 — checklist ด้านบนยัง **ค้างทั้งสองข้อ**

ยืนยันซ้ำด้วยการ hash เทียบค่าใน git history กับค่าที่ container ใช้จริง (ไม่เปิดค่าออกมา):

```
TMD_API_KEY       history=695993217ddf  ปัจจุบัน=695993217ddf  → ยังเป็นค่าเดิม
NEXTAUTH_SECRET   history=a12852a8c733  ปัจจุบัน=a12852a8c733  → ยังเป็นค่าเดิม
JWT_SECRET        history=107221278dab  ปัจจุบัน=5f4d57a3f387  → หมุนแล้ว (2026-07-16)
```

commit `78bd7830` ที่มีค่าเต็มยังอยู่บน `origin/main` — ค่าที่หลุดตอน repo เป็น public
(~15 มิ.ย. – 16 ก.ค. 2569) จึงยังเป็นค่าที่ production ใช้อยู่จนถึงวันนี้

**ทำไปแล้วรอบนี้:** ลบไฟล์ `.env.bak.20260519` ออกจาก disk (ค่าซ้ำกับที่อยู่ใน history อยู่แล้ว)

**ยังทำไม่ได้ — ต้อง operator ทำเอง:**
- `TMD_API_KEY` — ต้องขอ key ใหม่จากกรมอุตุฯ ไม่มีทางออกเองได้
- `NEXTAUTH_SECRET` — เขียนไฟล์ `.env` ถูกบล็อกโดย permission ของ agent

คำสั่งที่ต้องรัน (ดู DEPLOYMENT_NOTES.md #79 ประกอบ):
```bash
cd /var/www/WiMaRC
sed -i "s|^NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=$(openssl rand -base64 32)|" .env
# แก้ TMD_API_KEY=<key ใหม่จากกรมอุตุฯ> ในไฟล์ .env ด้วย
docker compose up -d --force-recreate frontend backend
```
**ผลข้างเคียง:** session Google OAuth ของทุกคนถูก invalidate ต้อง login ใหม่
