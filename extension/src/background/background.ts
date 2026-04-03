/**
 * ScoutFlow Background Service Worker
 *
 * Single-source architecture: receives extracted Transfermarkt data from
 * the content script, looks up the player by transfermarkt_url, and PATCHes
 * Supabase with the full payload.
 *
 * If the player doesn't exist yet, creates a new record (upsert-by-URL).
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

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
    throw new Error('Failed to update player. Please try again.');
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
    throw new Error('Failed to create player. Please try again.');
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
  (message: { type: string; payload: Record<string, unknown> }, sender, sendResponse) => {
    if (!sender.url || !/transfermarkt\.com/i.test(sender.url)) return;
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
