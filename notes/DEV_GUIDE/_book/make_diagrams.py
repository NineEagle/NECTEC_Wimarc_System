#!/usr/bin/env python3
"""วาดรูปประกอบทั้ง 9 รูปของเล่ม → _book/diagrams/*.svg

    python3 make_diagrams.py

ทุกรูปกว้าง 620 px = 16.4 ซม. เมื่อวางในหน้า A4 ที่ขอบ 2.5/2.0 ซม. (เนื้อที่ 16.5 ซม.)
เนื้อหาในรูปต้องตรงกับบทที่รูปนั้นอยู่ — แก้บทแล้วอย่าลืมกลับมาแก้รูป
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from svgkit import SVG, TONES, INK, MUTED, RULE, PAPER  # noqa: E402

W = 620
OUT = Path(__file__).parent / "diagrams"


def steps(s, rows, x=50, y0=46, w=560, h=46, gap=8, rail=True):
    """แถวลำดับขั้น: วงกลมเลข + ชื่อไฟล์ (monospace) + คำอธิบาย"""
    ys = [y0 + i * (h + gap) for i in range(len(rows))]
    if rail:
        s.line(x - 22, ys[0] + h / 2, x - 22, ys[-1] + h / 2, RULE, 2)
    for i, (r, y) in enumerate(zip(rows, ys), 1):
        stroke, fill = TONES[r.get("tone", "neutral")]
        s.rect(x, y, w, h, fill=fill, stroke=stroke, rx=7, sw=1.2)
        s.badge(x - 22, y + h / 2, str(r.get("n", i)), r.get("tone", "neutral"), r=12)
        s.code(x + 14, y + 19, r["file"], size=11.5, fill=stroke)
        s.text(x + 14, y + 35, r["desc"], size=11,
               fill=r.get("desc_color", MUTED),
               weight="600" if r.get("desc_color") else None)
        if r.get("note"):
            s.text(x + w - 14, y + 27, r["note"], size=10.5,
                   fill=TONES["danger"][0], anchor="end", weight="600")
    return ys[-1] + h


# ── 1. ภาพรวมระบบ (บท 02) ───────────────────────────────────────────────────
def system_overview():
    s = SVG(W, 340)
    s.panel(10, 28, 600, 118, "ฝั่งเว็บ — งานของคุณอยู่ตรงนี้", "web")
    s.rect(324, 40, 284, 94, fill="none", stroke=TONES["web"][0], rx=8, sw=1.1, dash="5 4")
    s.text(466, 129, "อยู่ใน Docker — แก้โค้ดแล้วต้อง build ใหม่", size=10,
           fill=TONES["web"][0], anchor="middle")

    bx, bw = [21, 177, 333, 489], 110
    s.box(bx[0], 52, bw, 62, "เบราว์เซอร์", "ผู้ใช้ 30 สวน", "neutral")
    s.box(bx[1], 52, bw, 62, "Apache", ":80 · :443", "neutral", mono_sub=True)
    s.box(bx[2], 52, bw, 62, "Next.js", ":3000 หน้าเว็บ", "web")
    s.box(bx[3], 52, bw, 62, "FastAPI", ":8000 API", "api")
    for a, label in ((0, "HTTPS"), (1, "proxy"), (2, "rewrite")):
        s.arrow(bx[a] + bw, 83, bx[a + 1], 83, MUTED, label=label, label_dy=-8, label_size=10)

    s.panel(10, 190, 316, 104, "ฝั่งอุปกรณ์ — ไม่ต้องแตะ", "device")
    s.box(30, 210, 124, 58, "ESP32 ในสวน", "60 บอร์ด", "device")
    s.box(182, 210, 124, 58, "PHP เดิม", "Insertdata*.php", "device", mono_sub=True)
    s.arrow(154, 239, 182, 239, MUTED, label="HTTP", label_dy=-8, label_size=10)

    s.box(396, 206, 214, 66, "PostgreSQL 16", "เก็บข้อมูลทั้งหมด · ไม่ได้อยู่ใน Docker", "db")
    s.arrow(306, 239, 396, 239, TONES["device"][0], label="INSERT", label_dy=-8)
    s.arrow(544, 114, 544, 206, TONES["api"][0], label="SQL", label_dx=8, label_dy=0)

    s.text(310, 320, "สองเส้นทางนี้แยกกันสิ้นเชิง มาเจอกันที่ฐานข้อมูลเท่านั้น",
           size=11.5, fill=MUTED, anchor="middle")
    return s.save(OUT / "system-overview.svg")

# ── 2. 3 ช่องทางเข้าถึงข้อมูล (บท 02) ───────────────────────────────────────
def three_channels():
    s = SVG(W, 268)
    lanes = [
        ("A", "device", "ESP32 ในสวน", ["Apache + PHP เดิม"], "ไม่มี — ตาม design ของอุปกรณ์สนาม"),
        ("B", "web", "เบราว์เซอร์", ["Next.js :3000", "FastAPI :8000"],
         "JWT — Authorization: Bearer"),
        ("C", "api", "ระบบภายนอก", ["FastAPI :8000"], "API key — X-Api-Key: wmk_…"),
    ]
    s.text(10, 22, "ใครเข้ามา", size=11, fill=MUTED, weight="600")
    s.text(150, 22, "ผ่านอะไร", size=11, fill=MUTED, weight="600")
    y = 34
    for tag, tone, who, hops, auth in lanes:
        stroke, fill = TONES[tone]
        s.rect(10, y, 600, 62, fill=fill, stroke=stroke, rx=8, sw=1.2)
        s.badge(34, y + 31, tag, tone, r=14)
        s.text(56, y + 26, who, size=12, weight="600")
        x = 150
        for i, hop in enumerate(hops):
            s.rect(x, y + 12, 140, 26, fill=PAPER, stroke=stroke, rx=5, sw=1)
            s.text(x + 70, y + 29, hop, size=11, anchor="middle")
            if i < len(hops) - 1:
                s.arrow(x + 140, y + 25, x + 156, y + 25, stroke, sw=1.3)
            x += 156
        s.arrow(x, y + 25, x + 20, y + 25, stroke, sw=1.3)
        s.rect(x + 26, y + 12, 74, 26, fill=TONES["db"][1], stroke=TONES["db"][0], rx=5, sw=1)
        s.text(x + 63, y + 29, "ฐานข้อมูล", size=11, anchor="middle", fill=TONES["db"][0])
        s.text(56, y + 50, "ยืนยันตัวตน:", size=10.5, fill=MUTED)
        s.code(126, y + 50, auth, size=10.5, fill=stroke)
        y += 72
    s.text(310, 254, "คู่มือเล่มนี้พูดถึงช่องทาง B เป็นหลัก", size=11, fill=MUTED, anchor="middle")
    return s.save(OUT / "three-channels.svg")

# ── 3. แผนที่โฟลเดอร์ (บท 04) ───────────────────────────────────────────────
def folder_map():
    s = SVG(W, 352)
    cols = [
        (10, "web", "หน้าเว็บ (Next.js)", [
            ("app/", "1 โฟลเดอร์ = 1 URL"),
            ("components/", "ชิ้นส่วนที่ใช้ซ้ำ + เมนูซ้าย"),
            ("contexts/", "สถานะร่วมทุกหน้า"),
            ("app/globals.css", "สีและขนาดตัวอักษรทั้งเว็บ"),
        ]),
        (215, "neutral", "ตัวเชื่อม 2 ฝั่ง", [
            ("services/", "เรียก API ทุกครั้งผ่านที่นี่"),
            ("types/index.ts", "หน้าตาข้อมูลฝั่งหน้าเว็บ"),
            ("utils/permissions.ts", "ซ่อนปุ่มตามสิทธิ์"),
            ("next.config.mjs", "rewrite ไป backend"),
        ]),
        (420, "api", "เซิร์ฟเวอร์ (FastAPI)", [
            ("backend/app/main.py", "endpoint ทั้งหมด + การคำนวณ"),
            ("backend/app/schemas.py", "สัญญาข้อมูลขาเข้า/ออก"),
            ("backend/app/models.py", "ตารางในฐานข้อมูล"),
            ("backend/app/db.py", "การต่อฐานข้อมูล 2 ทาง"),
        ]),
    ]
    for x, tone, head, items in cols:
        stroke, fill = TONES[tone]
        s.panel(x, 30, 190, 242, head, tone)
        y = 48
        for name, hint in items:
            s.rect(x + 10, y, 170, 48, fill=PAPER, stroke=stroke, rx=6, sw=1)
            s.code(x + 19, y + 19, name, size=10.5, fill=stroke)
            s.text(x + 19, y + 36, hint, size=10, fill=MUTED)
            y += 56
    s.rect(10, 288, 600, 52, fill=TONES["danger"][1], stroke=TONES["danger"][0], rx=7, sw=1.2)
    s.text(24, 309, "ไม่ต้องสนใจ:", size=11, weight="600", fill=TONES["danger"][0])
    x = 118
    for name in ("node_modules/", ".next/", "public/", "__pycache__/"):
        x += s.chip(x, 298, name, "danger", h=22) + 8
    s.text(24, 330, "เครื่องมือสร้างให้เอง ห้าม commit และไม่ต้องแก้", size=10, fill=MUTED)
    return s.save(OUT / "folder-map.svg")

# ── 4. เส้นทางข้อมูล 9 สถานี (บท 07) ────────────────────────────────────────
def data_path():
    s = SVG(W, 566)
    x = 46
    for label, tone in (("ฝั่งหน้าเว็บ", "web"), ("ตัวส่งต่อ", "neutral"),
                        ("ฝั่งเซิร์ฟเวอร์", "api")):
        x += s.chip(x, 12, label, tone, h=22, mono=False) + 12
    rows = [
        dict(file="app/dashboard/page.tsx", desc="หน้าเว็บสั่งดึงข้อมูล — useEffect ยิงซ้ำทุก 60 วินาที", tone="web"),
        dict(file="services/sensorService.ts", desc="แปลงคำสั่งของหน้าเว็บให้เป็น API call", tone="web"),
        dict(file="services/apiClient.ts", desc="แนบ Authorization: Bearer และจัดการ 401 (เตะออกจากระบบ)", tone="web"),
        dict(file="next.config.mjs", desc="rewrite /backend/* ไปที่ FastAPI :8000", tone="neutral"),
        dict(file="backend/app/main.py", desc="แปลงรหัสสถานีแล้ว SELECT จาก sensor_1min ด้วย :wid", tone="api"),
        dict(file="_calc_vpd() · _adc_to_moisture()", desc="คำนวณค่าที่ไม่ได้เก็บไว้ — ค่าผิดต้องคืน None ไม่ใช่ 0", tone="api"),
        dict(file="backend/app/schemas.py", desc="Pydantic ตรวจและตัดฟิลด์ที่ไม่ได้ประกาศทิ้ง", tone="api", note="ลืมประกาศ = ค่าหาย"),
        dict(file="services/apiMappers.ts", desc="snake_case เป็น camelCase และแปลงข้อความวันที่เป็น Date", tone="web"),
        dict(file="app/dashboard/page.tsx", desc="วาดตัวเลขลงการ์ดบนหน้าจอ", tone="web"),
    ]
    bottom = steps(s, rows, y0=46)
    s.text(310, bottom + 26, "ค่าไม่ขึ้นบนจอ = ขาดที่ขั้นใดขั้นหนึ่งใน 9 ขั้นนี้ ไล่จากขั้น 1 ลงไปทีละขั้น",
           size=11, fill=MUTED, anchor="middle")
    return s.save(OUT / "data-path.svg")


# ── 5. RBAC 3 ชั้น (บท 08) ──────────────────────────────────────────────────
def rbac():
    s = SVG(W, 424)
    roles = [("Admin", "ทุกสถานี ทุกหน้า", "ok"),
             ("User", "เฉพาะสถานีที่ได้รับสิทธิ์", "web"),
             ("Guest", "อ่านอย่างเดียว", "neutral")]
    x = 10
    for name, sub, tone in roles:
        s.box(x, 18, 190, 52, name, sub, tone)
        x += 205
    s.line(10, 88, 610, 88, RULE, 1)

    s.box(210, 102, 200, 42, "คำขอเขียนข้อมูล", "POST /faults", "neutral", mono_sub=True)
    gates = [
        ("ชั้นที่ 1 — ระดับ endpoint", "Depends(require_admin)"),
        ("ชั้นที่ 2 — ระดับรายการข้อมูล", "_require_write_station(user, station_id)"),
        ("ชั้นที่ 3 — ที่มาของข้อมูล", "created_by = current_user.id"),
    ]
    y = 162
    s.arrow(310, 144, 310, y, MUTED)
    for i, (title, code) in enumerate(gates):
        s.rect(150, y, 320, 52, fill=TONES["api"][1], stroke=TONES["api"][0], rx=7, sw=1.3)
        s.text(164, y + 22, title, size=12, weight="600")
        s.code(164, y + 39, code, size=10.5, fill=TONES["api"][0])
        if i < 2:
            s.arrow(470, y + 26, 556, y + 26, TONES["danger"][0], sw=1.3)
            s.chip(560, y + 15, "403", "danger", h=22)
            s.arrow(310, y + 52, 310, y + 66, MUTED)
        y += 66
    s.text(140, 318, "ห้ามรับ id ผู้ใช้จาก payload", size=10.5,
           fill=TONES["danger"][0], anchor="end", weight="600")
    s.line(146, 314, 150, 314, TONES["danger"][0], 1.2)
    s.arrow(146, 314, 150, 314, TONES["danger"][0], sw=1.2)
    s.arrow(310, 342, 310, 358, MUTED)
    s.box(210, 358, 200, 42, "บันทึกลงฐานข้อมูล", None, "ok")
    s.text(10, 416, "ฝั่งหน้าเว็บ (utils/permissions.ts) เป็นแค่การซ่อนปุ่ม ของจริงอยู่ฝั่ง backend เสมอ",
           size=10.5, fill=MUTED)
    return s.save(OUT / "rbac.svg")


# ── 6. ฐานข้อมูล 2 ทาง + การแปลงรหัสสถานี (บท 09) ───────────────────────────
def two_databases():
    s = SVG(W, 502)
    s.box(210, 18, 200, 46, "FastAPI", "backend/app/db.py", "api", mono_sub=True)
    s.line(310, 64, 310, 80, RULE, 1.6)
    s.elbow(310, 80, 175, 100, TONES["api"][0], first="h")
    s.elbow(310, 80, 445, 100, TONES["db"][0], first="h")
    s.box(60, 100, 230, 54, "get_db()", "DATABASE_URL · อ่าน + เขียน", "api", mono_sub=True)
    s.box(330, 100, 230, 54, "get_wimarc_db()", "WIMARC_DB_URL · อ่านอย่างเดียว", "db", mono_sub=True)

    s.panel(40, 194, 540, 106, "PostgreSQL 16 — ฐานข้อมูลเดียว แต่ต่อคนละทาง", "db")
    s.arrow(175, 154, 175, 218, TONES["api"][0])
    s.arrow(445, 154, 445, 218, TONES["db"][0])
    s.rect(60, 218, 230, 62, fill=PAPER, stroke=TONES["api"][0], rx=7, sw=1.2)
    s.text(175, 238, "ตารางของแอป (13 ตาราง)", size=11.5, weight="600", anchor="middle")
    s.code(175, 256, "users · stations · activities", size=10, fill=MUTED, anchor="middle")
    s.code(175, 270, "api_keys · station_faults …", size=10, fill=MUTED, anchor="middle")
    s.rect(330, 218, 230, 62, fill=PAPER, stroke=TONES["db"][0], rx=7, sw=1.2)
    s.text(445, 238, "ตารางเซนเซอร์เดิม", size=11.5, weight="600", anchor="middle")
    s.code(445, 256, "CAM_main · CAM_client", size=10, fill=MUTED, anchor="middle")
    s.code(445, 270, "sensor · sensor_1min · updatedata", size=10, fill=MUTED, anchor="middle")

    s.box(370, 322, 210, 44, "PHP เดิม", "เจ้าของข้อมูลกลุ่มขวา", "device")
    s.arrow(475, 322, 475, 300, TONES["device"][0])
    s.text(486, 314, "เขียนได้ทางเดียว", size=10, fill=TONES["device"][0])
    s.rect(10, 322, 340, 44, fill=TONES["danger"][1], stroke=TONES["danger"][0], rx=7, sw=1.2)
    s.text(24, 340, "ห้ามเขียนทับตารางฝั่งขวาเด็ดขาด", size=11,
           fill=TONES["danger"][0], weight="600")
    s.text(24, 357, "ข้อมูลจริงจากสวนจะเสียหายและกู้ไม่ได้", size=10, fill=MUTED)

    s.line(10, 396, 610, 396, RULE, 1)
    s.text(10, 418, "การแปลงรหัสสถานี — _station_to_wimarc_id()", size=12, weight="600")
    for i, (code, formula, table, kind) in enumerate((
            ("wimarc5", "(5-1) × 2 + 1  =  9", "sensor / sensor_1min", "สถานีหลัก · อากาศ"),
            ("wimarc5c", "(5-1) × 2 + 2  =  10", "CAM_client", "สถานีลูก · ดิน"))):
        y = 432 + i * 32
        s.chip(10, y, code, "web")
        s.arrow(112, y + 11, 136, y + 11, MUTED, sw=1.3)
        s.code(142, y + 15, formula, size=11, fill=INK)
        s.arrow(268, y + 11, 292, y + 11, MUTED, sw=1.3)
        w = s.chip(298, y, table, "db")
        s.text(306 + w, y + 15, kind, size=10.5, fill=MUTED)
    return s.save(OUT / "two-databases.svg")


# ── 7. 6 จุดที่ต้องแก้เมื่อเพิ่มค่าใหม่ (บท 11) ─────────────────────────────
def add_value_6_points():
    s = SVG(W, 428)
    s.text(10, 24, "เรียงจากหลังไปหน้า — backend ก่อนเสมอ จะได้ทดสอบด้วย curl ก่อนแตะหน้าเว็บ",
           size=11, fill=MUTED)
    rows = [
        dict(file="backend/app/main.py", desc="คำนวณค่าและใส่ลงในผลลัพธ์", tone="api"),
        dict(file="backend/app/schemas.py", desc="ประกาศให้ค่านี้ออกไปกับ JSON ได้", tone="api",
             note="ลืม = ค่าหายเงียบ ๆ ไม่มี error"),
        dict(file="services/apiMappers.ts", desc="ประกาศชนิดขาเข้า แล้วแปลงเป็น camelCase", tone="web"),
        dict(file="types/index.ts", desc="ประกาศฟิลด์ใหม่ในชนิดข้อมูลฝั่งหน้าเว็บ (ใส่หน่วยในคอมเมนต์)", tone="web"),
        dict(file="app/dashboard/page.tsx", desc="วาดการ์ดแสดงผล เลียนแบบการ์ดที่มีอยู่", tone="web"),
        dict(file="docker compose build backend frontend", desc="build ทั้งสองฝั่งถึงจะมีผลจริง", tone="neutral"),
    ]
    bottom = steps(s, rows, y0=40)
    s.rect(50, bottom + 14, 560, 48, fill=TONES["danger"][1],
           stroke=TONES["danger"][0], rx=7, sw=1.2)
    s.text(64, bottom + 33, "ค่าไม่ขึ้นบนจอ ให้ไล่ย้อนจากจุดที่ 6 ขึ้นไป", size=11,
           fill=TONES["danger"][0], weight="600")
    s.text(64, bottom + 51, "build แล้วหรือยัง → หน้าเว็บอ่านฟิลด์ถูกชื่อไหม → curl เห็นค่าจาก backend ไหม",
           size=10.5, fill=MUTED)
    return s.save(OUT / "add-value-6-points.svg")


# ── 8. build-time เทียบ runtime + ขั้นตอน deploy (บท 13) ────────────────────
def build_deploy():
    s = SVG(W, 482)
    s.panel(10, 30, 295, 182, "ฝังตอน build", "danger")
    s.text(24, 52, "ต้อง build ใหม่ถึงจะเปลี่ยน", size=10.5,
           fill=TONES["danger"][0], weight="600")
    for i, name in enumerate(("BACKEND_PROXY_URL", "MEDIA_PROXY_URL",
                              "NEXT_PUBLIC_* ทุกตัว", "args: ใน docker-compose.yml")):
        s.chip(24, 62 + i * 32, name, "danger", h=24)
    s.text(24, 202, "แก้ใน environment: อย่างเดียว ไม่มีผล", size=10, fill=MUTED)

    s.panel(325, 30, 285, 182, "อ่านตอนรัน", "ok")
    s.text(339, 52, "แก้แล้วสั่ง up -d พอ", size=10.5, fill=TONES["ok"][0], weight="600")
    for i, name in enumerate(("DATABASE_URL", "WIMARC_DB_URL",
                              "JWT_SECRET", "TMD_API_KEY")):
        s.chip(339, 62 + i * 32, name, "ok", h=24)
    s.text(339, 202, "อยู่ในไฟล์ .env ที่รากโปรเจกต์", size=10, fill=MUTED)

    s.text(10, 246, "ขั้นตอน deploy", size=12, weight="600", fill=TONES["api"][0])
    for i, cmd in enumerate((
            "git commit งานของคุณก่อน",
            "docker compose build backend frontend",
            "docker compose up -d",
            "docker compose logs -f backend",
            "curl -s localhost:8000/health")):
        y = 260 + i * 38
        s.rect(10, y, 295, 32, fill=TONES["api"][1], stroke=TONES["api"][0], rx=6, sw=1)
        s.badge(28, y + 16, str(i + 1), "api", r=11)
        s.code(46, y + 20, cmd, size=10.5, fill=INK)

    s.text(325, 246, "ย้อนกลับเมื่อ deploy แล้วพัง", size=12, weight="600",
           fill=TONES["danger"][0])
    for i, cmd in enumerate((
            "git revert <hash>",
            "docker compose build backend frontend",
            "docker compose up -d")):
        y = 260 + i * 38
        s.rect(325, y, 285, 32, fill=TONES["danger"][1], stroke=TONES["danger"][0], rx=6, sw=1)
        s.badge(343, y + 16, str(i + 1), "danger", r=11)
        s.code(361, y + 20, cmd, size=10, fill=INK)
    s.text(325, 390, "ใช้ revert ห้ามใช้ reset --hard — revert เก็บประวัติไว้ครบ", size=10,
           fill=TONES["danger"][0])
    s.text(325, 407, "คนที่มาดูทีหลังจะรู้ว่าเคยมีอะไรและถูกถอนออกเพราะอะไร", size=10, fill=MUTED)
    s.text(310, 462, "เปิดเว็บจริงแล้วกด Ctrl+Shift+R ตรวจหน้าที่แก้ทุกครั้งหลัง deploy",
           size=11, fill=MUTED, anchor="middle")
    return s.save(OUT / "build-deploy.svg")

# ── 9. บันไดไล่ปัญหา (บท 14) ────────────────────────────────────────────────
def troubleshoot_ladder():
    s = SVG(W, 338)
    s.text(10, 24, "ไล่จากปลายทางย้อนกลับทีละขั้น — ขาดตอนที่ขั้นไหน ให้แก้ที่ขั้นนั้น",
           size=11.5, fill=MUTED)
    rows = [
        ("เบราว์เซอร์เห็นอะไร", "DevTools (F12) แท็บ Console และ Network", "web"),
        ("คำขอไปถึง backend ไหม", "docker compose logs -f backend", "neutral"),
        ("backend ตอบถูกไหม", "curl ยิงที่ endpoint นั้นตรง ๆ", "api"),
        ("ของจริงในฐานข้อมูลเป็นอะไร", "psql แล้ว SELECT ดูแถวล่าสุด", "db"),
    ]
    y = 46
    for i, (q, tool, tone) in enumerate(rows, 1):
        stroke, fill = TONES[tone]
        s.rect(46, y, 564, 54, fill=fill, stroke=stroke, rx=7, sw=1.2)
        s.badge(24, y + 27, str(i), tone, r=13)
        s.text(62, y + 23, q, size=12.5, weight="600")
        s.code(62, y + 41, tool, size=11, fill=stroke)
        if i < len(rows):
            s.arrow(24, y + 54, 24, y + 68, RULE, sw=1.6)
        y += 68
    s.text(310, 324, "เจอขั้นที่ข้อมูลเริ่มผิด = เจอต้นเหตุ อย่าเดาแล้วแก้ข้ามขั้น",
           size=11, fill=MUTED, anchor="middle")
    return s.save(OUT / "troubleshoot-ladder.svg")


def main():
    OUT.mkdir(exist_ok=True)
    for fn in (system_overview, three_channels, folder_map, data_path, rbac,
               two_databases, add_value_6_points, build_deploy, troubleshoot_ladder):
        p = fn()
        print(f"  {p.name:<28} {p.stat().st_size:>6,} ไบต์")
    print(f"วาดรูปเสร็จ {len(list(OUT.glob('*.svg')))} รูป → {OUT.name}/")


if __name__ == "__main__":
    main()
