# Design: Playwright + Stealth FBref Scraper

**Date:** 2026-04-01
**Status:** Approved
**Phase:** Phase 6 — Local Python FBref Scraper

---

## Problem

FBref is protected by Cloudflare's multi-layer bot detection. Prior attempts using `requests` (Layer 1: UA), `cloudscraper`, and `curl_cffi` with Chrome impersonation (Layer 2: TLS fingerprint) all returned HTTP 403. A manual `cf_clearance` cookie injection test confirmed the root cause: Cloudflare applies a JavaScript challenge (Layer 3) that requires a real browser to execute before issuing a clearance cookie. Libraries that only simulate HTTP requests cannot pass this challenge.

Manual cookie injection was ruled out as too brittle for a recurring batch process.

---

## Decision

Pivot the scraper's HTTP layer from `curl_cffi` to **Playwright + playwright-stealth**. This replaces the network request with a real headless Chromium browser that executes Cloudflare's JS challenge natively. All other scraper logic (BeautifulSoup parsing, Supabase writes, rate limiting) is unchanged.

---

## Architecture

### Browser Lifecycle (Option A — confirmed)

One browser instance is launched when the script starts, shared across the entire player queue, and guaranteed-closed when the batch finishes (via `async_playwright()` context manager). No persistent daemon, no per-player browser launch.

```
script start
    └── async_playwright() context manager
            └── browser.launch()
                    └── context.new_page()
                            └── stealth_async(page)  ← applied once
                                    └── for each player:
                                            fetch_html(page, url)   ← reuses same page
                                            extract_player_stats(html)
                                            update_player_stats(id, stats)
                                            asyncio.sleep(6.5)
            └── browser.close()  ← guaranteed by context manager
script exit
```

### Components

| Component | File | Responsibility |
|---|---|---|
| Browser session | `scraper.py` `main()` | `async_playwright()` context, single page, stealth applied once |
| `fetch_html(page, url)` | `scraper.py` | Navigate → `wait_until="networkidle"` → return `page.content()` |
| `extract_player_stats(html)` | `scraper.py` | Unchanged BeautifulSoup logic; now receives HTML string |
| `fetch_players()` | `scraper.py` | Sync Supabase read — players with non-null `fbref_url` |
| `update_player_stats(id, stats)` | `scraper.py` | Sync Supabase write — stats columns + `stats_updated_at` |

### Error Handling

`fetch_html` catches two failure modes and logs structured JSON:

- `PlaywrightTimeoutError` → `{"error": "timeout", "url": "..."}` → returns `None`
- Navigation/other error → `{"error": "navigation_failed", "url": "...", "detail": "..."}` → returns `None`

Callers treat `None` as a skip (existing behavior preserved).

### Rate Limiting

`await asyncio.sleep(6.5)` between requests (~9.2 req/min, under FBref's published 10/min limit). Non-blocking since `main()` is async.

---

## Dependencies

| Package | Purpose | Replaces |
|---|---|---|
| `playwright` | Headless Chromium automation | `curl_cffi` |
| `playwright-stealth` | Patches ~20 automation signals on the page | — |
| `beautifulsoup4` | HTML parsing | unchanged |
| `supabase` | Database client | unchanged |
| `python-dotenv` | Env var loading | unchanged |

### Install Commands

```bash
pip install playwright playwright-stealth beautifulsoup4 supabase python-dotenv
playwright install chromium
```

---

## Files Changed

| File | Change |
|---|---|
| `scraper/scraper.py` | Full rewrite of HTTP layer; BeautifulSoup logic untouched |
| `scraper/requirements.txt` | Replace `curl_cffi` with `playwright`, `playwright-stealth` |
| `scraper/test_request.py` | Dead-end test from manual cookie approach — can be deleted |
| `SCOUT_APP_PROJECT_PLAN.md` | Tech stack row updated; Phase 6 status → In Progress; pivot note added |

---

## Constraints (unchanged from original spec)

- **Microservice isolation:** No changes to React frontend or Supabase schema.
- **Stats ownership:** `stats_matches`, `stats_goals`, `stats_assists`, `stats_minutes`, `stats_updated_at` are written only by the scraper, never by the UI.
- **Service role key:** Used only in `scraper/.env`, never in frontend code, never committed to git.
