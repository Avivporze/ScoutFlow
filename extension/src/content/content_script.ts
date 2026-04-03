/**
 * ScoutFlow Ride-Along Content Script
 * Injected into Transfermarkt player profile pages.
 *
 * Extracts all player data from the TM DOM and sends it to the
 * background service worker via chrome.runtime.sendMessage.
 */

// ── Position Map ─────────────────────────────────────────────────────────────

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

// ── Types ────────────────────────────────────────────────────────────────────

interface TMPlayerData {
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  nationality: string | null;
  second_nationality: string | null;
  height_cm: number | null;
  preferred_foot: string | null;
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

// ── Toast Notification System ────────────────────────────────────────────────

function createToast(): HTMLElement {
  const toast = document.createElement('div');
  toast.id = 'scoutflow-toast';
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    padding: '12px 20px',
    borderRadius: '8px',
    backgroundColor: '#2563EB',
    color: 'white',
    zIndex: '9999',
    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.3s ease',
    opacity: '0',
    transform: 'translateY(10px)',
  });

  document.body.appendChild(toast);

  // Animate in
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  }, 10);

  return toast;
}

function updateToast(toast: HTMLElement, message: string, type: 'loading' | 'success' | 'error'): void {
  toast.innerText = `ScoutFlow: ${message}`;
  if (type === 'success') {
    toast.style.backgroundColor = '#059669';
  } else if (type === 'error') {
    toast.style.backgroundColor = '#DC2626';
  } else {
    toast.style.backgroundColor = '#2563EB';
  }
}

function removeToast(toast: HTMLElement): void {
  toast.style.opacity = '0';
  toast.style.transform = 'translateY(10px)';
  setTimeout(() => toast.remove(), 300);
}

// ── Info Table Helpers ───────────────────────────────────────────────────────

/**
 * Transfermarkt player profiles use an "info-table" structure where each row
 * has a label span (--regular) and a value span (--bold). This helper finds
 * the value span for a given label keyword (case-insensitive).
 */
function getInfoTableValue(label: string): string | null {
  // Strategy 1: BEM class-based info-table (modern TM)
  const labelSpans = document.querySelectorAll('.info-table__content--regular');
  for (const span of labelSpans) {
    const text = (span.textContent ?? '').trim().toLowerCase();
    if (text.includes(label.toLowerCase())) {
      // The value is in the next sibling with class --bold
      const parent = span.closest('.info-table__content');
      if (parent) {
        const bold = parent.querySelector('.info-table__content--bold');
        if (bold) return (bold.textContent ?? '').trim();
      }
      // Fallback: next element sibling
      const next = span.nextElementSibling;
      if (next) return (next.textContent ?? '').trim();
    }
  }

  // Strategy 2: Generic table rows with th/td
  const rows = document.querySelectorAll('tr, .info-table__row');
  for (const row of rows) {
    const th = row.querySelector('th');
    if (th && (th.textContent ?? '').trim().toLowerCase().includes(label.toLowerCase())) {
      const td = row.querySelector('td');
      if (td) return (td.textContent ?? '').trim();
    }
  }

  return null;
}

/**
 * Get the raw DOM element for an info-table value (preserves links and sub-elements).
 */
function getInfoTableElement(label: string): Element | null {
  const labelSpans = document.querySelectorAll('.info-table__content--regular');
  for (const span of labelSpans) {
    const text = (span.textContent ?? '').trim().toLowerCase();
    if (text.includes(label.toLowerCase())) {
      const parent = span.closest('.info-table__content');
      if (parent) {
        const bold = parent.querySelector('.info-table__content--bold');
        if (bold) return bold;
      }
      const next = span.nextElementSibling;
      if (next) return next;
    }
  }
  return null;
}

// ── Name Extraction ──────────────────────────────────────────────────────────

function extractName(): { first_name: string; last_name: string } {
  // TM puts the player name in h1.data-header__headline-wrapper with the
  // last name (or known name) in a <strong> tag.
  const h1 = document.querySelector('h1.data-header__headline-wrapper');
  if (!h1) {
    // Fallback: any h1 on the page
    const fallbackH1 = document.querySelector('h1');
    if (fallbackH1) {
      const raw = (fallbackH1.textContent ?? '').trim().replace(/^#\d+\s*/, '');
      const parts = raw.split(/\s+/);
      return { first_name: parts[0] || '', last_name: parts.slice(1).join(' ') || '' };
    }
    return { first_name: '', last_name: '' };
  }

  const strongEl = h1.querySelector('strong');
  const strongText = (strongEl?.textContent ?? '').trim();

  // The first name is the text content of h1 BEFORE the <strong> tag.
  // Clone the node, remove the strong, and get remaining text.
  const h1Clone = h1.cloneNode(true) as HTMLElement;
  const clonedStrong = h1Clone.querySelector('strong');
  if (clonedStrong) clonedStrong.remove();
  let firstName = h1Clone.textContent?.trim() ?? '';

  // TM h1 contains a shirt number prefix like "#9 Erling Haaland" — strip it
  firstName = firstName.replace(/^#\d+\s*/, '');

  return {
    first_name: firstName,
    last_name: strongText.replace(/^#\d+\s*/, ''),
  };
}

// ── Date of Birth ────────────────────────────────────────────────────────────

function extractDateOfBirth(): string | null {
  // Strategy 1: itemprop="birthDate" (microdata)
  const birthdateEl = document.querySelector('[itemprop="birthDate"]');
  if (birthdateEl) {
    // May have a datetime attribute or content attribute
    const datetime = birthdateEl.getAttribute('datetime') ?? birthdateEl.getAttribute('content');
    if (datetime) {
      const normalized = normalizeDateToISO(datetime);
      if (normalized) return normalized;
    }
    // Parse the text content
    const text = (birthdateEl.textContent ?? '').trim();
    const normalized = normalizeDateToISO(text);
    if (normalized) return normalized;
  }

  // Strategy 2: info-table "Date of birth" row
  const dobText = getInfoTableValue('date of birth');
  if (dobText) {
    const normalized = normalizeDateToISO(dobText);
    if (normalized) return normalized;
  }

  // Strategy 3: info-table "born" or "birthday" row
  for (const keyword of ['born', 'birthday', 'geb']) {
    const text = getInfoTableValue(keyword);
    if (text) {
      const normalized = normalizeDateToISO(text);
      if (normalized) return normalized;
    }
  }

  return null;
}

// ── Nationality ──────────────────────────────────────────────────────────────

function extractNationalities(): { nationality: string | null; second_nationality: string | null } {
  // TM uses .flaggenrahmen img elements for nationality flags.
  // The country name is in the img's title or alt attribute.
  const flagImgs = document.querySelectorAll('.flaggenrahmen img, .flaggenrahmen-extra img');
  const nationalities: string[] = [];

  for (const img of flagImgs) {
    const name = (img.getAttribute('title') ?? img.getAttribute('alt') ?? '').trim();
    if (name && !nationalities.includes(name)) {
      nationalities.push(name);
    }
  }

  // If flaggenrahmen didn't yield results, try itemprop="nationality"
  if (nationalities.length === 0) {
    const natEl = document.querySelector('[itemprop="nationality"]');
    if (natEl) {
      const name = (natEl.textContent ?? '').trim();
      if (name) nationalities.push(name);
    }
  }

  return {
    nationality: nationalities[0] ?? null,
    second_nationality: nationalities[1] ?? null,
  };
}

// ── Height ───────────────────────────────────────────────────────────────────

function extractHeight(): number | null {
  // Strategy 1: itemprop="height"
  const heightEl = document.querySelector('[itemprop="height"]');
  if (heightEl) {
    const text = (heightEl.textContent ?? '').trim();
    return parseHeightToCm(text);
  }

  // Strategy 2: info-table "Height" row
  const heightText = getInfoTableValue('height');
  if (heightText) {
    return parseHeightToCm(heightText);
  }

  return null;
}

/**
 * Parse TM height strings like "1,80 m", "1.80m", "180 cm" to cm integer.
 */
function parseHeightToCm(text: string): number | null {
  // "1,80 m" or "1.80 m" -> 180
  const meterMatch = text.match(/(\d)[,.](\d{2})\s*m/);
  if (meterMatch) {
    return parseInt(meterMatch[1]) * 100 + parseInt(meterMatch[2]);
  }

  // "180 cm" -> 180
  const cmMatch = text.match(/(\d{2,3})\s*cm/);
  if (cmMatch) {
    return parseInt(cmMatch[1]);
  }

  return null;
}

// ── Preferred Foot ───────────────────────────────────────────────────────────

function extractPreferredFoot(): string | null {
  const footText = getInfoTableValue('foot');
  if (!footText) return null;

  const lower = footText.toLowerCase();
  if (lower === 'left') return 'Left';
  if (lower === 'right') return 'Right';
  if (lower === 'both') return 'Both';

  return null;
}

// ── Position ─────────────────────────────────────────────────────────────────

/**
 * Try to match a position string against TM_POSITION_MAP.
 * TM may format as "Attack - Centre-Forward" — try each segment.
 */
function matchPosition(raw: string): string | null {
  if (TM_POSITION_MAP[raw]) return TM_POSITION_MAP[raw];
  // Split on " - " and try each segment (e.g. "Attack - Centre-Forward")
  const parts = raw.split(/\s*-\s*/);
  for (const part of parts) {
    if (TM_POSITION_MAP[part.trim()]) return TM_POSITION_MAP[part.trim()];
  }
  return null;
}

function extractPosition(): string | null {
  // Strategy 1: info-table "Position" row (most reliable on current TM)
  const posText = getInfoTableValue('position');
  if (posText) {
    const mapped = matchPosition(posText);
    if (mapped) return mapped;
  }

  // Strategy 2: itemprop="position"
  const posEl = document.querySelector('[itemprop="position"]');
  if (posEl) {
    const mapped = matchPosition((posEl.textContent ?? '').trim());
    if (mapped) return mapped;
  }

  // Strategy 3: data-header content highlight
  const highlightEl = document.querySelector('.data-header__content--highlight');
  if (highlightEl) {
    const mapped = matchPosition((highlightEl.textContent ?? '').trim());
    if (mapped) return mapped;
  }

  // Strategy 4: detail-position class
  const detailPosEl = document.querySelector('.detail-position__position');
  if (detailPosEl) {
    const mapped = matchPosition((detailPosEl.textContent ?? '').trim());
    if (mapped) return mapped;
  }

  return null;
}

// ── Club & League ────────────────────────────────────────────────────────────

function extractCurrentClub(): string | null {
  // Strategy 1: data-header__club link
  const clubLink = document.querySelector('.data-header__club a');
  if (clubLink) {
    // Skip nested images, get text content
    const text = (clubLink.textContent ?? '').trim();
    if (text) return text;
    // Fallback: title attribute
    const title = clubLink.getAttribute('title');
    if (title) return title.trim();
  }

  // Strategy 2: info-table "Current club" row
  const clubText = getInfoTableValue('current club');
  if (clubText) return clubText;

  // Strategy 3: itemprop="affiliation"
  const affEl = document.querySelector('[itemprop="affiliation"]');
  if (affEl) {
    const text = (affEl.textContent ?? '').trim();
    if (text) return text;
  }

  return null;
}

function extractLeague(): string | null {
  // Strategy 1: data-header__league link text
  const leagueLink = document.querySelector('.data-header__league a');
  if (leagueLink) {
    const text = (leagueLink.textContent ?? '').trim();
    if (text) return text;
    // Fallback: title attribute (image-only league link)
    const title = leagueLink.getAttribute('title');
    if (title) return title.trim();
    // Fallback: img alt inside the link
    const img = leagueLink.querySelector('img');
    if (img) {
      const alt = img.getAttribute('alt');
      if (alt) return alt.trim();
    }
  }

  // Strategy 2: info-table "League" or "Highest league" row
  for (const keyword of ['league', 'liga', 'highest league']) {
    const leagueEl = getInfoTableElement(keyword);
    if (leagueEl) {
      // Try text first
      const text = (leagueEl.textContent ?? '').trim();
      if (text) return text;
      // Try link title
      const link = leagueEl.querySelector('a');
      if (link) {
        const title = link.getAttribute('title');
        if (title) return title.trim();
      }
      // Try img alt
      const img = leagueEl.querySelector('img');
      if (img) {
        const alt = img.getAttribute('alt');
        if (alt) return alt.trim();
      }
    }
  }

  return null;
}

// ── Contract Expiry ──────────────────────────────────────────────────────────

function extractContractExpiry(): string | null {
  // Strategy 1: info-table "Contract expires" or "Contract" row
  for (const keyword of ['contract expires', 'contract exp', 'vertrag bis', 'contract']) {
    const text = getInfoTableValue(keyword);
    if (text) {
      const normalized = normalizeDateToISO(text);
      if (normalized) return normalized;
    }
  }

  return null;
}

// ── Market Value ─────────────────────────────────────────────────────────────

function extractMarketValue(): string | null {
  // Strategy 1: .tm-market-value element (modern TM)
  const tmMvEl = document.querySelector('.tm-market-value');
  if (tmMvEl) {
    const text = (tmMvEl.textContent ?? '').trim();
    const normalized = normalizeMarketValue(text);
    if (normalized) return normalized;
  }

  // Strategy 2: .waehrung parent context (classic TM)
  const waehrungEl = document.querySelector('.waehrung');
  if (waehrungEl) {
    const parent = waehrungEl.parentElement;
    if (parent) {
      const text = (parent.textContent ?? '').trim();
      const normalized = normalizeMarketValue(text);
      if (normalized) return normalized;
    }
  }

  // Strategy 3: data-header market value section
  const headerMv = document.querySelector('.data-header__market-value-wrapper');
  if (headerMv) {
    const text = (headerMv.textContent ?? '').trim();
    const normalized = normalizeMarketValue(text);
    if (normalized) return normalized;
  }

  return null;
}

/**
 * Normalize market value text like "$45.00m", "45m", "800k", "45 Mio. $"
 * to the canonical format: "EUR45M" or "EUR800K".
 */
function normalizeMarketValue(text: string): string | null {
  // Remove all whitespace and non-breaking spaces for easier parsing
  const clean = text.replace(/\s+/g, '').replace(/\u00a0/g, '');

  // Match patterns like: EUR45.00m, $45m, 45M, 800K, 45Mio., etc.
  // Look for a number followed by m/k/mil/mio indicator
  const match = clean.match(/([\d,.]+)\s*(?:Mio\.?|mil\.?|m)\b/i);
  if (match) {
    const num = parseFloat(match[1].replace(/,/g, '.'));
    if (!isNaN(num)) return `\u20AC${parseFloat(num.toFixed(2))}M`;
  }

  const kMatch = clean.match(/([\d,.]+)\s*(?:Tsd\.?|k)\b/i);
  if (kMatch) {
    const num = parseFloat(kMatch[1].replace(/,/g, '.'));
    if (!isNaN(num)) return `\u20AC${Math.round(num)}K`;
  }

  // Try broader pattern: currency symbol + number + m/k
  const broadMatch = text.match(/[\$\u20AC\u00A3]?\s*([\d,.]+)\s*(m|k)/i);
  if (broadMatch) {
    const num = parseFloat(broadMatch[1].replace(/,/g, '.'));
    const unit = broadMatch[2].toLowerCase();
    if (!isNaN(num)) {
      if (unit === 'm') return `\u20AC${parseFloat(num.toFixed(2))}M`;
      if (unit === 'k') return `\u20AC${Math.round(num)}K`;
    }
  }

  return null;
}

// ── Agent ────────────────────────────────────────────────────────────────────

function extractAgent(): { agent_name: string | null; agent_contact: string | null } {
  // Get the DOM element for the agent info-table row
  const agentEl = getInfoTableElement('player agent') ?? getInfoTableElement('spielerberater') ?? getInfoTableElement('agent');

  if (!agentEl) {
    return { agent_name: null, agent_contact: null };
  }

  // Agent name: text of the link inside, or plain text
  const link = agentEl.querySelector('a');
  let agent_name: string | null = null;
  let agent_contact: string | null = null;

  if (link) {
    agent_name = (link.textContent ?? '').trim() || null;
    const href = link.getAttribute('href');
    if (href) {
      agent_contact = href.startsWith('http') ? href : `https://www.transfermarkt.com${href}`;
    }
  } else {
    agent_name = (agentEl.textContent ?? '').trim() || null;
  }

  return { agent_name, agent_contact };
}

// ── Social Links ─────────────────────────────────────────────────────────────

/**
 * Extract player social links from the info-table Social-Media toolbar.
 * Targets only the player's `.social-media-toolbar__icons` container
 * to avoid picking up TM's own footer social links.
 */
function extractSocialLinks(): Record<string, string> {
  const links: Record<string, string> = {};
  const toolbar = document.querySelector('.social-media-toolbar__icons');
  if (!toolbar) return links;

  toolbar.querySelectorAll('a[href]').forEach(a => {
    const href = (a as HTMLAnchorElement).href;
    if (/instagram\.com/i.test(href)) links.instagram = href;
    else if (/twitter\.com|x\.com/i.test(href)) links.twitter = href;
    else if (/facebook\.com/i.test(href)) links.facebook = href;
    else if (/tiktok\.com/i.test(href)) links.tiktok = href;
  });

  return links;
}

// ── Stats Extraction ─────────────────────────────────────────────────────────

interface SeasonStats {
  matches: number;
  goals: number;
  assists: number;
  minutes: number;
}

/**
 * Wait for the TM performance Svelte component to render.
 * Looks for the competition thumb buttons which appear when the component loads.
 */
function waitForPerformanceData(timeout = 5000): Promise<boolean> {
  const selector = '.tm-player-performance__thumb';
  return new Promise(resolve => {
    if (document.querySelector(selector)) return resolve(true);

    const interval = 200;
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += interval;
      if (document.querySelector(selector)) {
        clearInterval(timer);
        return resolve(true);
      }
      if (elapsed >= timeout) {
        clearInterval(timer);
        return resolve(false);
      }
    }, interval);
  });
}

/**
 * Read stats from the currently visible performance slide.
 *
 * DOM structure (Svelte component, as of 2025-2026):
 *   <li class="tm-player-performance__stats-list-item">
 *     <div class="...description">Appearances</div>
 *     <a class="...value">29</a>
 *   </li>
 *
 * Available stats: Appearances, Goals, Assists, Yellow/Second/Red cards.
 * Minutes are NOT available as absolute values (only as a percentage).
 */
function readCurrentSlideStats(): SeasonStats {
  const result: SeasonStats = { matches: 0, goals: 0, assists: 0, minutes: 0 };

  const items = document.querySelectorAll('.tm-player-performance__stats-list-item');
  for (const item of items) {
    const descEl = item.querySelector('.tm-player-performance__stats-list-item-description');
    const valueEl = item.querySelector('.tm-player-performance__stats-list-item-value');
    if (!descEl || !valueEl) continue;

    const label = (descEl.textContent ?? '').trim().toLowerCase();
    const rawValue = (valueEl.textContent ?? '').replace(/[^\d]/g, '');
    const value = parseInt(rawValue, 10) || 0;

    if (/appearances?|einsätze/i.test(label)) result.matches = value;
    else if (/\bgoals?\b|tore\b/i.test(label)) result.goals = value;
    else if (/assists?|vorlagen/i.test(label)) result.assists = value;
  }

  return result;
}

/**
 * Extract TOTAL season stats across all competitions by cycling through
 * each competition thumb in the Svelte performance component.
 *
 * Each thumb represents one competition (e.g. Premier League, UCL, FA Cup).
 * Only the active thumb's data is rendered. We click each thumb, wait for
 * the slide to update, read the stats, and sum them.
 */
async function extractStats(): Promise<SeasonStats> {
  const zero: SeasonStats = { matches: 0, goals: 0, assists: 0, minutes: 0 };

  const thumbs = document.querySelectorAll('.tm-player-performance__thumb');
  if (thumbs.length === 0) {
    // No competition thumbs found — stats will be zero
    return zero;
  }

  // Remember which thumb is currently active so we can restore it
  let originalIndex = 0;
  thumbs.forEach((t, i) => {
    if (t.classList.contains('tm-player-performance__thumb--active')) originalIndex = i;
  });

  const total: SeasonStats = { ...zero };

  for (let i = 0; i < thumbs.length; i++) {
    const thumb = thumbs[i] as HTMLElement;
    thumb.click();

    // Wait until this thumb becomes active (Svelte re-render)
    let waited = 0;
    while (!thumb.classList.contains('tm-player-performance__thumb--active') && waited < 1000) {
      await new Promise(r => setTimeout(r, 50));
      waited += 50;
    }
    // Small extra delay for slide content to update
    await new Promise(r => setTimeout(r, 150));

    const slide = readCurrentSlideStats();
    total.matches += slide.matches;
    total.goals += slide.goals;
    total.assists += slide.assists;
    total.minutes += slide.minutes;
  }

  // Restore original active tab
  if (originalIndex >= 0 && originalIndex < thumbs.length) {
    (thumbs[originalIndex] as HTMLElement).click();
  }

  return total;
}

// ── Date Normalization ───────────────────────────────────────────────────────

/**
 * Normalize various date formats to ISO date string (YYYY-MM-DD).
 * Handles:
 *   - "Jun 30, 2027" / "30 Jun 2027" (English natural)
 *   - "30.06.2027" (European dot)
 *   - "06/30/2027" / "30/06/2027" (slash)
 *   - "2027-06-30" (already ISO)
 *   - "Jun 30, 2027 (27)" — TM often appends age in parentheses
 */
function normalizeDateToISO(raw: string): string | null {
  // Strip parenthetical suffixes like "(27)" that TM appends for age
  const cleaned = raw.replace(/\s*\(\d+\)\s*$/, '').trim();

  if (!cleaned) return null;

  // Already ISO: "2027-06-30"
  const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return cleaned;

  // European dot format: "30.06.2027"
  const dotMatch = cleaned.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dotMatch) {
    const [, d, m, y] = dotMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Slash format: "06/30/2027" or "30/06/2027"
  // Default to dd/mm/yyyy (European convention) since TM is a European site
  const slashMatch = cleaned.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const [, a, b, y] = slashMatch;
    let day: string, month: string;
    if (parseInt(a) > 12) {
      // First number > 12: definitely dd/mm
      day = a; month = b;
    } else if (parseInt(b) > 12) {
      // Second number > 12: definitely mm/dd
      day = b; month = a;
    } else {
      // Ambiguous: default to dd/mm (European convention for TM)
      day = a; month = b;
    }
    return `${y}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Natural English: "Jun 30, 2027" / "30 Jun 2027" / "June 30, 2027"
  const parsed = Date.parse(cleaned);
  if (!isNaN(parsed)) {
    return new Date(parsed).toISOString().split('T')[0];
  }

  return null;
}

// ── Main Data Extraction ─────────────────────────────────────────────────────

async function extractData(): Promise<TMPlayerData | null> {
  try {
    const { first_name, last_name } = extractName();
    if (!first_name && !last_name) {
      return null;
    }

    const date_of_birth = extractDateOfBirth();
    const { nationality, second_nationality } = extractNationalities();
    const height_cm = extractHeight();
    const preferred_foot = extractPreferredFoot();
    const position = extractPosition();
    const current_club = extractCurrentClub();
    const league = extractLeague();
    const contract_expiry = extractContractExpiry();
    const market_value = extractMarketValue();
    const { agent_name, agent_contact } = extractAgent();
    const social_links = extractSocialLinks();
    const stats = await extractStats();

    return {
      first_name,
      last_name,
      date_of_birth,
      nationality,
      second_nationality,
      height_cm,
      preferred_foot,
      position,
      current_club,
      league,
      contract_expiry,
      market_value,
      agent_name,
      agent_contact,
      social_links,
      stats_matches: stats.matches,
      stats_goals: stats.goals,
      stats_assists: stats.assists,
      stats_minutes: stats.minutes,
      transfermarkt_url: window.location.href,
    };
  } catch (err) {
    return null;
  }
}

// ── Run ──────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  const toast = createToast();
  updateToast(toast, 'Extracting player data...', 'loading');

  // Wait for Svelte performance component to render (loads async)
  const perfReady = await waitForPerformanceData();
  if (!perfReady) {
    // Performance data did not render — proceeding with available data
  }

  const data = await extractData();

  if (!data) {
    updateToast(toast, 'Failed to parse player page', 'error');
    setTimeout(() => removeToast(toast), 3000);
    return;
  }

  const response = await chrome.runtime.sendMessage({ type: 'SYNC_PLAYER', payload: data });
  if (response?.success) {
    const label = response.created ? 'Player created & synced!' : 'Synced!';
    updateToast(toast, label, 'success');
  } else {
    updateToast(toast, response?.error ?? 'Unknown error', 'error');
  }
  setTimeout(() => removeToast(toast), 3000);
}

// Trigger immediately upon injection.
// Manifest 'run_at': 'document_end' ensures DOM is ready.
run();
