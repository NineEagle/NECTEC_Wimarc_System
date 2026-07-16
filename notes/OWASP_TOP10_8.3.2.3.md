# OWASP Top 10 (2017) — การป้องกัน (ข้อ 8.3.2.3 / 4.6.3)

map ช่องโหว่ 10 อันดับ OWASP Top 10 2017 (อ้างอิง owasp.org) กับมาตรการป้องกันในระบบ WiMaRC
รายละเอียด patch เต็มดู `notes/SECURITY.md`

| # | OWASP 2017 | สถานะ | มาตรการป้องกันในระบบ |
|---|---|---|---|
| **1** | **Injection** (SQL/Command) | ✅ ป้องกัน | SQLAlchemy ORM + parameterized query (`text()` + bind params `:wid` ฯลฯ) ทุกจุด · **verify code:** f-string ใน SQL (`date_filter`) ฝังแค่ literal + placeholder ไม่มี user value concat — ค่าจริงส่งผ่าน `params` ทั้งหมด · input ตรวจด้วย Pydantic · regex validate station_id |
| **2** | **Broken Authentication** | ✅ ป้องกัน | JWT (HS256) หมดอายุ 24 ชม. · password bcrypt · login **constant-time verify** กัน timing oracle · rate limit login 5/min, register 3/min · idle-timeout 10 นาที (frontend) |
| **3** | **Sensitive Data Exposure** | ✅ ป้องกัน | HTTPS + **HSTS** (`max-age=63072000; preload`) · password เก็บเป็น bcrypt hash · `/health` public ไม่ leak internal (fix SECURITY #1) · ลบ secret ที่เคยหลุดใน git (fix #13 FIX-1) · `UserOut` ไม่คืน password |
| **4** | **XML External Entities (XXE)** | ✅ N/A | ระบบไม่รับ/parse XML — รับเฉพาะ JSON (FastAPI) → ไม่มี attack surface XXE |
| **5** | **Broken Access Control** | ✅ ป้องกัน | RBAC 3 ระดับ (Admin/User/Guest) บังคับฝั่ง server · JWT middleware ทุก request · `require_admin` / `require_not_guest` / `_can_read_station` per-endpoint · CORS จำกัด origin (fix #13 FIX-5) · ลบ unauth endpoints (fix #13 FIX-2/4) |
| **6** | **Security Misconfiguration** | ✅ ป้องกัน | Swagger/ReDoc/OpenAPI ปิดใน prod (fix #3) · ลบ server banner (Next.js X-Powered-By + uvicorn server header, fix #4) · security headers ครบ (X-Frame DENY, X-Content-Type nosniff, CSP, Referrer-Policy, Permissions-Policy) · DB port 5432 ปิดจาก public (fix #6) |
| **7** | **Cross-Site Scripting (XSS)** | ✅ ป้องกัน | React auto-escape ทุก output · **CSP** จำกัด script-src · `X-Content-Type-Options: nosniff` · **verify code:** `dangerouslySetInnerHTML` มีจุดเดียวที่ `chart.tsx` — inject แค่ CSS color variable คงที่ ไม่ผูก user input |
| **8** | **Insecure Deserialization** | ✅ ป้องกัน | ไม่ใช้ pickle/eval · รับเฉพาะ JSON ผ่าน Pydantic (validate type ก่อน deserialize) · JWT verify signature ก่อน decode |
| **9** | **Using Components with Known Vulnerabilities** | ⚠️ ต้องแก้ | `pnpm audit` พบ 28 vuln (10 high / 15 mod / 3 low) — ส่วนใหญ่จาก **`next@16.0.10`** (middleware bypass, DoS, SSRF). **แผนแก้:** อัป `next ≥16.2.6` (latest 16.2.9) → ปิด high ทั้งหมด · lodash 4.17.21 (จาก recharts) = latest แล้ว, `_.template` ไม่ได้ใช้ = low risk · เคยเจอ+กำจัด cryptominer malware (SECURITY #6/#9) |
| **10** | **Insufficient Logging & Monitoring** | ⚠️ บางส่วน | uvicorn access log + `docker compose logs` · rate-limit log · `miner_monitor.sh` ตรวจ malware ทุก 1 นาที · *(แนะนำเพิ่ม: централ log + alert)* |

## หลักฐานยืนยัน (แคปประกอบ)

**Security headers (ยืนยันข้อ 3, 6, 7):**
```bash
curl -sI https://wimarc.in.th/ | grep -iE "strict-transport|x-content|x-frame|referrer|permissions|content-security"
```
→ เห็น HSTS, X-Frame-Options, X-Content-Type-Options, CSP, Referrer-Policy, Permissions-Policy

**Broken Access Control (ยืนยันข้อ 5):**
```bash
# ไม่มี token → 401
curl -s -o /dev/null -w "%{http_code}\n" https://wimarc.in.th/backend/stations
# Guest token เรียก admin endpoint → 403
```

**Authentication rate limit (ยืนยันข้อ 2):**
```bash
# ยิง login ผิด 6 ครั้งติด → ครั้งที่ 6 ได้ 429
for i in $(seq 1 6); do curl -s -o /dev/null -w "%{http_code} " -X POST \
  https://wimarc.in.th/backend/auth/login -H "Content-Type: application/json" \
  -d '{"username":"x","password":"y"}'; done; echo
```

**Components with Known Vulnerabilities (ยืนยันข้อ 9):**
```bash
# สแกน dependency frontend
pnpm audit --prod
# สแกน dependency backend
pip-audit -r backend/requirements.txt
```
→ ผลปัจจุบัน: 28 vuln (10 high จาก next@16.0.10) — **แผนแก้: อัป next ≥16.2.6**

> สรุป: 7/10 ป้องกันครบ · #9 พบ high CVE (next เก่า) รอ upgrade · #10 logging งานต่อเนื่อง
