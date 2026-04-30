from datetime import date, datetime, timedelta
import random

from sqlalchemy.orm import Session

from .models import PlotActivity, SensorReading, SimPayment, Station, StationImage, User, WeatherForecast

# ---------------------------------------------------------------------------
# Real wimarc installation data (from CSV, 30 orchards)
# Each orchard has 2 stations:
#   - wimarc{N}  : main station  → weather sensors (CAMV / sensor table)
#   - wimarc{N}c : client station → soil sensors   (CAMA / a tables)
# ---------------------------------------------------------------------------
WIMARC_DATA = [
    # (num, owner_full_name, username, area, latitude, longitude, sim)
    (1,  "คุณบุษบา นาคพิพัฒน์",          "wimarc01", "นายายอาม จ.จันทบุรี",      12.732491, 101.851732, "06-1512079-5"),
    (2,  "คุณยุทธยงค์ พาที",               "wimarc02", "นายายอาม จ.จันทบุรี",      12.678684, 101.862885, "06-1512143-1"),
    (3,  "คุณสนิท แก้วสุข",               "wimarc03", "เขาคิชฌกูฏ จ.จันทบุรี",    12.965763, 102.081827, "06-1512140-4"),
    (4,  "คุณบรรเจิด เต่าเงิน",           "wimarc04", "เขาคิชฌกูฏ จ.จันทบุรี",    12.972807, 102.085906, "06-1512138-9"),
    (5,  "คุณจุมพล ประสงค์ดี",            "wimarc05", "เขาคิชฌกูฏ จ.จันทบุรี",    12.840695, 102.034350, "06-1512126-0"),
    (6,  "คุณจุมพล ประสงค์ดี (สวนที่ 2)", "wimarc06", "ท่าใหม่ จ.จันทบุรี",       12.611434, 102.042915, "06-1512121-5"),
    (7,  "พีรพล แก้วดวงเล็ก",             "wimarc07", "เขาฉะเมา จ.ระยอง",         12.997012, 101.681239, "06-1512079-9"),
    (8,  "คุณนภกร ธรรมฉัตร (สวนที่ 1)",  "wimarc08", "เขาสมิง จ.ตราด",           12.294645, 102.336069, "06-1512117-0"),
    (9,  "คุณนภกร ธรรมฉัตร (สวนที่ 2)",  "wimarc09", "เขาสมิง จ.ตราด",           12.294645, 102.336069, "06-1512117-0"),
    (10, "คุณสำริทธิ์ พ่วงฟัก",           "wimarc10", "แกลง จ.ระยอง",             12.801150, 101.758554, "06-1512090-1"),
    (11, "นางสาวอุมาภรณ์ ร่วมสุข",        "wimarc11", "เขาคิชฌกูฏ จ.จันทบุรี",    12.797168, 102.116920, "06-1512090-0"),
    (12, "คุณวงสิน ฉัตกวาณิชย์",          "wimarc12", "เมือง จ.จันทบุรี",         12.723429, 102.094160, "06-1512135-0"),
    (13, "คุณพงศกร หงษ์พานิช",            "wimarc13", "เขาสมิง จ.ตราด",           12.547079, 102.356027, "06-1512133-2"),
    (14, "คุณณัฐวรรณ จิรวงศ์",            "wimarc14", "ขลุง จ.จันทบุรี",          12.507372, 102.254897, "06-1512131-5"),
    (15, "นายเจษฎา สมบัติเจริญนนท์",      "wimarc15", "เขาคิชฌกูฏ จ.จันทบุรี",    13.042733, 102.012936, "08-4115884-0"),
    (16, "นางสาวบานชื่น ผกามาศ",          "wimarc16", "เขาคิชฌกูฏ จ.จันทบุรี",    12.952490, 102.085150, "06-1512130-5"),
    (17, "คุณณีรนุช เปสน",                "wimarc17", "มะขาม จ.จันทบุรี",         12.797750, 102.229660, "06-1512129-2"),
    (18, "คุณพรนภา ยุทธสุขประเสริฐ",      "wimarc18", "ท่าใหม่ จ.จันทบุรี",       12.824547, 101.991341, "06-1512094-1"),
    (19, "คุณกนกวรรณ อนุสิทธิ์",          "wimarc19", "ท่าใหม่ จ.จันทบุรี",       12.661349, 101.978418, "06-1512095-6"),
    (20, "คุณฑีประจักษ์ แจงเชือ",         "wimarc20", "เขาคิชฌกูฏ จ.จันทบุรี",    12.882781, 102.012416, "09-5008899-5"),
    (21, "คุณกัญจนรัตน์ ณัฐธันยาภัทร์",  "wimarc21", "ท่าใหม่ จ.จันทบุรี",       12.827003, 101.972344, "06-2851095-1"),
    (22, "คุณมินตรา แก้ววิจิตร",           "wimarc22", "ท่าใหม่ จ.จันทบุรี",       12.704535, 101.994717, "06-1512101-7"),
    (23, "คุณบัณฑิต หนองบัว",             "wimarc23", "มะขาม จ.จันทบุรี",         12.769563, 102.267544, "06-1512104-4"),
    (24, "คุณสันฐิตา ร้อยอำแพง",          "wimarc24", "มะขาม จ.จันทบุรี",         12.752575, 102.208894, "06-1512147-9"),
    (25, "คุณรัชณีวรรณ ธนเจริญชินภักดี",  "wimarc25", "มะขาม จ.จันทบุรี",         12.774195, 102.184918, "08-3793162-4"),
    (26, "คุณพิพัฒน์ เต็งเศรษฐศักดิ์",   "wimarc26", "เขาคิชฌกูฏ จ.จันทบุรี",    12.778549, 102.084543, "06-1512103-0"),
    (27, "คุณสุวิจักขณ์ โพธิ์งาม",        "wimarc27", "เมือง จ.จันทบุรี",         12.730922, 102.109642, "06-4764331-7"),
    (28, "คุณอาทิตย์ จิรวงศ์วณิชย์",      "wimarc28", "แหลมสิงห์ จ.จันทบุรี",     12.510188, 102.167747, "09-1062692-3"),
    (29, "คุณณรงค์ชัย งามเสงี่ยม",        "wimarc29", "แกลง จ.ระยอง",             12.818473, 101.594600, "06-1512116-1"),
    (30, "คุณธีรโชติ ปริ่มผล",            "wimarc30", "เขาสมิง จ.ตราด",           12.379644, 102.440725, "06-1512113-0"),
]


def minutes_ago(minutes: int) -> datetime:
    return datetime.utcnow() - timedelta(minutes=minutes)


def seed_users(session: Session) -> None:
    if session.query(User).first():
        return

    users = [
        # Admin account
        User(
            id="user-admin",
            username="admin",
            password="admin123",
            role="Admin",
            full_name="ผู้ดูแลระบบ",
            email="admin@wimarc.example",
            is_enabled=True,
            permitted_station_ids=[],  # Admin can see all
            created_at=datetime(2024, 1, 1),
        ),
    ]

    # One user per wimarc orchard (owns both main + client station)
    for num, owner, username, area, lat, lng, sim in WIMARC_DATA:
        main_id   = f"wimarc{num}"
        client_id = f"wimarc{num}c"
        users.append(
            User(
                id=f"user-{username}",
                username=username,
                password="wimarc@2026",
                role="User",
                full_name=owner,
                email=f"{username}@wimarc.example",
                is_enabled=True,
                permitted_station_ids=[main_id, client_id],
                created_at=datetime(2024, 3, 1),
            )
        )

    session.add_all(users)
    session.commit()


def seed_stations(session: Session) -> None:
    if session.query(Station).first():
        return

    stations = []
    for num, owner, username, area, lat, lng, sim in WIMARC_DATA:
        # Main station — weather sensors (CAMV)
        stations.append(
            Station(
                id=f"wimarc{num}",
                name=f"wimarc{num:02d} (อากาศ) — {owner}",
                type="weather",
                owner_id=f"user-{username}",
                latitude=lat,
                longitude=lng,
                status="online",
                last_data_time=minutes_ago(5 + num * 2),
                area=area,
                description=f"สถานีอากาศหลัก wimarc{num:02d} สวนของ{owner}",
            )
        )
        # Client station — soil sensors (CAMA)
        stations.append(
            Station(
                id=f"wimarc{num}c",
                name=f"wimarc{num:02d} (ดิน) — {owner}",
                type="soil",
                owner_id=f"user-{username}",
                latitude=lat,
                longitude=lng,
                status="online",
                last_data_time=minutes_ago(7 + num * 2),
                area=area,
                description=f"สถานีวัดความชื้นดิน wimarc{num:02d} สวนของ{owner}",
            )
        )

    session.add_all(stations)
    session.commit()


def seed_station_images(session: Session) -> None:
    if session.query(StationImage).first():
        return

    stations = session.query(Station).order_by(Station.id).all()
    images = [
        StationImage(
            id=f"image-{idx + 1:03d}",
            station_id=station.id,
            image_url="/placeholder.svg?height=480&width=640",
            timestamp=minutes_ago(5 + idx * 3),
        )
        for idx, station in enumerate(stations)
    ]

    session.add_all(images)
    session.commit()


def seed_sim_payments(session: Session) -> None:
    if session.query(SimPayment).first():
        return

    payments = []
    for num, owner, username, area, lat, lng, sim in WIMARC_DATA[:5]:
        payments.append(
            SimPayment(
                id=f"sim-{num:03d}",
                station_id=f"wimarc{num}",
                station_name=f"wimarc{num:02d} — {owner}",
                sim_number=sim,
                provider="AIS",
                amount=350.0,
                due_date=date.today() + timedelta(days=15 + num),
                status="pending",
            )
        )

    session.add_all(payments)
    session.commit()


def seed_weather_forecasts(session: Session) -> None:
    if session.query(WeatherForecast).first():
        return

    weather_stations = session.query(Station).filter(Station.type == "weather").all()
    forecasts = []
    descriptions = ["แดดจัด", "มีเมฆบางส่วน", "เมฆมาก", "ฝนตกเล็กน้อย", "ฝนฟ้าคะนอง", "อากาศแจ่มใส"]
    
    for station in weather_stations:
        for day in range(7):
            forecast_date = date.today() + timedelta(days=day)
            desc = random.choice(descriptions) if day > 0 else "มีเมฆบางส่วน"
            forecasts.append(
                WeatherForecast(
                    id=f"forecast-{station.id}-{day}",
                    station_id=station.id,
                    forecast_date=forecast_date,
                    temperature=28.0 + random.uniform(-2, 5),
                    rain_probability=random.uniform(10, 80) if "ฝน" in desc else random.uniform(0, 30),
                    rainfall=random.uniform(1, 15) if "ฝน" in desc else 0.0,
                    description=desc,
                )
            )

    session.add_all(forecasts)
    session.commit()


def seed_sensor_readings(session: Session) -> None:
    start_of_year = datetime(datetime.utcnow().year, 1, 1)
    start_of_year_date = start_of_year.date()
    has_any = session.query(SensorReading).first() is not None
    oldest = session.query(SensorReading).order_by(SensorReading.timestamp.asc()).first()
    oldest_date = oldest.timestamp.date() if oldest else None
    has_year_data = oldest_date is not None and oldest_date <= (start_of_year_date + timedelta(days=1))

    if has_any and has_year_data:
        return

    stations = session.query(Station).all()
    readings = []
    rng = random.Random(2024)

    if not has_any:
        for station in stations:
            for offset in range(3):
                timestamp = datetime.utcnow() - timedelta(hours=offset * 3)
                if station.type == "weather":
                    readings.append(SensorReading(
                        id=f"reading-{station.id}-{offset}",
                        station_id=station.id,
                        timestamp=timestamp,
                        air_temperature=28.5 + offset,
                        relative_humidity=75.0 - offset,
                        light_intensity=32000 + offset * 500,
                        wind_direction=180,
                        wind_speed=2.5 + offset * 0.2,
                        rainfall=0.0,
                        atmospheric_pressure=1012.5,
                        vpd=1.1 + offset * 0.05,
                    ))
                else:
                    readings.append(SensorReading(
                        id=f"reading-{station.id}-{offset}",
                        station_id=station.id,
                        timestamp=timestamp,
                        soil_moisture1=52.0 - offset,
                        soil_moisture2=49.0 - offset * 0.8,
                    ))

    if not has_year_data:
        days = (datetime.utcnow().date() - start_of_year.date()).days + 1
        for station in stations:
            for day_offset in range(days):
                day_date = start_of_year.date() + timedelta(days=day_offset)
                timestamp = datetime.combine(day_date, datetime.min.time()) + timedelta(hours=12)
                if station.type == "weather":
                    readings.append(SensorReading(
                        id=f"reading-{station.id}-{day_date:%Y%m%d}",
                        station_id=station.id,
                        timestamp=timestamp,
                        air_temperature=round(rng.uniform(26.0, 34.5), 1),
                        relative_humidity=round(rng.uniform(60.0, 90.0), 1),
                        light_intensity=round(rng.uniform(18000, 62000), 0),
                        wind_direction=round(rng.uniform(0, 360), 0),
                        wind_speed=round(rng.uniform(0.8, 4.8), 1),
                        rainfall=round(rng.uniform(0.5, 8.0), 1) if rng.random() < 0.3 else 0.0,
                        atmospheric_pressure=round(rng.uniform(1008.0, 1018.5), 1),
                        vpd=round(rng.uniform(0.7, 1.8), 2),
                    ))
                else:
                    readings.append(SensorReading(
                        id=f"reading-{station.id}-{day_date:%Y%m%d}",
                        station_id=station.id,
                        timestamp=timestamp,
                        soil_moisture1=round(rng.uniform(38.0, 68.0), 1),
                        soil_moisture2=round(rng.uniform(35.0, 65.0), 1),
                    ))

    session.add_all(readings)
    session.commit()


def seed_activities(session: Session) -> None:
    if session.query(PlotActivity).first():
        return

    activities = [
        PlotActivity(
            id="activity-001",
            station_id="wimarc1",
            date=date.today() - timedelta(days=2),
            activity_type="รดน้ำ",
            description="รดน้ำช่วงเช้า 50 ลิตรต่อต้น",
            created_by="user-wimarc01",
            created_by_name="คุณบุษบา นาคพิพัฒน์",
            created_at=datetime.utcnow() - timedelta(days=2, hours=2),
            images=[],
        ),
    ]

    session.add_all(activities)
    session.commit()


def seed_data(session: Session) -> None:
    seed_users(session)
    seed_stations(session)
    seed_station_images(session)
    seed_sim_payments(session)
    seed_weather_forecasts(session)
    seed_sensor_readings(session)
    seed_activities(session)
