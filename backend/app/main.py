import asyncio
import json
import math
import os
import re
import urllib.request
from datetime import date, datetime, timedelta
from typing import List, Optional
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from .db import Base, SessionLocal, engine, get_db, get_wimarc_db
from .models import PlotActivity, SensorReading, SimPayment, Station, StationImage, User, WeatherForecast
from .schemas import (
    AuthLogin,
    GoogleAuthRequest,
    LiveDataOut,
    LoginResponse,
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

# ---------------------------------------------------------------------------
# JWT Auth
# ---------------------------------------------------------------------------
import jwt as _jwt
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

_JWT_SECRET = os.getenv("JWT_SECRET", "wimarc-dev-secret-change-in-production")
_JWT_ALGORITHM = "HS256"
_JWT_EXPIRE_HOURS = 24
_bearer = HTTPBearer(auto_error=False)


def _create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=_JWT_EXPIRE_HOURS),
    }
    return _jwt.encode(payload, _JWT_SECRET, algorithm=_JWT_ALGORITHM)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = _jwt.decode(credentials.credentials, _JWT_SECRET, algorithms=[_JWT_ALGORITHM])
        user_id: str = payload.get("sub", "")
    except _jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except _jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.id == user_id, User.is_enabled.is_(True)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found or disabled")
    return user


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


def _latest_image_from_server(
    img_base: str, folder: str
) -> Optional[tuple[str, Optional[datetime]]]:
    """Return (latest_filename, mtime) from file server, or None.

    imgMain  files: 20260320_12_M.jpg  (suffix _M)
    imgClient files: 20260320_12_C.jpg  (suffix _C)

    mtime is parsed from the directory listing's "Last modified" column
    (format YYYY-MM-DD HH:MM), giving minute-level precision when the
    filename only encodes the hour.
    """
    suffix = "C" if img_base == "imgClient" else "M"
    url = f"{FILE_SERVER_URL}/{img_base}/{folder}/"
    try:
        with urllib.request.urlopen(url, timeout=3) as resp:
            html = resp.read().decode()
        # Capture filename + modified-time from each row
        pattern = rf'href="(\d{{8}}_\d{{2}}_{suffix}\.jpg)"[^<]*</a></td><td[^>]*>(\d{{4}}-\d{{2}}-\d{{2}} \d{{2}}:\d{{2}})'
        matches = re.findall(pattern, html)
        if not matches:
            # Fallback: filename only
            filenames = re.findall(rf"(\d{{8}}_\d{{2}}_{suffix}\.jpg)", html)
            return (sorted(filenames)[-1], None) if filenames else None
        # Pick latest by filename order (filenames are date_hour sortable)
        matches.sort(key=lambda x: x[0])
        latest_name, latest_mtime_str = matches[-1]
        try:
            mtime = datetime.strptime(latest_mtime_str, "%Y-%m-%d %H:%M")
        except ValueError:
            mtime = None
        return latest_name, mtime
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


def _parse_float(val) -> Optional[float]:
    """Parse float from string or numeric, handling commas (e.g. '1,003.00' → 1003.0)."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    try:
        return float(str(val).replace(",", ""))
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


# CAM_client B/D columns store soil temperature as raw count = °C × 40
# (e.g. raw 1012 → 25.3 °C). Adjust scale if calibration differs.
_SOIL_TEMP_SCALE = 40.0


def _raw_to_soil_temp(raw: Optional[float]) -> Optional[float]:
    """Convert CAM_client B/D raw count to soil temperature (°C)."""
    if raw is None:
        return None
    return round(raw / _SOIL_TEMP_SCALE, 1)


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
        # Use sensor_1min (has raw E for pressure + G for battery; sensor table's Pressure column stores wrong data)
        sql = text(f"""
            SELECT s.date, s.time,
                   s."Temp"  AS temp,
                   s."Humid" AS humid,
                   s."Rain"  AS rain,
                   s."WindS" AS winds,
                   s."WindD" AS windd,
                   s."E"     AS pressure,
                   s."Lux"   AS lux
            FROM sensor_1min s
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
            date_str = str(r["date"])
            time_str = str(r["time"])[:8]
            lux_val = r["lux"]
            results.append({
                "id": f"real-{wimarc_id}-{date_str}-{time_str.replace(':','')}",
                "station_id": f"wimarc{(wimarc_id + 1) // 2}",
                "timestamp": datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M:%S"),
                "air_temperature": temp,
                "relative_humidity": humid,
                "rainfall": _parse_float(r["rain"]),
                "wind_speed": _parse_float(r["winds"]),
                "wind_direction": _parse_float(r["windd"]),
                # sensor_1min.E = barometric pressure (hPa, direct)
                "atmospheric_pressure": (lambda v: round(v, 1) if v is not None else None)(_parse_float(r["pressure"])) if r["pressure"] is not None else None,
                "light_intensity": _parse_float(str(lux_val).replace(",", "")) if lux_val is not None else None,
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
                "soil_temperature1": _raw_to_soil_temp(_parse_float(r["b"])),
                "soil_temperature2": _raw_to_soil_temp(_parse_float(r["d"])),
            })
        return results


_OPEN_PATHS = frozenset({"/health", "/auth/login", "/auth/google", "/docs", "/openapi.json", "/redoc"})
_OPEN_PREFIXES = ("/docs", "/openapi", "/redoc")


@app.middleware("http")
async def _jwt_auth_middleware(request: Request, call_next):
    path = request.url.path
    if (
        path in _OPEN_PATHS
        or any(path.startswith(p) for p in _OPEN_PREFIXES)
        or request.method == "OPTIONS"
        or request.method == "GET"
        or (request.method == "POST" and re.match(r"^/stations/[^/]+/readings$", path))
    ):
        return await call_next(request)

    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return JSONResponse({"detail": "Not authenticated"}, status_code=401)
    try:
        _jwt.decode(auth[7:], _JWT_SECRET, algorithms=[_JWT_ALGORITHM])
    except _jwt.ExpiredSignatureError:
        return JSONResponse({"detail": "Token expired"}, status_code=401)
    except _jwt.InvalidTokenError:
        return JSONResponse({"detail": "Invalid token"}, status_code=401)
    return await call_next(request)


cors_origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "*").split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins or ["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _daily_forecast_refresh():
    """Background task: refresh Open-Meteo forecasts once at startup, then every 12 h."""
    await asyncio.sleep(10)  # wait for DB to be ready
    while True:
        try:
            with SessionLocal() as session:
                stations = session.query(Station).filter(Station.type == "weather").all()
                for s in stations:
                    _refresh_forecast_for_station(s, session)
        except Exception as exc:
            print(f"[forecast-bg] error: {exc}")
        await asyncio.sleep(12 * 3600)  # re-run every 12 h


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    # Migration: add created_at column to weather_forecasts if missing (forecast history A)
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE weather_forecasts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()"))
            conn.commit()
        except Exception as e:
            print(f"[migration] weather_forecasts.created_at: {e}")
    with SessionLocal() as session:
        seed_data(session)
    asyncio.create_task(_daily_forecast_refresh())


@app.get("/health")
def health_check(
    db: Session = Depends(get_db),
    wdb: Session = Depends(get_wimarc_db),
) -> dict:
    import psutil  # psutil may not be installed; graceful fallback
    result: dict = {"status": "ok", "timestamp": datetime.utcnow().isoformat()}

    # --- App DB ---
    try:
        db.execute(text("SELECT 1"))
        result["db_app"] = "ok"
    except Exception as e:
        result["db_app"] = f"error: {e}"
        result["status"] = "degraded"

    # --- WiMaRC DB ---
    try:
        wdb.execute(text("SELECT 1"))
        result["db_wimarc"] = "ok"
    except Exception as e:
        result["db_wimarc"] = f"error: {e}"
        result["status"] = "degraded"

    # --- File server ---
    try:
        with urllib.request.urlopen(FILE_SERVER_URL + "/", timeout=3) as r:
            result["file_server"] = "ok" if r.status < 400 else f"http {r.status}"
    except Exception as e:
        result["file_server"] = f"error: {e}"
        result["status"] = "degraded"

    # --- System resources (optional, requires psutil) ---
    try:
        result["cpu_percent"] = psutil.cpu_percent(interval=0.1)
        mem = psutil.virtual_memory()
        result["mem_used_mb"] = round(mem.used / 1024 / 1024)
        result["mem_total_mb"] = round(mem.total / 1024 / 1024)
        result["mem_percent"] = mem.percent
        disk = psutil.disk_usage("/")
        result["disk_used_gb"] = round(disk.used / 1024 ** 3, 1)
        result["disk_total_gb"] = round(disk.total / 1024 ** 3, 1)
        result["disk_percent"] = disk.percent
    except Exception:
        pass  # psutil not installed — skip

    return result


# ---------------------------------------------------------------------------
# Weather forecast — Open-Meteo (free, no key, per station lat/lng)
# ---------------------------------------------------------------------------

_WMO_DESC = {
    0: "แจ่มใส", 1: "แจ่มใส", 2: "มีเมฆบางส่วน", 3: "เมฆมาก",
    45: "หมอก", 48: "หมอก",
    51: "ฝนปรอย", 53: "ฝนปรอย", 55: "ฝนปรอยหนัก",
    61: "ฝนเบา", 63: "ฝนตก", 65: "ฝนหนัก",
    80: "ฝนตก", 81: "ฝนตกหนัก", 82: "ฝนตกหนักมาก",
    95: "พายุฝนฟ้าคะนอง", 96: "พายุฝนฟ้าคะนอง", 99: "พายุฝนฟ้าคะนองรุนแรง",
}

def _wmo_to_desc(code: int) -> str:
    return _WMO_DESC.get(code, "มีเมฆ")


def _refresh_forecast_for_station(station: Station, session: Session) -> int:
    """Fetch 7-day forecast from Open-Meteo for station lat/lng and upsert to DB.
    Returns number of days upserted, or 0 on failure."""
    if station.latitude is None or station.longitude is None:
        return 0
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={station.latitude}&longitude={station.longitude}"
        f"&daily=temperature_2m_mean,precipitation_probability_max,precipitation_sum,weathercode"
        f"&timezone=Asia%2FBangkok&forecast_days=7"
    )
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            data = json.loads(resp.read())
        daily = data.get("daily", {})
        times = daily.get("time", [])
        temps = daily.get("temperature_2m_mean", [])
        probs = daily.get("precipitation_probability_max", [])
        rains = daily.get("precipitation_sum", [])
        codes = daily.get("weathercode", [])

        # INSERT new snapshot every refresh (keep historical forecasts; never overwrite/delete)
        snapshot_ts = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        for i, t in enumerate(times):
            forecast_date = date.fromisoformat(t)
            row_id = f"om-{station.id}-{t}-{snapshot_ts}"
            vals = dict(
                station_id=station.id,
                forecast_date=forecast_date,
                temperature=round(float(temps[i]), 1) if i < len(temps) and temps[i] is not None else 30.0,
                rain_probability=round(float(probs[i]), 1) if i < len(probs) and probs[i] is not None else 0.0,
                rainfall=round(float(rains[i]), 1) if i < len(rains) and rains[i] is not None else 0.0,
                description=_wmo_to_desc(int(codes[i])) if i < len(codes) and codes[i] is not None else "มีเมฆ",
            )
            session.add(WeatherForecast(id=row_id, **vals))

        session.commit()
        return len(times)
    except Exception as exc:
        session.rollback()
        print(f"[forecast] {station.id} failed: {exc}")
        return 0


@app.post("/admin/forecasts/refresh")
def admin_refresh_forecasts(db: Session = Depends(get_db)) -> dict:
    """Refresh Open-Meteo forecasts for all weather stations."""
    stations = db.query(Station).filter(Station.type == "weather").all()
    results = {}
    for s in stations:
        n = _refresh_forecast_for_station(s, db)
        results[s.id] = n
    return {"refreshed": results}


# ---------------------------------------------------------------------------
# TMD (กรมอุตุนิยมวิทยา) forecast — requires TMD_API_KEY env var
# ---------------------------------------------------------------------------

_TMD_API_KEY = os.getenv("TMD_API_KEY", "")
_TMD_PROXY_URL = os.getenv("TMD_PROXY_URL", "http://wimarc-api:8000")


@app.get("/stations/{station_id}/tmd-forecast")
def get_tmd_forecast(station_id: str, db: Session = Depends(get_db)):
    """Daily forecast from กรมอุตุนิยมวิทยา via wimarc-api proxy (cached)."""
    if not _TMD_API_KEY:
        return {"no_key": True, "forecasts": []}

    station = db.query(Station).filter(Station.id == station_id).first()
    if not station or station.latitude is None or station.longitude is None:
        raise HTTPException(status_code=404, detail="Station not found or missing coordinates")

    url = (
        f"{_TMD_PROXY_URL}/weather/by-coordinates"
        f"?lat={station.latitude}&lon={station.longitude}"
        f"&type=hourly&duration=168"
    )
    try:
        req = urllib.request.Request(url, headers={"accept": "application/json"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            payload = json.loads(resp.read())

        data = payload.get("data", {})
        forecasts = data.get("WeatherForecasts", [{}])[0].get("forecasts", [])

        daily: dict = {}
        for f in forecasts:
            day_key = f.get("time", "")[:10]
            d = f.get("data", {})
            if not day_key:
                continue
            if day_key not in daily:
                daily[day_key] = {"tc": [], "rh": [], "rain": [], "ws10m": [], "wd10m": []}
            for field in ("tc", "rh", "rain", "ws10m", "wd10m"):
                if d.get(field) is not None:
                    daily[day_key][field].append(float(d[field]))

        result = []
        for day_key in sorted(daily.keys()):
            day = daily[day_key]
            # Circular mean for wind direction (degrees)
            wd = None
            if day["wd10m"]:
                from math import sin, cos, atan2, radians, degrees
                u = sum(sin(radians(x)) for x in day["wd10m"]) / len(day["wd10m"])
                v = sum(cos(radians(x)) for x in day["wd10m"]) / len(day["wd10m"])
                wd = (degrees(atan2(u, v)) + 360) % 360
            result.append({
                "date": day_key,
                "avgTemp": round(sum(day["tc"]) / len(day["tc"]), 1) if day["tc"] else None,
                "avgHumidity": round(sum(day["rh"]) / len(day["rh"]), 0) if day["rh"] else None,
                "totalRain": round(sum(day["rain"]), 1) if day["rain"] else None,
                "avgWindSpeed": round(sum(day["ws10m"]) / len(day["ws10m"]), 1) if day["ws10m"] else None,
                "avgWindDir": round(wd, 0) if wd is not None else None,
            })

        return {"no_key": False, "forecasts": result}
    except Exception as exc:
        print(f"[tmd-forecast] {station_id} failed: {exc}")
        return {"no_key": False, "forecasts": [], "error": str(exc)}


@app.post("/stations/{station_id}/forecast/refresh")
def refresh_station_forecast(station_id: str, db: Session = Depends(get_db)) -> dict:
    """Refresh Open-Meteo forecast for a single station."""
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    n = _refresh_forecast_for_station(station, db)
    return {"station_id": station_id, "days_upserted": n}


@app.get("/stations/{station_id}/openmeteo-forecast")
def get_openmeteo_forecast(station_id: str, db: Session = Depends(get_db)):
    """7-day forecast from Open-Meteo (free, no auth). TMD-compatible shape."""
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station or station.latitude is None or station.longitude is None:
        raise HTTPException(status_code=404, detail="Station not found or missing coordinates")

    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={station.latitude}&longitude={station.longitude}"
        f"&daily=temperature_2m_mean,relative_humidity_2m_mean,precipitation_sum,"
        f"wind_speed_10m_max,wind_direction_10m_dominant"
        f"&timezone=Asia%2FBangkok&forecast_days=7"
    )
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            data = json.loads(resp.read())
        daily = data.get("daily", {})
        times = daily.get("time", [])
        temps = daily.get("temperature_2m_mean", [])
        rhs = daily.get("relative_humidity_2m_mean", [])
        rains = daily.get("precipitation_sum", [])
        winds = daily.get("wind_speed_10m_max", [])
        wdirs = daily.get("wind_direction_10m_dominant", [])

        def _f(arr, i, nd=1):
            if i < len(arr) and arr[i] is not None:
                return round(float(arr[i]), nd)
            return None

        result = []
        for i, t in enumerate(times):
            # Open-Meteo wind_speed_10m_max is km/h — convert to m/s for TMD parity
            ws_kmh = _f(winds, i, 2)
            ws_ms = round(ws_kmh / 3.6, 1) if ws_kmh is not None else None
            result.append({
                "date": t,
                "avgTemp": _f(temps, i, 1),
                "avgHumidity": _f(rhs, i, 0),
                "totalRain": _f(rains, i, 1),
                "avgWindSpeed": ws_ms,
                "avgWindDir": _f(wdirs, i, 0),
            })

        return {"no_key": False, "forecasts": result}
    except Exception as exc:
        print(f"[openmeteo-forecast] {station_id} failed: {exc}")
        return {"no_key": False, "forecasts": [], "error": str(exc)}


@app.post("/auth/login", response_model=LoginResponse)
def login(payload: AuthLogin, db: Session = Depends(get_db)) -> dict:
    user = (
        db.query(User)
        .filter(User.username == payload.username, User.password == payload.password, User.is_enabled.is_(True))
        .first()
    )
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"token": _create_token(user.id, user.role), "user": user}


@app.post("/auth/google", response_model=LoginResponse)
def google_login(payload: GoogleAuthRequest, db: Session = Depends(get_db)) -> dict:
    """Exchange a Google OAuth access token for a WiMaRC JWT."""
    try:
        req = urllib.request.Request(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {payload.access_token}"},
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            info = json.loads(resp.read())
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    email = info.get("email")
    if not email:
        raise HTTPException(status_code=401, detail="No email in Google profile")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            id=f"g-{uuid4().hex[:8]}",
            username=email,
            password="",
            role="G",
            full_name=info.get("name", email),
            email=email,
            is_enabled=True,
            permitted_station_ids=[],
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    elif not user.is_enabled:
        raise HTTPException(status_code=403, detail="Account disabled")

    return {"token": _create_token(user.id, user.role), "user": user}


@app.get("/stations", response_model=List[StationOut])
def list_stations(
    owner_id: Optional[str] = None,
    db: Session = Depends(get_db),
    wdb: Session = Depends(get_wimarc_db),
) -> List[Station]:
    query = db.query(Station)
    if owner_id:
        query = query.filter(Station.owner_id == owner_id)
    stations = query.order_by(Station.id).all()

    # Enrich with real-time status from wimarc_db
    try:
        ud_rows = wdb.execute(text('SELECT wimarc_id, name, date, time FROM updatedata')).mappings().all()
        ud_map = {}
        for r in ud_rows:
            try:
                ud_map[(r['wimarc_id'], r['name'])] = datetime.strptime(
                    f"{r['date']} {str(r['time'])[:8]}", "%Y-%m-%d %H:%M:%S"
                )
            except Exception:
                pass
                
        now = datetime.utcnow()
        for s in stations:
            info = _station_to_wimarc_id(s.id)
            if info:
                wid, source = info
                ud_name = "CAM_client" if source == "CAM_client" else "CAM_main"
                last_ping = ud_map.get((wid, ud_name))
                if last_ping:
                    s.last_data_time = last_ping
                    s.status = "offline" if now - last_ping > timedelta(minutes=30) else "online"
                else:
                    s.status = "offline"
    except Exception:
        pass
        
    return stations


@app.get("/stations/{station_id}", response_model=StationOut)
def get_station(station_id: str, db: Session = Depends(get_db), wdb: Session = Depends(get_wimarc_db)) -> Station:
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    # Enrich with real-time status
    try:
        info = _station_to_wimarc_id(station_id)
        if info:
            wid, source = info
            ud_name = "CAM_client" if source == "CAM_client" else "CAM_main"
            row = wdb.execute(
                text('SELECT date, time FROM updatedata WHERE wimarc_id = :wid AND name = :name'),
                {"wid": wid, "name": ud_name},
            ).mappings().first()
            if row:
                last_ping = datetime.strptime(f"{row['date']} {str(row['time'])[:8]}", "%Y-%m-%d %H:%M:%S")
                station.last_data_time = last_ping
                station.status = "offline" if datetime.utcnow() - last_ping > timedelta(minutes=30) else "online"
            else:
                station.status = "offline"
    except Exception:
        pass

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


def _today_images_from_server(
    img_base: str, folder: str, date: Optional[datetime] = None
) -> list[dict]:
    """Return list of {image_url, timestamp} for all images on a given date (default today)."""
    suffix = "C" if img_base == "imgClient" else "M"
    if date is None:
        date = datetime.utcnow()
    date_prefix = date.strftime("%Y%m%d")
    url = f"{FILE_SERVER_URL}/{img_base}/{folder}/"
    try:
        with urllib.request.urlopen(url, timeout=3) as resp:
            html = resp.read().decode()
        pattern = rf'href="({date_prefix}_\d{{2}}_{suffix}\.jpg)"[^<]*</a></td><td[^>]*>(\d{{4}}-\d{{2}}-\d{{2}} \d{{2}}:\d{{2}})'
        matches = re.findall(pattern, html)
        if not matches:
            filenames = re.findall(rf"({date_prefix}_\d{{2}}_{suffix}\.jpg)", html)
            matches = [(f, None) for f in filenames]
        results = []
        for filename, mtime_str in sorted(matches, key=lambda x: x[0]):
            try:
                ts = datetime.strptime(mtime_str, "%Y-%m-%d %H:%M") if mtime_str else datetime.strptime(filename[:11], "%Y%m%d_%H")
            except (ValueError, TypeError):
                ts = date
            results.append({
                "image_url": f"/media/{img_base}/{folder}/{filename}",
                "timestamp": ts,
            })
        return results
    except Exception:
        return []


@app.get("/stations/{station_id}/images/today")
def get_today_station_images(station_id: str):
    folder_info = _station_folder(station_id)
    if not folder_info:
        return []
    img_base, folder = folder_info
    return _today_images_from_server(img_base, folder)


@app.get("/stations/{station_id}/images/latest", response_model=StationImageOut)
def get_latest_station_image(station_id: str, db: Session = Depends(get_db)):
    folder_info = _station_folder(station_id)
    if folder_info:
        img_base, folder = folder_info
        latest = _latest_image_from_server(img_base, folder)
        if latest:
            filename, mtime = latest
            if mtime is None:
                try:
                    mtime = datetime.strptime(filename[:11], "%Y%m%d_%H")
                except ValueError:
                    mtime = datetime.utcnow()
            return {
                "id": f"img-{station_id}-live",
                "station_id": station_id,
                "image_url": f"/media/{img_base}/{folder}/{filename}",
                "timestamp": mtime,
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
    """Latest forecast snapshot per forecast_date (deduplicate historical snapshots)."""
    from sqlalchemy import func as sa_func
    # Subquery: max created_at per forecast_date
    sub = (
        db.query(
            WeatherForecast.forecast_date.label("fd"),
            sa_func.max(WeatherForecast.created_at).label("max_created")
        )
        .filter(WeatherForecast.station_id == station_id)
        .group_by(WeatherForecast.forecast_date)
        .subquery()
    )
    return (
        db.query(WeatherForecast)
        .join(sub, (WeatherForecast.forecast_date == sub.c.fd) & (WeatherForecast.created_at == sub.c.max_created))
        .filter(WeatherForecast.station_id == station_id)
        .order_by(WeatherForecast.forecast_date.asc())
        .all()
    )


@app.get("/stations/{station_id}/forecast/history")
def get_forecast_history(
    station_id: str,
    days: int = Query(7, ge=1, le=90),
    db: Session = Depends(get_db),
) -> List[dict]:
    """Historical forecasts for the past N days — latest snapshot per past day."""
    from sqlalchemy import func as sa_func
    cutoff = date.today() - timedelta(days=days)
    # Latest snapshot per forecast_date in past N days
    sub = (
        db.query(
            WeatherForecast.forecast_date.label("fd"),
            sa_func.max(WeatherForecast.created_at).label("max_created")
        )
        .filter(
            WeatherForecast.station_id == station_id,
            WeatherForecast.forecast_date >= cutoff,
            WeatherForecast.forecast_date <= date.today(),
        )
        .group_by(WeatherForecast.forecast_date)
        .subquery()
    )
    rows = (
        db.query(WeatherForecast)
        .join(sub, (WeatherForecast.forecast_date == sub.c.fd) & (WeatherForecast.created_at == sub.c.max_created))
        .filter(WeatherForecast.station_id == station_id)
        .order_by(WeatherForecast.forecast_date.asc())
        .all()
    )
    return [{
        "date": r.forecast_date.isoformat(),
        "temperature": r.temperature,
        "rainfall": r.rainfall,
        "rain_probability": r.rain_probability,
        "description": r.description,
        "snapshot_at": r.created_at.isoformat() if r.created_at else None,
    } for r in rows]


@app.get("/stations/{station_id}/live", response_model=LiveDataOut)
def get_live_data(
    station_id: str,
    wdb: Session = Depends(get_wimarc_db),
) -> dict:
    """Return real-time snapshot for a station.

    - last_ping   from updatedata        (device heartbeat, ~1 min cadence)
    - weather     from sensor_1min       (decoded sensor, ~1 min cadence)
    - client      from updatedata        (raw A/B/C/D, ~1 min cadence)
    - image_url   from file server directory listing (~1 min cadence)
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
                f"{row['date']} {str(row['time'])[:8]}", "%Y-%m-%d %H:%M:%S"
            )
    except Exception:
        pass

    # ── 2. Latest sensor values (1-min cadence) ───────────────────────────
    try:
        if not is_client:
            # Weather station — decoded values from sensor_1min table
            row = wdb.execute(
                text("""
                    SELECT date, time, "Temp", "Humid", "Rain", "WindS", "WindD", "Pressure", "Lux"
                    FROM sensor_1min
                    WHERE wimarc_id = :wid
                    ORDER BY date DESC, time DESC
                    LIMIT 1
                """),
                {"wid": wimarc_id},
            ).mappings().first()
            if row:
                temp = _parse_float(str(row["Temp"])) if row["Temp"] is not None else None
                humid = _parse_float(str(row["Humid"])) if row["Humid"] is not None else None
                lux = row["Lux"]
                result.update({
                    "sensor_time": datetime.strptime(
                        f"{row['date']} {str(row['time'])[:8]}", "%Y-%m-%d %H:%M:%S"
                    ),
                    "air_temperature": temp,
                    "relative_humidity": humid,
                    "rainfall": _parse_float(str(row["Rain"])) if row["Rain"] is not None else None,
                    "wind_speed": _parse_float(str(row["WindS"])) if row["WindS"] is not None else None,
                    "wind_direction": _parse_float(str(row["WindD"])) if row["WindD"] is not None else None,
                    "light_intensity": float(lux) if lux else None,
                    "vpd": _calc_vpd(temp, humid),
                })

            # Barometric pressure (E) + Battery voltage (G) — fetch raw from updatedata
            raw_row = wdb.execute(
                text('SELECT "E", "G" FROM updatedata WHERE wimarc_id = :wid AND name = :name'),
                {"wid": wimarc_id, "name": "CAM_main"},
            ).mappings().first()
            if raw_row:
                if raw_row["E"] not in (None, "", "0", "z"):
                    try:
                        result["atmospheric_pressure"] = round(float(raw_row["E"]), 1)
                    except (ValueError, TypeError):
                        pass
                if raw_row["G"] not in (None, "", "0", "z"):
                    try:
                        result["battery_voltage"] = round(float(raw_row["G"]) / 1000, 2)
                    except (ValueError, TypeError):
                        pass
        else:
            # Client station — raw values from updatedata (1-min cadence)
            row = wdb.execute(
                text("""
                    SELECT date, time, "A", "B", "C", "D"
                    FROM updatedata
                    WHERE wimarc_id = :wid AND name = 'CAM_client'
                """),
                {"wid": wimarc_id},
            ).mappings().first()
            if row and row["A"] not in (None, "0", "z"):
                result.update({
                    "sensor_time": datetime.strptime(
                        f"{row['date']} {str(row['time'])[:8]}", "%Y-%m-%d %H:%M:%S"
                    ),
                    "soil_moisture1": _adc_to_moisture(_parse_float(row["A"])),
                    "soil_moisture2": _adc_to_moisture(_parse_float(row["C"])),
                    "soil_temperature1": _raw_to_soil_temp(_parse_float(row["B"])),
                    "soil_temperature2": _raw_to_soil_temp(_parse_float(row["D"])),
                })
            else:
                # Fallback to CAM_client (10-min) if updatedata empty
                row = wdb.execute(
                    text("""
                        SELECT date, time, "A", "B", "C", "D"
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
                            f"{row['date']} {str(row['time'])[:8]}", "%Y-%m-%d %H:%M:%S"
                        ),
                        "soil_moisture1": _adc_to_moisture(_parse_float(row["A"])),
                        "soil_moisture2": _adc_to_moisture(_parse_float(row["C"])),
                        "soil_temperature1": _raw_to_soil_temp(_parse_float(row["B"])),
                        "soil_temperature2": _raw_to_soil_temp(_parse_float(row["D"])),
                    })
    except Exception:
        pass

    # ── 3. Latest image from file server ──────────────────────────────────
    folder_info = _station_folder(station_id)
    if folder_info:
        img_base, folder = folder_info
        try:
            latest = _latest_image_from_server(img_base, folder)
            if latest:
                filename, mtime = latest
                result["image_url"] = f"/media/{img_base}/{folder}/{filename}"
                if mtime is not None:
                    result["image_time"] = mtime
                else:
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
    limit: int = Query(100, ge=1, le=50000),
    days: Optional[int] = Query(None, ge=1, le=365),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    wdb: Session = Depends(get_wimarc_db),
) -> List[dict]:
    # Parse custom date range
    dt_start: Optional[datetime] = None
    dt_end: Optional[datetime] = None
    if start_date:
        try:
            dt_start = datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            pass
    if end_date:
        try:
            dt_end = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
        except ValueError:
            pass
    if dt_start is None and days:
        dt_start = datetime.utcnow() - timedelta(days=days)

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
    if dt_start:
        query = query.filter(SensorReading.timestamp >= dt_start)
    if dt_end:
        query = query.filter(SensorReading.timestamp < dt_end)
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
