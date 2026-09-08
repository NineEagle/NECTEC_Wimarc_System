# บทที่ 04 — ทัวร์โฟลเดอร์

> อ่าน 15 นาที

เปิด `/var/www/WiMaRC` ครั้งแรกจะเห็นโฟลเดอร์เยอะจนตกใจ แต่จริง ๆ ที่ต้องรู้จักมีแค่ 8 โฟลเดอร์
ที่เหลือเป็นของที่เครื่องมือสร้างให้เอง

## โครงสร้างที่ต้องรู้จัก

```
/var/www/WiMaRC/
├── app/                  ← หน้าเว็บ: 1 โฟลเดอร์ = 1 URL
│   ├── page.tsx              หน้าล็อกอิน (URL "/")
│   ├── layout.tsx            กรอบครอบทุกหน้า (ฟอนต์ + Provider ทั้งหมด)
│   ├── globals.css           สีและขนาดตัวอักษรทั้งเว็บ
│   ├── dashboard/page.tsx    URL "/dashboard"  — สภาวะแวดล้อมสด
│   ├── historical/page.tsx   URL "/historical" — ข้อมูลย้อนหลัง
│   ├── daily/  download/  activities/  map/  compare/  calendar/
│   ├── overview/  config/  payments/  maintenance/
│   ├── register/  request-api/  portal/
│   ├── admin/                หน้าเฉพาะผู้ดูแล
│   │   ├── users/page.tsx        จัดการผู้ใช้
│   │   ├── api-keys/page.tsx     จัดการ API key
│   │   ├── faults/page.tsx       บันทึกอุปกรณ์เสีย
│   │   ├── system-status/page.tsx  สถานะระบบ
│   │   └── add-station/  edit-station/
│   └── api/auth/[...nextauth]/route.ts   ← Google login (NextAuth) เท่านั้น
│
├── components/           ← ชิ้นส่วนหน้าจอที่ใช้ซ้ำได้
│   ├── ui/                   ปุ่ม การ์ด ตาราง ฯลฯ (shadcn/ui — แทบไม่ต้องแก้)
│   ├── layout/               AppShell, AppSidebar, AppHeader ← เมนูอยู่ตรงนี้
│   ├── charts/               กราฟทั้งหมด (ใช้ Recharts)
│   ├── maps/                 แผนที่ Leaflet
│   ├── dashboard/  overview/  config/  activities/  admin/  payments/
│
├── services/             ← ทุกการเรียก API อยู่ที่นี่ที่เดียว
│   ├── apiClient.ts          แกนกลาง: แนบ token, จัดการ 401, โยน ApiError
│   ├── apiMappers.ts         แปลง snake_case จาก backend → camelCase ของหน้าเว็บ
│   ├── sensorService.ts      ค่าเซนเซอร์สด / ย้อนหลัง / พยากรณ์
│   ├── stationsService.ts    รายชื่อสถานี
│   ├── userService.ts  faultService.ts  activityService.ts
│   ├── apiKeyService.ts  configService.ts  portalService.ts
│   ├── exportService.ts      สร้างไฟล์ CSV
│   └── systemConfigCache.ts  cache ค่าตั้งค่าระบบ 5 นาที (ตัวนี้ทำงานจริง)
│
├── contexts/             ← สถานะที่ทุกหน้าใช้ร่วมกัน
│   ├── AuthContext.tsx       ใครล็อกอินอยู่ + เตะออกเมื่อไม่ขยับ 10 นาที
│   └── StationContext.tsx    สถานีที่เลือก + รายชื่อสถานีที่มีสิทธิ์
│
├── types/index.ts        ← หน้าตาข้อมูลทุกชนิดในระบบ (TypeScript interface)
├── utils/
│   ├── permissions.ts        ตรรกะสิทธิ์ฝั่งหน้าเว็บ
│   ├── dateUtils.ts          จัดรูปแบบวันที่ไทย
│   └── chartUtils.ts         ตัวช่วยกราฟ
├── hooks/                ← ตัวช่วย React (use-mobile, use-toast)
├── lib/
│   ├── authOptions.ts        ตั้งค่า NextAuth (Google)
│   └── utils.ts              ฟังก์ชัน cn() รวม class ของ Tailwind
│
├── backend/app/          ← ฝั่งเซิร์ฟเวอร์ทั้งหมด (Python)
│   ├── main.py               3,113 บรรทัด · endpoint ทั้ง 64 เส้นทางอยู่ในนี้
│   ├── models.py             ตารางในฐานข้อมูล (13 ตาราง)
│   ├── schemas.py            หน้าตา JSON เข้า-ออก + การตรวจค่า
│   ├── db.py                 การต่อฐานข้อมูล 2 ตัว
│   ├── email_service.py      ส่งอีเมล OTP
│   ├── seed.py               ข้อมูลตั้งต้น 30 สวน (ใส่ครั้งแรกครั้งเดียว)
│   ├── requirements.txt      ไลบรารี Python ทั้งหมดพร้อมเวอร์ชัน
│   └── Dockerfile            แม่พิมพ์ container ของ backend
│
├── notes/                ← บันทึกงานทั้งหมด อ่านก่อนเริ่มทุกครั้ง
├── docker-compose.yml    ← นิยาม container 2 ตัวและค่า env ของแต่ละตัว
├── Dockerfile.frontend.prod  ← แม่พิมพ์ container หน้าเว็บ (ที่ใช้จริง)
├── next.config.mjs       ← การส่งต่อ /backend/* และ /media/*
├── package.json          ← รายชื่อไลบรารีฝั่งหน้าเว็บ + คำสั่ง dev/build/start
├── CLAUDE.md             ← กฎการทำงานในโปรเจกต์นี้ (สำคัญ อ่านบทที่ 15)
└── .env                  ← รหัสลับ (ไม่อยู่ใน git)
```

## อยากแก้อะไร ไปที่ไหน

| อยากทำ | ไปที่ไฟล์ |
|---|---|
| เปลี่ยนข้อความ / ปุ่ม / สี บนหน้าใดหน้าหนึ่ง | `app/<ชื่อหน้า>/page.tsx` |
| เพิ่ม / ลบ / สลับลำดับเมนูซ้าย | `components/layout/AppSidebar.tsx` → ตัวแปร `navItems` |
| เพิ่มหน้าใหม่ | สร้าง `app/<ชื่อ>/page.tsx` (บทที่ 10) |
| เปลี่ยนขนาดตัวอักษรทั้งเว็บ | `app/globals.css` → `html { font-size: 22px }` |
| เปลี่ยนสีหลักของระบบ | `app/globals.css` → ตัวแปร `--primary`, `--background` ฯลฯ |
| แก้วิธีเรียก API / เพิ่มฟังก์ชันดึงข้อมูล | `services/*.ts` |
| เพิ่ม endpoint ใหม่ / แก้ตรรกะฝั่งเซิร์ฟเวอร์ | `backend/app/main.py` |
| เพิ่มคอลัมน์ในฐานข้อมูล | `backend/app/models.py` + เพิ่ม ALTER TABLE (บทที่ 09) |
| แก้ว่าใครเห็นหน้าไหนได้ | `utils/permissions.ts` (หน้าเว็บ) + `main.py` (ของจริง) |
| แก้ค่าที่คำนวณ เช่น VPD หรือความชื้นดิน | `backend/app/main.py` → `_calc_vpd()`, `_adc_to_moisture()` |
| เปลี่ยนโดเมน / SSL / เส้นทางระดับเซิร์ฟเวอร์ | Apache: `/etc/apache2/sites-available/wimarc-in-th.conf` |
| เพิ่มไลบรารีใหม่ฝั่งหน้าเว็บ | `pnpm add <ชื่อ>` แล้ว commit ทั้ง `package.json` และ `pnpm-lock.yaml` |
| เพิ่มไลบรารีใหม่ฝั่ง backend | `backend/requirements.txt` แล้ว rebuild image |

## โฟลเดอร์ที่ไม่ต้องสนใจ

| ชื่อ | คืออะไร |
|---|---|
| `node_modules/` | ไลบรารีที่ pnpm โหลดมา — ลบทิ้งได้ แล้ว `pnpm install` ใหม่ |
| `.next/` | ผลลัพธ์การ build ของ Next.js — สร้างใหม่ได้เสมอ |
| `data/mock*.ts` | ข้อมูลปลอมสมัยยังไม่มี backend ตอนนี้แทบไม่ได้ใช้แล้ว |
| `newpage/` | ไฟล์ทดลองเก่า ไม่ได้ต่อกับระบบ |
| `*.bak.*` | ไฟล์สำรองที่คนก่อนหน้าเก็บไว้ (เช่น `main.py.bak.20260519`) |
| `tsconfig.tsbuildinfo` | แคชของ TypeScript |

## หน้าเว็บทั้งหมดที่มีตอนนี้

| URL | ชื่อบนเมนู | ใครเข้าได้ |
|---|---|---|
| `/` | หน้าล็อกอิน | ทุกคน |
| `/register` | สมัครสมาชิก (รออนุมัติ) | ทุกคน |
| `/request-api` | ขอ API key | ทุกคน |
| `/portal` | พอร์ทัลผู้ใช้ภายนอก (ยืนยันด้วย OTP อีเมล) | ทุกคน |
| `/dashboard` | สภาวะแวดล้อม | ทุกบทบาท (Guest เข้าได้หน้านี้หน้าเดียว) |
| `/historical` | ข้อมูลย้อนหลัง | Admin, User |
| `/daily` | ค่าเฉลี่ยรายวัน | Admin, User |
| `/download` | ดาวน์โหลด | Admin, User |
| `/activities` | กิจกรรมแปลง | Admin, User |
| `/map` | แผนที่ | Admin, User |
| `/compare` | เปรียบเทียบสถานี | Admin, User |
| `/payments` | จัดการซิม | Admin, User |
| `/overview` | ภาพรวมสถานี | Admin |
| `/config` | ตั้งค่าระบบ | Admin |
| `/admin/system-status` | สถานะระบบ | Admin |
| `/admin/users` | จัดการผู้ใช้ | Admin |
| `/admin/api-keys` | API Keys | Admin |
| `/admin/faults` | บันทึกอุปกรณ์เสีย | Admin |
