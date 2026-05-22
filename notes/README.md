# Notes — WiMaRC

โฟลเดอร์นี้เก็บ note ทุกอย่างที่เกี่ยวข้องกับ project แยกตามประเภท

---

## ไฟล์ในโฟลเดอร์นี้

| ไฟล์ | ประเภท | เนื้อหา |
|---|---|---|
| [DEPLOYMENT_NOTES.md](DEPLOYMENT_NOTES.md) | Feature / Config | ทุก feature ใหม่, UI change, config change, deployment บน production |
| [BUGS.md](BUGS.md) | Bug Fix | Bug ที่พบ, สาเหตุ, วิธีแก้, commit reference |
| [SECURITY.md](SECURITY.md) | Security | ช่องโหว่ที่พบ, patch, pending items, rollback |

---

## วิธีเลือกไฟล์ที่จะ note

```
เพิ่ม feature / เปลี่ยน UI / เปลี่ยน config   →  DEPLOYMENT_NOTES.md
แก้ bug (อาจไม่ใช่ security)                   →  BUGS.md
ช่องโหว่ security / CVE / hardening             →  SECURITY.md
```

ถ้างานหนึ่งครอบคลุมหลายประเภท ให้ note **ทั้งสองไฟล์** (เช่น bug ที่มีผลด้าน security)
