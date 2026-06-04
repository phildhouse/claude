# Scrape-Spec: Educational Fitness-Creator (DACH, ≥10.000 Follower)

Ziel: Liste qualifizierter, **deutschsprachiger** Instagram-Creator im Bereich
**educational Fitness** mit **mindestens 10.000 Followern** — Ausgabe in ein
Google Sheet. Datenquelle: Apify (über MCP-Server `apify`).

## Pipeline (3 Stufen)

```
1) instagram-search-scraper   Suchbegriffe ──► Kandidaten-Usernames
2) instagram-profile-scraper  Usernames    ──► Profildetails (Follower, Bio, …)
3) Filter + Qualifizierung    Profile      ──► qualifizierte Leads ──► Google Sheet
```

Begründung: Der Search-Scraper liefert nur Treffer (Username), aber keine
Follower-/Bio-Daten. Erst der Profile-Scraper liefert `followersCount` und
`biography`, die wir zum Filtern brauchen.

## Stufe 1 — `apify/instagram-search-scraper`

Input:

```json
{
  "search": "<jeweils ein Begriff aus der Liste>",
  "searchType": "user",
  "searchLimit": 50
}
```

Suchbegriffe (DACH / educational Fitness):

- fitness coach
- personal trainer
- fitness trainer deutschland
- online fitness coach
- ernährungscoach
- fitness tipps
- fitness wissen
- krafttraining technik
- muskelaufbau coach
- abnehmen coach
- athletiktrainer
- fitness ausbildung
- evidenzbasiertes training
- physiotherapeut fitness

→ Eindeutige `username`-Liste über alle Suchläufe zusammenführen (dedupliziert).

## Stufe 2 — `apify/instagram-profile-scraper`

Input:

```json
{ "usernames": ["<username1>", "<username2>", "..."] }
```

Relevante Felder pro Profil: `username`, `fullName`, `followersCount`,
`followsCount`, `biography`, `externalUrl`, `businessCategoryName`,
`verified`, `private`, `postsCount`, `profilePicUrl`.

## Stufe 3 — Filter & Qualifizierung

Ein Profil ist **qualifiziert**, wenn ALLE Bedingungen erfüllt sind:

1. **Follower:** `followersCount >= 10000`
2. **Öffentlich:** `private == false`
3. **DACH / Deutsch** — mindestens eines:
   - Bio enthält deutsche Umlaute (ä/ö/ü/ß)
   - Bio enthält deutsches Keyword: training, ernährung, abnehmen,
     muskelaufbau, gesundheit, coach, tipps, wissen, kostenlos, anmelden
   - `externalUrl` endet auf `.de` / `.at` / `.ch`
4. **Educational** — Bio oder verlinktes Angebot deutet auf Wissensvermittlung:
   tipps, lerne, erklär*, wissen, guide, anleitung, tutorial, coaching,
   ausbildung, mentor, online kurs, programm, "so trainierst", technik,
   form, science, studie, evidenzbasiert
5. **Fitness-Nische** — Bio enthält: fitness, training, gym, kraft, muskel,
   abnehmen, ernährung, athlet, personal trainer, bodybuilding, calisthenics,
   crossfit, hyrox, laufen, mobility

**Qualitäts-Score (0–100)** zum Sortieren:
`min(followersCount/1000, 50)` + `educational-Treffer*5` + `fitness-Treffer*3`
+ `verified ? 10 : 0`. Absteigend sortieren.

## Output — Google Sheet

Neues Sheet "IG Educational Fitness Creator DACH" mit Spalten:

| username | fullName | followersCount | score | verified | biography | externalUrl | profileUrl |
|----------|----------|----------------|-------|----------|-----------|-------------|------------|

`profileUrl = https://instagram.com/<username>`. Nur qualifizierte Zeilen,
nach `score` absteigend.

## Ausführen (sobald Apify-MCP verbunden ist)

Voraussetzungen: `.mcp.json` aktiv + `APIFY_TOKEN` als Secret gesetzt +
Session neu gestartet, sodass die `mcp__apify__*`-Tools verfügbar sind.
