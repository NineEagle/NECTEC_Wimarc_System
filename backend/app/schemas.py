from datetime import date as Date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class AuthLogin(BaseModel):
    username: str
    password: str


class GoogleAuthRequest(BaseModel):
    access_token: str


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    full_name: str = ""


class LoginResponse(BaseModel):
    token: str
    user: "UserOut"


class StationBase(BaseModel):
    name: str
    type: str
    owner_id: Optional[str] = None
    latitude: float
    longitude: float
    status: str
    last_data_time: Optional[datetime] = None
    area: str
    description: str


class StationCreate(StationBase):
    id: Optional[str] = None


class StationUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    owner_id: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    status: Optional[str] = None
    last_data_time: Optional[datetime] = None
    area: Optional[str] = None
    description: Optional[str] = None


class StationOut(StationBase):
    id: str
    owner_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class StationImageOut(BaseModel):
    id: str
    station_id: str
    image_url: str
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class SensorReadingBase(BaseModel):
    timestamp: Optional[datetime] = None
    air_temperature: Optional[float] = None
    relative_humidity: Optional[float] = None
    light_intensity: Optional[float] = None
    wind_direction: Optional[float] = None
    wind_speed: Optional[float] = None
    rainfall: Optional[float] = None
    atmospheric_pressure: Optional[float] = None
    vpd: Optional[float] = None
    soil_moisture1: Optional[float] = None       # 15 cm depth (%)
    soil_moisture2: Optional[float] = None       # 30 cm depth (%)
    soil_temperature1: Optional[float] = None    # 15 cm depth (°C)
    soil_temperature2: Optional[float] = None    # 30 cm depth (°C)


class SensorReadingCreate(SensorReadingBase):
    id: Optional[str] = None


class SensorReadingOut(SensorReadingBase):
    id: str
    station_id: str

    model_config = ConfigDict(from_attributes=True)


class PlotActivityBase(BaseModel):
    station_id: str
    date: Date
    activity_type: str
    description: str
    created_by: str
    created_by_name: str
    images: List[str] = Field(default_factory=list)


class PlotActivityCreate(PlotActivityBase):
    id: Optional[str] = None


class PlotActivityUpdate(BaseModel):
    station_id: Optional[str] = None
    date: Optional[Date] = None
    activity_type: Optional[str] = None
    description: Optional[str] = None
    created_by_name: Optional[str] = None
    images: Optional[List[str]] = None


class PlotActivityOut(PlotActivityBase):
    id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SimPaymentBase(BaseModel):
    station_id: str
    station_name: Optional[str] = None
    sim_number: str
    provider: str
    amount: float = 0
    due_date: Optional[Date] = None
    status: Optional[str] = None
    paid_date: Optional[Date] = None
    notes: Optional[str] = None


class SimPaymentCreate(SimPaymentBase):
    id: Optional[str] = None


class SimPaymentUpdate(BaseModel):
    station_id: Optional[str] = None
    station_name: Optional[str] = None
    sim_number: Optional[str] = None
    provider: Optional[str] = None
    amount: Optional[float] = None
    due_date: Optional[Date] = None
    status: Optional[str] = None
    paid_date: Optional[Date] = None
    notes: Optional[str] = None


class SimPaymentOut(SimPaymentBase):
    id: str

    model_config = ConfigDict(from_attributes=True)


class WeatherForecastBase(BaseModel):
    station_id: str
    forecast_date: Date
    temperature: float
    rain_probability: float
    rainfall: float
    description: str


class WeatherForecastCreate(WeatherForecastBase):
    id: Optional[str] = None


class WeatherForecastOut(WeatherForecastBase):
    id: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class UserOut(BaseModel):
    id: str
    username: str
    role: str
    full_name: str
    email: str
    is_enabled: bool
    permitted_station_ids: List[str] = Field(default_factory=list)
    phone: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserCreate(BaseModel):
    id: Optional[str] = None
    username: str
    password: str
    role: str
    full_name: str
    email: str
    is_enabled: bool = True
    permitted_station_ids: List[str] = Field(default_factory=list)
    phone: Optional[str] = None


class UserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    full_name: Optional[str] = None
    email: Optional[str] = None
    is_enabled: Optional[bool] = None
    permitted_station_ids: Optional[List[str]] = None
    phone: Optional[str] = None


class ApiKeyRequestCreate(BaseModel):
    name: str
    email: str
    organization: Optional[str] = None
    purpose: str


class ApiKeyRequestOut(BaseModel):
    id: str
    name: str
    email: str
    organization: Optional[str] = None
    purpose: str
    status: str
    reject_reason: Optional[str] = None
    api_key_id: Optional[str] = None
    created_at: datetime
    reviewed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ApiKeyCreate(BaseModel):
    name: str
    description: Optional[str] = None
    allowed_stations: Optional[List[str]] = None  # None = all stations
    expires_at: Optional[datetime] = None          # None = never expires
    data_scope: List[str] = Field(default_factory=lambda: ["sensor", "forecast"])  # which data types: "sensor", "forecast"


class ApiKeyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    allowed_stations: Optional[List[str]] = None
    expires_at: Optional[datetime] = None
    data_scope: Optional[List[str]] = None


class ApiKeyOut(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    created_by: Optional[str] = None
    external_user_id: Optional[str] = None
    is_active: bool
    allowed_stations: Optional[List[str]] = None
    data_scope: List[str] = Field(default_factory=lambda: ["sensor", "forecast"])
    created_at: datetime
    expires_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ApiKeyCreateResponse(ApiKeyOut):
    key: str  # Plaintext key — returned only on creation, never stored


class ExternalUserOut(BaseModel):
    id: str
    email: str
    name: str
    organization: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PortalSendOtp(BaseModel):
    email: str
    name: str
    organization: Optional[str] = None


class PortalVerifyOtp(BaseModel):
    email: str
    otp: str


class PortalApiKeyCreate(BaseModel):
    name: str
    description: Optional[str] = None
    expires_at: Optional[datetime] = None
    data_scope: List[str] = Field(default_factory=lambda: ["sensor", "forecast"])


class ApiKeyUsageLogOut(BaseModel):
    id: int
    api_key_id: str
    path: str
    method: str
    ip_address: Optional[str] = None
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class LiveDataOut(BaseModel):
    """Real-time snapshot for a station.

    last_ping   — timestamp of the last device heartbeat (updatedata, ~1 min)
    sensor_time — timestamp of the last saved sensor record (~10 min)
    image_time  — timestamp of the latest image file (~1 hour)
    image_url   — URL of the latest image
    All sensor fields mirror SensorReadingOut.
    """
    last_ping: Optional[datetime] = None
    sensor_time: Optional[datetime] = None
    air_temperature: Optional[float] = None
    relative_humidity: Optional[float] = None
    light_intensity: Optional[float] = None
    wind_direction: Optional[float] = None
    wind_speed: Optional[float] = None
    rainfall: Optional[float] = None
    atmospheric_pressure: Optional[float] = None
    battery_voltage: Optional[float] = None
    vpd: Optional[float] = None
    soil_moisture1: Optional[float] = None
    soil_moisture2: Optional[float] = None
    soil_temperature1: Optional[float] = None
    soil_temperature2: Optional[float] = None
    image_url: Optional[str] = None
    image_time: Optional[datetime] = None


# --- Station hardware fault log -------------------------------------------
# Device keys the UI offers. Kept server-side too so a spoofed client cannot
# invent categories that would fragment the per-device occurrence counts.
FAULT_DEVICE_KEYS = {
    # weather-station sensors
    "rain", "air_temp", "humidity", "wind_speed", "wind_direction",
    "light", "pressure",
    # soil-station sensors
    "soil_moist1", "soil_moist2", "soil_temp1", "soil_temp2",
    # shared hardware
    "battery", "solar_panel", "solar_charger", "mainboard", "sim_signal",
    "camera", "structure", "other",
}


class StationFaultBase(BaseModel):
    station_id: str
    device: str
    device_other: Optional[str] = None
    symptom: str
    note: Optional[str] = None
    images: List[str] = Field(default_factory=list)


class StationFaultCreate(StationFaultBase):
    id: Optional[str] = None


class StationFaultUpdate(BaseModel):
    station_id: Optional[str] = None
    device: Optional[str] = None
    device_other: Optional[str] = None
    symptom: Optional[str] = None
    note: Optional[str] = None
    images: Optional[List[str]] = None


class StationFaultOut(StationFaultBase):
    id: str
    created_by: str
    created_by_name: str
    created_at: datetime
    # Computed per (station_id, device) at read time — never stored.
    occurrence_no: int = 0

    model_config = ConfigDict(from_attributes=True)
