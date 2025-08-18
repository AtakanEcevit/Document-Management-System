FROM python:3.11-slim

WORKDIR /app
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend/app /app/app
ENV PYTHONUNBUFFERED=1     STORAGE_ROOT=/app/uploads     DB_PATH=/app/data/documents.db     ALLOWED_ORIGINS=http://localhost:4200,http://localhost

RUN mkdir -p /app/uploads /app/data
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host","0.0.0.0","--port","8000","--proxy-headers"]
