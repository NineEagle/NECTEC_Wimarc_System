# Notes — WiMaRC

โฟลเดอร์นี้เก็บ note ทุกอย่างที่เกี่ยวข้องกับ project แยกตามประเภท

---

## ไฟล์ในโฟลเดอร์นี้

### Note log — 4 ไฟล์หลักที่ต้อง append ทุกครั้งที่ทำงานเสร็จ (ดู CLAUDE.md)

| ไฟล์ | ประเภท | เนื้อหา |
|---|---|---|
| [DEPLOYMENT_NOTES.md](DEPLOYMENT_NOTES.md) | Feature / Config | ทุก feature ใหม่, UI change, config change, deployment บน production |
| [BUGS.md](BUGS.md) | Bug Fix | Bug ที่พบ, สาเหตุ, วิธีแก้, commit reference |
| [SECURITY.md](SECURITY.md) | Security | ช่องโหว่ที่พบ, patch, pending items, rollback |
| [IDEAS.md](IDEAS.md) | Idea / Future plan | idea และ architecture ที่ยังไม่ได้ทำ พร้อมสถานะ IDEA / IN PROGRESS / DONE |

### เอกสารอ้างอิง (reference — ไม่ใช่ log, แก้เมื่อระบบเปลี่ยนจริง)

| ไฟล์ | เนื้อหา |
|---|---|
| [API_ENDPOINTS.md](API_ENDPOINTS.md) | รายการ endpoint ทั้งหมดของ backend + ตัวอย่าง request/response (ส่งมอบข้อ 8.3.1.2 / 4.5.2) |
| [DATA_LOGIC.md](DATA_LOGIC.md) | ที่มาของข้อมูลแต่ละค่าและสูตรคำนวณ (VPD, ADC→ความชื้นดิน ฯลฯ) |
| [ICD_DATA_EXCHANGE.md](ICD_DATA_EXCHANGE.md) | Interface Control Document — การรับส่งข้อมูลระหว่างระบบ (external API, ingest จาก ESP) |
| [DOC_8.3.1.9_WEBAPP_DB.md](DOC_8.3.1.9_WEBAPP_DB.md) | เอกสารส่งมอบข้อ 8.3.1.9 / 4.5.9 — การรับส่งข้อมูลระหว่าง web application กับฐานข้อมูล |
| [FAILOVER.md](FAILOVER.md) | Runbook การทำ DB failover (primary/standby) |
| [WIMARC-External-API.postman_collection.json](WIMARC-External-API.postman_collection.json) | Postman collection สำหรับ external API (ใช้ API key `wmk_*`) |

### Archive / รายงานสแกน

| ไฟล์ | เนื้อหา |
|---|---|
| [security-removed-archive.md](security-removed-archive.md) | โค้ด/config ที่ถูกถอดออกด้วยเหตุผลด้านความปลอดภัย เก็บไว้อ้างอิง (ค่า secret ถูก redact แล้ว) |
| `zap/` | รายงาน OWASP ZAP (`zap_report_8.3.2.4*.md` / `.html`), `zap.yaml`, `openapi.json` snapshot |

> **หมายเหตุ (2026-08-11):** ก่อนหน้านี้ตารางนี้มีแค่ 3 ไฟล์ และตกหล่น `IDEAS.md` ทั้งที่ CLAUDE.md บังคับให้ note ลงไฟล์นั้นด้วย — อัปเดตให้ครบทุกไฟล์แล้ว
> เอกสารส่งมอบ TOR อีก 6 ไฟล์ (`DATA_DICTIONARY_8.3.2.7.md`, `ER_DIAGRAM_8.3.2.6.md`, `EVIDENCE_8.3.1.3.md`, `OWASP_TOP10_8.3.2.3.md`, `TEST_CASES_UAT_8.3.2.2.md`, `VULN_SCAN_8.3.2.4.md`) **ถูกลบออกจาก working tree** โดยยังไม่มี note อธิบายเหตุผล — ดูรายละเอียดและวิธีกู้คืนใน [IDEAS.md](IDEAS.md)

---

## วิธีเลือกไฟล์ที่จะ note

```
เพิ่ม feature / เปลี่ยน UI / เปลี่ยน config   →  DEPLOYMENT_NOTES.md
แก้ bug (อาจไม่ใช่ security)                   →  BUGS.md
ช่องโหว่ security / CVE / hardening             →  SECURITY.md
idea / future plan / ยังไม่ได้ทำ                →  IDEAS.md
```

ถ้างานหนึ่งครอบคลุมหลายประเภท ให้ note **ทุกไฟล์ที่เกี่ยวข้อง** (เช่น bug ที่มีผลด้าน security)
