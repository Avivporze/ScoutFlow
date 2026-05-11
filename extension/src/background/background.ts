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

// ── Auth & Session Refresh ────────────────────────────────────────────────────

interface SupabaseSession {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  currentSession?: {
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
  };
}

const STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;

const NOT_SIGNED_IN = 'Not signed in — open the ScoutFlow popup to sign in.';
const SESSION_EXPIRED = 'Session expired — open the ScoutFlow popup to sign in again.';

async function readSession(): Promise<SupabaseSession | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const raw = result[STORAGE_KEY];
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

async function writeSession(session: SupabaseSession): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: JSON.stringify(session) });
}

function extractTokens(s: SupabaseSession | null): { access?: string; refresh?: string } {
  if (!s) return {};
  return {
    access:  s.access_token  ?? s.currentSession?.access_token,
    refresh: s.refresh_token ?? s.currentSession?.refresh_token,
  };
}

async function getAccessToken(): Promise<string> {
  const { access } = extractTokens(await readSession());
  if (!access) throw new Error(NOT_SIGNED_IN);
  return access;
}

async function refreshAccessToken(): Promise<string> {
  const session = await readSession();
  const { refresh } = extractTokens(session);
  if (!session || !refresh) throw new Error(SESSION_EXPIRED);

  const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!resp.ok) throw new Error(SESSION_EXPIRED);

  const data = await resp.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    expires_at?: number;
  };

  const target = session.currentSession ?? session;
  target.access_token  = data.access_token;
  target.refresh_token = data.refresh_token;
  target.expires_at    = data.expires_at ?? Math.floor(Date.now() / 1000) + data.expires_in;
  await writeSession(session);

  return data.access_token;
}

/**
 * Adds Supabase auth headers and transparently retries once on 401 by
 * refreshing the access token via the stored refresh_token. If the refresh
 * itself fails, throws SESSION_EXPIRED so the toast prompts a manual re-login.
 */
async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headersWith = (token: string): HeadersInit => ({
    ...(init.headers as Record<string, string> | undefined),
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
  });

  let resp = await fetch(url, { ...init, headers: headersWith(await getAccessToken()) });
  if (resp.status === 401) {
    const refreshed = await refreshAccessToken();
    resp = await fetch(url, { ...init, headers: headersWith(refreshed) });
  }
  return resp;
}

function statusMessage(status: number, action: 'lookup' | 'create' | 'update'): string {
  if (status === 401) return SESSION_EXPIRED;
  if (status === 403) return 'Permission denied — your account cannot modify this player.';
  if (status === 409 && action === 'create') return 'Player already exists in the database.';
  if (status >= 500) return `Supabase server error (HTTP ${status}) — try again in a moment.`;
  return `Player ${action} failed (HTTP ${status}).`;
}

// ── Supabase Helpers ──────────────────────────────────────────────────────────

interface PlayerLookup {
  id: string;
}

async function lookupPlayerByTMUrl(tmUrl: string): Promise<PlayerLookup | null> {
  const resp = await authedFetch(
    `${SUPABASE_URL}/rest/v1/players` +
    `?transfermarkt_url=eq.${encodeURIComponent(tmUrl)}` +
    `&select=id` +
    `&limit=1`,
    { headers: { Accept: 'application/json' } },
  );
  if (!resp.ok) throw new Error(statusMessage(resp.status, 'lookup'));
  const rows = await resp.json();
  return rows.length > 0 ? rows[0] : null;
}

async function patchPlayer(id: string, payload: Record<string, unknown>): Promise<void> {
  const resp = await authedFetch(
    `${SUPABASE_URL}/rest/v1/players?id=eq.${id}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(payload),
    },
  );
  if (!resp.ok) throw new Error(statusMessage(resp.status, 'update'));
}

async function createPlayer(payload: Record<string, unknown>): Promise<string> {
  const resp = await authedFetch(
    `${SUPABASE_URL}/rest/v1/players`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(payload),
    },
  );
  if (!resp.ok) throw new Error(statusMessage(resp.status, 'create'));
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
  const tmUrl = data.transfermarkt_url as string;
  const existing = await lookupPlayerByTMUrl(tmUrl);
  const payload = buildPayload(data);

  if (existing) {
    await patchPlayer(existing.id, payload);
    return { success: true, created: false };
  }

  payload.status = 'active';
  await createPlayer(payload);
  return { success: true, created: true };
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
