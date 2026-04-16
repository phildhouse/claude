# WebinarJam → Beehiiv Bridge (Cloudflare Worker)

Cloudflare-Worker, der WebinarJam-Registrierungs-Webhooks empfängt,
den Kontakt in **Beehiiv** anlegt und direkt in eine Beehiiv-**Automation**
einschreibt.

## Warum Cloudflare Workers?

- **Free Tier: 100 000 Requests/Tag.** Bei 500–1000 Events/Tag = **$0/Monat.**
- Kein Cold-Start, läuft an der Edge, Logs inklusive.
- Bei Wachstum: $5/Monat Paid-Plan deckt 10 Mio. Requests ab.

## Ablauf

```
WebinarJam (Registration Webhook)
    │  POST JSON/Form
    ▼
Worker: POST /webhook/webinarjam
    │  1) POST /v2/publications/{pub}/subscriptions          (Retry auf 5xx/429)
    │  2) POST /v2/publications/{pub}/automations/{aut}/journeys
    ▼
Sofort 200 OK an WebinarJam; Beehiiv-Calls laufen im `waitUntil`.
```

## Setup

```bash
npm install
npx wrangler login
```

### 1. Beehiiv-IDs in `wrangler.toml` eintragen

```toml
[vars]
BEEHIIV_PUBLICATION_ID = "pub_d19044b5-5ee9-421e-b3c2-ab072b4450be"
BEEHIIV_AUTOMATION_ID  = "aut_5002f3a8-5462-4387-9fe1-18f9019e6475"
```

### 2. Secrets setzen (NIE ins Repo!)

```bash
# Beehiiv API Key – vorher rotieren wenn er irgendwo geleakt wurde!
npx wrangler secret put BEEHIIV_API_KEY

# Shared secret für die Webhook-URL (optional aber empfohlen)
npx wrangler secret put WEBHOOK_SECRET
```

### 3. Deployen

```bash
npm run deploy
```

Du bekommst eine URL wie `https://webinarjam-beehiiv-bridge.<dein-subdomain>.workers.dev`.

### 4. WebinarJam konfigurieren

Integrations → **Custom / Webhook Integration** → Ziel-URL:

```
https://webinarjam-beehiiv-bridge.<subdomain>.workers.dev/webhook/webinarjam?secret=DEIN_WEBHOOK_SECRET
```

Event: **On new registration** (optional weitere).

## Lokale Entwicklung

```bash
cp .dev.vars.example .dev.vars   # trage API key + secret ein
npm run dev                      # startet wrangler dev auf http://localhost:8787
```

Test:

```bash
curl -X POST http://localhost:8787/webhook/webinarjam \
  -H 'content-type: application/json' \
  -H "x-webhook-secret: $WEBHOOK_SECRET" \
  -d '{"email":"test@example.com","first_name":"Max","last_name":"Muster","webinar_name":"Demo"}'
```

## Logs in Produktion ansehen

```bash
npm run tail
```

Oder im Cloudflare Dashboard → Workers & Pages → dein Worker → Logs.

## Unterstützte WebinarJam-Felder

Pflicht: `email` (oder `user_email` / `registrant_email`).
Optional: `first_name`, `last_name`, `name`/`full_name` (wird gesplittet),
`phone`/`phone_number`, `webinar_id`, `webinar_name`, `schedule`, `timezone`.

Alles außer Name landet als **Custom Field** am Beehiiv-Subscriber.

## Kosten-Check

| Volumen/Tag | Requests/Monat | Cloudflare-Kosten |
| --- | --- | --- |
| 1 000 | 30 000 | **$0** (Free Tier) |
| 5 000 | 150 000 | **$5** (Paid Plan) |
| 100 000 | 3 000 000 | **$5** (innerhalb 10 Mio. inkl.) |

Beehiiv-API selbst hat keine Zusatzkosten – nur dein Beehiiv-Plan.
