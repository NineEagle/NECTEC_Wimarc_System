# Failover Runbook — WiMaRC DB Failover

## ข้อมูลเครื่อง
- Primary: jasmine 203.185.101.161:5432
- Replica: WiMarc-API 203.185.101.200:5432
- Replication slot: replica1

## Scenario A: jasmine ตายทั้งเครื่อง

### 1. Promote replica
(บน WiMarc-API)
```bash
sudo -u postgres pg_ctl promote -D /var/lib/postgresql/16/main
# ยืนยัน: sudo -u postgres psql -tAc "SELECT pg_is_in_recovery();" → ต้องได้ f
```

### 2. แก้ docker-compose.yml บน jasmine (ถ้ากลับมาได้)
ไฟล์: `/var/www/WiMaRC/docker-compose.yml` บรรทัด 35-36
เปลี่ยน: `host.docker.internal` → `203.185.101.200`
เพิ่ม: `?sslmode=require`

```yaml
DATABASE_URL: postgresql+psycopg2://wimarc_admin:wimarc%40dmin@203.185.101.200:5432/wimarc_db?sslmode=require
WIMARC_DB_URL: postgresql+psycopg2://wimarc_admin:wimarc%40dmin@203.185.101.200:5432/wimarc_db?sslmode=require
```

### 3. Restart backend
(บน jasmine)
```bash
cd /var/www/WiMaRC && docker compose up -d backend
```

## Scenario B: jasmine ยังอยู่แต่ต้องย้าย DB
ทำขั้นตอนเดียวกับ A แล้วเพิ่ม:

### 4. แก้ PHP legacy config
ไฟล์กลาง: **`/var/www/wimarc/dblink.php`** — ingestion ทุกไฟล์ (`InsertdataW32control_CAMV.php`,
`InsertdataW32control_CAMA.php`, `InsertdataW32_B.php`) `include "dblink.php"` จึงแก้ที่เดียวพอ

บรรทัด 3 ใน `dblink.php`:
```
เดิม:  host=localhost
ใหม่:  host=203.185.101.200
```
และเพิ่ม `sslmode=require` ในสตริง `pg_connect` (ข้าม public network ต้องเข้ารหัส):
```php
$conn = pg_connect("
  host=203.185.101.200
  port=5432
  dbname=wimarc_db
  sslmode=require
  ...
");
```

> ตรวจเพิ่ม: `dblink-backup.php` มี connection แยก (`mysqli_connect` localhost) — ถ้ายังใช้งานอยู่
> ต้องแก้ host ด้วย; ถ้าไม่ใช้แล้วควรลบ (มี password hardcoded)

## ยืนยัน failover สำเร็จ
```bash
# backend health (endpoint จริงคือ /backend/health — public, คืน {"status":"ok"})
curl https://www.wimarc.in.th/backend/health   # → ต้องได้ 200

# DB บน replica ต้องเป็น primary แล้ว (ไม่ recovery)
sudo -u postgres psql -h 203.185.101.200 -tAc "SELECT pg_is_in_recovery();"   # → ต้องได้ f
```

## หมายเหตุ
- daily backup dump อยู่ที่ `/var/backups/wimarc/` บน WiMarc-API
- หลัง primary กลับมา ต้อง setup replication ใหม่ตั้งแต่ต้น (pg_basebackup อีกครั้ง)
  โดยสลับบทบาท: jasmine กลายเป็น replica ของ .200 หรือทำ .200 → jasmine ใหม่แล้วแต่ตัดสินใจ
- promote แล้ว slot `replica1` บน primary เดิมใช้ไม่ได้อีก — ต้องสร้าง slot ใหม่ตอน re-setup
