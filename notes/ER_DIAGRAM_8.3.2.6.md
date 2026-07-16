# ER-Diagram — WiMaRC App Database (ข้อ 8.3.2.6 / 4.6.6)

ฐานข้อมูลแอป `wimarc_db` (engine `DATABASE_URL`) — 7 ตารางหลัก
> หมายเหตุ: sensor ดิบ real-time อ่านจาก legacy DB (`CAM_main`/`CAM_client`/`sensor`/`updatedata`) แยกอีกชุด — ไม่อยู่ใน ER นี้ (เป็น read-only external source / Server 1)

## Mermaid ER (render เป็นภาพได้ใน VS Code / mermaid.live)

```mermaid
erDiagram
    users ||--o{ stations : "owns (owner_id)"
    users ||--o{ plot_activities : "creates (created_by)"
    stations ||--o{ sensor_readings : "has"
    stations ||--o{ plot_activities : "has"
    stations ||--o{ station_images : "has"
    stations ||--o{ sim_payments : "has"
    stations ||--o{ weather_forecasts : "has"

    users {
        string id PK
        string username UK "unique, indexed"
        string password "bcrypt hash"
        string role "Admin|User|Guest"
        string full_name
        string email
        boolean is_enabled
        jsonb permitted_station_ids
        string phone "nullable"
        datetime created_at
    }
    stations {
        string id PK
        string name "indexed"
        string type "weather|soil"
        string owner_id FK "→ users.id, nullable"
        float latitude
        float longitude
        string status "online|offline"
        datetime last_data_time "nullable"
        string area
        text description
    }
    sensor_readings {
        string id PK
        string station_id FK "→ stations.id, indexed"
        datetime timestamp
        float air_temperature "nullable"
        float relative_humidity "nullable"
        float light_intensity "nullable"
        float wind_direction "nullable"
        float wind_speed "nullable"
        float rainfall "nullable"
        float atmospheric_pressure "nullable"
        float vpd "nullable"
        float soil_moisture1 "nullable"
        float soil_moisture2 "nullable"
    }
    plot_activities {
        string id PK
        string station_id FK "→ stations.id, indexed"
        date date
        string activity_type
        text description
        string created_by FK "→ users.id"
        string created_by_name
        datetime created_at
        jsonb images
    }
    station_images {
        string id PK
        string station_id FK "→ stations.id, indexed"
        text image_url
        datetime timestamp
    }
    sim_payments {
        string id PK
        string sim_number
        string provider
        float amount
        string station_id FK "→ stations.id"
        string station_name "nullable"
        date due_date "nullable"
        string status "nullable"
        date paid_date "nullable"
        text notes "nullable"
    }
    weather_forecasts {
        string id PK
        string station_id FK "→ stations.id, indexed"
        date forecast_date "indexed"
        float temperature
        float rain_probability
        float rainfall
        string description
        datetime created_at "indexed, nullable"
    }
```

## ความสัมพันธ์ (สรุป)

| Parent | Child | FK | ความสัมพันธ์ |
|---|---|---|---|
| users | stations | `stations.owner_id` | 1 : N (เจ้าของสถานี) |
| users | plot_activities | `plot_activities.created_by` | 1 : N (ผู้สร้างกิจกรรม) |
| stations | sensor_readings | `sensor_readings.station_id` | 1 : N |
| stations | plot_activities | `plot_activities.station_id` | 1 : N |
| stations | station_images | `station_images.station_id` | 1 : N |
| stations | sim_payments | `sim_payments.station_id` | 1 : N |
| stations | weather_forecasts | `weather_forecasts.station_id` | 1 : N |

## ASCII fallback

```
              ┌─────────┐
              │  users  │
              └────┬────┘
        owner_id   │   created_by
        ┌──────────┴───────────┐
        ▼                      ▼
  ┌──────────┐          ┌────────────────┐
  │ stations │◄─────────┤ plot_activities│
  └────┬─────┘ station_id└────────────────┘
       │ station_id (1:N) → sensor_readings, station_images,
       │                     sim_payments, weather_forecasts
       ▼
 (5 child tables)
```
