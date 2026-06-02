#!/usr/bin/env python3
"""
time_to_first_call.py

Berechnet die "Time-to-First-Call" (Speed-to-Lead) aus Close CRM:
Die Zeitspanne zwischen Lead-Erstellung und dem ersten AUSGEHENDEN Anruf
(outbound) eines Callers.

Aggregiert werden Anzahl, Durchschnitt, Median und p90 – gesamt und pro Caller.

Nur Standard-Library + "requests".
"""

import csv
import os
import statistics
import sys
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import requests

# ---------------------------------------------------------------------------
# Konfiguration
# ---------------------------------------------------------------------------

BASE_URL = "https://api.close.com/api/v1/"

# Zeitfenster: Wie viele Tage zurück betrachten wir Leads und Calls?
# Begrenzt das Activity-Volumen (und damit Laufzeit + API-Last).
DAYS_BACK = 90

# Paginierung: Close erlaubt max. 100 Objekte pro Seite.
PAGE_LIMIT = 100

# Rate-Limit-Handling
MAX_RETRIES = 5
BACKOFF_BASE = 1.0  # Sekunden, Basis für exponentielles Backoff

# Ausgabe-Datei
CSV_FILE = "time_to_first_call.csv"


# ---------------------------------------------------------------------------
# HTTP-Hilfsfunktionen
# ---------------------------------------------------------------------------

def get_api_key() -> str:
    """Liest den Close API-Key aus der Umgebung. Bricht klar ab, wenn er fehlt."""
    api_key = os.environ.get("CLOSE_API_KEY")
    if not api_key:
        sys.exit(
            "FEHLER: Umgebungsvariable CLOSE_API_KEY ist nicht gesetzt.\n"
            "Setze sie z.B. mit:  export CLOSE_API_KEY='dein_api_key'"
        )
    return api_key


def request_with_retry(session: requests.Session, url: str, params: dict) -> dict:
    """
    Führt einen GET-Request aus und behandelt HTTP 429 (Rate Limit) mit
    exponentiellem Backoff. Respektiert den "Retry-After"-Header, falls vorhanden.
    """
    for attempt in range(MAX_RETRIES):
        resp = session.get(url, params=params, timeout=30)

        if resp.status_code == 429:
            # Rate Limit: warten und erneut versuchen.
            retry_after = resp.headers.get("Retry-After")
            if retry_after is not None:
                try:
                    wait = float(retry_after)
                except ValueError:
                    wait = BACKOFF_BASE * (2 ** attempt)
            else:
                wait = BACKOFF_BASE * (2 ** attempt)
            print(
                f"  Rate Limit (429). Warte {wait:.1f}s "
                f"(Versuch {attempt + 1}/{MAX_RETRIES})...",
                file=sys.stderr,
            )
            time.sleep(wait)
            continue

        # Andere Fehler hart melden.
        resp.raise_for_status()
        return resp.json()

    sys.exit(f"FEHLER: Rate Limit nach {MAX_RETRIES} Versuchen nicht überwunden ({url}).")


def paginate(session: requests.Session, endpoint: str, params: dict) -> list:
    """
    Lädt alle Objekte eines Endpoints über _skip / _limit, bis has_more == False.
    Gibt die zusammengeführte Liste aus dem "data"-Feld zurück.
    """
    results = []
    skip = 0
    url = BASE_URL + endpoint

    while True:
        page_params = dict(params)
        page_params["_skip"] = skip
        page_params["_limit"] = PAGE_LIMIT

        payload = request_with_retry(session, url, page_params)
        data = payload.get("data", [])
        results.extend(data)

        if not payload.get("has_more"):
            break
        skip += PAGE_LIMIT

    return results


# ---------------------------------------------------------------------------
# Datum-Hilfsfunktionen
# ---------------------------------------------------------------------------

def parse_dt(value: str) -> datetime:
    """
    Parst einen ISO-8601-Zeitstempel von Close (z.B. '2026-01-02T15:04:05.000000+00:00').
    Liefert ein timezone-aware datetime.
    """
    # Python's fromisoformat kommt mit dem Close-Format zurecht; sicherheitshalber
    # ein evtl. nachgestelltes 'Z' auf +00:00 normalisieren.
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    return datetime.fromisoformat(value)


def window_start_iso() -> str:
    """Untere Zeitgrenze (date_created__gte) als ISO-String, DAYS_BACK in der Vergangenheit."""
    start = datetime.now(timezone.utc) - timedelta(days=DAYS_BACK)
    return start.isoformat()


# ---------------------------------------------------------------------------
# Daten laden
# ---------------------------------------------------------------------------

def load_users(session: requests.Session) -> dict:
    """Baut ein Dict {user_id: 'Vorname Nachname'}."""
    users = paginate(session, "user/", params={})
    mapping = {}
    for u in users:
        first = (u.get("first_name") or "").strip()
        last = (u.get("last_name") or "").strip()
        name = (first + " " + last).strip() or u.get("email") or u.get("id")
        mapping[u["id"]] = name
    return mapping


def load_leads(session: requests.Session, since_iso: str) -> list:
    """Lädt alle Leads im Zeitfenster (nur id + date_created werden benötigt)."""
    params = {
        "date_created__gte": since_iso,
        "_fields": "id,date_created",
    }
    return paginate(session, "lead/", params=params)


def load_outbound_calls(session: requests.Session, since_iso: str) -> list:
    """
    Lädt alle outbound Call-Activities im Zeitfenster.
    Wir filtern serverseitig auf direction=outbound, um Volumen zu reduzieren.
    """
    params = {
        "date_created__gte": since_iso,
        "direction": "outbound",
        "_fields": "lead_id,user_id,date_created,direction",
    }
    calls = paginate(session, "activity/call/", params=params)
    # Defensiv: falls der serverseitige Filter ignoriert würde, hier nochmal sichern.
    return [c for c in calls if c.get("direction") == "outbound"]


# ---------------------------------------------------------------------------
# Statistik-Hilfsfunktionen
# ---------------------------------------------------------------------------

def percentile(values: list, pct: float) -> float:
    """
    Einfaches Perzentil (lineare Interpolation) ohne numpy.
    pct in [0, 100]. Erwartet eine nicht-leere Liste.
    """
    if not values:
        raise ValueError("percentile() auf leerer Liste")
    ordered = sorted(values)
    if len(ordered) == 1:
        return float(ordered[0])
    rank = (pct / 100.0) * (len(ordered) - 1)
    low = int(rank)
    high = min(low + 1, len(ordered) - 1)
    frac = rank - low
    return ordered[low] + (ordered[high] - ordered[low]) * frac


def fmt_minutes(minutes: float) -> str:
    """Formatiert Minuten lesbar als 'X.X h (Y min)'."""
    return f"{minutes / 60:.1f} h ({minutes:.0f} min)"


# ---------------------------------------------------------------------------
# Hauptlogik
# ---------------------------------------------------------------------------

def main():
    api_key = get_api_key()

    session = requests.Session()
    # Close: API-Key als Username, Passwort leer.
    session.auth = (api_key, "")
    session.headers.update({"Accept": "application/json"})

    since_iso = window_start_iso()
    print(f"Zeitfenster: letzte {DAYS_BACK} Tage (ab {since_iso})\n")

    # 1) User-Mapping
    print("Lade User...")
    users = load_users(session)
    print(f"  {len(users)} User geladen.")

    # 2) Leads
    print("Lade Leads...")
    leads = load_leads(session, since_iso)
    print(f"  {len(leads)} Leads geladen.")

    # 3) Outbound Calls
    print("Lade outbound Call-Activities...")
    calls = load_outbound_calls(session, since_iso)
    print(f"  {len(calls)} outbound Calls geladen.\n")

    # 4) Pro Lead den frühesten outbound Call + verantwortlichen Caller finden.
    #    first_call[lead_id] = (datetime, user_id)
    first_call = {}
    for c in calls:
        lead_id = c.get("lead_id")
        if not lead_id or not c.get("date_created"):
            continue
        call_dt = parse_dt(c["date_created"])
        existing = first_call.get(lead_id)
        if existing is None or call_dt < existing[0]:
            first_call[lead_id] = (call_dt, c.get("user_id"))

    # 5) Pro Lead delta in Minuten berechnen.
    per_lead_rows = []          # für CSV + Aggregation
    never_called = 0           # Leads ohne outbound Call
    discarded_negative = 0     # erster Call vor Lead-Erstellung (Datenfehler)

    # Aggregations-Container
    all_deltas = []                         # gesamt
    by_caller = defaultdict(list)           # user_id -> [minutes, ...]

    for lead in leads:
        lead_id = lead["id"]
        lead_created = parse_dt(lead["date_created"])

        fc = first_call.get(lead_id)
        if fc is None:
            never_called += 1
            continue

        call_dt, user_id = fc
        delta_min = (call_dt - lead_created).total_seconds() / 60.0

        if delta_min < 0:
            # Erster Call vor Lead-Erstellung -> Datenfehler, verwerfen.
            discarded_negative += 1
            continue

        caller_name = users.get(user_id, "Unbekannt")
        all_deltas.append(delta_min)
        by_caller[user_id].append(delta_min)

        per_lead_rows.append({
            "lead_id": lead_id,
            "lead_created": lead_created.isoformat(),
            "first_call_at": call_dt.isoformat(),
            "caller_name": caller_name,
            "minutes_to_first_call": round(delta_min, 2),
        })

    if discarded_negative:
        print(f"Hinweis: {discarded_negative} Lead(s) verworfen "
              f"(erster Call lag VOR Lead-Erstellung).\n")

    # 6) Ausgabe
    print_summary(
        total_leads=len(leads),
        with_call=len(all_deltas),
        never_called=never_called,
        all_deltas=all_deltas,
        by_caller=by_caller,
        users=users,
    )

    write_csv(per_lead_rows)
    print(f"\nCSV exportiert: {CSV_FILE} ({len(per_lead_rows)} Zeilen)")


def print_summary(total_leads, with_call, never_called, all_deltas, by_caller, users):
    """Lesbare Konsolen-Zusammenfassung."""
    print("=" * 64)
    print("  SPEED-TO-LEAD / TIME-TO-FIRST-CALL")
    print("=" * 64)
    print(f"  Leads gesamt:        {total_leads}")
    print(f"  davon mit Call:      {with_call}")
    print(f"  nie angerufen:       {never_called}")
    print("-" * 64)

    if not all_deltas:
        print("  Keine auswertbaren Calls im Zeitfenster – keine Statistik möglich.")
        print("=" * 64)
        return

    avg = statistics.mean(all_deltas)
    med = statistics.median(all_deltas)
    p90 = percentile(all_deltas, 90)

    # Der Median ist hier die wichtigere Kennzahl: Er ist robust gegen Ausreißer
    # (z.B. ein einzelner Lead, der erst nach Tagen angerufen wurde, zieht den
    # Durchschnitt stark nach oben, lässt den Median aber kaum wandern). Deshalb
    # heben wir ihn unten besonders hervor.
    print(f"  Durchschnitt:        {fmt_minutes(avg)}")
    print(f"  >>> MEDIAN:          {fmt_minutes(med)}   <<< (wichtigste Kennzahl)")
    print(f"  p90:                 {fmt_minutes(p90)}")
    print("=" * 64)

    # Tabelle pro Caller
    print("\n  Pro Caller:")
    header = f"  {'Caller':<24}{'Calls':>7}{'Ø (min)':>12}{'Median (min)':>15}"
    print(header)
    print("  " + "-" * (len(header) - 2))

    # Sortiert nach (robustem) Median aufsteigend – schnellste Caller zuerst.
    rows = []
    for user_id, deltas in by_caller.items():
        rows.append((
            users.get(user_id, "Unbekannt"),
            len(deltas),
            statistics.mean(deltas),
            statistics.median(deltas),
        ))
    rows.sort(key=lambda r: r[3])

    for name, count, c_avg, c_med in rows:
        print(f"  {name:<24}{count:>7}{c_avg:>12.1f}{c_med:>15.1f}")


def write_csv(rows):
    """Schreibt eine Zeile pro Lead in CSV_FILE."""
    fieldnames = [
        "lead_id",
        "lead_created",
        "first_call_at",
        "caller_name",
        "minutes_to_first_call",
    ]
    with open(CSV_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


if __name__ == "__main__":
    main()
