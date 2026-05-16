import os

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'), override=False)

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg2://wimarc:wimarc@db:5432/wimarc")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# wimarc_db — real sensor database (sensor / CAM_main / CAM_client tables)
# ---------------------------------------------------------------------------
WIMARC_DB_URL = os.getenv(
    "WIMARC_DB_URL",
    "postgresql+psycopg2://postgres:Wimarc%402026@localhost:5433/wimarc_db",
)

wimarc_engine = create_engine(WIMARC_DB_URL, pool_pre_ping=True)
WimarcDBSession = sessionmaker(autocommit=False, autoflush=False, bind=wimarc_engine)


def get_wimarc_db():
    db = WimarcDBSession()
    try:
        yield db
    finally:
        db.close()
