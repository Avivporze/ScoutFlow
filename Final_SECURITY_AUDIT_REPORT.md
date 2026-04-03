# ScoutFlow — Final Security Audit Report

**Audit Date:** April 3, 2026
**Auditor:** Automated Claude Code Security Scan
**Scope:** Frontend (React/Vite), Chrome Extension (Manifest V3), Python Scraper, Supabase Backend (Migrations & RLS)
**Reference Document:** `SECURITY_BEST_PRACTICES.md`

---

## 1. Vulnerabilities & Gaps Discovered

### 1.1 CRITICAL: Self-Role Escalation via Profiles RLS Policy

**Location:** `supabase/migrations/001_initial_schema.sql`, lines 155-158

**What was found:**
The `profiles` table UPDATE policy from migration 001 allows any authenticated user to modify their own row with no column-level restriction:

```sql
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
```

While migration 004 replaced the insecure SELECT policies across all tables, it did **not** replace this UPDATE policy on `profiles`. The policy permits a user to update **any column** on their own row — including `role`.

**Educational Explanation:**

Supabase Row Level Security operates at the **row** level, not the **column** level. When a policy says `USING (auth.uid() = id)`, it means "this user can perform this operation on any row where the `id` column matches their auth UID." It does **not** say anything about which columns they can write to.

PostgreSQL does support column-level grants (`GRANT UPDATE (column_name) ON table TO role`), but RLS policies themselves cannot restrict individual columns. This means that the following sequence is possible:

1. A user with role `scout` signs up normally.
2. They open their browser's developer console (or use any HTTP client like curl).
3. They execute:
   ```js
   await supabase.from('profiles').update({ role: 'admin' }).eq('id', myUserId)
   ```
4. The RLS policy checks: "Is `auth.uid()` equal to the row's `id`?" — Yes.
5. PostgreSQL applies the update. The user is now an admin.
6. All subsequent RLS checks using `is_admin()` now pass for this user, granting them full access to every other user's players, notes, teams, and activity data.

This is called a **privilege escalation** attack. It is particularly dangerous because:
- It requires no special tools — just the browser console.
- The Supabase anon key is public (by design), so any authenticated user has direct API access.
- There is no server-side middleware to intercept the request — RLS is the only defense layer.

**Status:** Fixed via new migration `supabase/migrations/005_restrict_profile_role_updates.sql`. **Requires manual application** (see Section 3).

---

### 1.2 CRITICAL: Database Error Leakage in Chrome Extension

**Location:** `extension/src/background/background.ts`, lines 69 and 89 (before fix)

**What was found:**
The `patchPlayer()` and `createPlayer()` functions read the raw HTTP response body on failure and embedded it directly into the thrown error message:

```typescript
// BEFORE (vulnerable)
const body = await resp.text();
throw new Error(`Database error (${resp.status}): ${body}`);
```

This error propagated through the message listener back to the content script, which displayed it directly in the user-facing toast notification on the Transfermarkt page:

```typescript
updateToast(toast, response?.error ?? 'Unknown error', 'error');
```

**Educational Explanation:**

When Supabase (via PostgREST) rejects a request, the response body often contains rich diagnostic information. For example, a constraint violation might return:

```json
{
  "code": "23505",
  "details": "Key (transfermarkt_url)=(https://...) already exists.",
  "hint": null,
  "message": "duplicate key value violates unique constraint \"players_transfermarkt_url_key\""
}
```

This reveals:
- **Table and column names** (`players`, `transfermarkt_url`) — an attacker now knows your schema.
- **Constraint names** (`players_transfermarkt_url_key`) — useful for mapping the database structure.
- **PostgreSQL error codes** (`23505`) — confirms the exact database engine and version behavior.

This information is called **server-side reconnaissance data**. In a targeted attack, knowing the schema allows an attacker to craft more precise PostgREST injection payloads or identify which columns accept user input.

The `SECURITY_BEST_PRACTICES.md` Rule 3 explicitly prohibits this pattern: *"NEVER indiscriminately dump raw backend errors to the browser console."* While this was in the extension (not the browser console), it was worse — it was displayed directly on a third-party website (Transfermarkt) where any bystander or screen-share viewer could see it.

**Status:** Fixed. Error messages replaced with generic user-friendly strings: `'Failed to update player. Please try again.'` and `'Failed to create player. Please try again.'`

---

### 1.3 MEDIUM: Missing Origin Validation in Extension Message Listener

**Location:** `extension/src/background/background.ts`, line 165 (before fix)

**What was found:**
The `chrome.runtime.onMessage` listener accepted messages from **any sender** without validating the origin:

```typescript
// BEFORE (vulnerable)
chrome.runtime.onMessage.addListener(
  (message, _sender, sendResponse) => {  // _sender was ignored
    if (message.type !== 'SYNC_PLAYER') return;
    handleSyncPlayer(message.payload) ...
```

**Educational Explanation:**

Chrome extensions have a powerful inter-component messaging system. The `chrome.runtime.onMessage` listener in a background service worker can receive messages from:
- **Content scripts** injected by the extension (legitimate).
- **Other extensions** that know your extension's ID.
- **Web pages** if the extension has externally connectable configuration (not the case here, but defense-in-depth matters).

The `sender` parameter contains metadata about who sent the message, including `sender.url` (the page URL the content script is running on) and `sender.id` (the extension ID). By ignoring this parameter, the background worker blindly trusts any incoming `SYNC_PLAYER` message.

In a theoretical attack scenario:
1. A malicious browser extension (or a compromised page with content script injection capabilities) sends a crafted `SYNC_PLAYER` message with a payload containing fabricated player data.
2. The background worker processes it and writes the data to Supabase under the logged-in user's auth token.
3. The user's database now contains attacker-controlled data.

While the practical risk is limited (it requires a second malicious extension or a vulnerability in Chrome's extension isolation), validating the sender is a fundamental security principle called **defense in depth** — you don't rely on a single layer of protection.

**Status:** Fixed. Added origin check: `if (!sender.url || !/transfermarkt\.com/i.test(sender.url)) return;`

---

### 1.4 MEDIUM: Console Statements Leaking Extension Presence

**Location:** `extension/src/content/content_script.ts`, lines 654, 756, 796, 810 (before fix)

**What was found:**
Four `console.warn()` and `console.error()` statements were present in the content script that runs on Transfermarkt pages:

```typescript
console.warn('[ScoutFlow] No competition thumbs found.');
console.error('[ScoutFlow] Could not extract player name.');
console.error('[ScoutFlow] Extraction error:', err);
console.warn('[ScoutFlow] Performance data did not appear within 5s...');
```

**Educational Explanation:**

Content scripts run in the **page's JavaScript context** (with an isolated world for variables, but sharing the same DOM and console). This means any `console.log/warn/error` call from the content script appears in the page's browser console — visible to anyone who opens DevTools on that Transfermarkt page.

This creates two risks:

1. **Fingerprinting:** The `[ScoutFlow]` prefix announces exactly which extension is running. An adversary monitoring browser extensions (for example, a competitor or a data scraping countermeasure) can detect your tool's presence programmatically:
   ```javascript
   // A script on the page could detect ScoutFlow
   const originalWarn = console.warn;
   console.warn = function(...args) {
     if (args[0]?.includes('[ScoutFlow]')) {
       // Extension detected — take countermeasures
     }
     originalWarn.apply(console, args);
   };
   ```

2. **Error object leakage:** The line `console.error('[ScoutFlow] Extraction error:', err)` dumps the full error object, which could include stack traces revealing the extension's internal file structure, function names, and logic flow.

Per `SECURITY_BEST_PRACTICES.md` Rule 3, production code should not emit console output. While this rule was written for the main app, it applies even more strongly to content scripts running on third-party pages.

**Status:** Fixed. All console statements removed; replaced with inline comments where context was useful.

---

### 1.5 MEDIUM: Hardcoded Cloudflare Session Cookies in Git History

**Location:** `scraper/test_request.py`, lines 15-24 (before fix)

**What was found:**
The `test_request.py` file contained hardcoded Cloudflare `cf_clearance` and `__cf_bm` cookies, along with Google Analytics and HubSpot tracking cookies. This file is tracked by git (`git ls-files` confirmed `scraper/test_request.py` is committed).

```python
# BEFORE (vulnerable)
COOKIE_STRING = (
    "cf_clearance=NN61J4JxWZMM6b3IxsSEnUG4YKKBLvXHmVe6g3WN5eE-..."
    "__cf_bm=Oh4cn6mhxk0ql18.TX7t6_9Vgu8UZ8u.m6IN9QnLCuU-..."
    # ... plus GA and HubSpot tracking cookies
)
```

**Educational Explanation:**

Even though these specific cookies have likely expired (Cloudflare cookies rotate frequently), committing them to version control creates several problems:

1. **Git history is permanent.** Even after you remove the cookies from the file, `git log -p scraper/test_request.py` will show them forever. Anyone who clones your repo (or forks it) has access to the old cookie values.

2. **Pattern establishment.** When developers see committed cookies in a file, they're more likely to paste new cookies there and commit them again. This normalizes a dangerous practice.

3. **Tracking cookie correlation.** The HubSpot (`hubspotutk`) and Google Analytics (`_ga`) cookies in this file can be used to correlate your browsing identity across websites. If the repo were ever made public, your tracking identity would be exposed.

4. **Cloudflare session hijacking window.** If someone accessed the repo within the cookie's TTL (typically 30 minutes for `__cf_bm`, up to 24 hours for `cf_clearance`), they could impersonate your browser session on FBref, bypassing Cloudflare's bot protection.

The secure pattern is to load test cookies from environment variables or a local file excluded by `.gitignore`.

**Status:** Fixed. Cookie values replaced with empty placeholder and a comment warning against committing real values. Note: the old cookies remain in git history — see Section 3 for optional remediation.

---

### 1.6 LOW: Extension `tabs` Permission May Be Overly Broad

**Location:** `extension/public/manifest.json`, line 10

**What was found:**
The extension requests the `tabs` permission, which grants access to the `url`, `title`, `pendingUrl`, and `favIconUrl` properties of **all** browser tabs — not just the active one on Transfermarkt.

```json
"permissions": [
    "storage",
    "activeTab",
    "scripting",
    "tabs"        // <-- grants access to ALL tab URLs
]
```

**Educational Explanation:**

Chrome's permission model follows the **principle of least privilege**: extensions should request only the minimum permissions needed to function. Each permission has a specific scope:

| Permission | Grants Access To |
|-----------|------------------|
| `activeTab` | Temporarily grants host permission on the tab the user actively interacts with (clicks the extension icon) |
| `tabs` | Grants access to `url`, `title`, `favIconUrl`, and `pendingUrl` for ALL tabs at ALL times |
| `storage` | Chrome storage API for persisting data |
| `scripting` | Programmatic script injection (MV3 replacement for `tabs.executeScript`) |

The extension uses `tabs` in one place — `popup.tsx`:
```typescript
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  setOnTmProfile(isOnTmPlayerProfile(tabs[0]?.url));
});
```

This checks if the active tab is on a Transfermarkt player profile. However, the extension's `host_permissions` already include `*://*.transfermarkt.com/*`, which grants URL visibility for Transfermarkt tabs without the `tabs` permission. For non-TM tabs, `tabs[0]?.url` would return `undefined`, and `isOnTmPlayerProfile(undefined)` correctly returns `false`.

This means the `tabs` permission may be removable without breaking functionality. However, this needs testing — Chrome's behavior around `activeTab` + popup URL access has edge cases across OS and Chrome versions.

The concern is not that `tabs` is exploitable, but that it expands the extension's **attack surface**: if the extension were ever compromised (e.g., via a supply chain attack on a dependency), the attacker would have access to the URLs of every open tab, which is sensitive browsing data.

**Status:** Not changed. Flagged for manual testing and potential removal.

---

### 1.7 LOW: `.env.local.example` Added to `.gitignore`

**Location:** `.gitignore`, line 13

**What was found:**
The `.gitignore` file contains `.env.local.example`, which is the environment variable template file with placeholder values. This file is normally meant to be tracked in git so that new developers know which environment variables to configure.

**Educational Explanation:**

The `.env.local.example` file serves as documentation:
```
VITE_SUPABASE_URL=your_supabase_project_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

If this file is gitignored, new team members cloning the repo won't know:
- Which environment variables are required.
- What naming convention to use (e.g., `VITE_` prefix for Vite to expose them).
- That they need a `.env.local` file at all.

This entry may have been added accidentally (e.g., a glob pattern like `.env*.local` matching it, though `.env.local.example` doesn't end in `.local`). It should be verified whether this was intentional.

**Status:** Not changed. Flagged for manual review.

---

### 1.8 INFORMATIONAL: Supabase Anon Key in Built Extension Files

**Location:** `extension/dist/background.js`, `extension/dist/popup.js`

**What was found:**
The built (bundled) extension files contain the Supabase project URL and anon key baked in as string literals. This is because Vite replaces `import.meta.env.VITE_*` references at build time.

**Educational Explanation:**

This is **expected and by-design** for Supabase frontend applications. The anon key is explicitly designed to be public — it is a "publishable" key analogous to Stripe's publishable key. Its purpose is to identify your Supabase project and apply Row Level Security policies.

The security model works as follows:
1. The **anon key** authenticates requests to the PostgREST API but carries only the `anon` PostgreSQL role.
2. When a user logs in, Supabase issues a **JWT** containing their `auth.uid()`.
3. RLS policies use `auth.uid()` from this JWT to determine data access.
4. Without a valid user JWT, the anon key alone cannot read or write any RLS-protected data.

The key point: **the anon key is not a secret**. The `dist/` directories are also properly excluded from git via `.gitignore`, so these files won't be committed. If you distribute the extension (e.g., via Chrome Web Store), the anon key will be visible in the extension package, but this is the intended Supabase architecture.

The **service role key** (found only in `scraper/.env`) is the truly sensitive credential — it bypasses all RLS. This key is correctly isolated to the server-side Python scraper and excluded from git.

**Status:** No action needed. Working as designed.

---

### 1.9 INFORMATIONAL: Unused i18n Translation Keys

**Location:** `src/i18n/en.json`, `src/i18n/es.json`

**What was found:**
Approximately 36 translation keys exist in the i18n JSON files but are never referenced via `t()` calls in any component. Examples include:

- `toast.*` — Toast notification keys (toasts currently use hardcoded strings via sonner)
- `filter.results.*` — Filter result status messages
- `settings.tabs.*` — Settings page tab titles
- `pages.*` — Page title keys (pages use hardcoded strings instead)
- `common.save`, `common.cancel`, `common.delete`, etc.
- `columnHeaders.fbrefUrl`, `columnHeaders.weight` — Columns that were removed during TM-only migration
- `dashboard.actions.*` — Activity log action labels

**Educational Explanation:**

Unused i18n keys are not a security vulnerability, but they create **maintenance debt**:
- Translators spend time translating strings that are never displayed.
- Developers may reference a key expecting it to work, not realizing the component uses a hardcoded string instead.
- Stale keys (like `columnHeaders.fbrefUrl`) reference features that no longer exist, causing confusion.

The root cause is typically incremental development: components are built with hardcoded strings first, i18n keys are added later (or vice versa), and the two drift apart over time.

**Status:** Not changed. These should be cleaned up in a dedicated i18n audit pass.

---

## 2. What Was Verified Clean

The following areas were scanned and found to be properly secured:

| Area | Verification Method | Result |
|------|-------------------|--------|
| No hardcoded API keys in source files | Searched all `.ts`, `.tsx`, `.py` for `eyJ`, `supabase.co`, `apikey`, `secret` literals | CLEAN — all credentials loaded from `import.meta.env` or `os.getenv` |
| No service_role key in frontend/extension | Searched for `service_role`, `SERVICE_ROLE` across `src/` and `extension/src/` | CLEAN — only present in `scraper/.env` (server-side) |
| No `.env` files tracked by git | `git ls-files \| grep -i env` | CLEAN — only `.env.local.example` tracked |
| No XSS attack vectors | Searched for `dangerouslySetInnerHTML`, `innerHTML`, `eval(`, `document.write` | CLEAN — zero instances in entire frontend |
| PostgREST injection protection | Reviewed all `.or()`, `.ilike()`, `.filter()` calls in `src/api/` | CLEAN — `sanitizePostgrestFilter()` applied to all user string inputs |
| Frontend console-free | Searched for `console.log/error/warn/table` in `src/` | CLEAN — zero statements in main React app |
| RLS enabled on all tables | Reviewed `001_initial_schema.sql` lines 142-147 | CLEAN — `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on all 5 tables |
| `is_admin()` SECURITY DEFINER | Reviewed `004_rls_security_enforcement.sql` lines 8-16 | CLEAN — correctly defined |
| Auth flow security | Reviewed `useAuth.ts`, `LoginPage.tsx`, `SignUpPage.tsx` | CLEAN — delegates to Supabase Auth, no custom token handling |
| Extension session storage | Reviewed `extension/src/supabase.ts` | CLEAN — uses `chrome.storage.local` (isolated from web pages) |
| SQL injection in migrations | Reviewed all 5 migration files | CLEAN — no dynamic SQL or string concatenation |
| All npm packages in use | Searched imports for every dependency in `package.json` | CLEAN — all packages actively imported (`date-fns` confirmed in 5 files) |
| All React components in use | Cross-referenced component files with imports | CLEAN — every component is imported by at least one page or parent |
| All hooks in use | Cross-referenced hook files with imports | CLEAN — every hook is actively used |
| All API functions in use | Cross-referenced API exports with hook/component imports | CLEAN — every function is consumed |

---

## 3. Developer Action Items

These are manual steps that only you can perform. They are ordered by priority.

### ACTION 1 (CRITICAL): Apply Migration 005 to Supabase

**Why:** Without this migration, any authenticated user can promote themselves to admin. This is exploitable today with nothing more than a browser console.

**Steps:**
1. Open your Supabase Dashboard.
2. Navigate to **SQL Editor**.
3. Open the file `supabase/migrations/005_restrict_profile_role_updates.sql` from this repo.
4. Copy its full contents and paste them into the SQL Editor.
5. Click **Run**.
6. Verify success by checking that the old policies were dropped and the new ones created:
   ```sql
   SELECT policyname FROM pg_policies WHERE tablename = 'profiles';
   ```
   You should see:
   - `Users can update own profile, no role change`
   - `Admins can update any profile`
   - `Users can read their own profile, Admins read all`

**Verification test:** Log in as a scout user and attempt:
```js
const { error } = await supabase.from('profiles').update({ role: 'admin' }).eq('id', myId)
```
This should now return a policy violation error.

---

### ACTION 2 (RECOMMENDED): Test Removing the `tabs` Permission

**Why:** The `tabs` permission grants access to all browser tab URLs, which is more access than the extension needs.

**Steps:**
1. Open `extension/public/manifest.json`.
2. Remove `"tabs"` from the `permissions` array:
   ```json
   "permissions": [
       "storage",
       "activeTab",
       "scripting"
   ]
   ```
3. Rebuild the extension: `cd extension && npm run build`.
4. Load the unpacked extension from `extension/dist/` in Chrome.
5. Test the popup on a Transfermarkt player profile page — does it still correctly show "Syncing player data..."?
6. Test the popup on a non-Transfermarkt page — does it correctly show "Ready to extract Transfermarkt data"?
7. If both work correctly, keep the change. If the popup can't detect TM pages, revert.

---

### ACTION 3 (RECOMMENDED): Verify `.env.local.example` Gitignore Entry

**Why:** This template file should normally be tracked so new developers can set up their environment.

**Steps:**
1. Open `.gitignore`.
2. Check line 13 — if it contains `.env.local.example`, decide whether this is intentional.
3. If unintentional, remove that line so the template file remains tracked.

---

### ACTION 4 (OPTIONAL): Scrub Cookies from Git History

**Why:** The Cloudflare cookies removed from `test_request.py` still exist in git history. While they've almost certainly expired, scrubbing them is good hygiene.

**Steps (if repo is private and history scrubbing is acceptable):**
```bash
# Use git-filter-repo (install via: brew install git-filter-repo)
git filter-repo --path scraper/test_request.py --invert-paths --force

# Then re-add the cleaned file
git add scraper/test_request.py
git commit -m "re-add test_request.py after history scrub"
```

**Alternative (simpler, less disruptive):** If the repo is private and not shared publicly, the expired cookies in history pose minimal risk. You can skip this step.

---

### ACTION 5 (OPTIONAL): Rebuild Extension with Security Fixes

**Why:** The current `extension/dist/` files were built before the security fixes. Rebuilding ensures the deployed extension includes the error message sanitization, console removal, and origin validation.

**Steps:**
```bash
cd extension
npm run build
```

Then reload the extension in Chrome via `chrome://extensions` > click the refresh icon on "ScoutFlow Ride-Along."

---

### ACTION 6 (OPTIONAL): Clean Up Unused i18n Keys

**Why:** Reduces translator burden and prevents confusion from stale keys.

**Steps:**
Review and remove unused keys from `src/i18n/en.json` and `src/i18n/es.json`. The following key groups were identified as unreferenced:

- `toast.*` (all keys) — toasts use hardcoded strings
- `filter.results.*` (all keys)
- `settings.tabs.*` (all keys)
- `pages.*` (all keys — page titles are hardcoded)
- `common.save`, `common.saving`, `common.cancel`, `common.delete`, `common.edit`, `common.add`, `common.search`, `common.noResults`, `common.optional`
- `columnHeaders.fbrefUrl`, `columnHeaders.weight`
- `dashboard.actions.*`, `dashboard.notesLast7`, `dashboard.countriesScouted`
- `detail.overview`, `detail.notes`, `detail.activity`, `detail.noNotes`, `detail.addNotePlaceholder`, `detail.postNote`, `detail.noValue`
- `playerForm.back`, `playerForm.fields.fbrefUrl`, `playerForm.fields.weightKg`
- `grid.rowCount`, `grid.statsNoData`, `grid.statsLastUpdated`
- `auth.password`, `auth.login`, `auth.signup`
- `settings.users.joined`, `settings.export.exporting`

Before deleting, search for dynamic key usage patterns like `t(\`dashboard.actions.${type}\`)` which would not be caught by a static grep for the full key string.

---

*End of report. This document should be kept alongside `SECURITY_BEST_PRACTICES.md` as a historical record of the audit and its findings.*
