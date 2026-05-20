# Info-Operator Discovery

Modular creator-discovery toolkit for identifying German-speaking
**Business / Money / Coaching** creators on Instagram who qualify
for an **Info-Operator Revenue-Share-Partnership** per SOP v1.0.

> **What this is:** Apify actor configs, pure-function Python filters,
> LLM prompts, seed data. **JSON in, JSON out.**
>
> **What this isn't:** A pipeline runtime. No HTTP calls, no DB,
> no scheduler. You wire it into n8n / your own stack.

---

## 1. Pipeline Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│   STAGE 1            STAGE 2              STAGE 3          STAGE 4   │
│   ┌────────┐         ┌─────────┐         ┌────────┐       ┌────────┐ │
│   │ Apify  │         │ Apify   │         │ Python │       │ Claude │ │
│   │Hashtag │─usernames→ Profile │─profiles→ filter │─GREEN→│  LLM   │ │
│   │Scraper │         │ Scraper │         │ +score │       │qualit. │ │
│   └────────┘         └─────────┘         └────────┘       └────────┘ │
│       │                  │                   │                │      │
│       ▼                  ▼                   ▼                ▼      │
│   raw posts        raw profiles        scored.json      final.json   │
│                                                                      │
│              ┌───────────────────┐                                   │
│              │   Apify Post      │  (optional, for GREEN candidates  │
│              │   Scraper x30     │   that need engagement-trend or   │
│              └───────────────────┘   deep caption analysis)          │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

The three Apify scrapes and the Python scoring are **independent
units**. You orchestrate them in n8n (or anywhere). The LLM step is
optional but recommended — pure scraping cannot judge mindset,
expertise depth, or storytelling.

---

## 2. Directory Structure

```
info-operator-discovery/
├── README.md                          # this file
├── config/
│   └── scoring-weights.yaml           # all thresholds, weights, benchmarks
├── apify-configs/
│   ├── 01-hashtag-scraper.json        # Apify input for stage 1
│   ├── 02-profile-scraper.json        # Apify input for stage 2
│   └── 03-post-scraper.json           # Apify input for stage 3 (optional)
├── seed-data/
│   ├── hashtags.yaml                  # 25+ DACH business hashtags by sub-niche
│   ├── bio-keywords-positive.yaml     # signal words ("Coach", "skaliere", ...)
│   ├── bio-keywords-negative.yaml     # disqualifiers
│   └── dach-location-signals.yaml     # cities, flags, language markers
├── filter-logic/                      # importable Python package
│   ├── __init__.py
│   ├── normalizer.py                  # raw Apify -> internal schema
│   ├── dach_detector.py               # is_dach_creator()
│   ├── niche_classifier.py            # classify_niche_fit()
│   ├── engagement_analyzer.py         # calculate_engagement_metrics()
│   ├── funnel_detector.py             # analyze_link_in_bio()
│   ├── brand_deal_detector.py         # detect_brand_deal_dependency()
│   ├── candidate_scorer.py            # score_candidate()
│   ├── classifier.py                  # GREEN / YELLOW / RED + reasoning
│   └── pipeline.py                    # CLI: profiles.json -> scored.json
├── llm-prompts/
│   ├── mindset-analyzer.md            # paste-ready system prompt
│   ├── expertise-validator.md
│   ├── storytelling-scorer.md
│   └── outreach-hook-generator.md
├── examples/
│   ├── sample-apify-output.json       # realistic input shape
│   └── sample-scoring-output.json     # realistic output shape
└── tests/
    └── test_<module>.py               # happy-path + 1 edge case per module
```

---

## 3. Stage-by-Stage Integration

This is what an n8n flow (or any orchestrator) looks like end-to-end.

### Stage 1 — Hashtag Discovery (Apify)

- **Actor:** `apify/instagram-hashtag-scraper`
- **Input:** `apify-configs/01-hashtag-scraper.json` (templated — you
  fill `search` with one hashtag per run, e.g. `unternehmer`)
- **Output:** array of posts. Extract `ownerUsername` from each.
- **Run pattern:** loop over `seed-data/hashtags.yaml` → one Apify
  run per hashtag → concatenate post lists → dedupe usernames.
- **Budget guide:** `resultsLimit: 200` per hashtag × ~25 hashtags
  = 5 000 posts → ~$3 at $0.60/1k.

### Stage 2 — Profile Enrichment (Apify)

- **Actor:** `apify/instagram-profile-scraper`
- **Input:** `apify-configs/02-profile-scraper.json` with
  `usernames` populated from stage 1.
- **Output:** array of profile objects (followers, bio, externalUrl,
  verified, businessCategoryName, `latestPosts`, ...).
- **Batching:** the actor accepts up to ~500 usernames per run; if
  you have more, chunk in n8n.
- **Budget guide:** ~$2.30 per 1 000 profiles.

### Stage 3 — Python Scoring

```bash
python -m filter_logic.pipeline \
    --input  raw_profiles.json \
    --weights config/scoring-weights.yaml \
    --seed-dir seed-data/ \
    --output scored.json
```

What happens internally:

1. `normalizer.normalize_apify_profile(raw)` → internal `ProfileData`
2. `dach_detector.is_dach_creator(profile)` → DACH filter
3. `niche_classifier.classify_niche_fit(profile, kw+, kw-)` → niche
4. `engagement_analyzer.calculate_engagement_metrics(profile)` → ER tier
5. `funnel_detector.analyze_link_in_bio(url, bio)` → funnel maturity
6. `brand_deal_detector.detect_brand_deal_dependency(posts)` → red flag
7. `candidate_scorer.score_candidate(...)` → six mandatory scores
8. `classifier.classify(scores, ...)` → GREEN / YELLOW / RED + reasoning

Output is `scored.json` matching the schema in
`examples/sample-scoring-output.json`.
The fields `mindset_signals`, `credibility_expertise`,
`outreach_hook`, and `estimated_revenue_potential_eur_per_month`
remain `null` — they're filled in stage 4.

### Stage 4 — Qualitative LLM Pass (Claude)

For each GREEN candidate, call Claude with:

| Prompt                                  | Reads                       | Writes                             |
|-----------------------------------------|-----------------------------|------------------------------------|
| `llm-prompts/mindset-analyzer.md`       | last 10 captions            | `mandatory_scores.mindset_signals` |
| `llm-prompts/expertise-validator.md`    | bio + last 10 captions      | `mandatory_scores.credibility_expertise` |
| `llm-prompts/storytelling-scorer.md`    | last 10 captions            | `optional_criteria_met` += origin/storytelling flags |
| `llm-prompts/outreach-hook-generator.md`| bio + 3 most recent posts   | `outreach_hook`                    |

These prompts are stateless and idempotent. Send them via your normal
Claude API client (n8n HTTP node, or the Anthropic SDK).

### Stage 5 — Optional Post Deep-Dive (Apify)

If you want a precise engagement-trend (instead of the median from
`latestPosts` returned in stage 2), fire `apify-configs/03-post-scraper.json`
against the GREEN list with `resultsLimit: 30`. Use the resulting
data to recompute `engagement_analyzer.calculate_engagement_metrics`.

### Stage 6 — Hand-off

You'll likely:

- Export `scored.json` (or the LLM-enriched final) → Google Sheet,
  Airtable, Notion, or your CRM.
- Filter to `classification == "GREEN"` for outreach.
- Use `outreach_hook` as DM-opener.

---

## 4. Cost Estimate (per 1 000 candidates processed)

| Component                         | Approx. cost |
|-----------------------------------|--------------|
| Stage 1 — hashtag scrape (5k posts) | $3.00      |
| Stage 2 — profile scrape (1k profiles) | $2.30   |
| Stage 3 — Python (local, free)    | $0.00        |
| Stage 4 — LLM (~100 GREEN × 4 prompts, Sonnet) | $2.00 |
| Stage 5 — optional post deep-dive (100 × 30 posts) | $1.80 |
| **Total** (without stage 5)       | **~$7.30**   |
| **Total** (with stage 5)          | **~$9.10**   |

Rates from Apify pricing pages as of build date; verify before
production runs.

---

## 5. Output Schema

`scored.json` is an array of objects in this shape (see
`examples/sample-scoring-output.json` for a filled example):

```json
{
  "username": "max_unternehmer",
  "full_name": "Max Mustermann",
  "profile_url": "https://instagram.com/max_unternehmer",
  "followers": 28400,
  "posts_count": 412,
  "verified": false,

  "dach":          { "is_dach": true,  "confidence": 0.85, "signals": [...] },
  "niche":         { "sub_niche": "online_coaching", "niche_fit_score": 9, ... },
  "engagement":    { "avg_engagement_rate": 0.042, "tier": "high", ... },
  "funnel":        { "type": "webinar_funnel", "maturity_score": 7, ... },
  "brand_deals":   { "ratio": 0.05, "flag": "clean" },

  "mandatory_scores": {
    "niche_payment_willingness":  8,
    "monetization_gap":           6,
    "mindset_signals":            null,   // filled by LLM
    "credibility_expertise":      null,   // filled by LLM
    "audience_trust":             8,
    "growth_trend":               7
  },

  "optional_criteria_met": [],
  "classification": "PENDING_LLM_ANALYSIS",
  "manual_review_flags": [],

  "outreach_hook": null,
  "estimated_revenue_potential_eur_per_month": null,

  "raw_apify_data": { "...": "optional, for debugging" }
}
```

---

## 6. Known Limitations

- **Growth-trend:** real follower / view growth needs repeated
  scrapes. Stage 3 estimates "post frequency over the last 4 weeks"
  as a proxy. For true growth tracking, schedule weekly Stage 2
  re-runs and diff `followersCount`.
- **E-Mail list presence:** not visible from Instagram data. Mark
  for manual review or infer from external_url (e.g.
  `convertkit.com/...`, `mailerlite.com/...`).
- **Testimonials / case studies:** require LLM caption scan — handled
  in `expertise-validator.md`.
- **Mindset & expertise:** by design *not* mechanical. The two
  scores `mindset_signals` and `credibility_expertise` remain `null`
  until stage 4 runs.
- **Buy-vs-organic follower detection:** out of scope; flag profiles
  with suspiciously low engagement-to-followers ratio for manual review.

---

## 7. Tech & Dependencies

- Python 3.11+
- Runtime deps: `pandas`, `pyyaml`, `python-dateutil`
- Dev/test deps: `pytest`
- No network I/O in the Python code.

Install:

```bash
python -m venv .venv && source .venv/bin/activate
pip install pandas pyyaml python-dateutil pytest
```

---

## 8. Example: end-to-end smoke

```bash
# you already ran stage 1 + 2 in n8n / Apify and have profiles.json:
cat examples/sample-apify-output.json \
  | python -m filter_logic.pipeline \
      --weights config/scoring-weights.yaml \
      --seed-dir seed-data/ \
      > scored.json
diff <(jq -S . scored.json) <(jq -S . examples/sample-scoring-output.json)
```

If the diff is empty, your install is healthy.

---

## 9. Build Status

- [x] README (this file)
- [ ] `seed-data/` (hashtags + keyword files)
- [ ] `config/scoring-weights.yaml`
- [ ] `apify-configs/*.json`
- [ ] `filter-logic/*.py`
- [ ] `llm-prompts/*.md`
- [ ] `examples/*.json`
- [ ] `tests/*`

Built incrementally. Stop and review at each checkpoint.

---

## 10. Conventions

- All schema field names in `snake_case`.
- All booleans default to `False`, all numeric scores in `[0, 10]`
  unless explicitly noted.
- All Python functions are **pure**: input is a `dict` (parsed JSON),
  output is a `dict`. No file I/O except in `pipeline.py`.
- Threshold values live in `config/scoring-weights.yaml`,
  **never** hardcoded in module files.
- Docstrings English. Comments German allowed where it clarifies
  domain semantics.
