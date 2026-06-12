import asyncio
import json
import math
import os
import re
import secrets
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
    RegisterRequest,
    UserOut,
    UserUpdate,
    WeatherForecastOut,
)
from .seed import seed_data

# ---------------------------------------------------------------------------
# JWT Auth + Password Hashing + Rate Limiting
# ---------------------------------------------------------------------------
import jwt as _jwt
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

_JWT_SECRET = os.getenv("JWT_SECRET", "wimarc-dev-secret-change-in-production")
_JWT_ALGORITHM = "HS256"
_JWT_EXPIRE_HOURS = 24
_bearer = HTTPBearer(auto_error=False)

_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _get_real_ip(request: Request) -> str:
    """Real client IP — always use the direct connection IP (not spoofable headers)."""
    return request.client.host if request.client else "127.0.0.1"


_limiter = Limiter(key_func=_get_real_ip)


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


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def require_not_guest(current_user: User = Depends(get_current_user)) -> User:
    """Block Guest from write actions and download/image features (read-only role)."""
    if current_user.role == "Guest":
        raise HTTPException(status_code=403, detail="Guest is read-only")
    return current_user


def _can_read_station(user: User, station_id: str) -> bool:
    """Admin: all. Guest: any station (read-only live/forecast). User: only permitted."""
    if user.role == "Admin":
        return True
    if user.role == "Guest":
        return True
    return station_id in (user.permitted_station_ids or [])


_is_dev = os.getenv("ENV", "production").lower() == "dev"
app = FastAPI(
    title="WiMaRC API",
    version="0.1.0",
    docs_url="/docs" if _is_dev else None,
    redoc_url="/redoc" if _is_dev else None,
    openapi_url="/openapi.json" if _is_dev else None,
)
app.state.limiter = _limiter
app.add_exception_handler(
    RateLimitExceeded,
    lambda req, exc: JSONResponse({"detail": "Too many requests — try again later"}, status_code=429),
)
app.add_middleware(SlowAPIMiddleware)

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
    dt_start: Optional[datetime] = None,
    dt_end: Optional[datetime] = None,
) -> List[dict]:
    """Query real sensor data from wimarc_db and return as list of dicts
    matching SensorReadingOut field names.
    """
    BKK_OFFSET = timedelta(hours=7)
    if dt_start or days:
        if dt_start is None:
            # Use Bangkok time for cutoff so date/time comparison matches sensor storage
            dt_start = datetime.utcnow() + BKK_OFFSET - timedelta(days=days)
        cutoff_date = dt_start.strftime("%Y-%m-%d")
        cutoff_time = dt_start.strftime("%H:%M:%S")
        date_filter = f"""
            AND (s.date > :cutoff_date
                 OR (s.date = :cutoff_date AND s.time >= :cutoff_time))
        """
        params: dict = {"wid": wimarc_id, "cutoff_date": cutoff_date,
                        "cutoff_time": cutoff_time, "limit": limit}
        if dt_end:
            end_date = dt_end.strftime("%Y-%m-%d")
            end_time = dt_end.strftime("%H:%M:%S")
            date_filter += " AND (s.date < :end_date OR (s.date = :end_date AND s.time < :end_time))"
            params["end_date"] = end_date
            params["end_time"] = end_time
    else:
        date_filter = ""
        params = {"wid": wimarc_id, "limit": limit}

    if source_table == "sensor":
        # Use sensor table (10-min cadence); JOIN sensor_1min for correct pressure (sensor.Pressure stores wrong data)
        sql = text(f"""
            SELECT s.date, s.time,
                   s."Temp"  AS temp,
                   s."Humid" AS humid,
                   s."Rain"  AS rain,
                   s."WindS" AS winds,
                   s."WindD" AS windd,
                   s1."E"    AS pressure,
                   s."Lux"   AS lux
            FROM sensor s
            LEFT JOIN sensor_1min s1
                   ON s1.wimarc_id = s.wimarc_id
                  AND s1.date::text = s.date
                  AND s1.time::text = s.time
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
        main_wid = wimarc_id - 1

        # Query 1: soil data
        soil_sql = text(f"""
            SELECT s.date, s.time,
                   s."A" AS a, s."B" AS b, s."C" AS c, s."D" AS d
            FROM "CAM_client" s
            WHERE s.wimarc_id = :wid
            {date_filter}
            ORDER BY s.date DESC, s.time DESC
            LIMIT :limit
        """)
        rows = wdb.execute(soil_sql, params).mappings().all()
        if not rows:
            return []

        # Query 2: rainfall from main sensor for same date range (single query, fast)
        rain_params = {k: v for k, v in params.items() if k != "limit"}
        rain_params["wid"] = main_wid
        rain_sql = text(f"""
            SELECT s.date, s.time, s."Rain" AS rain
            FROM sensor s
            WHERE s.wimarc_id = :wid
            {date_filter}
        """)
        rain_rows = wdb.execute(rain_sql, rain_params).mappings().all()

        # Build rain lookup: (date_str, HH:MM rounded to 10min) -> rain value
        rain_map: dict = {}
        for rr in rain_rows:
            d_str = str(rr["date"])
            t_str = str(rr["time"])[:5]  # "HH:MM"
            rain_map[(d_str, t_str)] = _parse_float(rr["rain"])

        def _lookup_rain(d_str: str, t_str: str):
            # Try exact minute, then ±10min offsets
            hh, mm = int(t_str[:2]), int(t_str[3:5])
            for dm in (0, -10, 10, -20, 20):
                total = hh * 60 + mm + dm
                if total < 0 or total >= 1440:
                    continue
                key = (d_str, f"{total // 60:02d}:{total % 60:02d}")
                if key in rain_map:
                    return rain_map[key]
            return None

        n = wimarc_id // 2
        results = []
        for r in rows:
            d_str = str(r["date"])
            t_str = str(r["time"])[:5]
            results.append({
                "id": f"real-{wimarc_id}-{d_str}-{str(r['time']).replace(':','')}",
                "station_id": f"wimarc{n}c",
                "timestamp": datetime.strptime(f"{d_str} {str(r['time'])[:8]}", "%Y-%m-%d %H:%M:%S"),
                "air_temperature": None,
                "relative_humidity": None,
                "rainfall": _lookup_rain(d_str, t_str),
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


_OPEN_PATHS = frozenset({"/health", "/auth/login", "/auth/google", "/auth/register"})
_OPEN_PREFIXES: tuple = ()


@app.middleware("http")
async def _remove_server_header(request: Request, call_next):
    response = await call_next(request)
    if "server" in response.headers:
        del response.headers["server"]
    return response


@app.middleware("http")
async def _jwt_auth_middleware(request: Request, call_next):
    path = request.url.path
    if (
        path in _OPEN_PATHS
        or any(path.startswith(p) for p in _OPEN_PREFIXES)
        or request.method == "OPTIONS"
        or request.method == "GET"
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


cors_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins if cors_origins else ["https://www.wimarc.in.th"],
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
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE weather_forecasts ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()"))
            conn.commit()
        except Exception as e:
            print(f"[migration] weather_forecasts.created_at: {e}")
    try:
        from sqlalchemy import inspect as _sa_inspect
        _cols = [c["name"] for c in _sa_inspect(engine).get_columns("users")]
        if "phone" not in _cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN phone VARCHAR"))
            print("[migration] users.phone: column added")
    except Exception as e:
        print(f"[migration] users.phone: {e}")
    try:
        with SessionLocal() as session:
            seed_data(session)
    except Exception as e:
        print(f"[startup] seed_data failed: {e}")
    try:
        with SessionLocal() as session:
            changed = False
            for u in session.query(User).all():
                if u.password and not u.password.startswith(("$2b$", "$2a$")):
                    u.password = _pwd_ctx.hash(u.password)
                    changed = True
            if changed:
                session.commit()
                print("[migration] bcrypt: plaintext passwords hashed")
    except Exception as e:
        print(f"[startup] password migration failed: {e}")
    try:
        with SessionLocal() as session:
            n = session.query(User).filter(User.role == "G").update({User.role: "Guest"})
            if n:
                session.commit()
                print(f"[migration] role: {n} 'G' rows normalized to 'Guest'")
    except Exception as e:
        print(f"[startup] role migration failed: {e}")
    try:
        with engine.begin() as conn:
            conn.execute(text(
                "CREATE TABLE IF NOT EXISTS system_config "
                "(key VARCHAR PRIMARY KEY, value JSONB NOT NULL)"
            ))
            conn.execute(text(
                "CREATE TABLE IF NOT EXISTS station_config "
                "(station_id VARCHAR PRIMARY KEY, config JSONB NOT NULL)"
            ))
        print("[migration] system_config + station_config: tables ensured")
    except Exception as e:
        print(f"[migration] system_config/station_config: {e}")
    asyncio.create_task(_daily_forecast_refresh())


@app.get("/health")
def health_check(
    db: Session = Depends(get_db),
    wdb: Session = Depends(get_wimarc_db),
) -> JSONResponse:
    """Public health probe — returns only pass/fail, no internal details."""
    ok = True
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        ok = False
    try:
        wdb.execute(text("SELECT 1"))
    except Exception:
        ok = False
    if ok:
        return JSONResponse({"status": "ok"}, status_code=200)
    return JSONResponse({"status": "error"}, status_code=503)


@app.get("/health/detail")
def health_check_detail(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    wdb: Session = Depends(get_wimarc_db),
) -> dict:
    """Detailed health — requires valid JWT. Safe for admin dashboards/monitoring."""
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

    # --- File server (status only — no error message in response) ---
    try:
        with urllib.request.urlopen(FILE_SERVER_URL + "/", timeout=3) as r:
            result["file_server"] = "ok" if r.status < 400 else f"http {r.status}"
    except Exception:
        result["file_server"] = "error"
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

    # --- Wimarc-API server metrics (optional — only if WIMARC_API_METRICS_URL is set) ---
    _metrics_url = os.getenv("WIMARC_API_METRICS_URL", "")
    if _metrics_url:
        try:
            with urllib.request.urlopen(_metrics_url, timeout=3) as r:
                api_data = json.loads(r.read().decode())
                result["server_api"] = "ok"
                result["api_cpu_percent"] = api_data.get("cpu_percent")
                result["api_mem_used_mb"] = api_data.get("mem_used_mb")
                result["api_mem_total_mb"] = api_data.get("mem_total_mb")
                result["api_mem_percent"] = api_data.get("mem_percent")
                result["api_disk_used_gb"] = api_data.get("disk_used_gb")
                result["api_disk_total_gb"] = api_data.get("disk_total_gb")
                result["api_disk_percent"] = api_data.get("disk_percent")
        except Exception:
            result["server_api"] = "error"

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
def admin_refresh_forecasts(_: User = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
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
_TMD_PROXY_URL = os.getenv("TMD_PROXY_URL", "")  # set when wimarc-api proxy available


@app.get("/stations/{station_id}/tmd-forecast")
def get_tmd_forecast(station_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Daily forecast from กรมอุตุนิยมวิทยา using forecast/location/daily/at (7-day)."""
    if not _TMD_API_KEY:
        return {"no_key": True, "forecasts": []}

    station = db.query(Station).filter(Station.id == station_id).first()
    if not station or station.latitude is None or station.longitude is None:
        raise HTTPException(status_code=404, detail="Station not found or missing coordinates")

    use_proxy = bool(_TMD_PROXY_URL)
    if use_proxy:
        url = (
            f"{_TMD_PROXY_URL}/weather/by-coordinates"
            f"?lat={station.latitude}&lon={station.longitude}"
            f"&type=daily&duration=7"
        )
        headers = {"accept": "application/json"}
    else:
        now = datetime.now()
        url = (
            f"https://data.tmd.go.th/nwpapi/v1/forecast/location/daily/at"
            f"?lat={round(station.latitude, 4)}&lon={round(station.longitude, 4)}"
            f"&fields=tc_max,tc_min,rh,rain,ws10m,wd10m"
            f"&date={now.strftime('%Y-%m-%d')}&duration=7"
        )
        headers = {
            "accept": "application/json",
            "authorization": f"Bearer {_TMD_API_KEY}",
        }
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as resp:
            payload = json.loads(resp.read())

        data = payload.get("data", payload) if use_proxy else payload
        forecasts = data.get("WeatherForecasts", [{}])[0].get("forecasts", [])

        result = []
        for f in forecasts:
            day_key = f.get("time", "")[:10]
            if not day_key:
                continue
            d = f.get("data", {})
            tc_max = float(d["tc_max"]) if d.get("tc_max") is not None else None
            tc_min = float(d["tc_min"]) if d.get("tc_min") is not None else None
            avg_temp = round((tc_max + tc_min) / 2, 1) if tc_max is not None and tc_min is not None else None
            result.append({
                "date": day_key,
                "maxTemp": round(tc_max, 1) if tc_max is not None else None,
                "minTemp": round(tc_min, 1) if tc_min is not None else None,
                "avgTemp": avg_temp,
                "avgHumidity": round(float(d["rh"]), 0) if d.get("rh") is not None else None,
                "totalRain": round(float(d["rain"]), 1) if d.get("rain") is not None else None,
                "avgWindSpeed": round(float(d["ws10m"]), 1) if d.get("ws10m") is not None else None,
                "avgWindDir": round(float(d["wd10m"]), 0) if d.get("wd10m") is not None else None,
            })

        return {"no_key": False, "forecasts": result}
    except Exception as exc:
        print(f"[tmd-forecast] {station_id} failed: {exc}")
        return {"no_key": False, "forecasts": [], "error": str(exc)}


@app.get("/stations/{station_id}/hourly-forecast")
def get_hourly_forecast(station_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Hourly forecast for today — TMD primary, Open-Meteo fallback."""
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station or station.latitude is None or station.longitude is None:
        raise HTTPException(status_code=404, detail="Station not found or missing coordinates")

    bkk_now = datetime.utcnow() + timedelta(hours=7)
    today = bkk_now.strftime("%Y-%m-%d")

    # --- TMD primary ---
    if _TMD_API_KEY:
        try:
            url = (
                f"https://data.tmd.go.th/nwpapi/v1/forecast/location/hourly/at"
                f"?lat={round(station.latitude, 4)}&lon={round(station.longitude, 4)}"
                f"&fields=tc,rh,rain,ws10m,wd10m,cond"
                f"&date={today}&duration=24"
            )
            headers = {
                "accept": "application/json",
                "authorization": f"Bearer {_TMD_API_KEY}",
            }
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=15) as resp:
                payload = json.loads(resp.read())

            forecasts = payload.get("WeatherForecasts", [{}])[0].get("forecasts", [])
            # rain prob derived from cond (TMD has no prob field)
            _rain_prob = {5: 30, 6: 60, 7: 80, 8: 90}
            result = []
            for f in forecasts:
                t = f.get("time", "")
                if not t:
                    continue
                d = f.get("data", {})
                cond = int(d["cond"]) if d.get("cond") is not None else None
                ws_raw = float(d["ws10m"]) if d.get("ws10m") is not None else None
                result.append({
                    "time": t[:16],  # "YYYY-MM-DDTHH:mm"
                    "temperature": round(float(d["tc"]), 1) if d.get("tc") is not None else None,
                    "humidity": int(round(float(d["rh"]))) if d.get("rh") is not None else None,
                    "precipitation_probability": _rain_prob.get(cond, 0) if cond is not None else 0,
                    "precipitation": round(float(d["rain"]), 1) if d.get("rain") is not None else None,
                    "weather_code": cond,
                    "wind_speed": round(ws_raw / 3.6, 1) if ws_raw is not None else None,
                    "source": "tmd",
                })
            return result
        except Exception as exc:
            print(f"[hourly-forecast] TMD failed for {station_id}: {exc}")
            # fall through to Open-Meteo

    # --- Open-Meteo fallback ---
    try:
        url = (
            f"https://api.open-meteo.com/v1/forecast"
            f"?latitude={round(station.latitude, 4)}&longitude={round(station.longitude, 4)}"
            f"&hourly=temperature_2m,relativehumidity_2m,precipitation_probability,precipitation,weathercode,windspeed_10m"
            f"&timezone=Asia%2FBangkok&forecast_days=2"
        )
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
        hourly = data.get("hourly", {})
        times   = hourly.get("time", [])
        temps   = hourly.get("temperature_2m", [])
        rhs     = hourly.get("relativehumidity_2m", [])
        probs   = hourly.get("precipitation_probability", [])
        precips = hourly.get("precipitation", [])
        codes   = hourly.get("weathercode", [])
        winds   = hourly.get("windspeed_10m", [])
        result = []
        for i, t in enumerate(times):
            if not t.startswith(today):
                continue
            ws_kmh = winds[i] if i < len(winds) and winds[i] is not None else None
            result.append({
                "time": t,
                "temperature": round(float(temps[i]), 1) if i < len(temps) and temps[i] is not None else None,
                "humidity": int(round(float(rhs[i]))) if i < len(rhs) and rhs[i] is not None else None,
                "precipitation_probability": int(round(float(probs[i]))) if i < len(probs) and probs[i] is not None else None,
                "precipitation": round(float(precips[i]), 1) if i < len(precips) and precips[i] is not None else None,
                "weather_code": int(codes[i]) if i < len(codes) and codes[i] is not None else None,
                "wind_speed": round(float(ws_kmh) / 3.6, 1) if ws_kmh is not None else None,
                "source": "openmeteo",
            })
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Hourly forecast unavailable: {exc}")


@app.get("/stations/{station_id}/tmd-warning")
def get_tmd_warning(station_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Weather warning from กรมอุตุนิยมวิทยา for the station's province."""
    if not _TMD_API_KEY:
        return {"warnings": []}

    station = db.query(Station).filter(Station.id == station_id).first()
    if not station or station.latitude is None or station.longitude is None:
        return {"warnings": []}

    try:
        url = (
            f"https://data.tmd.go.th/nwpapi/v1/forecast/location/warning/at"
            f"?lat={round(station.latitude, 4)}&lon={round(station.longitude, 4)}"
        )
        headers = {
            "accept": "application/json",
            "authorization": f"Bearer {_TMD_API_KEY}",
        }
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            payload = json.loads(resp.read())

        raw = payload.get("WeatherWarnings", payload.get("warnings", []))
        if isinstance(raw, dict):
            raw = raw.get("Warning", [])
        warnings = []
        for w in (raw if isinstance(raw, list) else []):
            text = w.get("header", w.get("title", w.get("message", "")))
            if text:
                warnings.append({"text": text, "severity": w.get("severity", "advisory")})
        return {"warnings": warnings}
    except Exception as exc:
        print(f"[tmd-warning] {station_id} failed: {exc}")
        return {"warnings": []}


@app.post("/stations/{station_id}/forecast/refresh")
def refresh_station_forecast(station_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
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


_DUMMY_HASH = "$2b$12$GQWc.EHKFVgT9VHFHaY6dO1234567890abcdefghijklmnopqrstuv"  # constant-time sentinel


@app.post("/auth/login", response_model=LoginResponse)
@_limiter.limit("5/minute")
def login(request: Request, payload: AuthLogin, db: Session = Depends(get_db)) -> dict:
    user = (
        db.query(User)
        .filter(User.username == payload.username, User.is_enabled.is_(True))
        .first()
    )
    # Constant-time check: always call verify even when user not found (prevents timing oracle)
    candidate_hash = (user.password or _DUMMY_HASH) if user else _DUMMY_HASH
    try:
        valid = _pwd_ctx.verify(payload.password, candidate_hash)
    except Exception:
        valid = False
    if not valid or not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"token": _create_token(user.id, user.role), "user": user}


@app.post("/auth/register", status_code=201)
@_limiter.limit("3/minute")
def register(request: Request, payload: RegisterRequest, db: Session = Depends(get_db)) -> dict:
    """Public self-registration — creates a pending Guest account (is_enabled=False, awaiting admin approval)."""
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=409, detail="username_taken")
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="email_taken")
    if len(payload.password) < 8:
        raise HTTPException(status_code=422, detail="password_too_short")
    user = User(
        id=f"u-{uuid4().hex[:8]}",
        username=payload.username,
        password=_pwd_ctx.hash(payload.password),
        role="Guest",
        full_name=payload.full_name or payload.username,
        email=payload.email,
        is_enabled=False,
        permitted_station_ids=[],
    )
    db.add(user)
    db.commit()
    return {"message": "pending", "username": payload.username}


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
            password=_pwd_ctx.hash(secrets.token_hex(32)),  # unusable: Google users auth via OAuth only
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
    include_all: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    wdb: Session = Depends(get_wimarc_db),
) -> List[Station]:
    query = db.query(Station)
    if current_user.role == "Admin":
        if owner_id:
            query = query.filter(Station.owner_id == owner_id)
    elif not include_all:
        permitted = current_user.permitted_station_ids or []
        query = query.filter(Station.id.in_(permitted))
    stations = query.order_by(Station.id).all()

    # Enrich with real-time status from wimarc_db
    try:
        ud_rows = wdb.execute(text('SELECT wimarc_id, name, date, time FROM updatedata')).mappings().all()
        ud_map: dict[tuple, datetime] = {}
        for r in ud_rows:
            try:
                ud_map[(r['wimarc_id'], r['name'])] = datetime.strptime(
                    f"{r['date']} {str(r['time'])[:8]}", "%Y-%m-%d %H:%M:%S"
                )
            except Exception:
                pass

        # Fallback: latest record per station — scan only last 2 days to avoid full-table scan
        today = datetime.utcnow().strftime("%Y-%m-%d")
        yesterday = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")

        sensor_map: dict[int, datetime] = {}
        try:
            for row in wdb.execute(text(
                "SELECT DISTINCT ON (wimarc_id) wimarc_id, date, time"
                " FROM sensor WHERE date IN (:d0, :d1)"
                " ORDER BY wimarc_id, date DESC, time DESC"
            ), {"d0": today, "d1": yesterday}).mappings().all():
                try:
                    sensor_map[row['wimarc_id']] = datetime.strptime(
                        f"{row['date']} {str(row['time'])[:8]}", "%Y-%m-%d %H:%M:%S"
                    )
                except Exception:
                    pass
        except Exception:
            pass

        client_map: dict[int, datetime] = {}
        try:
            for row in wdb.execute(text(
                'SELECT DISTINCT ON (wimarc_id) wimarc_id, date, time'
                ' FROM "CAM_client" WHERE date IN (:d0, :d1)'
                ' ORDER BY wimarc_id, date DESC, time DESC'
            ), {"d0": today, "d1": yesterday}).mappings().all():
                try:
                    client_map[row['wimarc_id']] = datetime.strptime(
                        f"{row['date']} {str(row['time'])[:8]}", "%Y-%m-%d %H:%M:%S"
                    )
                except Exception:
                    pass
        except Exception:
            pass

        now = datetime.utcnow()
        for s in stations:
            info = _station_to_wimarc_id(s.id)
            if info:
                wid, source = info
                ud_name = "CAM_client" if source == "CAM_client" else "CAM_main"
                last_ping = ud_map.get((wid, ud_name))
                # Use the more recent of: updatedata heartbeat vs actual sensor table record
                sensor_ts = client_map.get(wid) if source == "CAM_client" else sensor_map.get(wid)
                candidates = [t for t in [last_ping, sensor_ts] if t is not None]
                effective_ts = max(candidates) if candidates else None
                if effective_ts:
                    s.last_data_time = effective_ts
                    s.status = "offline" if now - effective_ts > timedelta(minutes=30) else "online"
                else:
                    s.status = "offline"
    except Exception:
        pass

    # Attach owner_name for the frontend (avoids a separate /users call which is admin-only)
    try:
        owner_ids = list({s.owner_id for s in stations if s.owner_id})
        if owner_ids:
            owners = db.query(User).filter(User.id.in_(owner_ids)).all()
            owner_map = {u.id: u.full_name for u in owners}
            for s in stations:
                s.owner_name = owner_map.get(s.owner_id) if s.owner_id else None  # type: ignore[attr-defined]
    except Exception:
        pass

    return stations


@app.get("/stations/nearest", response_model=StationOut)
def get_nearest_station(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Station:
    """Return the weather station geographically closest to (lat, lon).

    Used by Guest auto-location: pick the single nearest station to show.
    Any authenticated user may call it (read-only lookup).
    """
    stations = (
        db.query(Station)
        .filter(Station.type == "weather", Station.latitude.isnot(None), Station.longitude.isnot(None))
        .all()
    )
    if not stations:
        raise HTTPException(status_code=404, detail="No stations available")

    def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        r = 6371.0
        p1, p2 = math.radians(lat1), math.radians(lat2)
        dp = math.radians(lat2 - lat1)
        dl = math.radians(lon2 - lon1)
        a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
        return 2 * r * math.asin(math.sqrt(a))

    nearest = min(stations, key=lambda s: _haversine_km(lat, lon, s.latitude, s.longitude))
    return nearest


@app.get("/stations/{station_id}", response_model=StationOut)
def get_station(
    station_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    wdb: Session = Depends(get_wimarc_db),
) -> Station:
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    if not _can_read_station(current_user, station_id):
        raise HTTPException(status_code=403, detail="Access denied")

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
def create_station(payload: StationCreate, _: User = Depends(require_admin), db: Session = Depends(get_db)) -> Station:
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
def update_station(station_id: str, payload: StationUpdate, _: User = Depends(require_admin), db: Session = Depends(get_db)) -> Station:
    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(station, key, value)

    db.commit()
    db.refresh(station)
    return station


@app.delete("/stations/{station_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_station(station_id: str, _: User = Depends(require_admin), db: Session = Depends(get_db)) -> None:
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
def get_today_station_images(station_id: str, current_user: User = Depends(require_not_guest)):
    folder_info = _station_folder(station_id)
    if not folder_info:
        return []
    img_base, folder = folder_info
    return _today_images_from_server(img_base, folder)


@app.get("/stations/{station_id}/images/latest", response_model=StationImageOut)
def get_latest_station_image(station_id: str, current_user: User = Depends(require_not_guest), db: Session = Depends(get_db)):
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
def get_station_forecast(station_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> List[WeatherForecast]:
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
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(require_not_guest),
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
    # ── Try real sensor data from wimarc_db first ──────────────────────────
    info = _station_to_wimarc_id(station_id)
    if info:
        wimarc_id, source_table = info
        try:
            real = _real_readings_from_wimarc_db(
                wimarc_id, source_table, days, limit, wdb,
                dt_start=dt_start, dt_end=dt_end,
            )
            if real:
                return real
        except Exception:
            pass  # fall through to mock data

    if dt_start is None and days:
        dt_start = datetime.utcnow() - timedelta(days=days)

    # ── Fallback: mock sensor_readings table ───────────────────────────────
    query = db.query(SensorReading).filter(SensorReading.station_id == station_id)
    if dt_start:
        query = query.filter(SensorReading.timestamp >= dt_start)
    if dt_end:
        query = query.filter(SensorReading.timestamp < dt_end)
    return query.order_by(SensorReading.timestamp.desc()).limit(limit).all()


@app.post("/stations/{station_id}/readings", response_model=SensorReadingOut, status_code=status.HTTP_201_CREATED)
def create_reading(
    station_id: str, payload: SensorReadingCreate,
    _: User = Depends(require_not_guest), db: Session = Depends(get_db)
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
    station_id: Optional[str] = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> List[PlotActivity]:
    query = db.query(PlotActivity)
    if station_id:
        query = query.filter(PlotActivity.station_id == station_id)
    return query.order_by(PlotActivity.date.desc()).all()


@app.post("/activities", response_model=PlotActivityOut, status_code=status.HTTP_201_CREATED)
def create_activity(payload: PlotActivityCreate, current_user: User = Depends(require_not_guest), db: Session = Depends(get_db)) -> PlotActivity:
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
    activity_id: str, payload: PlotActivityUpdate, current_user: User = Depends(require_not_guest), db: Session = Depends(get_db)
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
def delete_activity(activity_id: str, current_user: User = Depends(require_not_guest), db: Session = Depends(get_db)) -> None:
    activity = db.query(PlotActivity).filter(PlotActivity.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    db.delete(activity)
    db.commit()


@app.get("/users", response_model=List[UserOut])
def list_users(_: User = Depends(require_admin), db: Session = Depends(get_db)) -> List[User]:
    return db.query(User).order_by(User.username).all()


@app.get("/users/{user_id}", response_model=UserOut)
def get_user(user_id: str, _: User = Depends(require_admin), db: Session = Depends(get_db)) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@app.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, _: User = Depends(require_admin), db: Session = Depends(get_db)) -> User:
    user_id = payload.id or f"user-{uuid4().hex[:8]}"
    if db.query(User).filter(User.id == user_id).first():
        raise HTTPException(status_code=409, detail="User already exists")

    user = User(
        id=user_id,
        username=payload.username,
        password=_pwd_ctx.hash(payload.password),
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
def update_user(user_id: str, payload: UserUpdate, current_admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    dumped = payload.model_dump(exclude_unset=True)

    # Admin cannot disable their own account
    if user_id == current_admin.id and "is_enabled" in dumped and not dumped["is_enabled"]:
        raise HTTPException(status_code=403, detail="Cannot disable your own account")

    for key, value in dumped.items():
        if key == "password" and value:
            value = _pwd_ctx.hash(value)
        setattr(user, key, value)

    # ถ้า permitted_station_ids ถูกแก้ → set owner_id ให้ station ที่ยัง NULL
    if "permitted_station_ids" in dumped:
        new_ids = dumped["permitted_station_ids"] or []
        if new_ids:
            db.query(Station).filter(
                Station.id.in_(new_ids),
                Station.owner_id.is_(None),
            ).update({"owner_id": user_id}, synchronize_session=False)

    db.commit()
    db.refresh(user)
    return user


@app.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: str, _: User = Depends(require_admin), db: Session = Depends(get_db)) -> None:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.query(Station).filter(Station.owner_id == user_id).update({"owner_id": None}, synchronize_session=False)
    db.flush()
    db.delete(user)
    db.commit()


@app.get("/sim-payments", response_model=List[SimPaymentOut])
def list_sim_payments(
    station_id: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[SimPayment]:
    query = db.query(SimPayment)
    if station_id:
        query = query.filter(SimPayment.station_id == station_id)
    if status_filter:
        query = query.filter(SimPayment.status == status_filter)
    return query.order_by(SimPayment.due_date.desc()).all()


@app.post("/sim-payments", response_model=SimPaymentOut, status_code=status.HTTP_201_CREATED)
def create_sim_payment(payload: SimPaymentCreate, current_user: User = Depends(require_not_guest), db: Session = Depends(get_db)) -> SimPayment:
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
    payment_id: str, payload: SimPaymentUpdate, current_user: User = Depends(require_not_guest), db: Session = Depends(get_db)
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
def delete_sim_payment(payment_id: str, current_user: User = Depends(require_not_guest), db: Session = Depends(get_db)) -> None:
    payment = db.query(SimPayment).filter(SimPayment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    db.delete(payment)
    db.commit()


# ---------------------------------------------------------------------------
# System / Station Config
# ---------------------------------------------------------------------------

@app.get("/config/system")
def get_system_config(_: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    """Return the system config JSON object (any authenticated user — read-only display data)."""
    try:
        row = db.execute(
            text("SELECT value FROM system_config WHERE key = 'main'")
        ).fetchone()
        return row[0] if row else {}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")


@app.get("/config/stations")
def get_stations_config(_: User = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    """Return all per-station config objects keyed by station_id (admin only)."""
    try:
        rows = db.execute(
            text("SELECT station_id, config FROM station_config")
        ).fetchall()
        return {row[0]: row[1] for row in rows}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")


@app.put("/config")
def save_config(request_body: dict, _: User = Depends(require_admin), db: Session = Depends(get_db)) -> dict:
    """Save system + station configs in a single transaction (admin only).

    Body: { "system": {...}, "stations": { "wimarc1": {...}, ... } }
    """
    system_cfg = request_body.get("system", {})
    stations_cfg = request_body.get("stations", {})
    try:
        db.execute(
            text(
                "INSERT INTO system_config(key, value) VALUES('main', :val) "
                "ON CONFLICT(key) DO UPDATE SET value = :val"
            ),
            {"val": json.dumps(system_cfg)},
        )
        for station_id, cfg in stations_cfg.items():
            db.execute(
                text(
                    "INSERT INTO station_config(station_id, config) VALUES(:id, :cfg) "
                    "ON CONFLICT(station_id) DO UPDATE SET config = :cfg"
                ),
                {"id": station_id, "cfg": json.dumps(cfg)},
            )
        db.commit()
        return {"ok": True}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"DB error: {e}")
