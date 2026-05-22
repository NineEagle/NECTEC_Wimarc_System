# Data Logic & Sources — WiMaRC

เอกสารนี้อธิบาย **ที่มาของข้อมูลแต่ละค่า** และ **วิธีคำนวณ** ในระบบ

---

## 1. Station ID → ตารางฐานข้อมูล

สถานีในแอปแมปกับตารางใน legacy DB (`wimarc_db`) ผ่านฟังก์ชัน `_station_to_wimarc_id()` ใน `backend/app/main.py`

| App Station ID | wimarc_info.id | ตารางข้อมูล | ประเภท |
|---|---|---|---|
| `wimarc1` | 1 | `sensor`, `sensor_1min` | สภาพอากาศ (weather) |
| `wimarc1c` | 2 | `CAM_client` | ดิน (soil) |
| `wimarc2` | 3 | `sensor`, `sensor_1min` | สภาพอากาศ |
| `wimarc2c` | 4 | `CAM_client` | ดิน |
| `wimarc{N}` | `(N-1)*2 + 1` | `sensor` / `sensor_1min` | weather |
| `wimarc{N}c` | `(N-1)*2 + 2` | `CAM_client` | soil |

---

## 2. ตารางฐานข้อมูล Legacy (wimarc_db)

### 2.1 `sensor` — อ่านค่าอุตุนิยมวิทยาทุก 10 นาที

| คอลัมน์ | ค่าที่เก็บ | หน่วย | หมายเหตุ |
|---|---|---|---|
| `wimarc_id` | ID สถานี | — | FK ไป wimarc_info |
| `date` | วันที่ | DATE | |
| `time` | เวลา | TIME | |
| `Temp` | อุณหภูมิอากาศ | °C | |
| `Humid` | ความชื้นสัมพัทธ์ | % | |
| `Rain` | ปริมาณน้ำฝน | mm | |
| `WindS` | ความเร็วลม | m/s | |
| `WindD` | ทิศทางลม | degrees | |
| `Lux` | ความเข้มแสง | lux | มี comma ต้องแปลงก่อน: `str.replace(",","")` |
| `Pressure` | ❌ ค่าผิด | — | ใช้ `sensor_1min.E` แทน |

### 2.2 `sensor_1min` — อ่านค่าทุก 1 นาที (decoded)

ใช้เป็น primary สำหรับ **live data** และ JOIN เพื่อดึงความดันอากาศ

| คอลัมน์ | ค่าที่เก็บ | หน่วย |
|---|---|---|
| `Temp` | อุณหภูมิอากาศ | °C |
| `Humid` | ความชื้นสัมพัทธ์ | % |
| `Rain` | ปริมาณน้ำฝน | mm |
| `WindS` | ความเร็วลม | m/s |
| `WindD` | ทิศทางลม | degrees |
| `Lux` | ความเข้มแสง | lux |
| `Pressure` | ความดันอากาศ | hPa | ✅ ค่านี้ถูกต้อง (ต่างจาก sensor.Pressure) |

### 2.3 `updatedata` — heartbeat อุปกรณ์ทุก 1 นาที (raw)

ใช้สำหรับ: last_ping, ความดัน/แบตเตอรี่ (main), ข้อมูล soil แบบ raw (client)

| คอลัมน์ | สถานีหลัก (name='CAM_main') | สถานี Client (name='CAM_client') |
|---|---|---|
| `A` | — | raw ADC ความชื้นดิน 15cm |
| `B` | — | raw count อุณหภูมิดิน 15cm |
| `C` | — | raw ADC ความชื้นดิน 30cm |
| `D` | — | raw count อุณหภูมิดิน 30cm |
| `E` | ความดันอากาศ (hPa, ตรงๆ) | — |
| `G` | แรงดันแบตเตอรี่ raw (หาร 1000 → V) | — |

### 2.4 `CAM_client` — อ่านค่าดินทุก 10 นาที

| คอลัมน์ | ค่าที่เก็บ | แปลงเป็น |
|---|---|---|
| `A` | raw ADC ความชื้นดินที่ความลึก 15cm | `_adc_to_moisture()` → % |
| `B` | raw count อุณหภูมิดิน 15cm | `_raw_to_soil_temp()` → °C |
| `C` | raw ADC ความชื้นดินที่ความลึก 30cm | `_adc_to_moisture()` → % |
| `D` | raw count อุณหภูมิดิน 30cm | `_raw_to_soil_temp()` → °C |

---

## 3. การคำนวณค่าต่างๆ

### 3.1 VPD — Vapour Pressure Deficit (kPa)

**ฟังก์ชัน:** `_calc_vpd(temp_c, rh)` — `backend/app/main.py:226`

```
SVP  = 0.6108 × exp(17.27 × T / (T + 237.3))   ← ความดันไอน้ำอิ่มตัว (kPa)
VPD  = SVP × (1 − RH / 100)
```

- Input: `air_temperature` (°C), `relative_humidity` (%)
- Output: kPa, ปัดทศนิยม 3 ตำแหน่ง
- คำนวณ **ฝั่ง backend** ทุกครั้งที่ query — ไม่ได้เก็บในฐานข้อมูล
- ใช้สำหรับประเมินความเครียดของพืช โดยเฉพาะทุเรียน

### 3.2 ความชื้นดิน — ADC → %

**ฟังก์ชัน:** `_adc_to_moisture(adc)` — `backend/app/main.py:240`

```
pct = (DRY_ADC − adc) / (DRY_ADC − WET_ADC) × 100
    = (3800 − adc) / (3800 − 1200) × 100
```

- `_SOIL_DRY_ADC = 3800` — ค่า ADC เมื่อเซนเซอร์อยู่ในอากาศแห้ง (0%)
- `_SOIL_WET_ADC = 1200` — ค่า ADC เมื่อจุ่มในน้ำ (100%)
- clamp ผลลัพธ์ไว้ที่ 0–100%
- ปรับค่า calibration ได้ที่ `_SOIL_DRY_ADC` / `_SOIL_WET_ADC`

### 3.3 อุณหภูมิดิน — raw count → °C

**ฟังก์ชัน:** `_raw_to_soil_temp(raw)` — `backend/app/main.py:253`

```
°C = raw / 40.0
```

- `_SOIL_TEMP_SCALE = 40.0` — ค่า scale factor ของเซนเซอร์
- เช่น raw = 1012 → 25.3°C

### 3.4 แรงดันแบตเตอรี่ — raw → V

```
V = updatedata.G / 1000
```

- ดึงจาก `updatedata.G` คอลัมน์ของ main station
- หาร 1000 เพื่อแปลงเป็น Volt

---

## 4. Data Flow

### 4.1 Live Data (`/stations/{id}/live`)

```
updatedata (1 min heartbeat)
    └─ last_ping        ← last row WHERE wimarc_id + name

sensor_1min (1 min decoded)
    └─ air_temperature  ← Temp
    └─ relative_humidity← Humid
    └─ rainfall         ← Rain
    └─ wind_speed       ← WindS
    └─ wind_direction   ← WindD
    └─ light_intensity  ← Lux
    └─ vpd              ← คำนวณจาก Temp + Humid

updatedata (1 min raw)
    └─ atmospheric_pressure ← E (ตรงๆ, hPa)
    └─ battery_voltage      ← G / 1000

CAM_client (10 min) หรือ updatedata (1 min)  [เฉพาะ client station]
    └─ soil_moisture1   ← A → _adc_to_moisture()
    └─ soil_moisture2   ← C → _adc_to_moisture()
    └─ soil_temperature1← B → _raw_to_soil_temp()
    └─ soil_temperature2← D → _raw_to_soil_temp()
```

Priority live data: `updatedata` ก่อน fallback `CAM_client` (เพราะ updatedata ใหม่กว่า)

### 4.2 Historical Readings (`/stations/{id}/readings`)

```
sensor (10 min)  ← weather station
    JOIN sensor_1min ON date+time  ← เพื่อดึง pressure ที่ถูกต้อง
    └─ Temp, Humid, Rain, WindS, WindD, Lux
    └─ sensor_1min.E → atmospheric_pressure

CAM_client (10 min)  ← soil station
    └─ A → soil_moisture1
    └─ B → soil_temperature1
    └─ C → soil_moisture2
    └─ D → soil_temperature2
```

### 4.3 Station Online/Offline Status

```
updatedata  ← last timestamp
sensor      ← last timestamp (fallback, WHERE date IN today/yesterday)
CAM_client  ← last timestamp (fallback, WHERE date IN today/yesterday)

effective_ts = max(updatedata_ts, sensor_ts)
offline      = effective_ts < now − 30 minutes
```

---

## 5. Cadence สรุป

| ตาราง | Cadence | ใช้ทำอะไร |
|---|---|---|
| `updatedata` | ~1 นาที | heartbeat, raw A–G, last_ping |
| `sensor_1min` | ~1 นาที | decoded weather values (live) |
| `sensor` | ~10 นาที | historical weather |
| `CAM_client` | ~10 นาที | historical + fallback live soil |
| `CAM_main` | legacy (ไม่ใช้แล้ว) | — |

---

## 6. Weather Forecast Sources

| ค่า | แหล่งข้อมูล | Endpoint | Cache |
|---|---|---|---|
| พยากรณ์รายวัน 7 วัน | กรมอุตุฯ (TMD) | `/stations/{id}/tmd-forecast` | ไม่ cache — on-demand |
| พยากรณ์รายชั่วโมง | กรมอุตุฯ (TMD) primary, Open-Meteo fallback | `/stations/{id}/hourly-forecast` | ไม่ cache — on-demand |
| ประกาศเตือนภัย | กรมอุตุฯ (TMD) | `/stations/{id}/tmd-warning` | ไม่ cache |
| พยากรณ์ 7 วัน (stored) | Open-Meteo | `/stations/{id}/forecast` | background task ทุก 12h |

**TMD cond codes (hourly):**

| cond | ความหมาย | ไอคอน |
|---|---|---|
| 1 | ท้องฟ้าแจ่มใส | ☀️ |
| 2 | มีเมฆบางส่วน | 🌤️ |
| 3 | มีเมฆเป็นส่วนมาก | ⛅ |
| 4 | มีเมฆมาก | ☁️ |
| 5 | ฝนตกเล็กน้อย | 🌦️ |
| 6 | ฝนตกปานกลาง | 🌧️ |
| 7 | ฝนตกหนัก | 🌧️ |
| 8 | ฝนฟ้าคะนอง | ⛈️ |

`precipitation_probability` สำหรับ TMD derive จาก cond: `{5:30%, 6:60%, 7:80%, 8:90%}` เพราะ TMD hourly API ไม่มี field นี้โดยตรง
