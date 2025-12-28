# Repository Guidelines

## Project Structure & Module Organization
- `docs/` holds numbered Raspberry Pi setup guides; keep filenames in `NN-title.md` order and update the index in `README.md` if you add a guide.
- `configs/` contains live service configs (`zigbee2mqtt/docker-compose.yml`, `homeassistant/`, `cloudflared/`, `display-scheduler/`, `pi-reboot/`); secrets such as `SERVICE_ACCOUNT.json` and tunnel creds stay off-repo.
- `backups/configs/` mirrors the current device state; treat as read-only reference and only refresh when capturing a verified new baseline.
- `scripts/` stores operational helpers (e.g., `router-reboot.sh` requiring `.env` with `ROUTER_PASSWORD`).
- `services/` holds runtime code: `mqtt-influx-bridge` (Node.js MQTT→Influx bridge) and `dashboard` static assets served by Nginx. Avoid committing generated `node_modules/`.

## Build, Test, and Development Commands
- `cd services/mqtt-influx-bridge && npm install` fetches dependencies (Node 18+).
- `MQTT_URL=mqtt://pi:1883 INFLUX_URL=http://pi:8086 npm start` runs the bridge locally; logs Zigbee/audit events and writes to InfluxDB.
- `bash scripts/router-reboot.sh` triggers the graceful router reboot; requires `~/arris-tg3442-reboot` and `.env` with `ROUTER_PASSWORD`.
- `npm run start` (same directory) is the production entry; there is no separate build step.

## Coding Style & Naming Conventions
- Markdown: concise headings/tables; keep ASCII diagrams aligned.
- YAML/JSON: 2-space indent; preserve key order used by the services.
- JavaScript: ES modules, small pure helpers; keep device mappings in `config.js` synchronized with `docs/05-zigbee-devices.md`.
- Names and commits: use device-scoped labels (`[Room] Device`) and conventional commits (`feat(dashboard): ...`, `fix(config): ...`).

## Testing Guidelines
- No automated tests. Validate the bridge by confirming MQTT subscription and Influx writes in logs; simulate messages with `mosquitto_pub` on a non-production topic when possible.
- For config edits, dry-run on a spare Pi or document rollback steps in the related doc; avoid modifying `backups/` unless saving a new vetted snapshot.

## Commit & Pull Request Guidelines
- Conventional commits (`type(scope): subject`), imperative subjects, concise scope (e.g., `dashboard`, `config`, `docs`).
- PRs should state intent, affected services/docs, required env vars, and recovery steps if deployment fails. Include screenshots or log snippets for dashboard/service behavior changes.
- Never commit secrets (`SERVICE_ACCOUNT.json`, cloudflared creds, `.env`). Use placeholders and describe how to obtain the real values.
