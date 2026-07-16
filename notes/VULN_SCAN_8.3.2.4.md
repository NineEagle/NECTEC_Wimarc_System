# Vulnerability Scan Report (ข้อ 8.3.2.4 / 4.6.4)

**Tool:** OWASP ZAP (zaproxy/zap-stable) — Baseline scan (passive: spider + passive rules, ไม่ active attack)
**Target:** https://wimarc.in.th/
**วันที่:** 2026-06-23
**Report ไฟล์เต็ม:** `notes/zap/zap_report_8.3.2.4.html` (เปิดในเบราว์เซอร์), `notes/zap/zap_report_8.3.2.4.md`

## สรุปผล

| ระดับ | จำนวน |
|---|---|
| 🔴 High | **0** |
| 🟠 Medium | **0** |
| 🟡 Low / Warn | 5 |
| ✅ Pass (ผ่าน) | 62 |
| **FAIL** | **0** |

> **ไม่พบช่องโหว่ระดับ High หรือ Medium** — ตรงตามเงื่อนไขข้อ 4.6.4 (แก้ High ให้เสร็จ; Medium ไม่มี)
> 62 rules ผ่าน รวม: SQL/Command injection markers, CSRF, Private IP disclosure, App Error disclosure, Serialization, XSS markers

## รายการ Low/Warn ที่พบ (ไม่ใช่ High/Medium)

| ID | รายการ | จำนวน | ระดับ | การจัดการ |
|---|---|---|---|---|
| 10055 | CSP: Failure to Define Directive with No Fallback | 12 | Low | CSP มีแล้วแต่ขาด fallback บาง directive (เช่น `form-action`, `frame-src`) — เพิ่มเติมได้ |
| 90004 | Cross-Origin-Resource-Policy header missing | 5 | Low/Info | เฉพาะไฟล์ font `.woff2` (static) — ความเสี่ยงต่ำมาก |
| 10049 | Storable and Cacheable Content | 6 | Info | static assets (font) cache ได้ปกติ — ไม่ใช่ช่องโหว่ |
| 10015 | Re-examine Cache-control Directives | 2 | Low | หน้า `/` และ `/register` — ปรับ cache-control ได้ |
| 10109 | Modern Web Application | 2 | Info | ZAP แค่ระบุว่าเป็น SPA (จาก 404 robots/sitemap) — ไม่ใช่ช่องโหว่ |

## แผนจัดการ (remediation)

ทั้งหมดเป็น **Low/Info** — ไม่บังคับแก้ตามเงื่อนไข (เงื่อนไขให้แก้แค่ High; Medium ทำให้เสร็จ) แต่ปรับเพิ่มได้:

1. **10055 CSP fallback** — เพิ่ม `form-action 'self'; base-uri 'self'; frame-src 'none'` ใน CSP ที่ Apache (`wimarc-in-th.conf`)
2. **90004 CORP** — เพิ่ม `Cross-Origin-Resource-Policy: same-origin` สำหรับ static (optional, เป็น defense-in-depth)
3. **10015 cache-control** — เพิ่ม `Cache-Control: no-store` ที่หน้า login/register (กัน sensitive page cache)

> หมายเหตุ: ใช้ **baseline (passive) scan** เพื่อความปลอดภัยกับ production — ไม่ยิง active attack ที่อาจสร้าง/ลบข้อมูล
> ช่องโหว่ระดับ High/Medium ที่เคยพบและแก้แล้ว (cryptominer, leaked secrets, unauth endpoints, ฯลฯ) ดู `notes/SECURITY.md`

## คำสั่งที่ใช้ (reproduce)

```bash
docker pull zaproxy/zap-stable
docker run --rm -v "$(pwd)/notes/zap:/zap/wrk:rw" zaproxy/zap-stable \
  zap-baseline.py -t https://wimarc.in.th/ \
  -r zap_report_8.3.2.4.html -w zap_report_8.3.2.4.md
```
