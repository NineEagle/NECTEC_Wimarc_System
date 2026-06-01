from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class AuthLogin(BaseModel):
    username: str
    password: str


class GoogleAuthRequest(BaseModel):
    access_token: str


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
    date: date
    activity_type: str
    description: str
    created_by: str
    created_by_name: str
    images: List[str] = Field(default_factory=list)


class PlotActivityCreate(PlotActivityBase):
    id: Optional[str] = None


class PlotActivityUpdate(BaseModel):
    station_id: Optional[str] = None
    date: Optional[date] = None
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
    due_date: date
    status: str
    paid_date: Optional[date] = None
    notes: Optional[str] = None


class SimPaymentCreate(SimPaymentBase):
    id: Optional[str] = None


class SimPaymentUpdate(BaseModel):
    station_id: Optional[str] = None
    station_name: Optional[str] = None
    sim_number: Optional[str] = None
    provider: Optional[str] = None
    amount: Optional[float] = None
    due_date: Optional[date] = None
    status: Optional[str] = None
    paid_date: Optional[date] = None
    notes: Optional[str] = None


class SimPaymentOut(SimPaymentBase):
    id: str

    model_config = ConfigDict(from_attributes=True)


class WeatherForecastBase(BaseModel):
    station_id: str
    forecast_date: date
    temperature: float
    rain_probability: float
    rainfall: float
    description: str


class WeatherForecastCreate(WeatherForecastBase):
    id: Optional[str] = None


class WeatherForecastOut(WeatherForecastBase):
    id: str

    model_config = ConfigDict(from_attributes=True)


class UserOut(BaseModel):
    id: str
    username: str
    role: str
    full_name: str
    email: str
    is_enabled: bool
    permitted_station_ids: List[str] = Field(default_factory=list)
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


class UserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    full_name: Optional[str] = None
    email: Optional[str] = None
    is_enabled: Optional[bool] = None
    permitted_station_ids: Optional[List[str]] = None


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
