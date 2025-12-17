# Secure Remote Access Plan for Raspberry Pi 5

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║   ███████╗███████╗ ██████╗██╗   ██╗██████╗ ███████╗    ██████╗ ██╗           ║
║   ██╔════╝██╔════╝██╔════╝██║   ██║██╔══██╗██╔════╝    ██╔══██╗██║           ║
║   ███████╗█████╗  ██║     ██║   ██║██████╔╝█████╗      ██████╔╝██║           ║
║   ╚════██║██╔══╝  ██║     ██║   ██║██╔══██╗██╔══╝      ██╔═══╝ ██║           ║
║   ███████║███████╗╚██████╗╚██████╔╝██║  ██║███████╗    ██║     ██║           ║
║   ╚══════╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝    ╚═╝     ╚═╝           ║
║                                                                               ║
║   🔐 Comprehensive Security Hardening Guide                                   ║
║   📅 Created: December 2024                                                   ║
║   🎯 Goal: Secure remote access after malware incident                       ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## 📖 Table of Contents

1. [Executive Summary](#executive-summary)
2. [The Story: What Happened & Why](#the-story)
3. [Current Security Assessment](#current-security-assessment)
4. [Phase 1: SSH Hardening](#phase-1-ssh-hardening-critical---do-first)
5. [Phase 2: Router Security](#phase-2-router-security)
6. [Phase 3: Tailscale VPN Setup](#phase-3-tailscale-vpn-setup)
7. [Phase 4: Local Service Hardening](#phase-4-local-service-hardening)
8. [Phase 5: Documentation & Monitoring](#phase-5-documentation--monitoring)
9. [Verification Checklist](#verification-checklist)
10. [Troubleshooting Guide](#troubleshooting-guide)
11. [Emergency Recovery](#emergency-recovery)

---

## Executive Summary

| Item | Details |
|------|---------|
| **Problem** | Need secure internet access to Pi services (8888, 8080, 8123, SSH) |
| **Root Cause** | Previous malware from SSH + port forward + default password |
| **Solution** | Tailscale VPN + SSH hardening + router security + service auth |
| **Effort** | ~3 days of focused work |
| **Risk Level** | Currently HIGH → Target: LOW |

---

## The Story

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                     🎬 HOW THE MALWARE GOT IN                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Once upon a time, there was a Raspberry Pi...                                 │
│                                                                                 │
│  CHAPTER 1: The Setup                                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐    │
│  │                                                                        │    │
│  │    Router                              Pi                              │    │
│  │   ┌──────┐                          ┌──────┐                          │    │
│  │   │ Port │ ───── Forward ─────────► │ SSH  │                          │    │
│  │   │  22  │      :22 → Pi:22         │ :22  │                          │    │
│  │   └──────┘                          └──────┘                          │    │
│  │                                         │                              │    │
│  │                                   Password: raspberry                  │    │
│  │                                   (or similar default)                 │    │
│  │                                                                        │    │
│  └────────────────────────────────────────────────────────────────────────┘    │
│                                                                                 │
│  CHAPTER 2: The Attack                                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐    │
│  │                                                                        │    │
│  │  🤖 Bot Scanner (runs 24/7, scanning entire internet)                 │    │
│  │      │                                                                │    │
│  │      ▼                                                                │    │
│  │  "Port 22 open at your.public.ip.address"                            │    │
│  │      │                                                                │    │
│  │      ▼                                                                │    │
│  │  Try username: pi, root, admin, ubuntu...                            │    │
│  │  Try password: raspberry, password, 123456, admin...                 │    │
│  │      │                                                                │    │
│  │      ▼                                                                │    │
│  │  🎯 SUCCESS! Logged in as 'pi' with password 'raspberry'             │    │
│  │      │                                                                │    │
│  │      ▼                                                                │    │
│  │  📥 Download malware, establish persistence                          │    │
│  │                                                                        │    │
│  └────────────────────────────────────────────────────────────────────────┘    │
│                                                                                 │
│  CHAPTER 3: The Lesson                                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐    │
│  │                                                                        │    │
│  │  80%+ of SSH attacks are AUTOMATED. No human is targeting you.       │    │
│  │  Bots scan the ENTIRE IPv4 address space in hours.                   │    │
│  │  If you have port 22 open + weak password = GUARANTEED infection.    │    │
│  │                                                                        │    │
│  │  The solution is NOT "hide" (security through obscurity fails).      │    │
│  │  The solution is: Don't open ports + Strong authentication.          │    │
│  │                                                                        │    │
│  └────────────────────────────────────────────────────────────────────────┘    │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Current Security Assessment

### Services Running

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ PORT  │ SERVICE              │ CURRENT SECURITY    │ RISK    │ ACTION NEEDED  │
├───────┼──────────────────────┼─────────────────────┼─────────┼────────────────┤
│ 22    │ SSH                  │ Password auth ⚠️    │ HIGH    │ Key-only       │
│ 1883  │ MQTT (TCP)           │ Anonymous ❌        │ HIGH    │ Add auth       │
│ 9001  │ MQTT (WebSocket)     │ Anonymous ❌        │ HIGH    │ Add auth       │
│ 8080  │ Zigbee2MQTT UI       │ No auth ❌          │ MEDIUM  │ Add token      │
│ 8086  │ InfluxDB             │ No auth ❌          │ MEDIUM  │ Add auth       │
│ 8123  │ Home Assistant       │ Cloudflare ✅       │ LOW     │ Keep           │
│ 8888  │ Dashboard            │ Basic Auth ✅       │ LOW     │ Keep           │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Infrastructure

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ COMPONENT        │ CURRENT STATE           │ RISK     │ ACTION NEEDED         │
├──────────────────┼─────────────────────────┼──────────┼───────────────────────┤
│ Router           │ ISP default             │ HIGH     │ Disable UPnP          │
│ Port Forwards    │ None                    │ SAFE ✅  │ Keep none             │
│ Firewall         │ Not configured          │ MEDIUM   │ Install ufw           │
│ Remote Access    │ None (local only)       │ N/A      │ Add Tailscale         │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: SSH Hardening (CRITICAL - Do First)

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║  ⚠️  THIS PHASE ADDRESSES THE EXACT ATTACK VECTOR THAT GOT YOU HACKED        ║
║      Complete this BEFORE anything else.                                      ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Step 1.1: Change the Pi User Password

**Why:** Even though we'll disable password auth, having a strong password is defense-in-depth.

**On Mac, connect to Pi:**
```bash
ssh pi@pi
```

**On Pi, run:**
```bash
passwd
```

**Password Requirements:**
- Minimum 16 characters
- Mix of uppercase, lowercase, numbers, symbols
- NOT based on dictionary words
- Example format: `R@nd0m!Str1ng#2024`

**Verification:**
```bash
# Try to login with old password (should fail)
# Try to login with new password (should work)
```

---

### Step 1.2: Generate SSH Key on Mac

**Why:** SSH keys are mathematically impossible to brute-force (unlike passwords).

```bash
# Create SSH directory if needed
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Generate Ed25519 key (modern, secure, fast)
ssh-keygen -t ed25519 -C "siva-mac-to-pi-$(date +%Y%m%d)" -f ~/.ssh/pi_key
```

**When prompted:**
```
Enter passphrase: [TYPE A STRONG PASSPHRASE]
Enter same passphrase again: [CONFIRM]
```

**Why passphrase?** If your laptop is stolen, the thief cannot use the key without the passphrase.

**Verification:**
```bash
# Check key files were created
ls -la ~/.ssh/pi_key*

# Expected output:
# -rw-------  pi_key       (private key - NEVER share)
# -rw-r--r--  pi_key.pub   (public key - safe to share)
```

---

### Step 1.3: Copy Public Key to Pi

```bash
# Copy your public key to Pi
ssh-copy-id -i ~/.ssh/pi_key.pub pi@pi
```

**Expected output:**
```
Number of key(s) added: 1
```

**Verification - Test key-based login:**
```bash
# This should prompt for your KEY passphrase (not Pi password)
ssh -i ~/.ssh/pi_key pi@pi
```

**If it asks for Pi password instead of key passphrase, something is wrong.**

---

### Step 1.4: Configure SSH on Mac for Convenience

**Create/edit `~/.ssh/config`:**
```bash
cat >> ~/.ssh/config << 'EOF'

# Raspberry Pi - Secure Access
Host pi pi.local
    HostName pi
    User pi
    IdentityFile ~/.ssh/pi_key
    IdentitiesOnly yes
    AddKeysToAgent yes
    UseKeychain yes
EOF
```

**Verification:**
```bash
# Now you can just type:
ssh pi

# Should prompt for key passphrase, then connect
```

---

### Step 1.5: Disable Password Authentication on Pi

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║  ⚠️  DANGER ZONE: If you mess this up, you could lock yourself out!          ║
║      Keep your current SSH session open while testing.                        ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

**On Pi (keep this session open!):**
```bash
# Backup current config
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup.$(date +%Y%m%d)

# Edit SSH config
sudo nano /etc/ssh/sshd_config
```

**Find and change these lines:**
```conf
# Line ~40 - Disable root login completely
PermitRootLogin no

# Line ~58 - Ensure public key auth is enabled
PubkeyAuthentication yes

# Line ~60 - DISABLE password authentication
PasswordAuthentication no

# Line ~65 - Disable empty passwords
PermitEmptyPasswords no

# Line ~69 - Disable challenge-response
KbdInteractiveAuthentication no

# Line ~100 - Disable PAM (uses password)
UsePAM no
```

**Save and exit (Ctrl+X, Y, Enter)**

**Test configuration BEFORE restarting:**
```bash
sudo sshd -t
# Should output nothing (no errors)
```

**Restart SSH service:**
```bash
sudo systemctl restart sshd
```

---

### Step 1.6: Verify SSH Hardening (CRITICAL!)

**Keep your original SSH session open and open a NEW terminal:**

```bash
# Test 1: Key-based login should work
ssh pi
# Should prompt for KEY passphrase, then connect ✅

# Test 2: Password login should FAIL
ssh -o PubkeyAuthentication=no pi@pi
# Should say "Permission denied (publickey)" ✅

# Test 3: Root login should FAIL
ssh root@pi
# Should say "Permission denied (publickey)" ✅
```

**If Test 1 fails:** Use your original session to fix the config. Don't close it!

---

### Step 1.7: Install fail2ban

**Why:** Even with key-only auth, fail2ban blocks IPs that repeatedly try to connect.

**On Pi:**
```bash
# Install
sudo apt update
sudo apt install -y fail2ban

# Enable and start
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Verify running
sudo systemctl status fail2ban
```

**Verification:**
```bash
# Check jail status
sudo fail2ban-client status

# Check SSH jail specifically
sudo fail2ban-client status sshd
```

**Expected output:**
```
Status for the jail: sshd
|- Filter
|  |- Currently failed: 0
|  |- Total failed:     0
|  `- File list:        /var/log/auth.log
`- Actions
   |- Currently banned: 0
   |- Total banned:     0
   `- Banned IP list:
```

---

### Step 1.8: Backup SSH Config to Repo

**On Mac:**
```bash
cd /Users/siva/pyrepos/siva-personal/pi-setup

# Create backup
scp pi:/etc/ssh/sshd_config backups/configs/sshd_config

# Add note about changes
echo "# Updated $(date +%Y-%m-%d): Key-only auth, root disabled, fail2ban" >> backups/configs/sshd_config.notes
```

---

## Phase 2: Router Security

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║  🌐 ISP routers are often misconfigured. These steps protect your network.   ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Step 2.1: Access Router Admin Panel

**On Mac, open browser:**
```
http://192.168.0.1
```
(Or check your router's IP if different)

**Login credentials:** Usually on a sticker on the router, or try:
- admin/admin
- admin/password
- Check ISP documentation

---

### Step 2.2: Disable UPnP (CRITICAL!)

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║  ⚠️  UPnP allows ANY software to open ports automatically!                   ║
║      Malware uses this to create backdoors without your knowledge.           ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

**Location varies by router, usually:**
- Advanced Settings → UPnP
- NAT/Gaming → UPnP
- WAN Settings → UPnP

**Action:** Set to DISABLED or OFF

**Verification:**
After disabling, from your Mac:
```bash
# Check if UPnP port is still responding
nc -zv 192.168.0.1 5000
# Should fail or show "Connection refused"
```

---

### Step 2.3: Change Router Admin Password

**Location:** Usually under Administration or System

**Requirements:**
- Strong unique password (different from Pi password)
- Store in password manager (1Password, Bitwarden, etc.)

---

### Step 2.4: Disable Remote Management

**What it is:** Allows accessing router admin from the internet.

**Location varies:**
- Remote Management
- Remote Access
- WAN Access
- External Access

**Action:** Set to DISABLED

---

### Step 2.5: Verify No Port Forwards Exist

**Location:** Usually under:
- Port Forwarding
- NAT
- Virtual Servers

**Action:** Delete ALL rules if any exist.

**Take a screenshot** of the empty port forwarding page for documentation.

---

### Step 2.6: Check for Firmware Updates

**Location:** Usually under:
- Administration → Firmware Update
- System → Update

**Action:** Install any available updates (may require router restart).

---

## Phase 3: Tailscale VPN Setup

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║  🔐 Tailscale creates an encrypted tunnel - no port forwarding needed!       ║
║                                                                               ║
║  How it works:                                                                ║
║  ┌──────────┐                              ┌──────────┐                      ║
║  │ Your Pi  │═══ Encrypted Tunnel ════════│Your Phone│                      ║
║  │100.x.x.x │    (via Tailscale network)  │100.y.y.y │                      ║
║  └──────────┘                              └──────────┘                      ║
║                                                                               ║
║  The 100.x.x.x IPs only work between YOUR devices. No one else can reach.   ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Step 3.1: Create Tailscale Account

**On Mac, open browser:**
```
https://login.tailscale.com/start
```

**Sign up with:** Google, GitHub, Microsoft, or email
**Recommendation:** Use the same account you use for other important services (easier to manage).

---

### Step 3.2: Install Tailscale on Pi

**On Pi via SSH:**
```bash
# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
```

**Start Tailscale:**
```bash
sudo tailscale up
```

**This will output a URL like:**
```
To authenticate, visit:
https://login.tailscale.com/a/xxxxxxxxxxxxxx
```

**Copy this URL and open it in your browser.**
- Login with the same account you created
- Authorize the device

**Get your Tailscale IP:**
```bash
tailscale ip -4
```

**Example output:**
```
100.64.0.15
```

**Write this down!** This is your Pi's Tailscale IP.

---

### Step 3.3: Install Tailscale on Mac

**Download from:** https://tailscale.com/download/mac

**Or via Homebrew:**
```bash
brew install --cask tailscale
```

**Open Tailscale app** and login with the same account.

**Get your Mac's Tailscale IP:**
```bash
tailscale ip -4
```

---

### Step 3.4: Install Tailscale on iPhone

1. Open App Store
2. Search "Tailscale"
3. Install the app
4. Login with the same account
5. Note your phone's Tailscale IP (in the app)

---

### Step 3.5: Test Access via Tailscale

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║  📱 IMPORTANT: Test from MOBILE DATA, not home WiFi!                         ║
║      On home WiFi, you're testing local network, not Tailscale.              ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

**On iPhone (disable WiFi, use mobile data):**

**Test 1: Dashboard**
```
http://100.64.0.15:8888
```
Should show your dashboard with login prompt.

**Test 2: Zigbee2MQTT**
```
http://100.64.0.15:8080
```
Should show Zigbee2MQTT interface.

**Test 3: Home Assistant**
```
http://100.64.0.15:8123
```
Should show Home Assistant.

**Test 4: SSH (use Termius or similar app)**
```
ssh pi@100.64.0.15
```
Should prompt for key passphrase, then connect.

---

### Step 3.6: Enable MagicDNS (Optional but Recommended)

**In Tailscale admin console (browser):**
1. Go to https://login.tailscale.com/admin/dns
2. Enable "MagicDNS"
3. Your Pi will be accessible as `pi` or `pi.tail12345.ts.net`

**Now you can use:**
```
http://pi:8888
http://pi:8080
http://pi:8123
ssh pi@pi
```

---

### Step 3.7: Configure Tailscale to Start on Boot

**On Pi:**
```bash
# Should already be enabled, but verify
sudo systemctl enable tailscaled
sudo systemctl status tailscaled
```

**Verification after Pi reboot:**
```bash
# Reboot Pi
sudo reboot

# Wait 2 minutes, then from Mac:
tailscale ping pi

# Should respond
```

---

## Phase 4: Local Service Hardening

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║  🔒 Even with secure remote access, local services need authentication.     ║
║      A compromised device on your network could access everything.           ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Step 4.1: Add MQTT Authentication

**Files to modify:**
- `configs/zigbee2mqtt/mosquitto.conf`
- `configs/zigbee2mqtt/configuration.yaml`
- `configs/homeassistant/configuration.yaml`
- `services/dashboard/www/js/app.js`

#### 4.1.1: Create MQTT Password File

**On Pi:**
```bash
# Enter mosquitto container
docker exec -it mosquitto sh

# Create password file
mosquitto_passwd -c /mosquitto/config/passwd mqtt_user

# Enter password when prompted (use strong password, save it!)
# Exit container
exit
```

#### 4.1.2: Update Mosquitto Config

**In repo, edit `configs/zigbee2mqtt/mosquitto.conf`:**
```conf
# Listener for MQTT protocol
listener 1883
password_file /mosquitto/config/passwd
allow_anonymous false

# Listener for WebSocket
listener 9001
protocol websockets
password_file /mosquitto/config/passwd

# Persistence
persistence true
persistence_location /mosquitto/data/
```

#### 4.1.3: Update Zigbee2MQTT Config

**In repo, edit `configs/zigbee2mqtt/configuration.yaml`:**
```yaml
mqtt:
  base_topic: zigbee2mqtt
  server: mqtt://mosquitto:1883
  user: mqtt_user
  password: YOUR_MQTT_PASSWORD
```

#### 4.1.4: Update Home Assistant Config

**In repo, edit `configs/homeassistant/configuration.yaml`:**
Add under existing mqtt section:
```yaml
mqtt:
  broker: mosquitto
  port: 1883
  username: mqtt_user
  password: YOUR_MQTT_PASSWORD
```

#### 4.1.5: Update Dashboard

**In repo, edit `services/dashboard/www/js/app.js`:**
Find MQTT connection and add credentials:
```javascript
const mqttOptions = {
    username: 'mqtt_user',
    password: 'YOUR_MQTT_PASSWORD'
};
```

#### 4.1.6: Deploy and Verify

```bash
# Copy updated configs to Pi
scp configs/zigbee2mqtt/mosquitto.conf pi:/path/to/mosquitto/config/
scp configs/zigbee2mqtt/configuration.yaml pi:/path/to/z2m/config/

# Restart services
ssh pi "cd /path/to/docker && docker-compose restart mosquitto zigbee2mqtt"

# Verify MQTT rejects anonymous
mosquitto_sub -h pi -t "#" -v
# Should fail with "Connection refused"

# Verify with credentials
mosquitto_sub -h pi -t "#" -v -u mqtt_user -P YOUR_PASSWORD
# Should connect
```

---

### Step 4.2: Add InfluxDB Authentication

**Edit `configs/zigbee2mqtt/docker-compose.yml`:**

```yaml
influxdb:
  image: influxdb:1.8
  environment:
    - INFLUXDB_DB=homeassistant
    - INFLUXDB_HTTP_AUTH_ENABLED=true
    - INFLUXDB_ADMIN_USER=admin
    - INFLUXDB_ADMIN_PASSWORD=YOUR_STRONG_PASSWORD
  # ... rest of config
```

**Update Home Assistant:**
```yaml
influxdb:
  host: influxdb
  port: 8086
  username: admin
  password: YOUR_STRONG_PASSWORD
  database: homeassistant
```

**Update Dashboard API calls** (if applicable).

**Deploy:**
```bash
# WARNING: This may reset existing data!
# Backup InfluxDB data first if needed
ssh pi "docker-compose down influxdb && docker-compose up -d influxdb"
```

---

### Step 4.3: Add Zigbee2MQTT Frontend Authentication

**Edit `configs/zigbee2mqtt/configuration.yaml`:**
```yaml
frontend:
  port: 8080
  auth_token: YOUR_STRONG_TOKEN_HERE
```

**Verification:**
```
http://pi:8080
# Should prompt for token before showing UI
```

---

### Step 4.4: Install and Configure UFW Firewall

**On Pi:**
```bash
# Install
sudo apt install -y ufw

# Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow from local network
sudo ufw allow from 192.168.0.0/24

# Allow Tailscale interface
sudo ufw allow in on tailscale0

# Allow Docker internal
sudo ufw allow from 172.16.0.0/12

# Enable firewall
sudo ufw enable
```

**Verification:**
```bash
sudo ufw status verbose
```

**Expected output:**
```
Status: active

To                         Action      From
--                         ------      ----
Anywhere                   ALLOW       192.168.0.0/24
Anywhere on tailscale0     ALLOW       Anywhere
Anywhere                   ALLOW       172.16.0.0/12
```

---

## Phase 5: Documentation & Monitoring

### Step 5.1: Create Security Documentation

**Create `docs/09-security-hardening.md` with:**
- All changes made
- Credentials location (password manager)
- Recovery procedures
- Regular maintenance checklist

### Step 5.2: Backup All Changed Configs

```bash
cd /Users/siva/pyrepos/siva-personal/pi-setup

# Backup all configs
scp pi:/etc/ssh/sshd_config backups/configs/
scp -r pi:/path/to/docker/configs/* configs/

# Commit changes
git add -A
git commit -m "Security hardening: SSH key-only, MQTT auth, Tailscale"
```

### Step 5.3: Set Up Monitoring (Optional)

**Check fail2ban regularly:**
```bash
# Add to crontab on Pi
sudo crontab -e

# Add line:
0 9 * * * fail2ban-client status sshd | mail -s "Pi fail2ban daily" your@email.com
```

---

## Verification Checklist

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║  ✅ Complete Security Verification Checklist                                  ║
╚═══════════════════════════════════════════════════════════════════════════════╝

SSH SECURITY
┌────────────────────────────────────────────────────────────────────────────────┐
│ [ ] SSH key-based login works                                                 │
│ [ ] SSH password login is rejected                                            │
│ [ ] SSH root login is rejected                                                │
│ [ ] fail2ban is running                                                       │
│ [ ] SSH config backed up to repo                                              │
└────────────────────────────────────────────────────────────────────────────────┘

ROUTER SECURITY
┌────────────────────────────────────────────────────────────────────────────────┐
│ [ ] UPnP is disabled                                                          │
│ [ ] Router admin password changed                                             │
│ [ ] Remote management disabled                                                │
│ [ ] No port forwarding rules exist                                            │
│ [ ] Firmware is updated                                                       │
└────────────────────────────────────────────────────────────────────────────────┘

TAILSCALE
┌────────────────────────────────────────────────────────────────────────────────┐
│ [ ] Tailscale installed on Pi                                                 │
│ [ ] Tailscale installed on Mac                                                │
│ [ ] Tailscale installed on iPhone                                             │
│ [ ] Can access Pi from mobile data (not home WiFi)                            │
│ [ ] All 4 ports accessible via Tailscale IP                                   │
│ [ ] MagicDNS enabled (optional)                                               │
│ [ ] Tailscale starts on Pi boot                                               │
└────────────────────────────────────────────────────────────────────────────────┘

LOCAL SERVICES
┌────────────────────────────────────────────────────────────────────────────────┐
│ [ ] MQTT requires authentication                                              │
│ [ ] MQTT anonymous connections rejected                                       │
│ [ ] InfluxDB requires authentication                                          │
│ [ ] Zigbee2MQTT requires auth token                                           │
│ [ ] UFW firewall enabled                                                      │
│ [ ] All configs backed up to repo                                             │
└────────────────────────────────────────────────────────────────────────────────┘

DOCUMENTATION
┌────────────────────────────────────────────────────────────────────────────────┐
│ [ ] docs/09-security-hardening.md created                                     │
│ [ ] Credentials stored in password manager                                    │
│ [ ] Recovery procedures documented                                            │
│ [ ] Git commit with all changes                                               │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## Troubleshooting Guide

### SSH Issues

**Problem:** "Permission denied (publickey)"
```bash
# Check key is being offered
ssh -v pi@pi

# Look for:
# "Offering public key: /Users/you/.ssh/pi_key"

# If not offered, check ~/.ssh/config has correct path
```

**Problem:** Locked out of Pi
```bash
# Option 1: Physical access
# Connect keyboard/monitor to Pi
# Edit /etc/ssh/sshd_config
# Temporarily set PasswordAuthentication yes
# Reboot and fix

# Option 2: SD card access
# Remove SD card, mount on another Linux system
# Edit /boot/sshd_config
```

### Tailscale Issues

**Problem:** Can't connect from mobile
```bash
# On Pi, check Tailscale status
tailscale status

# Check if Pi shows "online"
# If not:
sudo systemctl restart tailscaled
```

**Problem:** Tailscale IP changed
```bash
# Get current IP
tailscale ip -4

# IPs are stable, but if changed:
# Update any bookmarks/configs
```

### Service Issues

**Problem:** MQTT won't connect after adding auth
```bash
# Check logs
docker logs mosquitto

# Verify password file exists
docker exec mosquitto cat /mosquitto/config/passwd

# Test with mosquitto_pub
docker exec mosquitto mosquitto_pub -t test -m "hello" -u mqtt_user -P password
```

---

## Emergency Recovery

### If Everything Goes Wrong

**Scenario: Can't SSH, Can't access anything**

1. **Physical Access:**
   - Connect keyboard and monitor to Pi
   - Login locally
   - Run: `sudo ufw disable`
   - Run: `sudo systemctl stop tailscaled`
   - Edit: `sudo nano /etc/ssh/sshd_config`
   - Set: `PasswordAuthentication yes`
   - Run: `sudo systemctl restart sshd`

2. **From Another Device on Network:**
   - Access Pi at `http://192.168.0.174:8123` (Home Assistant)
   - Use Terminal add-on if installed

3. **Last Resort:**
   - Reflash SD card with fresh OS
   - Restore from backups in this repo

### Backup Strategy

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ WHAT                  │ WHERE                        │ HOW OFTEN              │
├───────────────────────┼──────────────────────────────┼────────────────────────┤
│ SSH keys              │ ~/.ssh/ + password manager   │ After generation       │
│ Config files          │ pi-setup repo                │ After every change     │
│ Tailscale device      │ Tailscale admin console      │ N/A (cloud-based)      │
│ Router settings       │ Screenshot + notes           │ After changes          │
│ Service credentials   │ Password manager             │ After creation         │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## Files Modified Summary

| File | Location | Change |
|------|----------|--------|
| `sshd_config` | Pi: `/etc/ssh/` | Key-only auth |
| `mosquitto.conf` | Repo: `configs/zigbee2mqtt/` | Add authentication |
| `docker-compose.yml` | Repo: `configs/zigbee2mqtt/` | InfluxDB auth |
| `configuration.yaml` | Repo: `configs/zigbee2mqtt/` | Z2M frontend auth |
| `configuration.yaml` | Repo: `configs/homeassistant/` | MQTT/InfluxDB creds |
| `app.js` | Repo: `services/dashboard/www/js/` | MQTT credentials |
| `~/.ssh/config` | Mac: `~/.ssh/` | Pi SSH config |
| `~/.ssh/pi_key*` | Mac: `~/.ssh/` | SSH key pair |

---

## Architecture After Implementation

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                          FINAL SECURE ARCHITECTURE                            ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║   INTERNET                                                                    ║
║      │                                                                        ║
║      ├───────────────────────────────────────────────────────────────────┐   ║
║      │                                                                   │   ║
║      ▼                                                                   │   ║
║   ┌──────────────────┐                                                   │   ║
║   │  CLOUDFLARE      │  ha.sivaa.in → Home Assistant (existing)         │   ║
║   │  TUNNEL          │  DDoS protected, encrypted                       │   ║
║   └──────────────────┘                                                   │   ║
║                                                                          │   ║
║   ┌──────────────────────────────────────────────────────────────────┐  │   ║
║   │                      TAILSCALE VPN MESH                          │  │   ║
║   │  ┌─────────────┐                       ┌─────────────┐           │  │   ║
║   │  │    MAC      │═══════════════════════│    Pi       │           │  │   ║
║   │  │ 100.x.x.x   │   Encrypted Tunnel    │ 100.y.y.y   │           │  │   ║
║   │  └─────────────┘                       └─────────────┘           │  │   ║
║   │        │                                      │                  │  │   ║
║   │        │          ┌─────────────┐             │                  │  │   ║
║   │        └──────────│   iPhone    │─────────────┘                  │  │   ║
║   │                   │ 100.z.z.z   │                                │  │   ║
║   │                   └─────────────┘                                │  │   ║
║   │                                                                  │  │   ║
║   │   No port forwarding needed! Works from anywhere!               │  │   ║
║   └──────────────────────────────────────────────────────────────────┘  │   ║
║                                                                          │   ║
║   YOUR ROUTER                                                            │   ║
║   ┌────────────────────────────────────────────────────────────────────┐ │   ║
║   │  ✓ UPnP: DISABLED                                                 │ │   ║
║   │  ✓ Port Forwards: NONE                                            │ │   ║
║   │  ✓ Remote Management: DISABLED                                    │ │   ║
║   │  ✓ Admin Password: STRONG                                         │ │   ║
║   └────────────────────────────────────────────────────────────────────┘ │   ║
║                              │                                           │   ║
║                              ▼                                           │   ║
║   YOUR PI                                                                │   ║
║   ┌────────────────────────────────────────────────────────────────────┐ │   ║
║   │  ┌─────────────────────────────────────────────────────────────┐  │ │   ║
║   │  │  UFW FIREWALL                                               │  │ │   ║
║   │  │  • Allow: Local network (192.168.0.0/24)                    │  │ │   ║
║   │  │  • Allow: Tailscale interface                               │  │ │   ║
║   │  │  • Deny: Everything else                                    │  │ │   ║
║   │  └─────────────────────────────────────────────────────────────┘  │ │   ║
║   │                              │                                     │ │   ║
║   │  ┌───────────────────────────┼───────────────────────────────────┐│ │   ║
║   │  │  DOCKER SERVICES          │                                   ││ │   ║
║   │  │  ├─ SSH (22)        Key-only + fail2ban                       ││ │   ║
║   │  │  ├─ MQTT (1883)     Username/Password required                ││ │   ║
║   │  │  ├─ Z2M (8080)      Auth token required                       ││ │   ║
║   │  │  ├─ HA (8123)       Built-in auth + Cloudflare                ││ │   ║
║   │  │  ├─ Dashboard(8888) Basic auth                                ││ │   ║
║   │  │  └─ InfluxDB(8086)  Username/Password required                ││ │   ║
║   │  └───────────────────────────────────────────────────────────────┘│ │   ║
║   └────────────────────────────────────────────────────────────────────┘ │   ║
║                                                                          │   ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## Risk Acknowledgments

| Risk | Mitigation | Residual Risk |
|------|------------|---------------|
| Tailscale service breach | Cloudflare tunnel as backup for HA | Low |
| Tailscale account compromise | Strong password + 2FA | Low |
| SSH key stolen | Key passphrase required | Low |
| Local device compromise | Service auth + firewall | Medium |
| Router firmware vulnerability | Regular updates, consider replacement | Medium |
| Docker image compromise | Use official images, regular updates | Low |

---

## Success Criteria

When all boxes are checked, you have achieved a secure setup:

- [ ] SSH works ONLY with key (password rejected)
- [ ] fail2ban running and blocking attempts
- [ ] Tailscale connects from mobile data
- [ ] All 4 ports accessible via Tailscale
- [ ] Router has no UPnP, no port forwards
- [ ] MQTT rejects anonymous connections
- [ ] InfluxDB requires authentication
- [ ] Zigbee2MQTT requires auth token
- [ ] UFW firewall active
- [ ] All configs backed up to repo
- [ ] docs/09-security-hardening.md created
- [ ] Credentials in password manager
