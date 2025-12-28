FROM python:3.11-alpine

# Install docker CLI for container restart
RUN apk add --no-cache docker-cli

WORKDIR /app
COPY cast-ip-monitor.py .

CMD ["python", "-u", "cast-ip-monitor.py"]
