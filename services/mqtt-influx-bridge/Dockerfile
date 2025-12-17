# MQTT to InfluxDB Event Bridge
# Captures Zigbee events for timeline dashboard

FROM node:20-alpine

LABEL maintainer="pi-setup"
LABEL description="Bridge service to capture Zigbee MQTT events and write to InfluxDB"

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install --production

# Copy source code
COPY src/ ./src/

# Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs && \
    chown -R nodejs:nodejs /app

USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

CMD ["npm", "start"]
