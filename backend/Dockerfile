FROM python:3.11-slim-bookworm

ARG DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1

WORKDIR /app

# ✅ APT kaynaklarını garanti altına al (HTTPS)
RUN set -eux; \
  if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
    sed -i 's|http://|https://|g' /etc/apt/sources.list.d/debian.sources; \
  fi; \
  if [ ! -f /etc/apt/sources.list ]; then \
    printf '%s\n' \
      'deb https://deb.debian.org/debian bookworm main' \
      'deb https://deb.debian.org/debian bookworm-updates main' \
      'deb https://security.debian.org/debian-security bookworm-security main' \
      > /etc/apt/sources.list; \
  else \
    sed -i -e 's|http://deb.debian.org|https://deb.debian.org|g' \
           -e 's|http://security.debian.org|https://security.debian.org|g' /etc/apt/sources.list; \
  fi; \
  apt-get update; \
  apt-get install -y --no-install-recommends \
      ca-certificates \
      libgomp1 \
      libgl1 \
      libglib2.0-0 \
  ; \
  rm -rf /var/lib/apt/lists/*

# 🔧 Python bağımlılıkları
COPY backend/requirements.txt /app/requirements.txt
RUN pip install -r /app/requirements.txt \
 && pip install --index-url https://download.pytorch.org/whl/cpu torch torchvision \
 && pip install "python-doctr[torch]" "opencv-python-headless<5" "PyMuPDF<1.25" \
 && pip uninstall -y opencv-python || true \
 && pip install --no-cache-dir --upgrade --force-reinstall "opencv-python-headless<5"

# Uygulama
COPY backend/app /app/app

# Dizimler
RUN mkdir -p /app/uploads /app/data
ENV STORAGE_ROOT=/app/uploads \
    ALLOWED_ORIGINS=http://localhost:4200,http://localhost

EXPOSE 8000
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8000","--proxy-headers"]
