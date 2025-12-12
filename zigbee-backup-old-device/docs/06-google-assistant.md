# 🎤 Google Assistant Integration

> Voice control your smart home with "Hey Google, turn on the desk lamp!"

```
                    GOOGLE ASSISTANT FLOW
    ┌─────────────────────────────────────────────────────┐
    │                                                     │
    │   "Hey Google, turn on Desk Lamp"                  │
    │                     │                              │
    │                     ▼                              │
    │   ┌──────────────────────────────────────────────┐│
    │   │            Google Assistant                   ││
    │   │         (Voice Processing)                   ││
    │   └────────────────────┬─────────────────────────┘│
    │                        │                          │
    │                        ▼                          │
    │   ┌──────────────────────────────────────────────┐│
    │   │         Google Home Developer                ││
    │   │         (Cloud-to-Cloud)                     ││
    │   └────────────────────┬─────────────────────────┘│
    │                        │                          │
    │                   OAuth + API                     │
    │                        │                          │
    │                        ▼                          │
    │   ┌──────────────────────────────────────────────┐│
    │   │  https://ha.sivaa.in/api/google_assistant    ││
    │   │           (Home Assistant)                   ││
    │   └────────────────────┬─────────────────────────┘│
    │                        │                          │
    │                   MQTT Command                    │
    │                        │                          │
    │                        ▼                          │
    │   ┌──────────────────────────────────────────────┐│
    │   │              Zigbee Device                   ││
    │   │           💡 Light turns ON                 ││
    │   └──────────────────────────────────────────────┘│
    │                                                     │
    └─────────────────────────────────────────────────────┘
```

---

## 📋 Prerequisites

Before starting:
- [x] Cloudflare Tunnel working (https://ha.sivaa.in accessible)
- [x] Home Assistant configured
- [x] Devices visible in Home Assistant
- [ ] Google Cloud Platform account
- [ ] Google Home app on phone

---

## 🏗️ Architecture Overview

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Google     │     │   Google     │     │    Home      │
│  Assistant   │────►│    Cloud     │────►│  Assistant   │
│   (Voice)    │     │  (Actions)   │     │  (API)       │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                     Service Account
                     + HomeGraph API
                            │
                            ▼
                     ┌──────────────┐
                     │  Report State │
                     │  (Real-time   │
                     │   updates)    │
                     └──────────────┘
```

---

## 🔧 Step 1: Google Cloud Platform Setup

### Create Project

1. Go to: **https://console.cloud.google.com**
2. Click **Select Project** → **New Project**
3. Project name: `siva-home-assistant`
4. Click **Create**

### Enable HomeGraph API

1. Go to: **APIs & Services** → **Library**
2. Search: `HomeGraph API`
3. Click **Enable**

```
┌─────────────────────────────────────────────────────┐
│  Google Cloud Console                               │
├─────────────────────────────────────────────────────┤
│                                                     │
│  APIs & Services > Enabled APIs                     │
│                                                     │
│  ✅ HomeGraph API             Enabled              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Create Service Account

1. Go to: **IAM & Admin** → **Service Accounts**
2. Click **+ Create Service Account**
3. Configure:

| Field | Value |
|-------|-------|
| Name | `id-home-assistant` |
| Description | `Home Assistant Google integration` |

4. Grant role: **Service Account Token Creator**
5. Click **Done**

### Generate Key

1. Click on your service account
2. **Keys** tab → **Add Key** → **Create New Key**
3. Select **JSON**
4. Download file
5. Rename to `SERVICE_ACCOUNT.json`
6. Copy to Pi:
```bash
scp SERVICE_ACCOUNT.json root@dietpi.local:~/zigbee/homeassistant/
```

---

## 🏠 Step 2: Google Home Developer Console

### Create Integration

1. Go to: **https://console.home.google.com**
2. Create or select project
3. Click **+ Add Integration**
4. Select **Cloud-to-cloud**

### Configure OAuth

| Field | Value |
|-------|-------|
| Client ID | `https://oauth-redirect.googleusercontent.com/r/siva-home-assistant` |
| Client Secret | (any random string) |
| Authorization URL | `https://ha.sivaa.in/auth/authorize` |
| Token URL | `https://ha.sivaa.in/auth/token` |
| Scopes | `email`, `name` |

### Configure Fulfillment

| Field | Value |
|-------|-------|
| Cloud Fulfillment URL | `https://ha.sivaa.in/api/google_assistant` |

### Account Linking

| Field | Value |
|-------|-------|
| Linking type | OAuth |
| Grant type | Authorization code |

---

## ⚙️ Step 3: Home Assistant Configuration

### Edit configuration.yaml

```yaml
# Google Assistant Integration
google_assistant:
  project_id: siva-home-assistant
  service_account: !include SERVICE_ACCOUNT.json
  report_state: true
  exposed_domains:
    - light
    - switch
    - sensor
  entity_config:
    light.study_ikea_light:
      name: Desk Lamp
      room: Study
      aliases:
        - study light
        - desk light
        - ikea light
    sensor.bath_room_temperature:
      name: Bathroom Temperature
      room: Bathroom
    sensor.bath_room_humidity:
      name: Bathroom Humidity
      room: Bathroom
```

### Configuration Explained

| Option | Purpose |
|--------|---------|
| `project_id` | Must match GCP project name |
| `service_account` | Path to JSON key file |
| `report_state` | Push state changes to Google (recommended) |
| `exposed_domains` | Which device types to expose |
| `entity_config` | Per-device naming and room assignment |

### Restart Home Assistant

```bash
docker restart homeassistant
```

---

## 📱 Step 4: Link Account in Google Home

1. Open **Google Home** app on phone
2. Tap **+** icon
3. Select **Set up device**
4. Choose **Works with Google**
5. Search for `[test] siva-home-assistant` (or your project name)
6. Sign in with your Home Assistant credentials
7. Authorize access

```
┌─────────────────────────────────────────────────────┐
│  Google Home App                                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Link [test] siva-home-assistant                   │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │  Sign in to Home Assistant                    │ │
│  │                                               │ │
│  │  Username: ______________                     │ │
│  │  Password: ______________                     │ │
│  │                                               │ │
│  │              [Sign In]                        │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 🎤 Step 5: Sync Devices

Say: **"Hey Google, sync my devices"**

Or in Google Home app:
1. **Settings** → **Works with Google**
2. Find your project
3. Tap **Sync devices**

---

## 🗣️ Voice Commands

### Lights

| Command | Action |
|---------|--------|
| "Turn on Desk Lamp" | Light on |
| "Turn off Desk Lamp" | Light off |
| "Dim Desk Lamp to 50%" | Set brightness |
| "Turn on lights in Study" | Room control |
| "Turn off all lights" | All lights off |
| "Set Desk Lamp to warm" | Color temperature |

### Sensors

| Command | Action |
|---------|--------|
| "What's the temperature in the bathroom?" | Get temp |
| "What's the humidity in the bathroom?" | Get humidity |

### System

| Command | Action |
|---------|--------|
| "Sync my devices" | Refresh device list |

---

## 🔍 Troubleshooting

### Check Logs

```bash
docker logs homeassistant 2>&1 | grep -i google
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Device not found" | Not synced | Say "sync my devices" |
| "Something went wrong" | API error | Check HA logs |
| Can't link account | URL mismatch | Verify OAuth URLs |
| "Offline" devices | Network issue | Check Cloudflare tunnel |

### Test API Endpoint

```bash
curl -v https://ha.sivaa.in/api/google_assistant
```

Should return 401 (auth required) - that's correct!

### Enable Debug Logging

```yaml
# In configuration.yaml
logger:
  logs:
    homeassistant.components.google_assistant: debug
```

### Force Sync

```bash
# From HA Developer Tools → Services
service: google_assistant.request_sync
```

---

## 🔒 Security Notes

### What Gets Shared with Google

- Device names and types
- Room assignments
- Current states (on/off, brightness, temperature)

### What Doesn't Get Shared

- Your network topology
- Other HA entities
- Automations or scripts

### Best Practices

- Only expose necessary domains
- Use descriptive room names
- Don't expose sensitive sensors

---

## 📊 State Reporting

With `report_state: true`, Home Assistant pushes state changes to Google in real-time.

```
State Change Flow:

Physical      HA         Google     Google
Control  →  Update  →   Cloud   →   Home
  │          │           │          │
  ▼          ▼           ▼          ▼
Press     light.       HomeGraph   "Desk Lamp
switch    turn_on      API call    is now on"
```

Without report_state, Google only knows states when you ask.

---

## 🔗 Related Resources

- [Google Home Developer Console](https://console.home.google.com)
- [Google Cloud Console](https://console.cloud.google.com)
- [Home Assistant Google Integration Docs](https://www.home-assistant.io/integrations/google_assistant/)

---

## 🔗 Next Steps

Voice control is working! Continue to:
→ [Device Reference](./07-device-reference.md)

---

*Last updated: December 2025*
