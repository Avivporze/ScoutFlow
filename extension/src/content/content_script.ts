/**
 * ScoutFlow Ride-Along Content Script
 * Injected into FBref player pages
 */

function createToast() {
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
    transform: 'translateY(10px)'
  });
  
  document.body.appendChild(toast);
  
  // Animate in
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  }, 10);
  
  return toast;
}

function updateToast(toast: HTMLElement, message: string, type: 'loading' | 'success' | 'error') {
  toast.innerText = `ScoutFlow: ${message}`;
  if (type === 'success') {
    toast.style.backgroundColor = '#059669';
  } else if (type === 'error') {
    toast.style.backgroundColor = '#DC2626';
  } else {
    toast.style.backgroundColor = '#2563EB';
  }
}

function removeToast(toast: HTMLElement) {
  toast.style.opacity = '0';
  toast.style.transform = 'translateY(10px)';
  setTimeout(() => toast.remove(), 300);
}

function extractCurrentSeasonStats(): { matches: number; goals: number; assists: number; minutes: number } {
  const zero = { matches: 0, goals: 0, assists: 0, minutes: 0 };

  try {
    // Collect ALL rows including spacers so we can detect season boundaries.
    const allRows = Array.from(
      document.querySelectorAll('table[id^="stats_standard"] tbody tr')
    ) as HTMLElement[];

    if (allRows.length === 0) return zero;

    // Walk backwards from the bottom; stop at the first spacer.
    // Everything above the spacer (exclusive) is the current season's block.
    const currentBlock: HTMLElement[] = [];
    for (let i = allRows.length - 1; i >= 0; i--) {
      if (allRows[i].classList.contains('spacer')) break;
      currentBlock.unshift(allRows[i]);
    }

    // Filter to rows that carry real stat data.
    const dataRows = currentBlock.filter(
      row =>
        !row.classList.contains('partial_table') &&
        !row.classList.contains('thead') &&
        row.querySelector('td[data-stat="games"]') !== null
    );

    if (dataRows.length === 0) return zero;

    const getStat = (row: HTMLElement, stat: string): number => {
      const el = row.querySelector(`td[data-stat="${stat}"]`) as HTMLElement | null;
      return el ? parseInt(el.innerText.replace(/,/g, '')) || 0 : 0;
    };

    // Prefer a rolled-up Total row (comp_level is blank or says "X Comps" / "X Leagues").
    const totalRow = dataRows.find(row => {
      const el = row.querySelector('td[data-stat="comp_level"]') as HTMLElement | null;
      if (!el) return false;
      const text = el.innerText.trim();
      return text === '' || /Comps|Leagues/i.test(text);
    });

    if (totalRow) {
      return {
        matches: getStat(totalRow, 'games'),
        goals:   getStat(totalRow, 'goals'),
        assists: getStat(totalRow, 'assists'),
        minutes: getStat(totalRow, 'minutes'),
      };
    }

    // No total row: sum every competition row individually (no double-count risk).
    return dataRows.reduce(
      (acc, row) => ({
        matches: acc.matches + getStat(row, 'games'),
        goals:   acc.goals   + getStat(row, 'goals'),
        assists: acc.assists  + getStat(row, 'assists'),
        minutes: acc.minutes  + getStat(row, 'minutes'),
      }),
      zero
    );
  } catch {
    return zero;
  }
}

function extractData() {
  try {
    const meta = document.querySelector('#meta');
    if (!meta) return null;

    const nameText = document.querySelector('h1')?.innerText || '';
    const nameParts = nameText.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const paragraphs = Array.from(meta.querySelectorAll('p'));
    
    // 1. Position Rule & 2. Preferred Foot Rule
    let positionText: string | null = null;
    let footedText: string | null = null;

    for (const p of paragraphs) {
      const text = p.innerText;

      // Position and foot live in the same bio paragraph, anchored by "Footed:".
      // Skipping unrelated paragraphs prevents |/• characters in JS or other
      // content from being misidentified as the position separator.
      if (!text.includes('Footed:')) continue;

      // Position: text before the ▪ separator (FBref-specific, not generic |/•).
      const sepIndex = text.indexOf('▪');
      if (sepIndex !== -1) {
        positionText = text.substring(0, sepIndex).replace('Position:', '').trim() || null;
      }

      // Preferred foot: first word after "Footed:" label, sanitized for DB constraint.
      // DB accepts ONLY: "Left", "Right", "Both", or null.
      const footedMatch = text.match(/Footed:\s*(\w+)/);
      if (footedMatch) {
        const rawFoot = footedMatch[1].toLowerCase();
        if (rawFoot === 'left') footedText = 'Left';
        else if (rawFoot === 'right') footedText = 'Right';
        else if (rawFoot === 'both') footedText = 'Both';
      }

      break; // Bio paragraph found; no need to scan further.
    }

    // 3. Nationality Rule
    const countryLink = meta.querySelector('a[href*="/country/"]') as HTMLElement;
    const nationality = countryLink ? countryLink.innerText.trim() : null;

    // 3. Club, Height, Weight, DOB
    const getPText = (label: string) => {
      const p = paragraphs.find(p => p.innerText.includes(label));
      return p ? p.innerText.split(label)[1]?.trim() : null;
    };

    const clubText = getPText('Club:');
    const heightText = document.querySelector('span[itemprop="height"]')?.innerHTML || '';
    const weightText = document.querySelector('span[itemprop="weight"]')?.innerHTML || '';
    
    const heightCm = parseInt(heightText.replace('cm', '')) || null;
    const weightKg = parseInt(weightText.replace('kg', '')) || null;
    const dob = document.querySelector('#necro-birth')?.getAttribute('data-birth') || null;

    // 4. Statistics Extraction — aggregated across ALL competitions for the current season.
    //
    // FBref's stats_standard table is ordered ascending by season (oldest at top, newest
    // at bottom). Seasons are separated by tr.spacer rows. We walk backwards from the last
    // row, stopping at the first spacer, to isolate the current season's block.
    //
    // Within that block we first look for a rolled-up "Total" row (comp_level empty or
    // containing "Comps"/"Leagues"). If found, we use it directly. Otherwise we sum every
    // individual competition row — safe because each row is one distinct competition.
    const stats = extractCurrentSeasonStats();

    return {
      first_name: firstName,
      last_name: lastName,
      position: positionText,
      preferred_foot: footedText,
      height_cm: heightCm,
      weight_kg: weightKg,
      nationality: nationality,
      date_of_birth: dob,
      current_club: clubText,
      stats_matches: stats.matches,
      stats_goals: stats.goals,
      stats_assists: stats.assists,
      stats_minutes: stats.minutes,
      fbref_url: window.location.href
    };
  } catch (err) {
    console.error('ScoutFlow extraction error:', err);
    return null;
  }
}

async function run() {
  const toast = createToast();
  updateToast(toast, 'Extracting...', 'loading');

  const data = extractData();
  
  if (!data) {
    updateToast(toast, 'Failed to parse page', 'error');
    setTimeout(() => removeToast(toast), 3000);
    return;
  }

  chrome.runtime.sendMessage({ type: 'SYNC_PLAYER', payload: data }, (response) => {
    if (response?.success) {
      const label = response.outcome === 'full' ? 'Synced!' : 'Synced (FBref only)';
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
