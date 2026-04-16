# WebinarJam → Beehiiv Bridge

Kleiner Node.js-Webhook-Server: empfängt Registranten-Events von **WebinarJam**,
legt sie in **Beehiiv** als Subscriber an und schreibt sie direkt in eine
Beehiiv-**Automation** ein.

## So läuft's ab

```
WebinarJam (Registration Webhook)
    │  POST JSON/Form: { name, email, phone, schedule, ... }
    ▼
POST /webhook/webinarjam  (dieser Server)
    │  1) POST /v2/publications/{pub}/subscriptions
    │  2) POST /v2/publications/{pub}/automations/{aut}/journeys
    ▼
Beehiiv Subscriber + Automation Journey gestartet
```

## Setup

```bash
npm install
cp .env.example .env
# .env ausfüllen (siehe unten)
npm start
```

### Pflicht-ENV-Vars

| Variable | Beschreibung |
| --- | --- |
| `BEEHIIV_API_KEY` | API-Key aus Beehiiv → Settings → Integrations → API |
| `BEEHIIV_PUBLICATION_ID` | z. B. `pub_xxxx…` (in der URL deiner Publication sichtbar) |
| `BEEHIIV_AUTOMATION_ID` | z. B. `aut_xxxx…` (in der URL der Automation sichtbar) |

### Optional

| Variable | Default | Zweck |
| --- | --- | --- |
| `BEEHIIV_UTM_SOURCE` | `webinarjam` | UTM-Quelle für das Reporting in Beehiiv |
| `BEEHIIV_SEND_WELCOME_EMAIL` | `false` | Beehiiv-Welcome-Mail beim Anlegen senden |
| `BEEHIIV_REACTIVATE_EXISTING` | `true` | Zuvor abgemeldete Kontakte reaktivieren |
| `WEBHOOK_SECRET` | – | Shared Secret; per `x-webhook-secret`-Header oder `?secret=` übergeben |
| `PORT` | `3000` | Port, auf dem der Server läuft |

## WebinarJam konfigurieren

1. Im WebinarJam-Backend: **Integrations → Custom / Webhook Integration**.
2. Als Ziel-URL eintragen:
   `https://deine-domain.tld/webhook/webinarjam?secret=DEIN_SECRET`
3. Event: **On new registration** (und optional weitere).
4. Als Format JSON oder Form-URL-Encoded – beides wird akzeptiert.

Unterstützte Felder (alle optional bis auf `email`):

- `email` (oder `user_email`, `registrant_email`)
- `first_name`, `last_name` – oder `name` / `full_name` (wird gesplittet)
- `phone` / `phone_number`
- `webinar_id`, `webinar_name`, `schedule`, `timezone`

Alle Nicht-Namens-Felder landen als Custom Fields am Beehiiv-Subscriber.

## Endpoints

- `GET /health` → `{ ok: true }`
- `POST /webhook/webinarjam` → legt Subscriber an und startet die Automation

Beispiel-Test lokal:

```bash
curl -X POST http://localhost:3000/webhook/webinarjam \
  -H 'Content-Type: application/json' \
  -H "x-webhook-secret: $WEBHOOK_SECRET" \
  -d '{"email":"test@example.com","first_name":"Max","last_name":"Muster","webinar_name":"Demo"}'
```

Erwartete Antwort:

```json
{ "ok": true, "subscription_id": "sub_…", "journey_id": "jrn_…" }
```

## Deploy

Läuft auf jedem Node-18+-Host (Railway, Render, Fly.io, Vercel mit
Node-Runtime, eigener VPS …). Wichtig: `.env`-Vars als echte Environment-
Variablen im Hosting-Provider setzen, **nicht** mitdeployen.
