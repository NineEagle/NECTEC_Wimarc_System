#!/bin/bash
# Drop and recreate all tables, then reseed with wimarc folder-based stations
echo "Resetting database..."
cd "$(dirname "$0")/backend"
python3 -c "
from app.db import Base, engine
from app import models  # ensure all models are imported
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)
print('Tables recreated.')
from app.db import SessionLocal
from app.seed import seed_data
with SessionLocal() as session:
    seed_data(session)
print('Seed complete.')
"
