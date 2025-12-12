# ☁️ Cloudflare Tunnel Setup

> Secure external access without port forwarding or exposing your IP.

```
                    CLOUDFLARE TUNNEL
    ┌─────────────────────────────────────────────────────┐
    │                                                     │
    │   ┌──────────────────────────────────────────────┐ │
    │   │                   INTERNET                    │ │
    │   └──────────────────────────────────────────────┘ │
    │                         │                          │
    │                         ▼                          │
    │   ┌──────────────────────────────────────────────┐ │
    │   │            Cloudflare Edge Network           │ │
    │   │                                              │ │
    │   │    ┌────────────────────────────────────┐   │ │
    │   │    │  ha.sivaa.in → Tunnel Endpoint     │   │ │
    │   │    │                                    │   │ │
    │   │    │  ✓ DDoS Protection                │   │ │
    │   │    │  ✓ SSL Termination                │   │ │
    │   │    │  ✓ Zero Trust Access              │   │ │
    │   │    └────────────────────────────────────┘   │ │
    │   └──────────────────────────────────────────────┘ │
    │                         │                          │
    │                    Encrypted                       │
    │                    Connection                      │
    │                         │                          │
    │   ┌──────────────────────────────────────────────┐ │
    │   │                Your Home                      │ │
    │   │                                              │ │
    │   │    ┌────────────────────────────────────┐   │ │
    │   │    │  Raspberry Pi (cloudflared)        │   │ │
    │   │    │         ▼                          │   │ │
    │   │    │  localhost:8123 (Home Assistant)   │   │ │
    │   │    └────────────────────────────────────┘   │ │
    │   │                                              │ │
    │   │  🔒 No port forwarding needed!              │ │
    │   │  🔒 No public IP exposed!                   │ │
    │   │                                              │ │
    │   └──────────────────────────────────────────────┘ │
    │                                                     │
    └─────────────────────────────────────────────────────┘
```

---

## 🤔 Why Cloudflare Tunnel?

| Feature | Port Forwarding | Cloudflare Tunnel |
|---------|-----------------|-------------------|
| Requires static IP | ✓ | ✗ |
| Exposes home IP | ✓ | ✗ |
| Needs router config | ✓ | ✗ |
| DDoS protection | ✗ | ✓ |
| Free SSL certificate | ✗ | ✓ |
| Works behind CGNAT | ✗ | ✓ |
| **Cost** | Free | Free |

---

## 📋 Prerequisites

- Cloudflare account (free)
- Domain name added to Cloudflare
- `cloudflared` installed

---

## 🔧 Step-by-Step Setup

### Step 1: Install cloudflared (Any Machine)

First, create the tunnel from any machine with internet access:

```bash
# macOS
brew install cloudflared

# Debian/Ubuntu
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | \
  gpg --dearmor -o /usr/share/keyrings/cloudflare-main.gpg

echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared bookworm main' \
  > /etc/apt/sources.list.d/cloudflared.list

apt-get update && apt-get install -y cloudflared
```

### Step 2: Login to Cloudflare

```bash
cloudflared login
```

This opens a browser to authorize. Select your domain.

Creates: `~/.cloudflared/cert.pem`

### Step 3: Create Tunnel

```bash
cloudflared tunnel create ha-tunnel
```

Output:
```
Created tunnel ha-tunnel with id fadfd8e9-4af2-4b85-907b-9ee93fb02e64

Tunnel credentials written to ~/.cloudflared/fadfd8e9-4af2-4b85-907b-9ee93fb02e64.json
```

**Save this UUID!** You'll need it.

### Step 4: Configure DNS (Cloudflare Dashboard)

1. Go to: **Cloudflare Dashboard** → **DNS**
2. Add CNAME record:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `ha` | `fadfd8e9-4af2-4b85-907b-9ee93fb02e64.cfargotunnel.com` | ✓ (Proxied) |

Or via CLI:
```bash
cloudflared tunnel route dns ha-tunnel ha.sivaa.in
```

### Step 5: Install cloudflared on Pi

```bash
ssh root@dietpi.local

# Install
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | \
  gpg --dearmor -o /usr/share/keyrings/cloudflare-main.gpg

echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared bookworm main' \
  > /etc/apt/sources.list.d/cloudflared.list

apt-get update && apt-get install -y cloudflared
```

### Step 6: Copy Credentials to Pi

From your local machine:
```bash
# Copy tunnel credentials
scp ~/.cloudflared/fadfd8e9-4af2-4b85-907b-9ee93fb02e64.json \
  root@dietpi.local:/root/.cloudflared/
```

### Step 7: Create Config on Pi

```bash
ssh root@dietpi.local

mkdir -p /root/.cloudflared

cat > /root/.cloudflared/config.yml << 'EOF'
tunnel: fadfd8e9-4af2-4b85-907b-9ee93fb02e64
credentials-file: /root/.cloudflared/fadfd8e9-4af2-4b85-907b-9ee93fb02e64.json

ingress:
  - hostname: ha.sivaa.in
    service: http://localhost:8123
  - service: http_status:404
EOF
```

### Step 8: Test Tunnel

```bash
cloudflared tunnel run ha-tunnel
```

Should see:
```
INF Connection established ... tunnelID=fadfd8e9-4af2-4b85-907b-9ee93fb02e64
```

Test in browser: **https://ha.sivaa.in**

### Step 9: Install as Systemd Service

```bash
cloudflared service install
systemctl enable cloudflared
systemctl start cloudflared
```

Verify:
```bash
systemctl status cloudflared
```

---

## 📝 Config File Reference

**Location**: `/root/.cloudflared/config.yml`

```yaml
# Tunnel UUID (from tunnel create)
tunnel: fadfd8e9-4af2-4b85-907b-9ee93fb02e64

# Path to credentials JSON
credentials-file: /root/.cloudflared/fadfd8e9-4af2-4b85-907b-9ee93fb02e64.json

# Ingress rules (processed in order)
ingress:
  # Route ha.sivaa.in to Home Assistant
  - hostname: ha.sivaa.in
    service: http://localhost:8123

  # Could add more services:
  # - hostname: z2m.sivaa.in
  #   service: http://localhost:8080

  # Catch-all (required as last rule)
  - service: http_status:404
```

---

## 🔧 Home Assistant Configuration

**Critical!** HA needs to know about the reverse proxy:

```yaml
# homeassistant/configuration.yaml

http:
  server_port: 8123
  use_x_forwarded_for: true
  trusted_proxies:
    - 127.0.0.1
    - ::1
    - 172.18.0.0/16  # Docker networks
    - 172.17.0.0/16

homeassistant:
  external_url: "https://ha.sivaa.in"
  internal_url: "http://dietpi.local:8123"
```

Without `trusted_proxies`, you'll get **400 Bad Request** errors!

---

## 🔍 Troubleshooting

### Check Tunnel Status

```bash
# Service status
systemctl status cloudflared

# View logs
journalctl -u cloudflared -f

# Test connection
curl -v https://ha.sivaa.in/
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| 400 Bad Request | Missing trusted_proxies | Add Docker networks to HA config |
| 502 Bad Gateway | HA not running | `docker ps` - check if HA is up |
| Tunnel offline | cloudflared not running | `systemctl restart cloudflared` |
| DNS not resolving | CNAME not configured | Check Cloudflare DNS dashboard |

### Logs Location

```bash
# Systemd service logs
journalctl -u cloudflared --since "1 hour ago"

# Manual run logs
cloudflared tunnel run ha-tunnel 2>&1 | tee /tmp/tunnel.log
```

### Test Local Connection

```bash
# From Pi, test HA responds
curl -v http://localhost:8123/
```

### Restart Tunnel

```bash
systemctl restart cloudflared
```

---

## 🔐 Security Considerations

### What Cloudflare Protects

- ✅ DDoS attacks
- ✅ SSL/TLS encryption
- ✅ IP address hidden

### What You Need to Secure

- ❗ Home Assistant login (use strong password + 2FA)
- ❗ Don't expose API without authentication
- ❗ Keep HA and tunnel updated

### Optional: Zero Trust Access

For extra security, add Cloudflare Access:

1. **Cloudflare Dashboard** → **Zero Trust** → **Access**
2. Create application for `ha.sivaa.in`
3. Add authentication (email OTP, OAuth, etc.)

This adds an extra login layer before reaching HA.

---

## 📊 Monitoring

### Check Tunnel Connections

```bash
cloudflared tunnel info ha-tunnel
```

### View in Cloudflare Dashboard

**Cloudflare Dashboard** → **Zero Trust** → **Tunnels**

Shows:
- Connection status
- Active connectors
- Traffic metrics

---

## 🔄 Maintenance

### Update cloudflared

```bash
apt-get update && apt-get upgrade cloudflared
systemctl restart cloudflared
```

### Rotate Credentials (if compromised)

```bash
# Delete old tunnel
cloudflared tunnel delete ha-tunnel

# Create new one
cloudflared tunnel create ha-tunnel

# Update config and DNS
# Redeploy to Pi
```

---

## 🔗 Next Steps

External access is working! Continue to:
→ [Google Assistant Integration](./06-google-assistant.md)

---

*Last updated: December 2025*
