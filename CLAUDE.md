# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Session rules (MUST follow every session)

1. **At the start of every new session** — read `DEPLOYMENT_NOTES.md` before doing anything else. This file records all past deployments and changes on the production server; use it as context before suggesting commands or making changes.

2. **After completing any task** — append a summary of what was done to `DEPLOYMENT_NOTES.md`. Follow this format:

   ```markdown
   ### <sequential number>. <short title>  <!-- (YYYY-MM-DD) -->

   <what was changed and why, in Thai or English matching the file's language>
   ```

   **Rules for writing to DEPLOYMENT_NOTES.md:**
   - NEVER delete or overwrite existing content.
   - NEVER reorder or restructure existing sections.
   - Always append at the bottom of the file.
   - Only append after the task is truly complete (not mid-work).
   - Number entries sequentially from the last existing number.

---

## Commands

### Frontend

```bash
# Development (hot-reload, dev mode — slow first-compile per page)
pnpm dev

# Production build + start
pnpm build && pnpm start

# Lint
pnpm lint
```

### Docker (production server workflow)

```bash
# Start all services
cd /var/www/WiMaRC
docker compose up -d

# Frontend changes → must rebuild (no volume mount in prod image)
docker compose build frontend && docker compose up -d frontend

# Backend changes → must rebuild (never has a volume mount)
docker compose build backend && docker compose up -d backend

# Logs
docker compose logs -f frontend
docker compose logs -f backend
```

### Backend (FastAPI) — standalone

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

## Architecture

### Two-service stack

```
Browser → Apache (HTTPS) → Next.js :3000
                         → FastAPI  :8000  (via Next.js rewrite /backend/*)
```

`next.config.mjs` defines two rewrites:
- `/backend/:path*` → FastAPI at `BACKEND_PROXY_URL` (default `http://localhost:8000`)
- `/media/:path*` → Apache/file server at `MEDIA_PROXY_URL`

All frontend API calls go through `services/apiClient.ts → apiRequest()`, which:
- Prepends `NEXT_PUBLIC_API_URL` (default `/backend`)
- Attaches `Authorization: Bearer <wimarc_token>` from `localStorage`
- Caches GET responses in-memory with TTLs (30s live, 2min readings, 10min forecast)
- On 401, clears storage and redirects to `/`

### Dual databases (backend)

The backend uses **two separate PostgreSQL databases**:

| DB | Purpose | Connection |
|---|---|---|
| `wimarc_db` (app DB) | Users, stations metadata, activities, forecasts | `DATABASE_URL` env var |
| `wimarc_db` (legacy sensor DB) | Raw sensor tables: `CAM_main`, `CAM_client`, `sensor`, `updatedata` | `WIMARC_DB_URL` env var |

Both are the same physical database but accessed via separate SQLAlchemy engines (`get_db` vs `get_wimarc_db`). The legacy sensor DB is **read-only** from the app.

### Station ID → sensor table mapping

App station IDs (`wimarc1`, `wimarc1c`, `wimarc10`, `wimarc10c`) map to the legacy `wimarc_info` table:

```
wimarc{N}   → wimarc_info.id = (N-1)*2+1, table = CAM_main / sensor
wimarc{N}c  → wimarc_info.id = (N-1)*2+2, table = CAM_client
```

`_station_to_wimarc_id()` in `main.py` handles this conversion. The live data endpoint reads directly from `CAM_main`/`CAM_client`/`sensor` tables in `wimarc_db` using raw SQL.

### Auth flow

Two auth paths, both produce a JWT stored in `localStorage` as `wimarc_token`:

1. **Username/password** → `POST /auth/login` → FastAPI validates against `users` table → returns JWT
2. **Google OAuth** (NextAuth) → `POST /auth/google` with Google access token → FastAPI validates → returns JWT

The JWT is validated on every request via `_jwt_auth_middleware` in `main.py`. Role is embedded in the JWT payload.

### RBAC

Three roles: `Admin`, `User`, `Guest`

- `Admin` — full access to all stations and admin pages
- `User` — access only to `permitted_station_ids` (stored on `User` model), can write
- `Guest` — same station restriction as User, read-only

`utils/permissions.ts` has the client-side helpers; the backend enforces the same rules in middleware and per-endpoint checks.

### Contexts

- `StationContext` — global selected station state, list of all/permitted stations, client list. Consumed by most pages.
- `AuthContext` — current user, login/logout, idle-timeout (10 min). Also syncs Google OAuth session.

### Data flow for live sensor values

```
wimarc_db.CAM_main / CAM_client / sensor (legacy tables)
    ↓  _real_readings_from_wimarc_db()
FastAPI /stations/{id}/live
    ↓  getLiveData()  [cache 30s]
dashboard/page.tsx  (polls every 60s)
```

VPD is calculated server-side in `_calc_vpd()`. Soil moisture ADC→% conversion is in `_adc_to_moisture()`.

### Weather forecasts (two sources)

| Source | Endpoint | Refresh |
|---|---|---|
| **Open-Meteo** (free) | `/stations/{id}/forecast` | Background task every 12h, stored in `weather_forecasts` table |
| **กรมอุตุนิยมวิทยา (TMD)** | `/stations/{id}/tmd-forecast` | On-demand per page load, not cached. Uses `forecast/location/daily/at` — max `duration=7`. API key in `TMD_API_KEY` env var. Rate limit: 60 req/min, 100k datapoints/month. |

### Frontend type mapping

Backend snake_case JSON → frontend camelCase via `services/apiMappers.ts`. When adding backend fields, update both the Pydantic schema (`backend/app/schemas.py`) and the mapper + TypeScript interface (`types/index.ts`).

---

## Key env vars

| Var | Where | Purpose |
|---|---|---|
| `TMD_API_KEY` | `.env` | กรมอุตุฯ JWT token |
| `JWT_SECRET` | `.env` | Signs app JWTs |
| `NEXTAUTH_SECRET` | `.env` | Required for prod NextAuth |
| `DATABASE_URL` | docker-compose env | App DB connection |
| `WIMARC_DB_URL` | docker-compose env | Legacy sensor DB connection |
| `BACKEND_PROXY_URL` | docker-compose env | Frontend → backend proxy target |
| `NEXT_PUBLIC_SHOW_TOR_LABELS` | build arg | Shows TOR station labels on map |

---

## Important caveats

- `next.config.mjs` rewrites (`BACKEND_PROXY_URL`, `MEDIA_PROXY_URL`) are evaluated at **build time**, not runtime. These must be ARGs in `Dockerfile.frontend.prod` — changing them in `docker-compose.yml` environment alone has no effect. Default is baked as `http://backend:8000` (Docker internal DNS).
- `next.config.mjs` has `typescript: { ignoreBuildErrors: true }` — TypeScript errors won't block the build, but icon name mismatches (e.g. `Grapes` vs `Grape` in lucide-react) **will** fail the Turbopack build. Verify icon names with: `docker run --rm wimarc-frontend node -e "const l=require('lucide-react');console.log(Object.keys(l).filter(k=>/pattern/i.test(k)))"`
- Backend has no volume mount → every code change requires `docker compose build backend`.
- Frontend prod image also has no volume mount → every code change requires `docker compose build frontend`.
- `db.py` loads `.env` from two locations: `backend/.env` then `../../.env` (the repo root). The root `.env` is the one actually used on the server.
