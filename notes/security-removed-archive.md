# WiMaRC — Security Removed / Archived Content

## Removed Files

### `.env.bak.20260519` — Leaked env backup (removed from git tracking 2026-06-07)

Full content of the file before untracking:

```
TMD_API_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6ImEyZTQ5ZGNmMWY3YWY4NzBhZjZmODdlZjBmYjc1ZGQ1OGZiMTcwZWNkNmQ4ZmM4Y2Q5M2Y4MDk5N2M0MmE1OGY0MGYyMjIxZGZlYjYxNWRkIn0.eyJhdWQiOiIyIiwianRpIjoiYTJlNDlkY2YxZjdhZjg3MGFmNmY4N2VmMGZiNzVkZDU4ZmIxNzBlY2Q2ZDhmYzhjZDkzZjgwOTk3YzQyYTU4ZjQwZjIyMjFkZmViNjE1ZGQiLCJpYXQiOjE3Nzg5NDAzMzMsIm5iZiI6MTc3ODk0MDMzMywiZXhwIjoxODEwNDc2MzMzLCJzdWIiOiI1MzE1Iiwic2NvcGVzIjpbXX0.ImEwvSYsO2WFHIAmXY9KmBMLjRBxyAPzdvC7bqyVJDwDZAhIENAjW9ZOVyGeubmvJRcZczskQOEojfOXfA_2TUkZVc30bbihBYj610oBZc4BnuqNrmFdkxg-K9IwjXawS9QDx3CvEyKzBujJQI0i9rLD9DmQXSEePZyA5euThH3vIIGGolbppoFgXzJJ_99OZvjK3sG6qga2q44lEMumL25m55FyJlrDfcfA3b9s32dmjfH-gMDawFPCmjHYGk1jlhXaynapWXLhC2y4PRhBPkerza3hE8nNZHjjLrmWv8yOxwLDehdapZe-V0uECGNtCylHbhDAb2PiHRO7uYGyGMSUJ6PsVpGOqFPP_6uouzVB5S27LpdvmE6TVMKUnO1QZja_MA7JyOlZEga4djy-fEXu5C-XHM36_Zwy6flvxPg8exfsWwjJL3PjRGi5Jesp3dEn86v4Ek3uysYkuxVAXrq43HWo6Wyepicrd3lTEN8P6sM7Bdt5kCQ1BsXVwY0GiUaL0Dcg3sicfMOcnekf46FkDEA4ftTprDl5mZCtKm4mUCgf1dunHqO1L7LNhbsIv6FxRnp7WZPW2nIt2i64LJ3IdwyxtlVF2t0cNhnLovrhhl7e2rk7yrr80w58nPSOvt0m_wOeWuDl7i_Q211yiZ5aZKDNw29g_cCNDj9NGvk
JWT_SECRET=<redacted — rotated 2026-07-16 หลังพบว่าหลุดใน public repo; ค่าจริงอยู่ใน .env บนเซิร์ฟเวอร์เท่านั้น>
NEXTAUTH_SECRET=CMYXUwP/NpyxsrgoG9oBMgwsrieynQMrsG7L8IhG340=
NEXTAUTH_URL=http://localhost:3000
```

**Action taken:** `git rm --cached .env.bak.20260519` — file kept locally but removed from git tracking. `.env.bak*` added to `.gitignore`.

## Removed Code

### `_get_real_ip` X-Forwarded-For trust — removed 2026-06-07

Original function (replaced with `request.client.host` only):

```python
def _get_real_ip(request: Request) -> str:
    """Real client IP — trust Apache's X-Forwarded-For (backend only reachable via proxy)."""
    fwd = request.headers.get("X-Forwarded-For", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"
```

**Reason:** X-Forwarded-For is trivially spoofable by the client, allowing rate limit bypass.

### JWT middleware POST /readings whitelist — removed 2026-06-07

Original line in `_jwt_auth_middleware` (removed):

```python
or (request.method == "POST" and re.match(r"^/stations/[^/]+/readings$", path))
```

**Reason:** Allowed unauthenticated writes to sensor readings table.

### Hardcoded internal IP in `/health/detail` — moved to env var 2026-06-07

Original code:

```python
    # --- Wimarc-API server (.200) metrics ---
    try:
        with urllib.request.urlopen("http://203.185.101.200:8081/metrics", timeout=3) as r:
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
```

**Replaced with:** reads `WIMARC_API_METRICS_URL` env var; block is skipped entirely if env var is unset/empty.

## Removed Endpoints

_(none removed — all endpoints retained, access control added)_
