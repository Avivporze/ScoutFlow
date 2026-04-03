# Design Spec: Dual-Source Data Pipeline (Phase 8)

**Date:** 2026-04-03
**Status:** Approved — ready for implementation
**Files changed:** 4 (no DB migration, no frontend changes)

---

## Problem

The Chrome extension currently fetches player data from FBref only. Stats aggregation takes the last table row (domestic-only, broken for multi-competition players). Market value and tactical position, which are more accurate on Transfermarkt, are never populated automatically.

---

## Solution: Background-Orchestrated Dual-Source Fetch

**Architecture:** Single-Message / Background-Orchestrated (Approach 1)

The user experience is unchanged: visit a FBref player page, extension auto-extracts and syncs. Internally, the background service worker now orchestrates two data sources before writing to Supabase.

### Flow

```
User on FBref → [content_script] extract FBref data (bio + aggregated stats)
                    ↓ chrome.runtime.sendMessage('SYNC_PLAYER', fbrefData)
             [background.ts]
               1. GET /players?fbref_url=eq.X&select=id,transfermarkt_url
               2. If transfermarkt_url exists → fetch TM page with browser-like headers
               3. Parse position + market value from TM HTML via layered regex
               4. Merge: TM position overrides FBref; TM market_value if parsed; FBref for everything else
               5. PATCH /players?id=eq.<uuid> with strict allowlist payload
                    ↓ sendResponse({ success, outcome })
             [content_script] show toast: "Synced!" or "Synced (FBref only)"
```

---

## FBref Stats Aggregation

**Problem:** `validRows[last]` takes the bottom row of the `stats_standard` table, which may be a single competition row (domestic only) for players in multiple competitions.

**Algorithm:**
1. Collect ALL rows from `table[id^="stats_standard"] tbody tr` including spacers
2. Walk backwards from the last row; stop at the first `tr.spacer` → these are the current season's rows
3. Filter out `partial_table`, `thead`, and rows without `td[data-stat="games"]`
4. In remaining rows, look for a **Total row**: `td[data-stat="comp_level"]` is empty or matches `/Comps|Leagues/i`
5. If Total row found → use it directly (no double-count risk)
6. If not found → SUM all rows in the group (each row = one competition)

---

## Transfermarkt Parsing

### Market Value (three-layer regex)
```
Layer 1: /class="[^"]*market-value-wrapper[^"]*"[\s\S]{0,800}?€\s*([\d,.]+)\s*(m|k)/i
Layer 2: /itemprop="price"[^>]*>\s*€?\s*([\d,.]+)\s*(m|k)/i
Layer 3: /Marktwert[\s\S]{0,400}?€\s*([\d,.]+)\s*(m|k)/i
```

**Normalization:** `€45.00m → €45M`, `€45.50m → €45.5M`, `€800k → €800K`

### Position (three-layer regex)
```
Layer 1: /<span[^>]*itemprop="position"[^>]*>([^<]+)<\/span>/i
Layer 2: /class="[^"]*hauptposition[^"]*"[\s\S]{0,500}?<td[^>]*>([^<]+)<\/td>/i
Layer 3: /Position:?\s*<\/td>\s*<td[^>]*>(?:<[^>]*>)*\s*([^<\n]+?)\s*(?:<|$)/i
```

**Position map:** TM verbose names → ScoutFlow codes (GK, CB, LB, RB, LWB, RWB, CDM, CM, CAM, LM, RM, LW, RW, CF, ST). Unmapped → `null`, fall back to FBref position.

### Request Headers (to prevent 403)
```
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ...Chrome/120...
Accept-Language: en-US,en;q=0.9
Accept: text/html,application/xhtml+xml,...
Referer: https://www.transfermarkt.com/
```

---

## Error Handling

| State | Trigger | Result | Toast |
|---|---|---|---|
| `PLAYER_NOT_FOUND` | GET returns 0 rows | Fatal stop | ❌ "Player not found in ScoutFlow — add them first" |
| `AUTH_MISSING` | No session in storage | Fatal stop | ❌ "Not logged in..." |
| `TM_URL_MISSING` | `transfermarkt_url IS NULL` | Soft skip | ✅ "Synced (FBref only)" |
| `TM_FETCH_FAILED` | Network error / 403 | Soft skip | ✅ "Synced (FBref only)" |
| `TM_PARSE_FAILED` | All regex layers miss | Soft skip | ✅ "Synced (FBref only)" |
| `SUPABASE_PATCH_FAILED` | DB write error | Fatal stop | ❌ "Failed to sync" |

---

## Security Compliance

1. **SSRF prevention:** Validate `transfermarkt_url` against allowlist `['https://www.transfermarkt.com', 'https://transfermarkt.com']` before fetching
2. **Data minimization:** Supabase lookup uses `select=id,transfermarkt_url` not `select=*`
3. **No raw error logging:** Remove existing `console.error('Supabase PATCH error:', errorBody)` (SECURITY_BEST_PRACTICES §3)
4. **Strict PATCH allowlist:** Payload built field-by-field; no object spread from external data
5. **Enum validation:** `preferred_foot` gated; TM position falls back to null if unmapped
6. **PATCH filter:** Uses `?id=eq.<uuid>` (from lookup) instead of `fbref_url` filter

---

## Manifest Change

```diff
"host_permissions": [
  "https://fbref.com/*",
+ "*://*.transfermarkt.com/*",
  "https://*.supabase.co/*"
]
```

---

## Files Changed

| File | Change |
|---|---|
| `extension/public/manifest.json` | Add TM host_permissions |
| `extension/src/content/content_script.ts` | Season-group stats aggregation |
| `extension/src/background/background.ts` | TM lookup + fetch + parse + merge + secure PATCH |
| `SCOUT_APP_PROJECT_PLAN.md` | Phase 8 entry + revision history |

**No DB migration. No frontend changes.**
