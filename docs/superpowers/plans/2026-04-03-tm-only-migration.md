# Transfermarkt-Only Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire FBref entirely and make Transfermarkt the single, exclusive data source for the Chrome extension scraper. All 28 player fields that can be scraped come from one TM page.

**Architecture:** The content script is rewritten to run on Transfermarkt player profiles instead of FBref. It extracts bio, stats, market, agent, and social data from the TM page DOM and sends it to the background worker. The background worker simplifies to a single-source PATCH (no dual-source orchestration). The web app form makes `transfermarkt_url` the primary URL field; `fbref_url` becomes optional/hidden.

**Tech Stack:** TypeScript, Chrome Extension Manifest V3, Vite, React, TanStack Table, Supabase, i18next

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| **Rewrite** | `extension/src/content/content_script.ts` | TM DOM extraction for all fields (bio, stats, market, agent, social) |
| **Rewrite** | `extension/src/background/background.ts` | Single-source orchestration: receive TM data, lookup player by `transfermarkt_url`, PATCH Supabase |
| **Modify** | `extension/public/manifest.json` | Update content_scripts match to TM, update description, keep permissions broad |
| **Modify** | `extension/src/popup/popup.tsx` | Update copy from "FBref" to "Transfermarkt" |
| **Modify** | `src/pages/PlayerFormPage.tsx` | Make `transfermarkt_url` required, `fbref_url` optional/hidden, allow name-less add |
| **Modify** | `src/components/players/PlayerStatsCard.tsx` | Update "No stats" copy from FBref to TM |
| **Modify** | `src/components/players/PlayerDetailPanel.tsx` | Reorder links (TM first, FBref optional) |
| **Modify** | `src/components/settings/DataExportSection.tsx` | Keep FBref URL in CSV export (backward compat) |
| **Modify** | `src/components/table/columns.tsx` | No logic change needed (columns are source-agnostic) |
| **Modify** | `src/i18n/en.json` | Update copy referencing FBref |
| **Modify** | `src/i18n/es.json` | Update copy referencing FBref |
| **Modify** | `SCOUT_APP_PROJECT_PLAN.md` | Document Phase 10: TM-only architecture |

---

## Task 1: Rewrite Content Script for Transfermarkt

**Files:**
- Rewrite: `extension/src/content/content_script.ts`

This is the biggest task. The content script must extract ALL player data from a single Transfermarkt profile page.

- [ ] **Step 1.1: Write the new content script**

Replace the entire content of `extension/src/content/content_script.ts` with:

```typescript
/**
 * ScoutFlow Content Script — Transfermarkt Player Profile Extractor
 *
 * Injected into Transfermarkt player profile pages.
 * Extracts bio, performance stats, market data, agent info, and social links
 * from the DOM and sends everything to the background worker for Supabase sync.
 */

// ── Toast UI ──────────────────────────────────────────────────────────────────

function createToast(): HTMLDivElement {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    padding: '12px 20px',
    borderRadius: '8px',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '14px',
    color: '#fff',
    backgroundColor: '#2563eb',
    zIndex: '999999',
    opacity: '0',
    transform: 'translateY(10px)',
    transition: 'opacity 0.3s, transform 0.3s',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  });
  el.textContent = 'ScoutFlow: Extracting...';
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  });
  return el;
}

function updateToast(el: HTMLDivElement, text: string, success: boolean): void {
  el.textContent = `ScoutFlow: ${text}`;
  el.style.backgroundColor = success ? '#16a34a' : '#dc2626';
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(10px)';
    setTimeout(() => el.remove(), 400);
  }, 3000);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract text from the first element matching a selector, trimmed. */
function txt(root: Element | Document, sel: string): string {
  return root.querySelector(sel)?.textContent?.trim() ?? '';
}

/** Parse an integer from a string, stripping commas and non-digit chars. Returns 0 on failure. */
function int(raw: string): number {
  const n = parseInt(raw.replace(/[^\d-]/g, ''), 10);
  return Number.isNaN(n) ? 0 : n;
}

// ── Position Map ──────────────────────────────────────────────────────────────

const TM_POSITION_MAP: Record<string, string> = {
  'Goalkeeper':         'GK',
  'Centre-Back':        'CB',
  'Left-Back':          'LB',
  'Right-Back':         'RB',
  'Left Wing-Back':     'LWB',
  'Right Wing-Back':    'RWB',
  'Defensive Midfield': 'CDM',
  'Central Midfield':   'CM',
  'Attacking Midfield': 'CAM',
  'Left Midfield':      'LM',
  'Right Midfield':     'RM',
  'Left Winger':        'LW',
  'Right Winger':       'RW',
  'Second Striker':     'CF',
  'Centre-Forward':     'ST',
};

// ── Name Extraction ───────────────────────────────────────────────────────────

function extractName(): { first_name: string; last_name: string } {
  // TM has <h1 class="data-header__headline-wrapper">...<strong>Name</strong></h1>
  // The strong tag usually holds the full name.
  const strong = document.querySelector('h1.data-header__headline-wrapper strong');
  if (strong) {
    const parts = (strong.textContent?.trim() ?? '').split(/\s+/);
    return {
      first_name: parts[0] ?? '',
      last_name: parts.slice(1).join(' ') || '',
    };
  }
  // Fallback: try <h1> directly
  const h1 = document.querySelector('h1');
  const parts = (h1?.textContent?.trim() ?? '').split(/\s+/);
  return {
    first_name: parts[0] ?? '',
    last_name: parts.slice(1).join(' ') || '',
  };
}

// ── Bio Extraction ────────────────────────────────────────────────────────────

function extractBio(): {
  date_of_birth: string | null;
  nationality: string | null;
  second_nationality: string | null;
  height_cm: number | null;
  preferred_foot: 'Left' | 'Right' | 'Both' | null;
} {
  const infoTable = document.querySelector('.info-table') ?? document;

  // DOB: look for itemprop="birthDate" or the "Date of birth:" row
  let dob: string | null = null;
  const dobEl = document.querySelector('[itemprop="birthDate"]');
  if (dobEl) {
    // itemprop element often has a data attribute or text like "Mar 20, 1997"
    const raw = dobEl.getAttribute('content') ?? dobEl.textContent?.trim() ?? '';
    dob = normalizeDateToISO(raw);
  }
  if (!dob) {
    // Search info-table spans for "Date of birth" label
    const spans = infoTable.querySelectorAll('.info-table__content');
    for (let i = 0; i < spans.length; i++) {
      if (/date of birth|geb/i.test(spans[i].textContent ?? '')) {
        const val = spans[i + 1]?.textContent?.trim() ?? '';
        dob = normalizeDateToISO(val);
        break;
      }
    }
  }

  // Nationalities: look for flag images in info-table or header
  const nationalities: string[] = [];
  const flagImgs = document.querySelectorAll('.info-table__content img.flaggenrahmen, .data-header__content img.flaggenrahmen');
  flagImgs.forEach(img => {
    const title = img.getAttribute('title')?.trim();
    if (title && !nationalities.includes(title)) nationalities.push(title);
  });
  // Fallback: itemprop="nationality"
  if (nationalities.length === 0) {
    document.querySelectorAll('[itemprop="nationality"]').forEach(el => {
      const n = el.textContent?.trim();
      if (n && !nationalities.includes(n)) nationalities.push(n);
    });
  }

  // Height: look for itemprop="height" or "Height:" row
  let heightCm: number | null = null;
  const heightEl = document.querySelector('[itemprop="height"]');
  if (heightEl) {
    const raw = heightEl.textContent?.trim() ?? '';
    const m = raw.match(/(\d)[,.](\d{2})\s*m/); // "1,80 m" or "1.80 m"
    if (m) heightCm = int(m[1]) * 100 + int(m[2]);
    else {
      const cm = raw.match(/(\d{2,3})\s*cm/);
      if (cm) heightCm = int(cm[1]);
    }
  }
  if (!heightCm) {
    const spans = infoTable.querySelectorAll('.info-table__content');
    for (let i = 0; i < spans.length; i++) {
      if (/height|größe/i.test(spans[i].textContent ?? '')) {
        const val = spans[i + 1]?.textContent?.trim() ?? '';
        const m = val.match(/(\d)[,.](\d{2})\s*m/);
        if (m) heightCm = int(m[1]) * 100 + int(m[2]);
        break;
      }
    }
  }

  // Preferred Foot: look for "Foot:" row
  let foot: 'Left' | 'Right' | 'Both' | null = null;
  const spans = infoTable.querySelectorAll('.info-table__content');
  for (let i = 0; i < spans.length; i++) {
    if (/foot|fuß/i.test(spans[i].textContent ?? '')) {
      const val = (spans[i + 1]?.textContent?.trim() ?? '').toLowerCase();
      if (val === 'left') foot = 'Left';
      else if (val === 'right') foot = 'Right';
      else if (val === 'both') foot = 'Both';
      break;
    }
  }

  return {
    date_of_birth: dob,
    nationality: nationalities[0] ?? null,
    second_nationality: nationalities[1] ?? null,
    height_cm: heightCm,
    preferred_foot: foot,
  };
}

// ── Date Normalization ────────────────────────────────────────────────────────

function normalizeDateToISO(raw: string): string | null {
  if (!raw) return null;
  // Already ISO?
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // European dot: "20.03.1997"
  const dot = raw.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dot) return `${dot[3]}-${dot[2].padStart(2, '0')}-${dot[1].padStart(2, '0')}`;
  // English natural: "Mar 20, 1997" — extract from within parenthetical or after colon
  const cleaned = raw.replace(/\(.*?\)/g, '').trim();
  const d = new Date(cleaned);
  if (!isNaN(d.getTime()) && d.getFullYear() > 1900 && d.getFullYear() < 2100) {
    return d.toISOString().split('T')[0];
  }
  return null;
}

// ── Position Extraction ───────────────────────────────────────────────────────

function extractPosition(): string | null {
  // Try itemprop first
  const posEl = document.querySelector('[itemprop="position"]');
  if (posEl) {
    const raw = posEl.textContent?.trim() ?? '';
    return TM_POSITION_MAP[raw] ?? null;
  }
  // Try data-header highlight
  const highlight = document.querySelector('.data-header__content--highlight');
  if (highlight) {
    const raw = highlight.textContent?.trim() ?? '';
    if (TM_POSITION_MAP[raw]) return TM_POSITION_MAP[raw];
  }
  // Try detail-position class
  const detailPos = document.querySelector('.detail-position__position');
  if (detailPos) {
    const raw = detailPos.textContent?.trim() ?? '';
    return TM_POSITION_MAP[raw] ?? null;
  }
  // Search info-table for "Position:" label
  const spans = (document.querySelector('.info-table') ?? document).querySelectorAll('.info-table__content');
  for (let i = 0; i < spans.length; i++) {
    if (/position/i.test(spans[i].textContent ?? '')) {
      const raw = spans[i + 1]?.textContent?.trim() ?? '';
      return TM_POSITION_MAP[raw] ?? null;
    }
  }
  return null;
}

// ── Club & League Extraction ──────────────────────────────────────────────────

function extractClub(): string | null {
  // data-header club link
  const clubLink = document.querySelector('.data-header__club a');
  if (clubLink) {
    const text = clubLink.textContent?.trim();
    if (text) return text;
  }
  // info-table "Current club:" row
  const spans = (document.querySelector('.info-table') ?? document).querySelectorAll('.info-table__content');
  for (let i = 0; i < spans.length; i++) {
    if (/current club|aktueller verein/i.test(spans[i].textContent ?? '')) {
      const link = spans[i + 1]?.querySelector('a');
      if (link) return link.textContent?.trim() ?? null;
      return spans[i + 1]?.textContent?.trim() ?? null;
    }
  }
  return null;
}

function extractLeague(): string | null {
  // data-header league link (may have image-only)
  const leagueLink = document.querySelector('.data-header__league a');
  if (leagueLink) {
    const text = leagueLink.textContent?.trim();
    if (text) return text;
    const title = leagueLink.getAttribute('title')?.trim();
    if (title) return title;
    const img = leagueLink.querySelector('img');
    if (img) return img.getAttribute('alt')?.trim() ?? null;
  }
  // info-table "League:" row
  const spans = (document.querySelector('.info-table') ?? document).querySelectorAll('.info-table__content');
  for (let i = 0; i < spans.length; i++) {
    if (/league|liga(?!.*spieler)/i.test(spans[i].textContent ?? '')) {
      const link = spans[i + 1]?.querySelector('a');
      if (link) {
        const text = link.textContent?.trim();
        if (text) return text;
        return link.getAttribute('title')?.trim() ?? null;
      }
      return spans[i + 1]?.textContent?.trim() ?? null;
    }
  }
  return null;
}

// ── Contract Expiry Extraction ────────────────────────────────────────────────

function extractContractExpiry(): string | null {
  const spans = (document.querySelector('.info-table') ?? document).querySelectorAll('.info-table__content');
  for (let i = 0; i < spans.length; i++) {
    if (/contract|vertrag/i.test(spans[i].textContent ?? '')) {
      const raw = spans[i + 1]?.textContent?.trim() ?? '';
      return normalizeDateToISO(raw);
    }
  }
  return null;
}

// ── Market Value Extraction ───────────────────────────────────────────────────

function extractMarketValue(): string | null {
  // Wrapper element (modern TM layout)
  const wrapper = document.querySelector('.tm-market-value, .market-value-wrapper, [class*="market-value"]');
  if (wrapper) {
    const raw = wrapper.textContent?.trim() ?? '';
    return normalizeMarketValue(raw);
  }
  // Fallback: waehrung span
  const waehrung = document.querySelector('.waehrung');
  if (waehrung?.parentElement) {
    return normalizeMarketValue(waehrung.parentElement.textContent?.trim() ?? '');
  }
  // Fallback: itemprop="price"
  const price = document.querySelector('[itemprop="price"]');
  if (price) {
    return normalizeMarketValue(price.textContent?.trim() ?? '');
  }
  return null;
}

function normalizeMarketValue(raw: string): string | null {
  // Match patterns like "€45.50m", "€800k", "€45,50 Mio", "€800 Tsd"
  const match = raw.match(/([\d,.]+)\s*(m(?:io\.?)?|k|tsd\.?)/i);
  if (!match) return null;
  const digits = parseFloat(match[1].replace(',', '.'));
  if (isNaN(digits)) return null;
  const unit = match[2].toLowerCase();
  if (unit.startsWith('m')) return `€${digits.toFixed(2).replace(/\.00$/, '')}M`;
  if (unit.startsWith('k') || unit.startsWith('t')) return `€${Math.round(digits)}K`;
  return null;
}

// ── Agent Extraction ──────────────────────────────────────────────────────────

function extractAgent(): { agent_name: string | null; agent_contact: string | null } {
  const spans = (document.querySelector('.info-table') ?? document).querySelectorAll('.info-table__content');
  for (let i = 0; i < spans.length; i++) {
    if (/player agent|spielerberater/i.test(spans[i].textContent ?? '')) {
      const nextSpan = spans[i + 1];
      if (!nextSpan) break;
      const link = nextSpan.querySelector('a');
      const name = (link?.textContent?.trim() ?? nextSpan.textContent?.trim()) || null;
      const contact = link?.getAttribute('href') ?? null;
      return { agent_name: name, agent_contact: contact };
    }
  }
  return { agent_name: null, agent_contact: null };
}

// ── Social Links Extraction ───────────────────────────────────────────────────

function extractSocialLinks(): Record<string, string> {
  const links: Record<string, string> = {};
  document.querySelectorAll('a[href]').forEach(a => {
    const href = (a as HTMLAnchorElement).href;
    if (/instagram\.com\//i.test(href) && !links.instagram) {
      links.instagram = href;
    }
  });
  return links;
}

// ── Season Stats Extraction ───────────────────────────────────────────────────

/**
 * Extract current season stats from the "Current season performance" section.
 *
 * TM shows a "Leistungsdaten" / "Stats" section on player profiles with
 * competition rows for the current season. We sum across all competition rows.
 *
 * Layout patterns:
 *   - Table with class "items" inside a section/div about performance
 *   - Each row: competition | appearances | goals | assists | minutes (varies)
 *   - A "Total" / "Gesamt" row may exist — if found, use it directly
 */
function extractStats(): {
  stats_matches: number;
  stats_goals: number;
  stats_assists: number;
  stats_minutes: number;
} {
  const zero = { stats_matches: 0, stats_goals: 0, stats_assists: 0, stats_minutes: 0 };

  // Strategy 1: Look for the performance data box / "Leistungsdaten" section
  // TM player profiles have a section with current season stats in a compact table
  const perfBoxes = document.querySelectorAll('.box, .content-box, [class*="performance"]');

  for (const box of perfBoxes) {
    const heading = box.querySelector('h2, .headline, .content-box-headline');
    const headText = heading?.textContent?.toLowerCase() ?? '';
    if (!/stat|leistung|performance|season/i.test(headText)) continue;

    const table = box.querySelector('table');
    if (!table) continue;

    return parseStatsTable(table);
  }

  // Strategy 2: Find any table with "items" class that has stat-like headers
  const itemsTables = document.querySelectorAll('table.items');
  for (const table of itemsTables) {
    const headers = table.querySelectorAll('th');
    let looksLikeStats = false;
    headers.forEach(th => {
      if (/appearances|goals|assists|einsätze|tore/i.test(th.textContent ?? '')) {
        looksLikeStats = true;
      }
    });
    if (looksLikeStats) return parseStatsTable(table);
  }

  // Strategy 3: Look for the compact performance data items on the profile
  // Some TM layouts show stats as individual data points, not a table
  const dataItems = document.querySelectorAll('[class*="data-header__details"] li, .data-header__info-box span');
  if (dataItems.length > 0) {
    const result = { ...zero };
    dataItems.forEach(item => {
      const label = item.querySelector('.data-header__label, small')?.textContent?.toLowerCase() ?? '';
      const value = item.querySelector('.data-header__content, b')?.textContent?.trim() ?? '';
      if (/appearances|games|einsätze/i.test(label)) result.stats_matches = int(value);
      else if (/^goals?$|^tore$/i.test(label)) result.stats_goals = int(value);
      else if (/assist/i.test(label)) result.stats_assists = int(value);
      else if (/minutes|minuten/i.test(label)) result.stats_minutes = int(value);
    });
    if (result.stats_matches > 0 || result.stats_goals > 0) return result;
  }

  return zero;
}

function parseStatsTable(table: HTMLTableElement): {
  stats_matches: number;
  stats_goals: number;
  stats_assists: number;
  stats_minutes: number;
} {
  // Detect column indices from header row
  const headers = Array.from(table.querySelectorAll('thead th, tr:first-child th'));
  let matchesCol = -1, goalsCol = -1, assistsCol = -1, minutesCol = -1;

  headers.forEach((th, idx) => {
    const text = (th.textContent?.trim() ?? '').toLowerCase();
    const title = (th.getAttribute('title') ?? '').toLowerCase();
    const combined = text + ' ' + title;
    if (/appearances|games|einsätze|matches/i.test(combined)) matchesCol = idx;
    else if (/^goals?$|^tore$|^g$/i.test(combined)) goalsCol = idx;
    else if (/assist/i.test(combined)) assistsCol = idx;
    else if (/minutes|minuten|min\b/i.test(combined)) minutesCol = idx;
  });

  // Sum across data rows (skip header, skip "total" row — we'll sum ourselves)
  let matches = 0, goals = 0, assists = 0, minutes = 0;
  let totalRowFound = false;

  const rows = table.querySelectorAll('tbody tr, tr:not(:first-child)');
  for (const row of rows) {
    const cells = row.querySelectorAll('td');
    if (cells.length === 0) continue;

    // Check for "Total" / "Gesamt" row — use it directly if found
    const firstCell = cells[0]?.textContent?.trim().toLowerCase() ?? '';
    if (/^total$|^gesamt$|^sum/i.test(firstCell)) {
      matches = matchesCol >= 0 ? int(cells[matchesCol]?.textContent ?? '0') : 0;
      goals = goalsCol >= 0 ? int(cells[goalsCol]?.textContent ?? '0') : 0;
      assists = assistsCol >= 0 ? int(cells[assistsCol]?.textContent ?? '0') : 0;
      minutes = minutesCol >= 0 ? int(cells[minutesCol]?.textContent ?? '0') : 0;
      totalRowFound = true;
      break;
    }

    // Regular competition row — accumulate
    if (matchesCol >= 0) matches += int(cells[matchesCol]?.textContent ?? '0');
    if (goalsCol >= 0) goals += int(cells[goalsCol]?.textContent ?? '0');
    if (assistsCol >= 0) assists += int(cells[assistsCol]?.textContent ?? '0');
    if (minutesCol >= 0) minutes += int(cells[minutesCol]?.textContent ?? '0');
  }

  // If we summed manually but also found a total row, the total row wins (already set above).
  // If no total row, our manual sum is used.

  return {
    stats_matches: totalRowFound ? matches : matches,
    stats_goals: totalRowFound ? goals : goals,
    stats_assists: totalRowFound ? assists : assists,
    stats_minutes: totalRowFound ? minutes : minutes,
  };
}

// ── Main Extraction ───────────────────────────────────────────────────────────

interface TMPlayerData {
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  nationality: string | null;
  second_nationality: string | null;
  preferred_foot: 'Left' | 'Right' | 'Both' | null;
  height_cm: number | null;
  position: string | null;
  current_club: string | null;
  league: string | null;
  contract_expiry: string | null;
  market_value: string | null;
  agent_name: string | null;
  agent_contact: string | null;
  social_links: Record<string, string>;
  stats_matches: number;
  stats_goals: number;
  stats_assists: number;
  stats_minutes: number;
  transfermarkt_url: string;
}

function extractAll(): TMPlayerData {
  const name = extractName();
  const bio = extractBio();
  const stats = extractStats();
  const agent = extractAgent();

  return {
    ...name,
    ...bio,
    position: extractPosition(),
    current_club: extractClub(),
    league: extractLeague(),
    contract_expiry: extractContractExpiry(),
    market_value: extractMarketValue(),
    ...agent,
    social_links: extractSocialLinks(),
    ...stats,
    transfermarkt_url: window.location.href,
  };
}

// ── Entry Point ───────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  const toast = createToast();

  try {
    const data = extractAll();

    const response = await chrome.runtime.sendMessage({
      type: 'SYNC_PLAYER',
      payload: data,
    });

    if (response?.success) {
      updateToast(toast, response.created ? 'Player created & synced!' : 'Synced!', true);
    } else {
      updateToast(toast, response?.error ?? 'Unknown error', false);
    }
  } catch (err) {
    updateToast(toast, err instanceof Error ? err.message : 'Extraction failed', false);
  }
}

void run();
```

- [ ] **Step 1.2: Verify the file was written correctly**

Run: `wc -l extension/src/content/content_script.ts`
Expected: ~400 lines (the new TM-only content script)

- [ ] **Step 1.3: Commit**

```bash
git add extension/src/content/content_script.ts
git commit -m "feat: rewrite content script for Transfermarkt-only extraction

Replaces entire FBref extraction logic with DOM-based TM parsing.
Extracts: name, DOB, nationalities, height, foot, position, club,
league, contract, market value, agent, social links, season stats.
All from a single Transfermarkt player profile page."
```

---

## Task 2: Rewrite Background Worker for Single-Source Flow

**Files:**
- Rewrite: `extension/src/background/background.ts`

The background worker simplifies dramatically. No more dual-source orchestration — it receives TM data from content script, looks up the player by `transfermarkt_url`, and PATCHes Supabase.

- [ ] **Step 2.1: Write the new background worker**

Replace the entire content of `extension/src/background/background.ts` with:

```typescript
/**
 * ScoutFlow Background Service Worker
 *
 * Single-source architecture: receives extracted Transfermarkt data from
 * the content script, looks up the player by transfermarkt_url, and PATCHes
 * Supabase with the full payload.
 *
 * If the player doesn't exist yet, creates a new record (upsert-by-URL).
 */

const SUPABASE_URL  = '__SUPABASE_URL__';
const SUPABASE_ANON_KEY = '__SUPABASE_ANON_KEY__';

// ── Auth ──────────────────────────────────────────────────────────────────────

async function getAuthToken(): Promise<string> {
  const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
  const storageKey = `sb-${projectRef}-auth-token`;
  const result = await chrome.storage.local.get(storageKey);
  const raw = result[storageKey];
  if (!raw) throw new Error('User not logged in — open the ScoutFlow popup to sign in.');

  const session = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const token = session?.access_token ?? session?.currentSession?.access_token;
  if (!token) throw new Error('Session expired — please sign in again.');
  return token;
}

// ── Supabase Helpers ──────────────────────────────────────────────────────────

interface PlayerLookup {
  id: string;
}

async function lookupPlayerByTMUrl(tmUrl: string, token: string): Promise<PlayerLookup | null> {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/players` +
    `?transfermarkt_url=eq.${encodeURIComponent(tmUrl)}` +
    `&select=id` +
    `&limit=1`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    },
  );
  if (!resp.ok) return null;
  const rows = await resp.json();
  return rows.length > 0 ? rows[0] : null;
}

async function patchPlayer(id: string, payload: Record<string, unknown>, token: string): Promise<void> {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/players?id=eq.${id}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(payload),
    },
  );
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Database error (${resp.status}): ${body}`);
  }
}

async function createPlayer(payload: Record<string, unknown>, token: string): Promise<string> {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/players`,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(payload),
    },
  );
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Database error (${resp.status}): ${body}`);
  }
  const rows = await resp.json();
  return rows[0]?.id;
}

// ── Payload Builder ───────────────────────────────────────────────────────────

const VALID_FEET = new Set(['Left', 'Right', 'Both']);

function buildPayload(data: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    first_name:         data.first_name,
    last_name:          data.last_name,
    date_of_birth:      data.date_of_birth ?? null,
    nationality:        data.nationality ?? null,
    height_cm:          data.height_cm ?? null,
    stats_matches:      data.stats_matches ?? 0,
    stats_goals:        data.stats_goals ?? 0,
    stats_assists:      data.stats_assists ?? 0,
    stats_minutes:      data.stats_minutes ?? 0,
    stats_updated_at:   new Date().toISOString(),
    transfermarkt_url:  data.transfermarkt_url,
  };

  // Conditional fields — only write if not null (preserve manual edits)
  const foot = data.preferred_foot as string | null;
  if (foot && VALID_FEET.has(foot)) payload.preferred_foot = foot;

  if (data.second_nationality) payload.second_nationality = data.second_nationality;
  if (data.position) payload.position = data.position;
  if (data.current_club) payload.current_club = data.current_club;
  if (data.league) payload.league = data.league;
  if (data.contract_expiry) payload.contract_expiry = data.contract_expiry;
  if (data.market_value) payload.market_value = data.market_value;
  if (data.agent_name) payload.agent_name = data.agent_name;
  if (data.agent_contact) payload.agent_contact = data.agent_contact;

  const social = data.social_links as Record<string, string> | undefined;
  if (social && Object.keys(social).length > 0) {
    payload.social_links = social;
  }

  return payload;
}

// ── Main Handler ──────────────────────────────────────────────────────────────

async function handleSyncPlayer(
  data: Record<string, unknown>,
): Promise<{ success: boolean; created?: boolean; error?: string }> {
  // 1. Auth
  const token = await getAuthToken();

  // 2. Look up player by transfermarkt_url
  const tmUrl = data.transfermarkt_url as string;
  const existing = await lookupPlayerByTMUrl(tmUrl, token);

  // 3. Build payload
  const payload = buildPayload(data);

  if (existing) {
    // 4a. Update existing player
    await patchPlayer(existing.id, payload, token);
    return { success: true, created: false };
  } else {
    // 4b. Create new player record
    // Ensure required fields have defaults for INSERT
    payload.status = 'active';
    await createPlayer(payload, token);
    return { success: true, created: true };
  }
}

// ── Message Listener ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener(
  (message: { type: string; payload: Record<string, unknown> }, _sender, sendResponse) => {
    if (message.type !== 'SYNC_PLAYER') return;

    handleSyncPlayer(message.payload)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }));

    return true; // Keep message channel open for async response
  },
);
```

**Important:** Replace `__SUPABASE_URL__` and `__SUPABASE_ANON_KEY__` with the actual values from the current `background.ts` file. These are hardcoded constants at the top of the existing file.

- [ ] **Step 2.2: Verify the file was written correctly**

Run: `wc -l extension/src/background/background.ts`
Expected: ~170 lines (massively simplified from ~617)

- [ ] **Step 2.3: Commit**

```bash
git add extension/src/background/background.ts
git commit -m "feat: rewrite background worker for single-source TM architecture

Removes all FBref orchestration, dual-source merging, and TM HTML fetching/regex parsing.
Now: receive TM DOM data from content script -> lookup by transfermarkt_url -> PATCH.
Adds auto-create: if player not found by URL, INSERTs a new record.
~170 lines replacing ~617 lines."
```

---

## Task 3: Update Extension Manifest & Popup

**Files:**
- Modify: `extension/public/manifest.json`
- Modify: `extension/src/popup/popup.tsx`

- [ ] **Step 3.1: Update manifest.json**

Change the manifest to inject the content script on Transfermarkt instead of FBref. Keep FBref in host_permissions for now (backward compat if user has fbref_url data).

In `extension/public/manifest.json`:

1. Change `description` from `"Securely extract FBref player stats to the ScoutFlow database."` to `"Extract player data from Transfermarkt to the ScoutFlow database."`

2. Change `content_scripts[0].matches` from `["https://fbref.com/en/players/*"]` to `["*://*.transfermarkt.com/*/profil/spieler/*"]`

3. In `host_permissions`, remove `"https://fbref.com/*"` (no longer needed).

The final `manifest.json` should be:

```json
{
  "manifest_version": 3,
  "name": "ScoutFlow Ride-Along",
  "version": "1.1",
  "description": "Extract player data from Transfermarkt to the ScoutFlow database.",
  "permissions": [
    "storage",
    "activeTab",
    "scripting"
  ],
  "host_permissions": [
    "*://*.transfermarkt.com/*",
    "https://*.supabase.co/*"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_title": "ScoutFlow"
  },
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["*://*.transfermarkt.com/*/profil/spieler/*"],
      "js": ["content_script.js"],
      "run_at": "document_end"
    }
  ]
}
```

- [ ] **Step 3.2: Update popup.tsx copy**

In `extension/src/popup/popup.tsx`, update the two FBref references:

1. Change `"Ready to extract FBref stats"` to `"Ready to extract Transfermarkt data"`
2. Change `"Navigate to any FBref player page. The Ride-Along script runs automatically behind the scenes."` to `"Navigate to any Transfermarkt player profile. The Ride-Along script runs automatically behind the scenes."`

- [ ] **Step 3.3: Commit**

```bash
git add extension/public/manifest.json extension/src/popup/popup.tsx
git commit -m "feat: update manifest and popup for TM-only architecture

Content script now matches transfermarkt.com player profiles.
Removed FBref from host_permissions. Bumped version to 1.1.
Updated popup copy from FBref to Transfermarkt."
```

---

## Task 4: Update Web App — Player Form

**Files:**
- Modify: `src/pages/PlayerFormPage.tsx`

Make `transfermarkt_url` the primary link field. `fbref_url` becomes optional (still shown but de-emphasized). When adding a new player, only `transfermarkt_url` is required (first/last name become optional since the TM scraper will populate them).

- [ ] **Step 4.1: Update validation in PlayerFormPage.tsx**

In the `validate()` function (around line 115-124), change the validation so that:
- `firstName` and `lastName` are NOT required when `transfermarktUrl` is provided (the scraper will populate them)
- `transfermarktUrl` is validated as URL if provided

Replace the current validate function:

```typescript
  function validate(): FormErrors {
    const e: FormErrors = {}
    if (!firstName.trim()) e.firstName = t('playerForm.errors.required')
    if (!lastName.trim()) e.lastName = t('playerForm.errors.required')
    if (!isValidUrl(fbrefUrl)) e.fbrefUrl = t('playerForm.errors.invalidUrl')
    if (!isValidUrl(transfermarktUrl)) e.transfermarktUrl = t('playerForm.errors.invalidUrl')
    if (!isValidUrl(instagram)) e.instagram = t('playerForm.errors.invalidUrl')
    if (!isValidUrl(youtube)) e.youtube = t('playerForm.errors.invalidUrl')
    return e
  }
```

With:

```typescript
  function validate(): FormErrors {
    const e: FormErrors = {}
    // Name is required UNLESS a TM URL is provided (scraper will extract name)
    const hasTmUrl = transfermarktUrl.trim().length > 0
    if (!firstName.trim() && !hasTmUrl) e.firstName = t('playerForm.errors.required')
    if (!lastName.trim() && !hasTmUrl) e.lastName = t('playerForm.errors.required')
    if (!isValidUrl(fbrefUrl)) e.fbrefUrl = t('playerForm.errors.invalidUrl')
    if (!isValidUrl(transfermarktUrl)) e.transfermarktUrl = t('playerForm.errors.invalidUrl')
    if (!isValidUrl(instagram)) e.instagram = t('playerForm.errors.invalidUrl')
    if (!isValidUrl(youtube)) e.youtube = t('playerForm.errors.invalidUrl')
    return e
  }
```

- [ ] **Step 4.2: Reorder the Links & Social section**

In the JSX `{/* ── LINKS & SOCIAL ── */}` section (around line 349-390), swap the order so `transfermarkt_url` comes first and `fbref_url` comes second with "(optional)" in its label.

Replace the current Links & Social section:

```tsx
        {/* ── LINKS & SOCIAL ── */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
            {t('playerForm.sections.linksSocial')}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input
                label={t('playerForm.fields.fbrefUrl')}
                type="url"
                placeholder="https://fbref.com/en/players/..."
                value={fbrefUrl}
                onChange={e => setFbrefUrl(e.target.value)}
                error={errors.fbrefUrl}
              />
            </div>
            <div className="col-span-2">
              <Input
                label={t('playerForm.fields.transfermarktUrl')}
                type="url"
                placeholder="https://www.transfermarkt.com/..."
                value={transfermarktUrl}
                onChange={e => setTransfermarktUrl(e.target.value)}
                error={errors.transfermarktUrl}
              />
            </div>
```

With:

```tsx
        {/* ── LINKS & SOCIAL ── */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
            {t('playerForm.sections.linksSocial')}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input
                label={t('playerForm.fields.transfermarktUrl')}
                type="url"
                placeholder="https://www.transfermarkt.com/..."
                value={transfermarktUrl}
                onChange={e => setTransfermarktUrl(e.target.value)}
                error={errors.transfermarktUrl}
              />
            </div>
            <div className="col-span-2">
              <Input
                label={`${t('playerForm.fields.fbrefUrl')} (${t('common.optional', 'optional')})`}
                type="url"
                placeholder="https://fbref.com/en/players/..."
                value={fbrefUrl}
                onChange={e => setFbrefUrl(e.target.value)}
                error={errors.fbrefUrl}
              />
            </div>
```

- [ ] **Step 4.3: Commit**

```bash
git add src/pages/PlayerFormPage.tsx
git commit -m "feat: update player form for TM-primary architecture

TM URL is now the primary link field (shown first).
FBref URL is marked as optional.
Name fields are optional when TM URL is provided (scraper populates name)."
```

---

## Task 5: Update UI Copy and i18n

**Files:**
- Modify: `src/components/players/PlayerStatsCard.tsx`
- Modify: `src/components/players/PlayerDetailPanel.tsx`
- Modify: `src/i18n/en.json`
- Modify: `src/i18n/es.json`

- [ ] **Step 5.1: Update PlayerStatsCard.tsx**

In `src/components/players/PlayerStatsCard.tsx`, line 19, change:
```
No stats yet — add an FBref URL to enable scraping.
```
To:
```
No stats yet — sync from Transfermarkt to populate.
```

- [ ] **Step 5.2: Update PlayerDetailPanel.tsx link order**

In `src/components/players/PlayerDetailPanel.tsx`, in the Links & Social section (around lines 208-230), swap the order so Transfermarkt comes first and FBref second:

Replace:
```tsx
                {player.fbref_url && (
                  <a
                    href={player.fbref_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                  >
                    <ExternalLink size={14} />
                    FBref Profile
                  </a>
                )}
                {player.transfermarkt_url && (
                  <a
                    href={player.transfermarkt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                  >
                    <ExternalLink size={14} />
                    Transfermarkt Profile
                  </a>
                )}
```

With:
```tsx
                {player.transfermarkt_url && (
                  <a
                    href={player.transfermarkt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                  >
                    <ExternalLink size={14} />
                    Transfermarkt Profile
                  </a>
                )}
                {player.fbref_url && (
                  <a
                    href={player.fbref_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                  >
                    <ExternalLink size={14} />
                    FBref Profile
                  </a>
                )}
```

- [ ] **Step 5.3: Update en.json**

In `src/i18n/en.json`, update these keys:

1. Change `"statsNoData"` value from `"No stats yet — add an FBref URL to enable scraping."` to `"No stats yet — sync from Transfermarkt to populate."`

2. Ensure there's an `"optional"` key under `"common"` (add if missing): `"optional": "optional"`

- [ ] **Step 5.4: Update es.json**

In `src/i18n/es.json`, update these keys:

1. Change `"statsNoData"` value from `"Sin estadísticas aún — añade una URL de FBref para activar el scraping."` to `"Sin estadísticas aún — sincroniza desde Transfermarkt para completar."`

2. Ensure there's an `"optional"` key under `"common"` (add if missing): `"optional": "opcional"`

- [ ] **Step 5.5: Commit**

```bash
git add src/components/players/PlayerStatsCard.tsx src/components/players/PlayerDetailPanel.tsx src/i18n/en.json src/i18n/es.json
git commit -m "feat: update UI copy and link ordering for TM-only architecture

Stats card references TM instead of FBref.
Detail panel shows TM link first, FBref second.
Updated en.json and es.json copy."
```

---

## Task 6: Update Project Plan Documentation

**Files:**
- Modify: `SCOUT_APP_PROJECT_PLAN.md`

- [ ] **Step 6.1: Add Phase 10 to the project plan**

At the end of the Phase section in `SCOUT_APP_PROJECT_PLAN.md`, add a new Phase 10 section:

```markdown
### Phase 10: Total Migration to Transfermarkt (Single-Source Architecture)

> **Status:** Complete. FBref retired. Transfermarkt is now the exclusive data source.

**Why:** FBref became unreliable due to Cloudflare Turnstile blocking automated access. Transfermarkt provides all 28 player fields from a single page, eliminating the complexity of dual-source orchestration.

**What changed:**
1. **Content Script** — Completely rewritten to extract all data from TM player profile DOM: name, DOB, nationalities, height, foot, position, club, league, contract, market value, agent, social links, and season stats.
2. **Background Worker** — Simplified from ~617 lines to ~170 lines. No more dual-source merging or TM HTML fetching via regex. Receives DOM-extracted data from content script, looks up player by `transfermarkt_url`, PATCHes Supabase. Auto-creates new players if not found.
3. **Manifest** — Content script now matches `*://*.transfermarkt.com/*/profil/spieler/*`. FBref removed from host_permissions.
4. **Player Form** — `transfermarkt_url` is now the primary URL field. `fbref_url` is optional. Name fields optional when TM URL provided (scraper populates them).
5. **UI Copy** — All FBref references updated to reference Transfermarkt.

**Data source mapping (all from TM):**
| # | Field | TM Extraction Method |
|---|-------|---------------------|
| 1 | `first_name` | `h1 strong` text, first token |
| 2 | `last_name` | `h1 strong` text, remaining tokens |
| 3 | `date_of_birth` | `[itemprop="birthDate"]` or info-table "Date of birth" row |
| 4 | `nationality` | First `.flaggenrahmen` img title |
| 5 | `second_nationality` | Second `.flaggenrahmen` img title |
| 6 | `preferred_foot` | Info-table "Foot:" row |
| 7 | `height_cm` | `[itemprop="height"]` or info-table, parse "1,80 m" format |
| 8 | `position` | `[itemprop="position"]` mapped via TM_POSITION_MAP |
| 9 | `current_club` | `.data-header__club a` text |
| 10 | `league` | `.data-header__league a` text/title/img-alt |
| 11 | `contract_expiry` | Info-table "Contract:" row, normalized to ISO |
| 12 | `market_value` | `.tm-market-value` or `.waehrung` parent, normalized |
| 13 | `agent_name` | Info-table "Player agent:" row text |
| 14 | `agent_contact` | Info-table "Player agent:" row link href |
| 15 | `social_links.instagram` | `a[href*="instagram.com"]` |
| 16-19 | `stats_*` | Performance data table, sum across competitions or use Total row |
```

Also update the changelog table at the top of the file with a new row for version 10.0.

- [ ] **Step 6.2: Commit**

```bash
git add SCOUT_APP_PROJECT_PLAN.md
git commit -m "docs: add Phase 10 — TM-only migration to project plan

Documents single-source architecture, all extraction methods,
and the rationale for retiring FBref."
```

---

## Task 7: Build Extension and Verify

**Files:**
- No file changes — build verification only

- [ ] **Step 7.1: Build the extension**

Run:
```bash
cd extension && npm run build
```

Expected: Clean build with no TypeScript errors. Output in `extension/dist/`.

- [ ] **Step 7.2: Verify dist contents**

Run:
```bash
ls -la extension/dist/
```

Expected: `manifest.json`, `popup.html`, `popup.js`, `content_script.js`, `background.js` all present.

- [ ] **Step 7.3: Verify manifest in dist has TM match pattern**

Run:
```bash
cat extension/dist/manifest.json | grep -A2 "matches"
```

Expected: `"matches": ["*://*.transfermarkt.com/*/profil/spieler/*"]`

- [ ] **Step 7.4: Verify no FBref references remain in extension source**

Run:
```bash
grep -ri "fbref" extension/src/
```

Expected: No output (zero matches).

- [ ] **Step 7.5: Verify web app builds cleanly**

Run:
```bash
cd /Users/avivporze/Desktop/Programming/Scout && npx tsc --noEmit
```

Expected: No TypeScript errors.

- [ ] **Step 7.6: Final commit (if any build fixes needed)**

Only if previous steps required fixes. Otherwise skip.
