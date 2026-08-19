FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Run unprivileged. Nothing in the image is written to at runtime
# (PYTHONDONTWRITEBYTECODE=1, no volumes) and 8000 needs no privileged bind.
RUN useradd --system --uid 10001 --shell /usr/sbin/nologin --no-create-home appuser \
 && chown -R appuser:appuser /app
USER appuser

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
