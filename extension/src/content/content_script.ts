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
  instagram: string | null;
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
      const parts = (fallbackH1.textContent ?? '').trim().split(/\s+/);
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
  const firstName = h1Clone.textContent?.trim() ?? '';

  return {
    first_name: firstName,
    last_name: strongText,
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

function extractPosition(): string | null {
  // Strategy 1: itemprop="position" or dedicated position element
  const posEl = document.querySelector('[itemprop="position"]');
  if (posEl) {
    const text = (posEl.textContent ?? '').trim();
    // TM sometimes appends " - " with sub-position. Take the main position.
    const mainPos = text.split(' - ')[0].trim();
    if (TM_POSITION_MAP[mainPos]) return TM_POSITION_MAP[mainPos];
  }

  // Strategy 2: data-header content highlight (position shown in header)
  const highlightEl = document.querySelector('.data-header__content--highlight');
  if (highlightEl) {
    const text = (highlightEl.textContent ?? '').trim();
    if (TM_POSITION_MAP[text]) return TM_POSITION_MAP[text];
  }

  // Strategy 3: detail-position class
  const detailPosEl = document.querySelector('.detail-position__position');
  if (detailPosEl) {
    const text = (detailPosEl.textContent ?? '').trim();
    if (TM_POSITION_MAP[text]) return TM_POSITION_MAP[text];
  }

  // Strategy 4: info-table "Position" row
  const posText = getInfoTableValue('position');
  if (posText) {
    const mainPos = posText.split(' - ')[0].trim();
    if (TM_POSITION_MAP[mainPos]) return TM_POSITION_MAP[mainPos];
  }

  // Strategy 5: Try all map keys against any text content found
  console.warn('[ScoutFlow] Position not found via standard selectors.');
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

function extractInstagram(): string | null {
  const link = document.querySelector('a[href*="instagram.com"]');
  if (link) {
    return link.getAttribute('href');
  }
  return null;
}

// ── Stats Extraction ─────────────────────────────────────────────────────────

interface SeasonStats {
  matches: number;
  goals: number;
  assists: number;
  minutes: number;
}

/**
 * Wait for the performance data table to appear in the DOM.
 * TM may load stats asynchronously.
 */
function waitForStatsTable(timeout = 3000): Promise<boolean> {
  return new Promise(resolve => {
    if (findPerformanceTable()) return resolve(true);

    const interval = 200;
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += interval;
      if (findPerformanceTable()) {
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
 * Find the performance data table on the TM player profile.
 * TM uses various table structures for season stats.
 */
function findPerformanceTable(): HTMLTableElement | null {
  // Look for the main stats/performance table
  const selectors = [
    'table.items',                              // Classic TM stats table
    '.responsive-table table',                  // Responsive wrapper
    '#yw1 table',                               // Legacy TM table ID
    'table[class*="performance"]',              // Performance-specific class
    '.grid-view table',                         // Grid view variant
    '.box .responsive-table table',             // Boxed layout
  ];

  for (const selector of selectors) {
    const table = document.querySelector(selector) as HTMLTableElement | null;
    if (table?.querySelector('tbody tr td')) return table;
  }

  return null;
}

/**
 * Extract current season stats from the performance table.
 * Strategy 1: Look for a "Total" or "Overall" row.
 * Strategy 2: Sum across individual competition rows.
 */
function extractStats(): SeasonStats {
  const zero: SeasonStats = { matches: 0, goals: 0, assists: 0, minutes: 0 };

  try {
    const table = findPerformanceTable();
    if (!table) {
      console.warn('[ScoutFlow] No performance table found.');
      return zero;
    }

    // Identify column indices from the header row
    const headerCells = table.querySelectorAll('thead th, thead td');
    const colIndex = mapColumnIndices(headerCells);

    // Strategy 1: Look for a "Total" or tfoot summary row
    const totalRow = findTotalRow(table);
    if (totalRow) {
      const stats = extractStatsFromRow(totalRow, colIndex);
      console.log('[ScoutFlow] Stats from Total row:', stats);
      return stats;
    }

    // Strategy 2: Sum across all data rows in tbody
    const rows = Array.from(table.querySelectorAll('tbody tr')) as HTMLElement[];
    const dataRows = rows.filter(row => {
      // Skip header/spacer rows
      if (row.classList.contains('bg_blau_20') || row.classList.contains('thead')) return false;
      return row.querySelector('td') !== null;
    });

    if (dataRows.length === 0) {
      console.warn('[ScoutFlow] No data rows in performance table.');
      return zero;
    }

    const summed = dataRows.reduce(
      (acc, row) => {
        const rowStats = extractStatsFromRow(row, colIndex);
        return {
          matches: acc.matches + rowStats.matches,
          goals: acc.goals + rowStats.goals,
          assists: acc.assists + rowStats.assists,
          minutes: acc.minutes + rowStats.minutes,
        };
      },
      { ...zero },
    );

    console.log('[ScoutFlow] Stats summed across competitions:', summed);
    return summed;
  } catch (err) {
    console.error('[ScoutFlow] Stats extraction error:', err);
    return zero;
  }
}

/**
 * Map header cell text to column indices for flexible stat extraction.
 */
function mapColumnIndices(headerCells: NodeListOf<Element>): Record<string, number> {
  const map: Record<string, number> = {};

  headerCells.forEach((cell, index) => {
    const text = (cell.textContent ?? '').trim().toLowerCase();
    const title = (cell.getAttribute('title') ?? '').trim().toLowerCase();

    // Appearances / Matches
    if (text === 'apps' || text === 'appearances' || title.includes('appearance') ||
        title.includes('matches') || text === 'mp' || text === 'games') {
      if (!map.matches) map.matches = index;
    }
    // Goals
    if (text === 'goals' || title.includes('goals') || text === 'g') {
      if (!map.goals) map.goals = index;
    }
    // Assists
    if (text === 'assists' || text === 'a' || title.includes('assists')) {
      if (!map.assists) map.assists = index;
    }
    // Minutes
    if (text === 'minutes' || text === 'min' || text === 'mins' ||
        title.includes('minutes') || text === "'") {
      if (!map.minutes) map.minutes = index;
    }
  });

  return map;
}

/**
 * Find a Total / Overall summary row in the table.
 */
function findTotalRow(table: HTMLTableElement): HTMLElement | null {
  // Check tfoot first
  const tfootRow = table.querySelector('tfoot tr') as HTMLElement | null;
  if (tfootRow?.querySelector('td')) return tfootRow;

  // Look for a row with "Total" or "Overall" text
  const allRows = Array.from(table.querySelectorAll('tbody tr, tfoot tr')) as HTMLElement[];
  for (const row of allRows) {
    const firstCell = row.querySelector('td, th');
    const text = (firstCell?.textContent ?? '').trim().toLowerCase();
    if (text === 'total' || text === 'overall' || text.includes('total')) {
      return row;
    }
  }

  // Look for a specifically styled summary row (e.g., bold/highlighted)
  for (const row of allRows) {
    if (row.classList.contains('zentriert_bold') || row.classList.contains('main-group-first-row')) {
      const text = (row.textContent ?? '').toLowerCase();
      if (text.includes('total')) return row;
    }
  }

  return null;
}

/**
 * Extract numeric stats from a single table row using column indices.
 */
function extractStatsFromRow(row: HTMLElement, colIndex: Record<string, number>): SeasonStats {
  const cells = Array.from(row.querySelectorAll('td, th'));

  function getNumeric(key: string): number {
    const idx = colIndex[key];
    if (idx === undefined || idx >= cells.length) return 0;
    const text = (cells[idx].textContent ?? '').replace(/[.,\s]/g, '').replace(/-/g, '0').trim();
    const num = parseInt(text);
    return isNaN(num) ? 0 : num;
  }

  return {
    matches: getNumeric('matches'),
    goals: getNumeric('goals'),
    assists: getNumeric('assists'),
    minutes: getNumeric('minutes'),
  };
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
  const slashMatch = cleaned.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const [, a, b, y] = slashMatch;
    // Heuristic: if first number > 12, it's dd/mm/yyyy
    const day = parseInt(a) > 12 ? a : b;
    const month = parseInt(a) > 12 ? b : a;
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

function extractData(): TMPlayerData | null {
  try {
    const { first_name, last_name } = extractName();
    if (!first_name && !last_name) {
      console.error('[ScoutFlow] Could not extract player name.');
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
    const instagram = extractInstagram();
    const stats = extractStats();

    const data: TMPlayerData = {
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
      instagram,
      stats_matches: stats.matches,
      stats_goals: stats.goals,
      stats_assists: stats.assists,
      stats_minutes: stats.minutes,
      transfermarkt_url: window.location.href,
    };

    return data;
  } catch (err) {
    console.error('[ScoutFlow] Extraction error:', err);
    return null;
  }
}

// ── Run ──────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  const toast = createToast();
  updateToast(toast, 'Extracting player data...', 'loading');

  // Wait for stats table to appear (TM may load it asynchronously)
  const tableReady = await waitForStatsTable();
  if (!tableReady) {
    console.warn('[ScoutFlow] Stats table did not appear within 3s — proceeding with available data.');
  }

  const data = extractData();

  if (!data) {
    updateToast(toast, 'Failed to parse player page', 'error');
    setTimeout(() => removeToast(toast), 3000);
    return;
  }

  console.log('[ScoutFlow] Extracted payload:', data);

  chrome.runtime.sendMessage({ type: 'SYNC_PLAYER', payload: data }, (response) => {
    if (response?.success) {
      const label = response.created ? 'Player created!' : 'Player synced!';
      updateToast(toast, label, 'success');
    } else {
      updateToast(toast, response?.error || 'Failed to sync', 'error');
    }
    setTimeout(() => removeToast(toast), 3000);
  });
}

// Trigger immediately upon injection.
// Manifest 'run_at': 'document_end' ensures DOM is ready.
run();
