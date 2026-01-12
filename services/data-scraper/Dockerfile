# BVG Scraper with Playwright for Raspberry Pi (ARM64)
# Uses Debian-based image for better ARM64 compatibility
FROM python:3.11-slim-bookworm

WORKDIR /app

# Install system dependencies for Playwright/Chromium
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    libu2f-udev \
    libvulkan1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers (Chromium for ARM64)
RUN playwright install chromium --with-deps

# Copy scraper
COPY scraper.py .

# Expose port
EXPOSE 8890

# Health check
HEALTHCHECK --interval=60s --timeout=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8890/api/health')" || exit 1

# Run scraper
CMD ["python", "-u", "scraper.py"]
