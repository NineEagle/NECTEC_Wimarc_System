# บทที่ 03 — เตรียมเครื่อง

> ทำ 30–60 นาที

คุณต้องมี 6 อย่างนี้ในเครื่อง ถ้าจะทำงานบนเซิร์ฟเวอร์จริง (`/var/www/WiMaRC`) ทุกอย่าง
ติดตั้งไว้ให้แล้ว ให้ข้ามไปหัวข้อ "ตรวจว่าครบไหม" ได้เลย

| โปรแกรม | ใช้ทำอะไร | เวอร์ชันที่ระบบนี้ใช้ |
|---|---|---|
| **Git** | ดึงโค้ด บันทึกการแก้ไข ย้อนกลับเวลาพัง | เวอร์ชันไหนก็ได้ |
| **Node.js** | รันฝั่งหน้าเว็บ (Next.js) | 20 ขึ้นไป (image ใช้ `node:20-slim`) |
| **pnpm** | ตัวติดตั้งไลบรารีฝั่งหน้าเว็บ (ใช้แทน npm) | **9.12.3** — ล็อกไว้ใน Dockerfile |
| **Python** | รันฝั่ง backend (FastAPI) | 3.11 ขึ้นไป |
| **Docker + Compose** | รัน/สร้าง container ทั้ง 2 ตัว = วิธี deploy จริง | Docker 20 ขึ้นไป, Compose v2 |
| **VS Code** | โปรแกรมแก้โค้ด (จะใช้ตัวอื่นก็ได้) | — |

## ติดตั้งบน Ubuntu / Debian

รันทีละบรรทัด อย่า copy ทั้งก้อน

```bash
# 1) git + เครื่องมือพื้นฐาน
sudo apt update && sudo apt install -y git curl build-essential

# 2) Node.js 20 (จาก NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3) pnpm — ไม่ต้องลงเอง ใช้ corepack ที่มากับ Node
sudo corepack enable
corepack prepare pnpm@9.12.3 --activate

# 4) Python + pip
sudo apt install -y python3 python3-pip python3-venv

# 5) Docker (ตามคู่มือ official)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER    # แล้ว logout/login ใหม่ จะได้ไม่ต้องพิมพ์ sudo ทุกครั้ง

# 6) เครื่องมือเปิดดูฐานข้อมูล (ไม่บังคับ แต่มีแล้วสะดวก)
sudo apt install -y postgresql-client
```

บน macOS ใช้ Homebrew แทน: `brew install git node python@3.11` แล้วติดตั้ง Docker Desktop
จากเว็บ Docker ส่วน pnpm ใช้ `corepack` เหมือนกัน

## ตรวจว่าครบไหม

ทุกบรรทัดต้องขึ้นเลขเวอร์ชัน ไม่ใช่ `command not found`

```bash
git --version              # git version 2.x
node -v                    # v20 ขึ้นไป
pnpm -v                    # 9.12.3
python3 -V                 # Python 3.11 ขึ้นไป
docker -v                  # Docker version 2x.x
docker compose version     # v2.x ขึ้นไป
psql --version             # psql (PostgreSQL) 16.x
```

## สิ่งที่ต้องขอจากผู้ดูแลระบบ

ขอไม่ได้ = ทำงานไม่ได้ ให้ขอตั้งแต่วันแรก

- [ ] **สิทธิ์เข้า GitHub repo** — `NineEagle/NECTEC_Wimarc_System` (ตั้งเป็น remote ชื่อ `origin`)
- [ ] **SSH key เข้าเซิร์ฟเวอร์** — ใช้ทั้ง deploy และเปิดอุโมงค์เข้าฐานข้อมูลตอนพัฒนา
- [ ] **ไฟล์ `.env`** — มี 8 ค่า: `TMD_API_KEY`, `JWT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`,
      `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`,
      `NEXT_PUBLIC_GOOGLE_MAP_ID` — **ไฟล์นี้ไม่อยู่ใน git ต้องขอจากคนเดิมเท่านั้น**
- [ ] **บัญชี Admin ของเว็บ** — ไว้ล็อกอินทดสอบหน้าที่ต้องใช้สิทธิ์ผู้ดูแล
- [ ] **ผู้ใช้ฐานข้อมูล** — สำหรับเปิดดูตารางด้วย `psql`

## แต่ละ env ใช้ทำอะไร

| ชื่อ | ใช้ตอนไหน | ถ้าไม่มีจะเป็นอย่างไร |
|---|---|---|
| `JWT_SECRET` | backend ใช้เซ็น token ตอนล็อกอิน | **backend ไม่ยอมสตาร์ท** (ตั้งใจให้ fail ทันที ไม่ให้เผลอใช้ค่า default) |
| `NEXTAUTH_SECRET` | NextAuth ใช้เข้ารหัส session ของ Google login | ล็อกอินด้วย Google ไม่ได้ |
| `NEXTAUTH_URL` | บอก NextAuth ว่าเว็บอยู่โดเมนอะไร | Google เด้งกลับผิดที่หลังล็อกอิน |
| `GOOGLE_CLIENT_ID` / `SECRET` | ยืนยันกับ Google ว่าเป็นเว็บของเรา | ปุ่ม "เข้าสู่ระบบด้วย Google" ใช้ไม่ได้ |
| `TMD_API_KEY` | เรียกพยากรณ์อากาศจากกรมอุตุนิยมวิทยา | การ์ดพยากรณ์ตกไปใช้ Open-Meteo แทน (มี fallback อยู่แล้ว) |
| `NEXT_PUBLIC_*` | ค่าที่ถูกฝังลงหน้าเว็บตอน build | ฟีเจอร์ที่พึ่งค่านั้นไม่ทำงาน |

> **หมายเหตุ:** ชื่อที่ขึ้นต้น `NEXT_PUBLIC_` แปลว่าค่านั้นจะถูกฝังลงในไฟล์ที่ส่งถึงเบราว์เซอร์
> **ห้ามเอาความลับใส่ในตัวแปรที่ขึ้นต้นแบบนี้เด็ดขาด** เพราะผู้ใช้เปิดดูได้หมด

## 🔴 กฎเหล็กเรื่อง .env

`.env` มีรหัสลับจริงทั้งหมดของระบบ

- ห้าม commit ขึ้น git — ถูกกันไว้ใน `.gitignore` แล้ว อย่าไปแก้บรรทัดนั้น
- ห้ามส่งทางแชท ห้ามวางในเอกสาร ห้ามใส่ในภาพหน้าจอ
- ถ้าเผลอหลุดออกไป ต้องเปลี่ยนค่านั้นใหม่ทันที ไม่ใช่แค่ลบข้อความ

`backend/app/db.py` โหลด `.env` จาก 2 ที่ตามลำดับ: `backend/.env` ก่อน แล้วค่อย `.env`
ที่รากโปรเจกต์ บนเซิร์ฟเวอร์จริงใช้ตัวที่รากโปรเจกต์

## ดึงโค้ดมาลงเครื่อง

```bash
git clone git@github.com:NineEagle/NECTEC_Wimarc_System.git WiMaRC
cd WiMaRC
git log --oneline -5        # ดูว่ามีประวัติจริง = clone สำเร็จ
```

จากนั้นขอไฟล์ `.env` มาวางไว้ที่รากโปรเจกต์ (ระดับเดียวกับ `package.json`)
ถ้ายังไม่มี ให้ดูโครงจาก `.env.production.example` ซึ่งเป็นไฟล์ตัวอย่างที่ไม่มีค่าจริง
