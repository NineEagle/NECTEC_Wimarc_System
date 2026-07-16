# Test Cases + UAT — WiMaRC (ข้อ 8.3.2.2 / 4.6.2)

ชุดทดสอบการยอมรับระบบ (User Acceptance Testing) — ทดสอบผ่าน Swagger UI (`/backend/docs`) หรือหน้าเว็บจริง
**วิธีบันทึกผล:** ทำจริง → แคปหน้าจอ/response → เติมคอลัมน์ "ผลจริง" + "ผ่าน/ไม่ผ่าน" → ผู้ใช้เซ็นรับรองท้ายเอกสาร

## A. Authentication & Authorization

| # | Test Case | ขั้นตอน | ผลที่คาดหวัง | ผลจริง | ผ่าน? |
|---|---|---|---|---|---|
| A1 | Login สำเร็จ (admin) | POST /auth/login + creds ถูก | 200 + token + role=Admin | | ☐ |
| A2 | Login ผิด password | POST /auth/login + password ผิด | 401 Invalid credentials | | ☐ |
| A3 | Rate limit login | ยิง login ผิด 6 ครั้ง | ครั้งที่ 6 → 429 | | ☐ |
| A4 | สมัครสมาชิก | POST /auth/register | 201 pending (รออนุมัติ) | | ☐ |
| A5 | เรียก API ไม่มี token | GET /stations ไม่ใส่ Authorization | 401 | | ☐ |
| A6 | User เรียก admin endpoint | GET /users ด้วย token User | 403 | | ☐ |
| A7 | Guest เขียนข้อมูล | POST /activities ด้วย token Guest | 403 Guest read-only | | ☐ |

## B. Station & Sensor data

| # | Test Case | ขั้นตอน | ผลที่คาดหวัง | ผลจริง | ผ่าน? |
|---|---|---|---|---|---|
| B1 | ดูรายการสถานี | GET /stations (admin) | 200 + array สถานี | | ☐ |
| B2 | ดู live data | GET /stations/wimarc1/live | 200 + ค่า sensor ล่าสุด | | ☐ |
| B3 | สถานีใกล้สุด | GET /stations/nearest?lat=18.8&lon=99 | 200 + 1 สถานี | | ☐ |
| B4 | สถานีใกล้สุด param ผิด | GET /stations/nearest?lat=999 | 422 validation | | ☐ |
| B5 | ดูข้อมูลย้อนหลัง | GET /stations/wimarc1/readings?days=7 | 200 + array | | ☐ |
| B6 | สร้างสถานี (admin) | POST /stations | 201 + station | | ☐ |
| B7 | สร้างสถานี (non-admin) | POST /stations ด้วย User | 403 | | ☐ |

## C. Real-time Dashboard (ข้อ 4.5.3)

| # | Test Case | ขั้นตอน | ผลที่คาดหวัง | ผลจริง | ผ่าน? |
|---|---|---|---|---|---|
| C1 | Dashboard แสดงค่า live | เปิด /dashboard | เห็นค่า sensor + เวลาล่าสุด | | ☐ |
| C2 | Auto-refresh | ดู dashboard 30 วินาที | countdown + pulse + ค่า update | | ☐ |
| C3 | รูปกล้อง | ดู card กล้อง | เห็นรูปจาก Server 1 + timestamp | | ☐ |

## D. Guest mode (feature ใหม่)

| # | Test Case | ขั้นตอน | ผลที่คาดหวัง | ผลจริง | ผ่าน? |
|---|---|---|---|---|---|
| D1 | Guest ขอตำแหน่ง | login Guest | popup ขอ geolocation | | ☐ |
| D2 | Guest อนุญาต location | กดอนุญาต | เห็น dashboard สถานีใกล้สุด | | ☐ |
| D3 | Guest ปฏิเสธ location | กดบล็อก | หน้า gate + ปุ่มลองใหม่ (เข้าไม่ได้) | | ☐ |
| D4 | Guest เห็นแค่ dashboard | ดู sidebar | มีแค่เมนู dashboard | | ☐ |
| D5 | Guest ไม่มีกล้อง | ดู dashboard | ไม่มี card กล้อง | | ☐ |
| D6 | Guest พิมพ์ URL อื่น | ไป /historical | เด้งกลับ /dashboard | | ☐ |

## E. CRUD (Activities / SIM / Users)

| # | Test Case | ขั้นตอน | ผลที่คาดหวัง | ผลจริง | ผ่าน? |
|---|---|---|---|---|---|
| E1 | สร้างกิจกรรม | POST /activities (User) | 201 | | ☐ |
| E2 | แก้กิจกรรม | PUT /activities/{id} | 200 | | ☐ |
| E3 | ลบกิจกรรม | DELETE /activities/{id} | 204 | | ☐ |
| E4 | สร้างผู้ใช้ (admin) | POST /users | 201 | | ☐ |
| E5 | จัดการซิม | GET /sim-payments | 200 | | ☐ |

## F. Security headers

| # | Test Case | ขั้นตอน | ผลที่คาดหวัง | ผลจริง | ผ่าน? |
|---|---|---|---|---|---|
| F1 | HSTS + CSP | `curl -I https://wimarc.in.th/` | มี HSTS, CSP, X-Frame DENY ฯลฯ | | ☐ |
| F2 | ไม่ leak banner | ดู response header | ไม่มี X-Powered-By / server version | | ☐ |

---

## สรุปผลการทดสอบ

- จำนวน test case ทั้งหมด: **30**
- ผ่าน: ____ / ไม่ผ่าน: ____
- ช่องโหว่/ปัญหาที่พบ: ________________________________

## การยอมรับจากผู้ใช้ (User Acceptance)

| บทบาท | ชื่อ-นามสกุล | ลายเซ็น | วันที่ |
|---|---|---|---|
| ผู้ทดสอบ (ฝั่งพัฒนา) | | | |
| ผู้ใช้/ตัวแทนผู้ว่าจ้าง | | | |
| ผู้รับรอง | | | |

> ผู้ใช้ลงนามยืนยันว่าระบบทำงานได้ตามข้อกำหนด (ข้อ 4.6.2 UAT)
