import math
import os
import re
import urllib.request
from datetime import datetime, timedelta
from typing import List, Optional
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from .db import Base, SessionLocal, engine, get_db, get_wimarc_db
from .models import PlotActivity, SensorReading, SimPayment, Station, StationImage, User, WeatherForecast
from .schemas import (
    AuthLogin,
    LiveDataOut,
    PlotActivityCreate,
    PlotActivityOut,
    PlotActivityUpdate,
    SensorReadingCreate,
    SensorReadingOut,
    SimPaymentCreate,
    SimPaymentOut,
    SimPaymentUpdate,
    StationCreate,
    StationImageOut,
    StationOut,
    StationUpdate,
    UserCreate,
    UserOut,
    UserUpdate,
    WeatherForecastOut,
)
from .seed import seed_data

app = FastAPI(title="WiMaRC API", version="0.1.0")

FILE_SERVER_URL = os.getenv("FILE_SERVER_URL", "http://localhost:8001")


def _station_folder(station_id: str) -> Optional[tuple[str, str]]:
    """Map station_id to (img_base_dir, folder_name).

    Main station  : 'wimarc5'  → ('imgMain',   'wimarc5')
    Client station: 'wimarc5c' → ('imgClient',  'wimarc5')
    Legacy format : 'station-005' → ('imgMain', 'wimarc5')
    """
    # Client station: wimarc{N}c
    m_client = re.match(r"wimarc(\d+)c$", station_id)
    if m_client:
        return ("imgClient", f"wimarc{m_client.group(1)}")
    # Main station: wimarc{N}
    if re.match(r"wimarc\d+$", station_id):
        return ("imgMain", station_id)
    # Legacy: station-0NN
    m_legacy = re.match(r"station-0*(\d+)$", station_id)
    if m_legacy:
        return ("imgMain", f"wimarc{m_legacy.group(1)}")
    return None


def _latest_image_from_server(img_base: str, folder: str) -> Optional[str]:
    """Return latest filename from file server directory listing, or None.

    imgMain  files: 20260320_12_M.jpg  (suffix _M)
    imgClient files: 20260320_12_C.jpg  (suffix _C)
    """
    suffix = "C" if img_base == "imgClient" else "M"
    url = f"{FILE_SERVER_URL}/{img_base}/{folder}/"
    try:
        with urllib.request.urlopen(url, timeout=3) as resp:
            html = resp.read().decode()
        filenames = re.findall(rf"(\d{{8}}_\d{{2}}_{suffix}\.jpg)", html)
        return sorted(filenames)[-1] if filenames else None
    except Exception:
        return None


# ---------------------------------------------------------------------------
# wimarc_db helpers — convert app station_id ↔ wimarc_info.id
# ---------------------------------------------------------------------------

def _station_to_wimarc_id(station_id: str) -> Optional[tuple[int, str]]:
    """Return (wimarc_info.id, table_name) for a station_id, or None.

    wimarc_info rows:
      id=1  set_name='wimarc01' type='M'  ← main  (weather)
      id=2  set_name='wimarc01' type='C'  ← client (soil)
      id=3  set_name='wimarc02' type='M'
      id=4  set_name='wimarc02' type='C'
      ...
      id=(N-1)*2+1  → wimarc{N} main
      id=(N-1)*2+2  → wimarc{N} client

    Returns (wimarc_id:int, source_table:'sensor'|'CAM_client')
    """
    # Client: wimarc{N}c
    m = re.match(r"wimarc(\d+)c$", station_id)
    if m:
        n = int(m.group(1))
        return ((n - 1) * 2 + 2, "CAM_client")
    # Main: wimarc{N}
    m = re.match(r"wimarc(\d+)$", station_id)
    if m:
        n = int(m.group(1))
        return ((n - 1) * 2 + 1, "sensor")
    return None


def _parse_float(val: Optional[str]) -> Optional[float]:
    """Parse float from string, handling commas (e.g. '1,003.00' → 1003.0)."""
    if val is None:
        return None
    try:
        return float(val.replace(",", ""))
    except (ValueError, AttributeError):
        return None


def _calc_vpd(temp_c: Optional[float], rh: Optional[float]) -> Optional[float]:
    """Calculate Vapour Pressure Deficit (kPa) from temperature (°C) and RH (%)."""
    if temp_c is None or rh is None:
        return None
    svp = 0.6108 * math.exp(17.27 * temp_c / (temp_c + 237.3))
    return round(svp * (1.0 - rh / 100.0), 3)


# Capacitive soil moisture sensor calibration
# Raw ADC: ~4096 = dry air, ~1500 = saturated soil (adjust per sensor)
_SOIL_DRY_ADC = 3800.0   # ADC value in air (0 % moisture)
_SOIL_WET_ADC = 1200.0   # ADC value in water (100 % moisture)


def _adc_to_moisture(adc: Optional[float]) -> Optional[float]:
    """Convert raw ADC to soil moisture percentage (0–100 %)."""
    if adc is None:
        return None
    pct = (_SOIL_DRY_ADC - adc) / (_SOIL_DRY_ADC - _SOIL_WET_ADC) * 100.0
    return round(max(0.0, min(100.0, pct)), 1)


def _real_readings_from_wimarc_db(
    wimarc_id: int,
    source_table: str,
    days: Optional[int],
    limit: int,
    wdb: Session,
) -> List[dict]:
    """Query real sensor data from wimarc_db and return as list of dicts
    matching SensorReadingOut field names.
    """
    if days:
        cutoff = datetime.utcnow() - timedelta(days=days)
        cutoff_date = cutoff.strftime("%Y-%m-%d")
        cutoff_time = cutoff.strftime("%H:%M:%S")
        date_filter = f"""
            AND (s.date > :cutoff_date
                 OR (s.date = :cutoff_date AND s.time >= :cutoff_time))
        """
        params: dict = {"wid": wimarc_id, "cutoff_date": cutoff_date,
                        "cutoff_time": cutoff_time, "limit": limit}
    else:
        date_filter = ""
        params = {"wid": wimarc_id, "limit": limit}

    if source_table == "sensor":
        sql = text(f"""
            SELECT s.date, s.time,
                   s."Temp"     AS temp,
                   s."Humid"    AS humid,
                   s."Rain"     AS rain,
                   s."WindS"    AS winds,
                   s."WindD"    AS windd,
                   s."Pressure" AS pressure,
                   s."Lux"      AS lux
            FROM sensor s
            WHERE s.wimarc_id = :wid
            {date_filter}
            ORDER BY s.date DESC, s.time DESC
            LIMIT :limit
        """)
        rows = wdb.execute(sql, params).mappings().all()

        results = []
        for r in rows:
            temp = _parse_float(r["temp"])
            humid = _parse_float(r["humid"])
            results.append({
                "id": f"real-{wimarc_id}-{r['date']}-{r['time'].replace(':','')}",
                "station_id": f"wimarc{(wimarc_id + 1) // 2}",
                "timestamp": datetime.strptime(f"{r['date']} {r['time'][:8]}", "%Y-%m-%d %H:%M:%S"),
                "air_temperature": temp,
                "relative_humidity": humid,
                "rainfall": _parse_float(r["rain"]),
                "wind_speed": _parse_float(r["winds"]),
                "wind_direction": _parse_float(r["windd"]),
                # "Pressure" column = supply voltage in mV (12V system), NOT barometric pressure
                # store as atmospheric_pressure field reused for supply_voltage_v (mV ÷ 1000)
                "atmospheric_pressure": round(_parse_float(r["pressure"]) / 1000, 3) if r["pressure"] else None,
                "light_intensity": _parse_float(r["lux"].replace(",", "")) if r["lux"] else None,
                "vpd": _calc_vpd(temp, humid),
                "soil_moisture1": None,
                "soil_moisture2": None,
            })
        return results

    else:  # CAM_client
        sql = text(f"""
            SELECT s.date, s.time,
                   s."A" AS a, s."B" AS b, s."C" AS c, s."D" AS d
            FROM "CAM_client" s
            WHERE s.wimarc_id = :wid
            {date_filter}
            ORDER BY s.date DESC, s.time DESC
            LIMIT :limit
        """)
        rows = wdb.execute(sql, params).mappings().all()

        results = []
        for r in rows:
            # N for client: wimarc_id is even, N = wimarc_id // 2
            n = wimarc_id // 2
            results.append({
                "id": f"real-{wimarc_id}-{r['date']}-{r['time'].replace(':','')}",
                "station_id": f"wimarc{n}c",
                "timestamp": datetime.strptime(f"{r['date']} {r['time'][:8]}", "%Y-%m-%d %H:%M:%S"),
                "air_temperature": None,
                "relative_humidity": None,
                "rainfall": None,
                "wind_speed": None,
                "wind_direction": None,
                "atmospheric_pressure": None,
                "light_intensity": None,
                "vpd": None,
                "soil_moisture1": _adc_to_moisture(_parse_float(r["a"])),
                "soil_moisture2": _adc_to_moisture(_parse_float(r["c"])),
            })
        return results


cors_origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "*").split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins or ["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:
        seed_data(session)


@app.get("/health")
def health_check() -> dict:
    return {"status": "ok"}


@app.post("/auth/login", response_model=UserOut)
def login(payload: AuthLogin, db: Session = Depends(get_db)) -> User:
    user = (
        db.query(User)
        .filter(User.username == payload.username, User.password == payload.password, User.is_enabled.is_(True))
        .first()
    )
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return user


@app.get("/stations", response_model=List[StationOut])
def list_stations(
    owner_id: Optional[str] = None,
    db: Session = Depends(get_db),
) -> List[Station]:
    query = db.query(Station)
    if owner_id:
        query = query.filter(Station.owner_id == owner_id)
    return query.order_by(Station.id).all()


@app.get("/stations/{station_id}", response_model=StationOut)
def get_station(station_id: str, db: Session = Depends(get_db)) -> Station:
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    return station


@app.post("/stations", response_model=StationOut, status_code=status.HTTP_201_CREATED)
def create_station(payload: StationCreate, db: Session = Depends(get_db)) -> Station:
    station_id = payload.id or f"station-{uuid4().hex[:8]}"
    if db.query(Station).filter(Station.id == station_id).first():
        raise HTTPException(status_code=409, detail="Station already exists")

    station = Station(
        id=station_id,
        name=payload.name,
        type=payload.type,
        owner_id=payload.owner_id,
        latitude=payload.latitude,
        longitude=payload.longitude,
        status=payload.status,
        last_data_time=payload.last_data_time,
        area=payload.area,
        description=payload.description,
    )
    db.add(station)
    db.commit()
    db.refresh(station)
    return station


@app.put("/stations/{station_id}", response_model=StationOut)
def update_station(station_id: str, payload: StationUpdate, db: Session = Depends(get_db)) -> Station:
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(station, key, value)

    db.commit()
    db.refresh(station)
    return station


@app.delete("/stations/{station_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_station(station_id: str, db: Session = Depends(get_db)) -> None:
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    db.delete(station)
    db.commit()


@app.get("/stations/{station_id}/images/latest", response_model=StationImageOut)
def get_latest_station_image(station_id: str, db: Session = Depends(get_db)):
    folder_info = _station_folder(station_id)
    if folder_info:
        img_base, folder = folder_info
        filename = _latest_image_from_server(img_base, folder)
        if filename:
            try:
                # Parse timestamp from filename: 20260411_14_M.jpg → 2026-04-11 14:00
                dt = datetime.strptime(filename[:11], "%Y%m%d_%H")
            except ValueError:
                dt = datetime.utcnow()
            return {
                "id": f"img-{station_id}-live",
                "station_id": station_id,
                "image_url": f"/media/{img_base}/{folder}/{filename}",
                "timestamp": dt,
            }

    # Fallback to database
    image = (
        db.query(StationImage)
        .filter(StationImage.station_id == station_id)
        .order_by(StationImage.timestamp.desc())
        .first()
    )
    if not image:
        raise HTTPException(status_code=404, detail="Station image not found")
    return image


@app.get("/stations/{station_id}/forecast", response_model=List[WeatherForecastOut])
def get_station_forecast(station_id: str, db: Session = Depends(get_db)) -> List[WeatherForecast]:
    return (
        db.query(WeatherForecast)
        .filter(WeatherForecast.station_id == station_id)
        .order_by(WeatherForecast.forecast_date.asc())
        .all()
    )


@app.get("/stations/{station_id}/live", response_model=LiveDataOut)
def get_live_data(
    station_id: str,
    wdb: Session = Depends(get_wimarc_db),
) -> dict:
    """Return real-time snapshot for a station.

    - last_ping   from updatedata  (device heartbeat, ~1 min cadence)
    - sensor data from sensor / CAM_client (last saved record, ~10 min cadence)
    - image_url   from file server directory listing (~1 hour cadence)
    """
    info = _station_to_wimarc_id(station_id)
    result: dict = {}

    if not info:
        return result

    wimarc_id, source_table = info
    is_client = source_table == "CAM_client"

    # ── 1. Last device ping from updatedata ───────────────────────────────
    ud_name = "CAM_client" if is_client else "CAM_main"
    try:
        row = wdb.execute(
            text('SELECT date, time FROM updatedata WHERE wimarc_id = :wid AND name = :name'),
            {"wid": wimarc_id, "name": ud_name},
        ).mappings().first()
        if row:
            result["last_ping"] = datetime.strptime(
                f"{row['date']} {row['time'][:8]}", "%Y-%m-%d %H:%M:%S"
            )
    except Exception:
        pass

    # ── 2. Latest decoded sensor values ───────────────────────────────────
    try:
        if not is_client:
            row = wdb.execute(
                text("""
                    SELECT date, time, "Temp", "Humid", "Rain", "WindS", "WindD", "Pressure", "Lux"
                    FROM sensor
                    WHERE wimarc_id = :wid
                    ORDER BY date DESC, time DESC
                    LIMIT 1
                """),
                {"wid": wimarc_id},
            ).mappings().first()
            if row:
                temp = _parse_float(row["Temp"])
                humid = _parse_float(row["Humid"])
                result.update({
                    "sensor_time": datetime.strptime(
                        f"{row['date']} {row['time'][:8]}", "%Y-%m-%d %H:%M:%S"
                    ),
                    "air_temperature": temp,
                    "relative_humidity": humid,
                    "rainfall": _parse_float(row["Rain"]),
                    "wind_speed": _parse_float(row["WindS"]),
                    "wind_direction": _parse_float(row["WindD"]),
                    # "Pressure" = supply voltage mV ÷ 1000 → V
                    "atmospheric_pressure": round(_parse_float(row["Pressure"]) / 1000, 3) if row["Pressure"] else None,
                    "light_intensity": _parse_float(row["Lux"].replace(",", "")) if row["Lux"] else None,
                    "vpd": _calc_vpd(temp, humid),
                })
        else:
            row = wdb.execute(
                text("""
                    SELECT date, time, "A", "C"
                    FROM "CAM_client"
                    WHERE wimarc_id = :wid
                    ORDER BY date DESC, time DESC
                    LIMIT 1
                """),
                {"wid": wimarc_id},
            ).mappings().first()
            if row:
                result.update({
                    "sensor_time": datetime.strptime(
                        f"{row['date']} {row['time'][:8]}", "%Y-%m-%d %H:%M:%S"
                    ),
                    "soil_moisture1": _adc_to_moisture(_parse_float(row["A"])),
                    "soil_moisture2": _adc_to_moisture(_parse_float(row["C"])),
                })
    except Exception:
        pass

    # ── 3. Latest image from file server ──────────────────────────────────
    folder_info = _station_folder(station_id)
    if folder_info:
        img_base, folder = folder_info
        try:
            filename = _latest_image_from_server(img_base, folder)
            if filename:
                result["image_url"] = f"/media/{img_base}/{folder}/{filename}"
                try:
                    result["image_time"] = datetime.strptime(filename[:11], "%Y%m%d_%H")
                except ValueError:
                    pass
        except Exception:
            pass

    return result


@app.get("/stations/{station_id}/readings", response_model=List[SensorReadingOut])
def list_readings(
    station_id: str,
    limit: int = Query(100, ge=1, le=1000),
    days: Optional[int] = Query(None, ge=1, le=365),
    db: Session = Depends(get_db),
    wdb: Session = Depends(get_wimarc_db),
) -> List[dict]:
    # ── Try real sensor data from wimarc_db first ──────────────────────────
    info = _station_to_wimarc_id(station_id)
    if info:
        wimarc_id, source_table = info
        try:
            real = _real_readings_from_wimarc_db(wimarc_id, source_table, days, limit, wdb)
            if real:
                return real
        except Exception:
            pass  # fall through to mock data

    # ── Fallback: mock sensor_readings table ───────────────────────────────
    query = db.query(SensorReading).filter(SensorReading.station_id == station_id)
    if days:
        start_date = datetime.utcnow() - timedelta(days=days)
        query = query.filter(SensorReading.timestamp >= start_date)
    return query.order_by(SensorReading.timestamp.desc()).limit(limit).all()


@app.post("/stations/{station_id}/readings", response_model=SensorReadingOut, status_code=status.HTTP_201_CREATED)
def create_reading(
    station_id: str, payload: SensorReadingCreate, db: Session = Depends(get_db)
) -> SensorReading:
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    reading = SensorReading(
        id=payload.id or f"reading-{uuid4().hex[:12]}",
        station_id=station_id,
        timestamp=payload.timestamp or datetime.utcnow(),
        air_temperature=payload.air_temperature,
        relative_humidity=payload.relative_humidity,
        light_intensity=payload.light_intensity,
        wind_direction=payload.wind_direction,
        wind_speed=payload.wind_speed,
        rainfall=payload.rainfall,
        atmospheric_pressure=payload.atmospheric_pressure,
        vpd=payload.vpd,
        soil_moisture1=payload.soil_moisture1,
        soil_moisture2=payload.soil_moisture2,
    )

    station.last_data_time = reading.timestamp
    db.add(reading)
    db.commit()
    db.refresh(reading)
    return reading


@app.get("/activities", response_model=List[PlotActivityOut])
def list_activities(
    station_id: Optional[str] = None, db: Session = Depends(get_db)
) -> List[PlotActivity]:
    query = db.query(PlotActivity)
    if station_id:
        query = query.filter(PlotActivity.station_id == station_id)
    return query.order_by(PlotActivity.date.desc()).all()


@app.post("/activities", response_model=PlotActivityOut, status_code=status.HTTP_201_CREATED)
def create_activity(payload: PlotActivityCreate, db: Session = Depends(get_db)) -> PlotActivity:
    activity = PlotActivity(
        id=payload.id or f"activity-{uuid4().hex[:12]}",
        station_id=payload.station_id,
        date=payload.date,
        activity_type=payload.activity_type,
        description=payload.description,
        created_by=payload.created_by,
        created_by_name=payload.created_by_name,
        images=payload.images,
    )

    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity


@app.put("/activities/{activity_id}", response_model=PlotActivityOut)
def update_activity(
    activity_id: str, payload: PlotActivityUpdate, db: Session = Depends(get_db)
) -> PlotActivity:
    activity = db.query(PlotActivity).filter(PlotActivity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(activity, key, value)

    db.commit()
    db.refresh(activity)
    return activity


@app.delete("/activities/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_activity(activity_id: str, db: Session = Depends(get_db)) -> None:
    activity = db.query(PlotActivity).filter(PlotActivity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    db.delete(activity)
    db.commit()


@app.get("/users", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db)) -> List[User]:
    return db.query(User).order_by(User.username).all()


@app.get("/users/{user_id}", response_model=UserOut)
def get_user(user_id: str, db: Session = Depends(get_db)) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@app.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db)) -> User:
    user_id = payload.id or f"user-{uuid4().hex[:8]}"
    if db.query(User).filter(User.id == user_id).first():
        raise HTTPException(status_code=409, detail="User already exists")

    user = User(
        id=user_id,
        username=payload.username,
        password=payload.password,
        role=payload.role,
        full_name=payload.full_name,
        email=payload.email,
        is_enabled=payload.is_enabled,
        permitted_station_ids=payload.permitted_station_ids,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.put("/users/{user_id}", response_model=UserOut)
def update_user(user_id: str, payload: UserUpdate, db: Session = Depends(get_db)) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)
    return user


@app.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: str, db: Session = Depends(get_db)) -> None:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()


@app.get("/sim-payments", response_model=List[SimPaymentOut])
def list_sim_payments(
    station_id: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
) -> List[SimPayment]:
    query = db.query(SimPayment)
    if station_id:
        query = query.filter(SimPayment.station_id == station_id)
    if status_filter:
        query = query.filter(SimPayment.status == status_filter)
    return query.order_by(SimPayment.due_date.desc()).all()


@app.post("/sim-payments", response_model=SimPaymentOut, status_code=status.HTTP_201_CREATED)
def create_sim_payment(payload: SimPaymentCreate, db: Session = Depends(get_db)) -> SimPayment:
    payment = SimPayment(
        id=payload.id or f"sim-{uuid4().hex[:10]}",
        station_id=payload.station_id,
        station_name=payload.station_name,
        sim_number=payload.sim_number,
        provider=payload.provider,
        amount=payload.amount,
        due_date=payload.due_date,
        status=payload.status,
        paid_date=payload.paid_date,
        notes=payload.notes,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


@app.put("/sim-payments/{payment_id}", response_model=SimPaymentOut)
def update_sim_payment(
    payment_id: str, payload: SimPaymentUpdate, db: Session = Depends(get_db)
) -> SimPayment:
    payment = db.query(SimPayment).filter(SimPayment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(payment, key, value)

    db.commit()
    db.refresh(payment)
    return payment


@app.delete("/sim-payments/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sim_payment(payment_id: str, db: Session = Depends(get_db)) -> None:
    payment = db.query(SimPayment).filter(SimPayment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    db.delete(payment)
    db.commit()
