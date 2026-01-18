# Secrets Recovery Guide

> **Purpose:** Step-by-step instructions to regenerate all secrets after disaster recovery
> **Last Updated:** January 11, 2026

---

## Overview

This system uses 4 types of secrets:

| Secret | Purpose | Where Used |
|--------|---------|------------|
| MQTT Credentials | Authenticate to mosquitto broker | mqtt-influx-bridge |
| HA Long-Lived Token | API access to Home Assistant | heater-watchdog |
| GCP Service Account | Google Home integration | Home Assistant |
| Cloudflared Credentials | Tunnel to ha.sivaa.in | cloudflared container |

---

## 1. MQTT Credentials

**Files:** `configs/zigbee2mqtt/.env`, `/opt/mosquitto/config/passwd`

### Step 1: Choose Credentials

Choose a username and generate a strong password:
```bash
# Generate random password
openssl rand -base64 16
```

Example:
```
Username: mqtt_user
Password: K8x2mQp4LnR9vT6w
```

### Step 2: Create Mosquitto Password File

```bash
ssh pi@pi << 'EOF'
# Install mosquitto-clients for password tool
sudo apt install -y mosquitto-clients

# Create password file
sudo mosquitto_passwd -c /opt/mosquitto/config/passwd mqtt_user
# Enter password when prompted

# Verify file exists
cat /opt/mosquitto/config/passwd
EOF
```

### Step 3: Update .env File

```bash
ssh pi@pi << 'EOF'
cat > ~/pi-setup/configs/zigbee2mqtt/.env << 'ENVFILE'
MQTT_USER=mqtt_user
MQTT_PASSWORD=K8x2mQp4LnR9vT6w
HA_TOKEN=your_ha_token_here
ENVFILE
EOF
```

### Step 4: Restart MQTT-Dependent Services

```bash
ssh pi@pi << 'EOF'
cd ~/pi-setup/configs/zigbee2mqtt
docker compose restart mosquitto mqtt-influx-bridge
EOF
```

### Verification

```bash
# Test MQTT connection
ssh pi@pi "mosquitto_sub -h localhost -u mqtt_user -P 'K8x2mQp4LnR9vT6w' -t '#' -C 1 -W 5"
```

---

## 2. Home Assistant Long-Lived Token

**File:** `configs/zigbee2mqtt/.env` (HA_TOKEN variable)

### Step 1: Access Home Assistant

1. Open browser: http://pi:8123
2. Log in (or create initial admin account on fresh install)

### Step 2: Create Token

1. Click your **profile icon** (bottom left of sidebar)
2. Scroll to **Security** tab
3. Scroll to **Long-Lived Access Tokens** section
4. Click **Create Token**
5. Name it: `heater-watchdog`
6. Click **OK**

### Step 3: Copy Token

**IMPORTANT:** The token is shown **only once**. Copy it immediately.

Token format example:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiI...
```

### Step 4: Update .env File

```bash
ssh pi@pi << 'EOF'
# Update HA_TOKEN in .env (replace the placeholder)
sed -i 's/HA_TOKEN=.*/HA_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6.../' ~/pi-setup/configs/zigbee2mqtt/.env
EOF
```

### Step 5: Restart heater-watchdog

```bash
ssh pi@pi "docker restart heater-watchdog"
```

### Verification

```bash
# Test HA API
ssh pi@pi << 'EOF'
source ~/pi-setup/configs/zigbee2mqtt/.env
curl -s -H "Authorization: Bearer $HA_TOKEN" http://localhost:8123/api/ | head -c 100
EOF
```

Expected: JSON response starting with `{"message":"API running."}`

---

## 3. GCP Service Account (SERVICE_ACCOUNT.json)

**File:** `/opt/homeassistant/SERVICE_ACCOUNT.json`
**Purpose:** Google Home/Assistant integration, Google Calendar

### Step 1: Access Google Cloud Console

1. Go to: https://console.cloud.google.com
2. Select your project (or create one)

### Step 2: Navigate to Service Accounts

1. Menu (☰) → **IAM & Admin** → **Service Accounts**
2. Find existing service account OR click **+ Create Service Account**

### Step 3: Create/Download Key

**If creating new:**
1. Name: `home-assistant`
2. Description: `Home Assistant integration`
3. Click **Create and Continue**
4. Skip role assignment (click **Continue**)
5. Click **Done**

**Download key:**
1. Click on the service account
2. **Keys** tab → **Add Key** → **Create new key**
3. Choose **JSON**
4. Click **Create**
5. File downloads automatically

### Step 4: Upload to Pi

```bash
# From your local machine
scp ~/Downloads/your-project-*.json pi@pi:/tmp/SERVICE_ACCOUNT.json

# Move to correct location
ssh pi@pi "sudo mv /tmp/SERVICE_ACCOUNT.json /opt/homeassistant/"
ssh pi@pi "sudo chown root:root /opt/homeassistant/SERVICE_ACCOUNT.json"
ssh pi@pi "sudo chmod 600 /opt/homeassistant/SERVICE_ACCOUNT.json"
```

### Step 5: Restart Home Assistant

```bash
ssh pi@pi "docker restart homeassistant"
```

### Verification

Check Home Assistant logs for Google integration:
```bash
ssh pi@pi "docker logs homeassistant 2>&1 | grep -i google | tail -5"
```

---

## 4. Cloudflared Tunnel Credentials

**Files:** `~/.cloudflared/cert.pem`, `/etc/cloudflared/config.yml`
**Purpose:** External access to Home Assistant via ha.sivaa.in

### Step 1: Install Cloudflared

```bash
ssh pi@pi << 'EOF'
# Download and install
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o /tmp/cloudflared
sudo mv /tmp/cloudflared /usr/local/bin/
sudo chmod +x /usr/local/bin/cloudflared
EOF
```

### Step 2: Login to Cloudflare

```bash
ssh pi@pi "cloudflared tunnel login"
```

This will:
1. Display a URL
2. Open it in your browser (or copy/paste)
3. Select your Cloudflare zone (sivaa.in)
4. Authorize the tunnel
5. Certificate saved to `~/.cloudflared/cert.pem`

### Step 3: Create Tunnel

```bash
ssh pi@pi << 'EOF'
# Create tunnel named "pi-tunnel"
cloudflared tunnel create pi-tunnel

# List tunnels to get UUID
cloudflared tunnel list
EOF
```

Note the tunnel UUID (e.g., `abc123-def456-...`)

### Step 4: Configure Tunnel

```bash
ssh pi@pi << 'EOF'
sudo mkdir -p /etc/cloudflared
sudo tee /etc/cloudflared/config.yml << 'CONFIG'
tunnel: [YOUR_TUNNEL_UUID]
credentials-file: /root/.cloudflared/[YOUR_TUNNEL_UUID].json

ingress:
  - hostname: ha.sivaa.in
    service: http://localhost:8123
  - service: http_status:404
CONFIG
EOF
```

### Step 5: Route DNS

```bash
ssh pi@pi "cloudflared tunnel route dns pi-tunnel ha.sivaa.in"
```

### Step 6: Start Tunnel

```bash
ssh pi@pi << 'EOF'
# Install as systemd service
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
EOF
```

### Verification

```bash
# Check tunnel status
ssh pi@pi "cloudflared tunnel info pi-tunnel"

# Test external access
curl -I https://ha.sivaa.in
```

---

## Secret Locations Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SECRET FILE LOCATIONS                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  MQTT Credentials:                                                  │
│    .env file:     ~/pi-setup/configs/zigbee2mqtt/.env               │
│    Password file: /opt/mosquitto/config/passwd                      │
│                                                                     │
│  Home Assistant Token:                                              │
│    .env file:     ~/pi-setup/configs/zigbee2mqtt/.env               │
│    (HA_TOKEN variable)                                              │
│                                                                     │
│  GCP Service Account:                                               │
│    JSON file:     /opt/homeassistant/SERVICE_ACCOUNT.json           │
│                                                                     │
│  Cloudflared:                                                       │
│    Certificate:   ~/.cloudflared/cert.pem                           │
│    Tunnel creds:  ~/.cloudflared/[UUID].json                        │
│    Config:        /etc/cloudflared/config.yml                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Security Notes

1. **Never commit secrets to git** - `.env` files are gitignored
2. **Use strong passwords** - Minimum 16 characters, random
3. **Rotate tokens periodically** - HA tokens can be revoked and regenerated
4. **Backup is NOT storing secrets** - Store in password manager, not in repo
5. **File permissions matter** - Use `chmod 600` for sensitive files

---

## Related Documents

- [Disaster Recovery](00-DISASTER-RECOVERY.md) - Main recovery playbook
- [Zigbee2MQTT Setup](04-zigbee2mqtt-setup.md) - Docker configuration
- [Google Home Integration](08-google-home-integration.md) - GCP setup details
