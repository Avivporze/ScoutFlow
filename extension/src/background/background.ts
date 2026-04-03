/**
 * ScoutFlow Ride-Along Background Service Worker
 * Orchestrates dual-source data fetch (FBref + Transfermarkt) and Supabase sync.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Only fetch Transfermarkt pages from these trusted origins (SSRF prevention).
const TM_ALLOWED_ORIGINS = [
  'https://www.transfermarkt.com',
  'https://transfermarkt.com',
];

// Maps Transfermarkt verbose position names to ScoutFlow position codes.
// Unmapped values fall back to the FBref-extracted position.
const TM_POSITION_MAP: Record<string, string> = {
  'Goalkeeper':        'GK',
  'Centre-Back':       'CB',
  'Left-Back':         'LB',
  'Right-Back':        'RB',
  'Left Wing-Back':    'LWB',
  'Right Wing-Back':   'RWB',
  'Defensive Midfield':'CDM',
  'Central Midfield':  'CM',
  'Attacking Midfield':'CAM',
  'Left Midfield':     'LM',
  'Right Midfield':    'RM',
  'Left Winger':       'LW',
  'Right Winger':      'RW',
  'Second Striker':    'CF',
  'Centre-Forward':    'ST',
};

// ── Message listener ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SYNC_PLAYER') {
    handleSyncPlayer(message.payload, sender)
      .then(result => sendResponse(result))
      .catch(() => sendResponse({ success: false, error: 'Unexpected error during sync.' }));
    return true; // Keep message channel open for async response
  }
});

// ── Auth ────────────────────────────────────────────────────────────────────

async function getAuthToken(): Promise<string> {
  const projectRef = SUPABASE_URL.split('.')[0].split('//')[1];
  const storageKey = `sb-${projectRef}-auth-token`;

  const storage = await chrome.storage.local.get(storageKey);
  const sessionData = storage[storageKey];

  if (!sessionData) {
    throw new Error('User not logged in. Please open the ScoutFlow extension popup.');
  }

  const session = typeof sessionData === 'string' ? JSON.parse(sessionData) : sessionData;
  const token: string = session.access_token;

  if (!token) {
    throw new Error('Session expired. Please log in again.');
  }

  return token;
}

// ── Supabase lookup ─────────────────────────────────────────────────────────

interface PlayerLookup {
  id: string;
  transfermarkt_url: string | null;
}

async function lookupPlayerByFbrefUrl(fbrefUrl: string, token: string): Promise<PlayerLookup | null> {
  const url =
    `${SUPABASE_URL}/rest/v1/players` +
    `?fbref_url=eq.${encodeURIComponent(fbrefUrl)}` +
    `&select=id,transfermarkt_url` +
    `&limit=1`;

  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!res.ok) return null;

  const rows: PlayerLookup[] = await res.json();
  return rows.length > 0 ? rows[0] : null;
}

// ── Transfermarkt fetch & parse ─────────────────────────────────────────────

function isTrustedTMUrl(rawUrl: string): boolean {
  try {
    const { origin } = new URL(rawUrl);
    return TM_ALLOWED_ORIGINS.includes(origin);
  } catch {
    return false;
  }
}

function parseTMPosition(html: string): string | null {
  const patterns = [
    /<span[^>]*itemprop="position"[^>]*>([^<]+)<\/span>/i,
    /class="[^"]*hauptposition[^"]*"[\s\S]{0,500}?<td[^>]*>([^<]+)<\/td>/i,
    /Position:?\s*<\/td>\s*<td[^>]*>(?:<[^>]*>)*\s*([^<\n]+?)\s*(?:<|$)/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      const raw = match[1].trim();
      return TM_POSITION_MAP[raw] ?? null;
    }
  }

  return null;
}

function normalizeMarketValue(digits: string, unit: string): string | null {
  const num = parseFloat(digits.replace(/,/g, ''));
  if (isNaN(num)) return null;

  if (unit.toLowerCase() === 'm') {
    // parseFloat(toFixed(2)) strips trailing zeros: 45.00 → 45, 45.50 → 45.5
    return `€${parseFloat(num.toFixed(2))}M`;
  }

  // 'k' suffix
  return `€${Math.round(num)}K`;
}

function parseTMMarketValue(html: string): string | null {
  // TM renders market value as: <span class="waehrung">€</span>130.00m
  // The closing </span> tag sits between the € symbol and the digit string,
  // so a naive /€\s*[\d,.]+/ pattern fails to match.
  // All patterns below account for that optional tag boundary.
  const patterns = [
    // Primary: market-value-wrapper class → € (possibly inside closed span) → number + unit
    /class="[^"]*market-value-wrapper[^"]*"[\s\S]{0,600}?€(?:<\/span>)?\s*([\d,.]+)\s*(m|k)/i,
    // Secondary: waehrung span closing tag immediately before the number
    /<span[^>]*class="[^"]*waehrung[^"]*"[^>]*>€<\/span>\s*([\d,.]+)\s*(m|k)/i,
    // Tertiary: itemprop price (semantic, stable across redesigns)
    /itemprop="price"[^>]*>[\s\S]{0,80}?([\d,.]+)\s*(m|k)/i,
    // Last resort: "Market value" or "Marktwert" label context
    /(?:Market value|Marktwert)[\s\S]{0,400}?([\d,.]+)\s*(m|k)/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      const normalized = normalizeMarketValue(match[1], match[2]);
      if (normalized) return normalized;
    }
  }

  return null;
}

interface TMData {
  position: string | null;
  market_value: string | null;
}

async function fetchTMData(tmUrl: string): Promise<TMData> {
  const empty: TMData = { position: null, market_value: null };

  if (!isTrustedTMUrl(tmUrl)) return empty;

  let html: string;
  try {
    const res = await fetch(tmUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Referer': 'https://www.transfermarkt.com/',
      },
    });

    if (!res.ok) return empty;
    html = await res.text();
  } catch {
    return empty;
  }

  const position     = parseTMPosition(html);
  const market_value = parseTMMarketValue(html);

  if (position === null) {
    console.warn('[ScoutFlow TM] Position parse failed — check regex against current TM HTML.');
  }
  if (market_value === null) {
    console.warn('[ScoutFlow TM] Market value parse failed — check regex against current TM HTML.');
  }

  return { position, market_value };
}

// ── Payload assembly ────────────────────────────────────────────────────────

type SyncOutcome = 'full' | 'fbref_only';

function buildPatchPayload(
  fbref: Record<string, unknown>,
  tm: TMData
): Record<string, unknown> {
  // TM position takes precedence; fall back to FBref position if TM parse failed.
  const position = tm.position ?? fbref.position ?? null;

  const payload: Record<string, unknown> = {
    first_name:       fbref.first_name,
    last_name:        fbref.last_name,
    position,
    preferred_foot:   fbref.preferred_foot,
    height_cm:        fbref.height_cm,
    weight_kg:        fbref.weight_kg,
    nationality:      fbref.nationality,
    date_of_birth:    fbref.date_of_birth,
    current_club:     fbref.current_club,
    stats_matches:    fbref.stats_matches,
    stats_goals:      fbref.stats_goals,
    stats_assists:    fbref.stats_assists,
    stats_minutes:    fbref.stats_minutes,
    stats_updated_at: new Date().toISOString(),
  };

  // Only write market_value when TM successfully parsed one — never overwrite
  // a manually-entered value with null.
  if (tm.market_value !== null) {
    payload.market_value = tm.market_value;
  }

  return payload;
}

// ── Main handler ────────────────────────────────────────────────────────────

async function handleSyncPlayer(
  payload: Record<string, unknown>,
  _sender: chrome.runtime.MessageSender
): Promise<{ success: boolean; error?: string; outcome?: SyncOutcome }> {

  // 1. Authenticate
  const token = await getAuthToken();

  // 2. Look up the player by fbref_url to get their id and transfermarkt_url.
  //    We filter by fbref_url but PATCH by primary key (id) for precision.
  const player = await lookupPlayerByFbrefUrl(payload.fbref_url as string, token);

  if (!player) {
    return {
      success: false,
      error: 'Player not found in ScoutFlow — add them first.',
    };
  }

  // 3. Fetch Transfermarkt data (all failures are soft — sync continues without TM).
  let tm: TMData = { position: null, market_value: null };
  let outcome: SyncOutcome = 'fbref_only';

  if (player.transfermarkt_url) {
    tm = await fetchTMData(player.transfermarkt_url);
    if (tm.position !== null || tm.market_value !== null) {
      outcome = 'full';
    }
  }

  // 4. Build strict allowlist payload and write to Supabase.
  const body = buildPatchPayload(payload, tm);
  const patchUrl = `${SUPABASE_URL}/rest/v1/players?id=eq.${player.id}`;

  const res = await fetch(patchUrl, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    return { success: false, error: `Database error: ${res.statusText}` };
  }

  return { success: true, outcome };
}
