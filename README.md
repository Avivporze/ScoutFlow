# Scout — Football Scouting & Player Management Platform

A real-time collaborative web application for football (soccer) scouting teams. Replaces scattered spreadsheets and WhatsApp threads with a centralized player database, Monday.com-style data grid, and automated data ingestion from Transfermarkt via a Chrome Extension.

Built for a small team of partners who need to track, evaluate, and discuss players — with every change synced instantly across all users.

---

## Tech Stack

| Layer              | Technology                                |
| ------------------ | ----------------------------------------- |
| Frontend           | React 18, TypeScript, Vite                |
| Styling            | Tailwind CSS                              |
| Table Engine       | TanStack Table v8 + TanStack Virtual      |
| State Management   | TanStack Query (React Query)              |
| Drag & Drop        | @dnd-kit/core + @dnd-kit/sortable         |
| Internationalization | react-i18next (EN + HE)                 |
| Database           | Supabase (PostgreSQL) with Row-Level Security |
| Auth               | Supabase Auth (email/password)            |
| Realtime           | Supabase Realtime (WebSocket)             |
| Data Ingestion     | Chrome Extension (Manifest V3, TypeScript) |
| Hosting            | Vercel (static SPA)                       |

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   VERCEL (Static SPA)                    │
│                React + TypeScript + Vite                 │
│            Dashboard │ Master Grid │ Filters             │
└─────────────────────────┬────────────────────────────────┘
                          │ HTTPS
                          ▼
┌──────────────────────────────────────────────────────────┐
│                      SUPABASE                            │
│                                                          │
│  ┌─────────────┐  ┌────────────┐  ┌─────────────────┐   │
│  │ PostgreSQL   │  │   Auth     │  │   Realtime      │   │
│  │ + RLS on     │  │ email/pw   │  │  WebSocket      │   │
│  │   every      │  │ sessions   │  │  subscriptions  │   │
│  │   table      │  │            │  │                 │   │
│  └─────────────┘  └────────────┘  └─────────────────┘   │
│  ┌─────────────┐                                         │
│  │  Storage     │                                        │
│  │  (photos,    │                                        │
│  │   reports)   │                                        │
│  └─────────────┘                                         │
└──────────────────────────▲───────────────────────────────┘
                           │ Authenticated Supabase JS Client
                           │
              ┌────────────┴──────────────┐
              │     Chrome Extension       │
              │     (Manifest V3)          │
              │                            │
              │  Content Script            │
              │    ↓ DOM extraction         │
              │  Background Service Worker │
              │    ↓ Supabase PATCH/INSERT │
              └────────────┬──────────────┘
                           │
                           ▼
              ┌───────────────────────────┐
              │    transfermarkt.com       │
              │    Player Profile Pages    │
              └───────────────────────────┘
```

The web app and database run entirely on free tiers. The Chrome Extension runs in the user's browser — no backend middleware, no proxy servers.

---

## Key Features

- **Real-time multi-user collaboration** — Supabase Realtime (WebSocket) pushes every player edit, note, and status change to all connected users instantly. No manual refresh.
- **Chrome Extension for automated data ingestion** — Visit any Transfermarkt player profile and the Extension extracts 20+ fields (bio, stats, contract, agent, social links) and writes them directly to the database. Auto-creates player records if not found.
- **Monday.com-style data grid** — TanStack Table v8 with column sorting, resizing, reordering (drag & drop), visibility toggles, inline editing, and row virtualization for large datasets.
- **Role-based access control** — Two roles: `admin` and `scout`. Admins manage teams, users, and can delete players. Scouts can add and edit but not delete.
- **Bilingual interface** — Full English and Hebrew support via react-i18next with RTL layout handling.
- **Advanced query builder** — Multi-condition filter page with field/operator/value rows, supporting age ranges, stat thresholds, contract windows, and CSV export.
- **Tamper-proof audit trail** — All activity logging is driven by PostgreSQL `SECURITY DEFINER` triggers. The frontend has no write access to the audit log.

---

## Security

This section documents the security architecture and the findings of the April 2026 security audit that hardened the application against common attack vectors.

### Row-Level Security (RLS)

Every table in the database has RLS enabled. Policies enforce access control at the database layer — not in application code — meaning even direct PostgREST API calls are constrained:

| Table           | Read             | Write                                    | Delete            |
| --------------- | ---------------- | ---------------------------------------- | ----------------- |
| `profiles`      | All authenticated | Own profile only; admin can modify roles | —                 |
| `players`       | All authenticated | All authenticated                        | Admin only        |
| `player_notes`  | All authenticated | All authenticated (insert); author only (update/delete) | Author only |
| `internal_teams`| All authenticated | Admin only                               | Admin only        |
| `activity_log`  | All authenticated | **No direct access** — trigger-only writes | —              |

### April 2026 Security Audit

A dedicated audit was performed across Phases 7–10, hardening the application against the following:

**Role escalation prevention.** RLS policies for the `profiles` table were rewritten to explicitly verify the caller's current role via a subquery (`SELECT role FROM profiles WHERE id = auth.uid()`) before permitting changes to the `role` column. This prevents a scout from promoting themselves to admin via a direct Supabase API call — even if they craft the request manually outside the application UI.

**PostgREST injection patching.** All user-facing filter inputs that feed into Supabase query builders were audited and sanitized. Query construction uses the Supabase JS client's parameterized methods exclusively — no string interpolation of user input into `.or()`, `.filter()`, or `.rpc()` calls.

**Data minimization.** Every Supabase query uses explicit `.select('col1, col2, col3')` rather than `.select('*')`. This limits the data surface exposed to the client, prevents accidental leakage of internal columns, and reduces payload size.

**PostgREST error body obfuscation.** Raw PostgREST error responses (which can expose schema details like table names, column types, and constraint names) are caught and replaced with generic user-facing messages before rendering. The original error is logged to the console in development only.

**No service role key in application code.** The `SUPABASE_SERVICE_ROLE_KEY` is never present in the frontend bundle or the Chrome Extension. All reads and writes — including from the Extension — use the anon key + authenticated user session + RLS. The service role key exists only in the Supabase Dashboard for manual administrative SQL operations.

### Authentication Flow

Authentication is handled by Supabase Auth (email/password). The flow:

1. User signs up or logs in via the web app. Supabase issues a JWT stored in `localStorage`.
2. Every Supabase JS client request includes this JWT automatically. RLS policies evaluate `auth.uid()` from the token.
3. A PostgreSQL trigger auto-creates a `profiles` row on sign-up, seeding the user's name, email, and default `scout` role.
4. The first user is promoted to `admin` via a bootstrap trigger (or manual SQL) — there is no self-service admin creation.

### Chrome Extension Authentication

The Extension does not maintain its own auth state or use a separate backend. It reads the authenticated Supabase session from the user's browser (the same session established by logging into the web app). This means:

- No credentials are stored in the Extension.
- No middleware or proxy server sits between the Extension and Supabase.
- All Extension writes are subject to the same RLS policies as the web app.
- If the user is not logged into the web app, the Extension cannot write to the database.

### Environment Variable Management

| Variable                  | Visibility  | Purpose                                      |
| ------------------------- | ----------- | -------------------------------------------- |
| `VITE_SUPABASE_URL`       | Public      | Supabase project URL (safe to expose)        |
| `VITE_SUPABASE_ANON_KEY`  | Public      | Anon key — restricted by RLS (safe to expose)|
| `SUPABASE_SERVICE_ROLE_KEY`| **Never bundled** | Not referenced in any application code  |

- `.env.local` and `.env*.local` are gitignored from the first commit.
- `.env.local.example` is committed as a template with placeholder values.
- The `VITE_` prefix is required by Vite to expose variables to the frontend — only these two are used.

The April 2026 security audit identified and resolved critical issues, specifically patching PostgREST injection vectors, preventing role escalation, and enforcing strict data minimization.

---

## Chrome Extension

The Chrome Extension is the primary data ingestion mechanism. It uses Manifest V3 with two components:

**Content Script** — Injected on Transfermarkt player profile pages (`*://*.transfermarkt.com/*/profil/spieler/*`). Extracts 20+ fields from the DOM: name, date of birth, nationalities, height, preferred foot, position, current club, league, contract expiry, market value, agent details, social media links, and season statistics (matches, goals, assists, minutes).

**Background Service Worker** — Receives extracted data from the content script, authenticates with Supabase using the browser's existing session, and performs an upsert:
1. Looks up the player by `transfermarkt_url`.
2. If found, PATCHes the existing record with fresh data.
3. If not found, INSERTs a new player record.

All Supabase calls go through an internal `authedFetch` wrapper that transparently refreshes the access token on `401` using the stored `refresh_token` and retries the request once. This makes syncs self-healing across Supabase free-tier database hibernations — the user only sees a "Session expired" prompt if the refresh itself fails. Failures surface status-aware messages (`401`, `403`, `409` on duplicate, `5xx`) rather than a single opaque "try again".

No backend proxy, no API keys in the Extension, no separate authentication flow. The Extension is a thin extraction layer that writes through the same authenticated Supabase client the web app uses.

---

## Development Journey

This project went through 10 completed revision phases, reflecting real-world engineering trade-offs:

| Phase | What happened |
| ----- | ------------- |
| 1–5   | Built the full web application: auth, Master Grid, player forms, notes system, dashboard, advanced filters, settings, i18n, and Vercel deployment prep. |
| 6     | Attempted a Python scraper for FBref stats using Playwright + stealth plugins. **Blocked by Cloudflare Turnstile** (managed mode) — no automation bypass exists. Phase permanently frozen. |
| 7     | Rebuilt the dashboard with new KPI widgets. Conducted the first security audit: patched PostgREST injection vectors, enforced data minimization. |
| 8–9   | Built a dual-source Chrome Extension (FBref + Transfermarkt). Mapped all 28 DB fields to their scrape sources. Realized FBref was permanently unreliable. |
| 10    | **Pivoted to single-source Transfermarkt architecture.** Rewrote the Extension from ~617 lines to ~170 lines. Eliminated dual-source complexity entirely. |

The arc — external APIs, then manual CRUD, then FBref scraper, then Cloudflare wall, then dual-source Extension, then single-source simplification — demonstrates iterative problem-solving under real constraints rather than a theoretical architecture imposed upfront.

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)
- Google Chrome (for the Extension)

### Setup

```bash
# Clone and install
git clone https://github.com/Avivporze/ScoutFlow
cd Scout
npm install

# Configure environment
cp .env.local.example .env.local
# Edit .env.local with your Supabase project URL and anon key
```

### Database

1. Apply the SQL schema manually via the Supabase Dashboard SQL Editor.
2. Enable the `pg_trgm` extension in Dashboard → Database → Extensions.
3. Sign up your first user through the app, then promote them to admin:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE email = 'your-email@example.com';
   ```

### Run

```bash
npm run dev        # Starts Vite dev server at localhost:5173
npm run build      # Production build
npm run preview    # Preview production build locally
```

### Chrome Extension

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the `extension/` directory.
4. Log into the Scout web app in the same browser — the Extension uses this session to authenticate.
5. Navigate to any Transfermarkt player profile. The Extension extracts and syncs data automatically.

### Deploy

Connect the GitHub repo to [Vercel](https://vercel.com). Set the framework to **Vite** and add the environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
