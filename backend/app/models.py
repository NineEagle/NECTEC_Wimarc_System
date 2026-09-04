from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from .db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    role = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    is_enabled = Column(Boolean, default=True, nullable=False)
    permitted_station_ids = Column(JSONB, nullable=False, default=list)
    phone = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Station(Base):
    __tablename__ = "stations"

    id = Column(String, primary_key=True)
    name = Column(String, index=True, nullable=False)
    type = Column(String, nullable=False)
    owner_id = Column(String, ForeignKey("users.id"), nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    status = Column(String, nullable=False)
    last_data_time = Column(DateTime(timezone=True), nullable=True)
    area = Column(String, nullable=False)
    description = Column(Text, nullable=False)


class SensorReading(Base):
    __tablename__ = "sensor_readings"

    id = Column(String, primary_key=True)
    station_id = Column(String, ForeignKey("stations.id"), index=True, nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    air_temperature = Column(Float, nullable=True)
    relative_humidity = Column(Float, nullable=True)
    light_intensity = Column(Float, nullable=True)
    wind_direction = Column(Float, nullable=True)
    wind_speed = Column(Float, nullable=True)
    rainfall = Column(Float, nullable=True)
    atmospheric_pressure = Column(Float, nullable=True)
    vpd = Column(Float, nullable=True)
    soil_moisture1 = Column(Float, nullable=True)
    soil_moisture2 = Column(Float, nullable=True)


class PlotActivity(Base):
    __tablename__ = "plot_activities"

    id = Column(String, primary_key=True)
    station_id = Column(String, ForeignKey("stations.id"), index=True, nullable=False)
    date = Column(Date, nullable=False)
    activity_type = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_by_name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    images = Column(JSONB, nullable=False, default=list)


class StationImage(Base):
    __tablename__ = "station_images"

    id = Column(String, primary_key=True)
    station_id = Column(String, ForeignKey("stations.id"), index=True, nullable=False)
    image_url = Column(Text, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class SimPayment(Base):
    __tablename__ = "sim_payments"

    id = Column(String, primary_key=True)
    sim_number = Column(String, nullable=False)
    provider = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    station_id = Column(String, ForeignKey("stations.id"), nullable=False)
    station_name = Column(String, nullable=True)
    due_date = Column(Date, nullable=True)
    status = Column(String, nullable=True)
    paid_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)


class WeatherForecast(Base):
    __tablename__ = "weather_forecasts"

    id = Column(String, primary_key=True)
    station_id = Column(String, ForeignKey("stations.id"), index=True, nullable=False)
    forecast_date = Column(Date, nullable=False, index=True)
    temperature = Column(Float, nullable=False)
    rain_probability = Column(Float, nullable=False)
    rainfall = Column(Float, nullable=False)
    description = Column(String, nullable=False)
    # When this forecast snapshot was stored (allows historical timeline of forecasts)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True, index=True)


class ApiKeyRequest(Base):
    __tablename__ = "api_key_requests"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    organization = Column(String, nullable=True)
    purpose = Column(Text, nullable=False)
    status = Column(String, nullable=False, default="pending")  # pending/approved/rejected
    reject_reason = Column(Text, nullable=True)
    api_key_id = Column(String, ForeignKey("api_keys.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_by = Column(String, ForeignKey("users.id"), nullable=True)


class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    key_hash = Column(String, nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    created_by = Column(String, ForeignKey("users.id"), nullable=True)         # null for external users
    external_user_id = Column(String, ForeignKey("external_users.id"), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    allowed_stations = Column(JSONB, nullable=True)  # None = all stations
    data_scope = Column(JSONB, nullable=False, default=lambda: ["sensor", "forecast"])  # which data types this key may access
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)  # None = never expires
    last_used_at = Column(DateTime(timezone=True), nullable=True)


class ExternalUser(Base):
    __tablename__ = "external_users"

    id = Column(String, primary_key=True)
    email = Column(String, nullable=False, unique=True, index=True)
    name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    organization = Column(String, nullable=True)


class EmailOtp(Base):
    __tablename__ = "email_otps"

    id = Column(String, primary_key=True)
    email = Column(String, nullable=False, index=True)
    otp_hash = Column(String, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ApiKeyUsageLog(Base):
    __tablename__ = "api_key_usage_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    api_key_id = Column(String, ForeignKey("api_keys.id"), nullable=False, index=True)
    path = Column(String, nullable=False)
    method = Column(String, nullable=False)
    ip_address = Column(String, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)


class StationFault(Base):
    """Manual hardware-fault log: one row = one occasion a device broke.

    Entirely operator-entered — nothing here is derived from telemetry. A
    station going silent means the data stopped, not that a specific device
    failed (a dead SIM or a flat battery looks identical), so the system
    never writes to this table on its own.

    Carries no operator-entered dates at all: nobody reliably knows when a
    part actually failed, and repair dates went unfilled, so a row is dated
    solely by `created_at` (when it was logged).
    The per-device "occurrence number" is not stored — it is computed at read
    time so deletions always renumber correctly.
    """

    __tablename__ = "station_faults"

    id = Column(String, primary_key=True)
    station_id = Column(String, ForeignKey("stations.id"), index=True, nullable=False)
    device = Column(String, nullable=False, index=True)
    device_other = Column(String, nullable=True)  # free text when device == "other"
    symptom = Column(Text, nullable=False)
    note = Column(Text, nullable=True)
    images = Column(JSONB, nullable=False, default=list)  # reserved; no upload UI yet
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_by_name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
