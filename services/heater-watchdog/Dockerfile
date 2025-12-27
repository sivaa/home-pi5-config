FROM python:3.11-alpine

LABEL maintainer="pi-setup"
LABEL description="Heater Safety Watchdog - Independent safety monitor for heater-window violations"

WORKDIR /app
COPY heater-watchdog.py .

# No additional dependencies needed - uses stdlib only

CMD ["python", "-u", "heater-watchdog.py"]
