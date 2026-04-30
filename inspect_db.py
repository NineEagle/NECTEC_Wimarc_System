"""
Inspect real database schema and sample data through SSH tunnel (port 5433).
Run: python inspect_db.py
"""

import os
import sys

try:
    from sqlalchemy import create_engine, text
except ImportError:
    print("Installing sqlalchemy...")
    os.system(f"{sys.executable} -m pip install sqlalchemy psycopg2-binary -q")
    from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql+psycopg2://postgres:Wimarc%402026@localhost:5433/postgres"

engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    # 1. List all tables
    print("=" * 60)
    print("ALL TABLES")
    print("=" * 60)
    rows = conn.execute(text("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
    """))
    tables = [r[0] for r in rows]
    for t in tables:
        print(f"  {t}")

    # 2. For each table, show columns + row count
    for table in tables:
        print(f"\n{'=' * 60}")
        print(f"TABLE: {table}")
        print("=" * 60)

        cols = conn.execute(text(f"""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = '{table}'
            ORDER BY ordinal_position
        """))
        print("  Columns:")
        for c in cols:
            print(f"    {c[0]:30s} {c[1]:20s} nullable={c[2]}")

        count = conn.execute(text(f'SELECT COUNT(*) FROM "{table}"')).scalar()
        print(f"  Row count: {count}")

        if count and count > 0:
            sample = conn.execute(text(f'SELECT * FROM "{table}" LIMIT 3'))
            print("  Sample rows:")
            for row in sample:
                print(f"    {dict(row._mapping)}")
