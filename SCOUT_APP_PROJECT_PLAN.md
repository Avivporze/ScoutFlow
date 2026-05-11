# Football Scouting & Player Management App — Project Plan

> **Document Purpose:** This is the single source of truth for architecture, tech stack, database schema, UI/UX decisions, and implementation roadmap. This document is the instruction manual for Claude Code — read it in full before writing any code.

---

## Revision History

| Rev  | Date       | Changes                                                                  |
| ---- | ---------- | ------------------------------------------------------------------------ |
| 1.0  | 2026-03-30 | Initial plan (with external API integration)                             |
| 2.0  | 2026-03-30 | 8 architectural fixes applied                                            |
| 3.0  | 2026-03-31 | Major pivot: removed all external API integration. Pure manual CRUD MVP. |
| 4.0  | 2026-03-31 | Added FBref stats columns + standalone Python scraper (Phase 6). Phase 1 complete. |
| 5.0  | 2026-04-01 | Phase 6 pivot: replaced curl_cffi/requests with Playwright + playwright-stealth. |
| 6.0  | 2026-04-01 | Phase 6 frozen: Cloudflare Turnstile managed mode cannot be bypassed by automation. |
| 7.0  | 2026-04-02 | Phase 7 complete: V2 Dashboard rebuilt. Pre-launch Security Audit: patched PostgREST injection, enforced strict auth.uid() RLS. |
| 8.0  | 2026-04-03 | Phase 8: Dual-Source Chrome Extension (FBref + Transfermarkt). Background Service Worker orchestrates TM fetch. |
| 9.0  | 2026-04-03 | Phase 9: Master Grid now exposes all DB fields. Step-by-step scraper rebuild initiated. Superseded by Phase 10. |
| 10.0 | 2026-04-03 | Phase 10: Total Migration to Transfermarkt. FBref retired. Single-source TM architecture. Auto-create players by URL. |
| 11.0 | 2026-04-03 | **Architecture finalized. April 2026 Security Audit complete: RLS hardened against role escalation, hardcoded secrets removed. `weight_kg` removed. Best Fit = predefined Israeli Premier League teams. Phase 11 placeholder added.** |
| 12.0 | 2026-05-11 | Extension background worker hardened against Supabase free-tier DB hibernation: added `authedFetch` wrapper that refreshes the access token on `401` via the stored `refresh_token` and retries once. Helpers now throw status-aware messages (`401` → "Session expired", `409` → duplicate, `5xx` → server). `lookupPlayerByTMUrl` no longer swallows non-2xx responses. |

---

## 1. Project Overview

A web-based football (soccer) player scouting and management application for a small team of partners. It replaces scattered Excel spreadsheets and WhatsApp messages with an organized, real-time collaborative workspace.

**Transfermarkt is the Single Source of Truth.** All player data — biographical info, position, club, contract, market value, agent details, and season statistics — is ingested automatically via a **Chrome Extension** that extracts data directly from Transfermarkt player profile pages and writes to Supabase. Player records can also be created and edited manually via the web UI.

### Key Goals

- Centralized player database with real-time multi-user collaboration
- Monday.com-style Master Grid as the core interface
- One-click player data import from Transfermarkt via Chrome Extension
- Comprehensive manual add/edit form for entering or correcting player details
- Advanced filtering to query the player database
- Bilingual support (English + Hebrew)
- Modern, clean, minimalist design (white background, blue accent buttons)

---

## 2. Tech Stack (Final)

| Layer                  | Technology                                  | Why                                                                         |
| ---------------------- | ------------------------------------------- | --------------------------------------------------------------------------- |
| **Frontend**           | Vite + React 18 + TypeScript                | Fast dev server, strong typing, largest ecosystem for complex UI            |
| **Styling**            | Tailwind CSS                                | Utility-first, easy to achieve clean minimalist design, no bloat            |
| **Table Engine**       | TanStack Table v8                           | Headless — full control over rendering; supports sort, filter, edit         |
| **Row Virtualization** | TanStack Virtual                            | Renders only visible rows; needed if player list exceeds 500+               |
| **Drag & Drop**        | @dnd-kit/core                               | Lightweight, integrates cleanly with TanStack Table for column reorder      |
| **Routing**            | React Router v6                             | Standard SPA routing for the 3 pages + auth                                 |
| **i18n**               | react-i18next                               | Industry standard, JSON translation files, namespace support                |
| **State Management**   | TanStack Query (React Query)                | Server state caching, background refetching, optimistic updates             |
| **Icons**              | Lucide React                                | Clean, consistent icon set that fits minimalist design                      |
| **Frontend Hosting**   | Vercel (Free Tier)                          | Global CDN, automatic HTTPS, preview deploys per branch, zero config        |
| **Database**           | Supabase (PostgreSQL)                       | Managed Postgres, 500 MB free, JSONB support, GIN indexes                   |
| **Auth**               | Supabase Auth                               | Built-in email/password or magic link, RLS integration                      |
| **Real-time**          | Supabase Realtime                           | WebSocket subscriptions — one scout's edit appears instantly for others     |
| **Storage**            | Supabase Storage                            | Player photos, PDF scouting reports (1 GB free)                             |
| **Data Ingestion**     | Chrome Extension (Manifest V3, TypeScript)  | Content script extracts all 28 player fields from Transfermarkt DOM; background worker PATCHes Supabase via authenticated session. Auto-creates new players if not found. |

### What We Are NOT Using (And Why)

| Rejected Option               | Reason                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| **Python FBref Scraper**      | Fully deprecated — replaced by Chrome Extension + Transfermarkt. FBref blocked by Cloudflare Turnstile. |
| **FBref as data source**      | Retired in Phase 10. Transfermarkt provides all required fields from a single page.   |
| **Oracle Cloud**              | No background tasks needed — all ingestion happens in-browser via Chrome Extension    |
| **Supabase Edge Functions**   | Extension writes via authenticated Supabase JS client — no server-side proxy needed   |
| **pg_cron / pg_net**          | Data is pushed on-demand when user visits TM profile pages — no scheduling needed     |
| **External Football APIs**    | Transfermarkt is scraped directly by the extension — no paid API needed               |
| **Electron / Tauri**          | Web app + Chrome Extension is sufficient — zero installation for partners             |
| **AG Grid / MUI DataGrid**    | Heavy, opinionated styling that fights custom design systems                          |

### Future Option: Desktop Wrapper

If native desktop features are ever needed (system tray notifications, offline mode), the same React codebase can be wrapped in **Tauri 2.0** with minimal changes.

---

## 3. Infrastructure Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     VERCEL (Free Tier)                       │
│                  Vite + React + TypeScript                   │
│                   Static SPA Hosting                         │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   SUPABASE (Free Tier)                       │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  PostgreSQL   │  │    Auth      │  │   Realtime       │  │
│  │  Database     │  │  (email/pw)  │  │  (WebSockets)    │  │
│  │  + RLS        │  │              │  │                  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                                                             │
│  ┌──────────────┐                                           │
│  │   Storage    │                                           │
│  │  (1 GB free) │                                           │
│  └──────────────┘                                           │
└──────────────────────▲──────────────────────────────────────┘
                       │ HTTPS (Supabase JS Client, authenticated session)
                       │
              ┌────────────────────────────┐
              │     Chrome Extension        │
              │     (Manifest V3)           │
              │  Content Script +           │
              │  Background Service Worker  │
              └────────────┬───────────────┘
                           │ DOM extraction
                           ▼
              ┌────────────────────────────┐
              │     transfermarkt.com       │
              │     Player Profile Page     │
              └────────────────────────────┘
```

**The web app (Vercel + Supabase) runs on free tier. The Chrome Extension installs in the browser — no hosting cost, no local server required.**

**Total cost at launch: $0/month.**

---

## 4. Database Schema

### 4.1 Tables

#### `profiles`

Extends Supabase Auth. One row per authenticated user, auto-created on sign-up via a database trigger.

| Column               | Type          | Constraints         | Description                      |
| -------------------- | ------------- | ------------------- | -------------------------------- |
| `id`                 | `uuid`        | PK, FK → auth.users | Matches Supabase Auth user ID    |
| `full_name`          | `text`        | NOT NULL            | Display name in the app          |
| `email`              | `text`        | NOT NULL, UNIQUE    | User email                       |
| `role`               | `text`        | DEFAULT 'scout'     | 'admin' or 'scout'               |
| `preferred_language` | `text`        | DEFAULT 'en'        | 'en' or 'he'                     |
| `avatar_url`         | `text`        | NULLABLE            | Profile image URL                |
| `created_at`         | `timestamptz` | DEFAULT now()       | Account creation time            |

#### `internal_teams`

The predefined list of **Israeli Premier League** teams your scouting group evaluates players against. Powers the "Best Fit Team" single-select in the Master Grid and Player Form.

| Column       | Type          | Constraints                    | Description                         |
| ------------ | ------------- | ------------------------------ | ----------------------------------- |
| `id`         | `uuid`        | PK, DEFAULT gen_random_uuid()  | Auto-generated ID                   |
| `team_name`  | `text`        | NOT NULL, UNIQUE               | e.g., "Maccabi Tel Aviv", "Hapoel Beer Sheva" |
| `league`     | `text`        | NULLABLE                       | League the team plays in            |
| `country`    | `text`        | NULLABLE                       | Country                             |
| `sort_order` | `integer`     | DEFAULT 0                      | Controls display order in dropdowns |
| `created_at` | `timestamptz` | DEFAULT now()                  | When the team was added             |

#### `players`

The core table. One row per tracked player. Powers the Master Grid. Data is populated automatically by the Chrome Extension from Transfermarkt, or entered/corrected manually via the web UI.

**Basic Info:**

| Column               | Type          | Constraints                   | Description                                  |
| -------------------- | ------------- | ----------------------------- | -------------------------------------------- |
| `id`                 | `uuid`        | PK, DEFAULT gen_random_uuid() | Internal player ID                           |
| `first_name`         | `text`        | NOT NULL                      | Player's first name                          |
| `last_name`          | `text`        | NOT NULL                      | Player's last name                           |
| `date_of_birth`      | `date`        | NULLABLE                      | DOB                                          |
| `nationality`        | `text`        | NULLABLE                      | Primary nationality                          |
| `second_nationality` | `text`        | NULLABLE                      | Second nationality (dual citizens)           |
| `preferred_foot`     | `text`        | NULLABLE                      | 'Left', 'Right', 'Both'                      |
| `height_cm`          | `integer`     | NULLABLE                      | Height in centimeters                        |

**Club & Position:**

| Column            | Type          | Constraints | Description                                  |
| ----------------- | ------------- | ----------- | -------------------------------------------- |
| `current_club`    | `text`        | NULLABLE    | Current club name                            |
| `league`          | `text`        | NULLABLE    | Current league name                          |
| `position`        | `text`        | NULLABLE    | Primary position (GK, CB, LB, CM, ST, etc.)  |
| `contract_expiry` | `date`        | NULLABLE    | Contract expiry date (for alerts)            |
| `market_value`    | `text`        | NULLABLE    | Estimated market value (e.g., "€5M")         |

**Agent:**

| Column          | Type   | Constraints | Description                                |
| --------------- | ------ | ----------- | ------------------------------------------ |
| `agent_name`    | `text` | NULLABLE    | Player's agent name                        |
| `agent_contact` | `text` | NULLABLE    | Agent phone, email, or other contact info  |

**Links & Social:**

| Column              | Type   | Constraints    | Description                                                           |
| ------------------- | ------ | -------------- | --------------------------------------------------------------------- |
| `transfermarkt_url` | `text` | NULLABLE       | **Primary URL.** Used by the Chrome Extension to identify and enrich the player. |
| `fbref_url`         | `text` | NULLABLE       | **Deprecated.** Retained in DB for backward compatibility; no longer used by the data pipeline. |
| `social_links`      | `jsonb`| DEFAULT '{}'   | Social media links (see structure below)                              |

**`social_links` JSONB structure:**
```json
{
  "instagram": "https://instagram.com/player",
  "twitter": "https://x.com/player",
  "facebook": "https://facebook.com/player",
  "tiktok": "https://tiktok.com/@player",
  "linkedin": "https://linkedin.com/in/player",
  "youtube": "https://youtube.com/@player",
  "website": "https://player.com"
}
```
Only populated fields are stored — empty/null fields are omitted from the JSONB object.

**Stats (populated by Chrome Extension from Transfermarkt — READ-ONLY in the UI):**

| Column             | Type          | Constraints | Description                                              |
| ------------------ | ------------- | ----------- | -------------------------------------------------------- |
| `stats_matches`    | `integer`     | DEFAULT 0   | Total matches played (current season)                    |
| `stats_goals`      | `integer`     | DEFAULT 0   | Total goals scored (current season)                      |
| `stats_assists`    | `integer`     | DEFAULT 0   | Total assists (current season)                           |
| `stats_minutes`    | `integer`     | DEFAULT 0   | Total minutes played (current season)                    |
| `stats_updated_at` | `timestamptz` | NULLABLE    | When stats were last synced by the Chrome Extension      |

**These 5 columns are NEVER edited via the web UI.** They are written exclusively by the Chrome Extension after visiting a player's Transfermarkt page.

**Internal Management:**

| Column             | Type          | Constraints                                               | Description                                                    |
| ------------------ | ------------- | --------------------------------------------------------- | -------------------------------------------------------------- |
| `best_fit_team_id` | `uuid`        | NULLABLE, FK → internal_teams(id) ON DELETE SET NULL      | Which Israeli Premier League team suits this player. Resets to NULL if team deleted. |
| `status`           | `text`        | DEFAULT 'active'                                          | 'active', 'archived', 'watchlist'                              |
| `added_by`         | `uuid`        | NOT NULL, DEFAULT auth.uid(), FK → profiles(id)           | Who added this player. Defaults to current authenticated user. |
| `created_at`       | `timestamptz` | DEFAULT now()                                             | When player was first added                                    |
| `updated_at`       | `timestamptz` | DEFAULT now()                                             | Last modification time (auto-updated by trigger)               |

#### `player_notes`

Threaded notes per player. Replaces WhatsApp discussions.

| Column       | Type          | Constraints                                      | Description                     |
| ------------ | ------------- | ------------------------------------------------ | ------------------------------- |
| `id`         | `uuid`        | PK, DEFAULT gen_random_uuid()                    | Note ID                         |
| `player_id`  | `uuid`        | NOT NULL, FK → players(id) ON DELETE CASCADE     | Which player this note is about |
| `author_id`  | `uuid`        | NOT NULL, DEFAULT auth.uid(), FK → profiles(id)  | Who wrote the note              |
| `content`    | `text`        | NOT NULL                                         | Note text (supports markdown)   |
| `created_at` | `timestamptz` | DEFAULT now()                                    | When the note was written       |

#### `activity_log`

Audit trail for the Dashboard's "recent activity" feed. **Populated exclusively by database triggers — never by frontend code.**

| Column        | Type          | Constraints                                      | Description                                          |
| ------------- | ------------- | ------------------------------------------------ | ---------------------------------------------------- |
| `id`          | `uuid`        | PK, DEFAULT gen_random_uuid()                    | Log entry ID                                         |
| `user_id`     | `uuid`        | NULLABLE, FK → profiles(id)                      | Who performed the action. NULL for Extension writes. |
| `player_id`   | `uuid`        | NULLABLE, FK → players(id) ON DELETE SET NULL    | Related player (if applicable)                       |
| `action_type` | `text`        | NOT NULL                                         | 'player_added', 'player_updated', 'note_added', 'player_archived' |
| `metadata`    | `jsonb`       | DEFAULT '{}'                                     | Additional context (e.g., which fields changed)      |
| `created_at`  | `timestamptz` | DEFAULT now()                                    | When the action occurred                             |

### 4.2 Indexes

```sql
-- Fast Master Grid queries
CREATE INDEX idx_players_position ON players(position);
CREATE INDEX idx_players_league ON players(league);
CREATE INDEX idx_players_nationality ON players(nationality);
CREATE INDEX idx_players_best_fit_team ON players(best_fit_team_id);
CREATE INDEX idx_players_status ON players(status);
CREATE INDEX idx_players_contract_expiry ON players(contract_expiry);
CREATE INDEX idx_players_current_club ON players(current_club);

-- Full-text search on player name (first + last combined)
CREATE INDEX idx_players_name ON players USING GIN (
  (first_name || ' ' || last_name) gin_trgm_ops
);

-- Notes lookup
CREATE INDEX idx_notes_player ON player_notes(player_id);

-- Activity feed (recent first)
CREATE INDEX idx_activity_created ON activity_log(created_at DESC);
```

**Note:** The `gin_trgm_ops` index requires the `pg_trgm` extension (enabled in Supabase Dashboard → Database → Extensions). This enables fast fuzzy text search on player names.

### 4.3 Row Level Security (RLS)

All tables have RLS enabled. Authenticated users can read all data (it's a shared team workspace). Write permissions are scoped:

- **profiles:** Users can update their own profile only. **Exception: admins can update any profile's `role` field** (for promoting scouts to admin). Users cannot promote themselves — the policy checks that the requester's current role is 'admin' before allowing `role` field updates.
- **internal_teams:** Only `admin` role can insert/update/delete.
- **players:** All authenticated users can insert and update. Only `admin` can delete. The Chrome Extension writes via an authenticated user session, so RLS applies normally.
- **player_notes:** All authenticated users can insert. Authors can update/delete their own notes.
- **activity_log:** **No direct insert/update/delete for any user.** All writes happen via `SECURITY DEFINER` trigger functions that bypass RLS. The audit log is tamper-proof.

> **April 2026 Security Audit:** RLS policies were hardened against role escalation attacks. Policies now explicitly verify the caller's existing role via a subquery on `profiles` before allowing `role` field changes, preventing a scout from self-promoting to admin. All policies use `auth.uid()` directly. Hardcoded service role keys were removed from all application code paths.

### 4.4 Database Trigger: `updated_at` Auto-Refresh

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

### 4.5 Database Trigger: Auto-Create Profile on Sign-Up

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
```

### 4.6 Database Triggers: Automatic Activity Logging

**Design principle:** The `activity_log` is populated **exclusively by PostgreSQL triggers**, never by frontend code. This guarantees every data change is logged regardless of source and eliminates race conditions.

The trigger functions use `SECURITY DEFINER` to bypass RLS on the `activity_log` table. They use `auth.uid()` to capture the current user (returns NULL for Chrome Extension writes using a service session).

```sql
-- ============================================================
-- Trigger: Log when a player is ADDED
-- ============================================================
CREATE OR REPLACE FUNCTION log_player_added()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO activity_log (user_id, player_id, action_type, metadata)
  VALUES (
    auth.uid(),
    NEW.id,
    'player_added',
    jsonb_build_object('player_name', NEW.first_name || ' ' || NEW.last_name)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_player_added
  AFTER INSERT ON players
  FOR EACH ROW
  EXECUTE FUNCTION log_player_added();

-- ============================================================
-- Trigger: Log when a player is UPDATED (tracks changed fields)
-- ============================================================
CREATE OR REPLACE FUNCTION log_player_updated()
RETURNS TRIGGER AS $$
DECLARE
  changed_fields jsonb := '{}';
BEGIN
  IF OLD.first_name IS DISTINCT FROM NEW.first_name THEN
    changed_fields := changed_fields || jsonb_build_object('first_name', jsonb_build_array(OLD.first_name, NEW.first_name));
  END IF;
  IF OLD.last_name IS DISTINCT FROM NEW.last_name THEN
    changed_fields := changed_fields || jsonb_build_object('last_name', jsonb_build_array(OLD.last_name, NEW.last_name));
  END IF;
  IF OLD.current_club IS DISTINCT FROM NEW.current_club THEN
    changed_fields := changed_fields || jsonb_build_object('current_club', jsonb_build_array(OLD.current_club, NEW.current_club));
  END IF;
  IF OLD.league IS DISTINCT FROM NEW.league THEN
    changed_fields := changed_fields || jsonb_build_object('league', jsonb_build_array(OLD.league, NEW.league));
  END IF;
  IF OLD.best_fit_team_id IS DISTINCT FROM NEW.best_fit_team_id THEN
    changed_fields := changed_fields || jsonb_build_object('best_fit_team_id', jsonb_build_array(OLD.best_fit_team_id, NEW.best_fit_team_id));
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    changed_fields := changed_fields || jsonb_build_object('status', jsonb_build_array(OLD.status, NEW.status));
  END IF;
  IF OLD.contract_expiry IS DISTINCT FROM NEW.contract_expiry THEN
    changed_fields := changed_fields || jsonb_build_object('contract_expiry', jsonb_build_array(OLD.contract_expiry, NEW.contract_expiry));
  END IF;
  IF OLD.position IS DISTINCT FROM NEW.position THEN
    changed_fields := changed_fields || jsonb_build_object('position', jsonb_build_array(OLD.position, NEW.position));
  END IF;
  IF OLD.market_value IS DISTINCT FROM NEW.market_value THEN
    changed_fields := changed_fields || jsonb_build_object('market_value', jsonb_build_array(OLD.market_value, NEW.market_value));
  END IF;
  IF OLD.agent_name IS DISTINCT FROM NEW.agent_name THEN
    changed_fields := changed_fields || jsonb_build_object('agent_name', jsonb_build_array(OLD.agent_name, NEW.agent_name));
  END IF;

  -- Only log if something meaningful changed
  -- (Skip stats-only updates from the Chrome Extension and updated_at-only changes)
  IF changed_fields != '{}' THEN
    INSERT INTO activity_log (user_id, player_id, action_type, metadata)
    VALUES (
      auth.uid(),
      NEW.id,
      CASE WHEN NEW.status = 'archived' AND OLD.status != 'archived' THEN 'player_archived' ELSE 'player_updated' END,
      jsonb_build_object('player_name', NEW.first_name || ' ' || NEW.last_name, 'changed_fields', changed_fields)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_player_updated
  AFTER UPDATE ON players
  FOR EACH ROW
  EXECUTE FUNCTION log_player_updated();

-- ============================================================
-- Trigger: Log when a note is ADDED to a player
-- ============================================================
CREATE OR REPLACE FUNCTION log_note_added()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO activity_log (user_id, player_id, action_type, metadata)
  VALUES (
    auth.uid(),
    NEW.player_id,
    'note_added',
    jsonb_build_object('note_preview', LEFT(NEW.content, 100))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_note_added
  AFTER INSERT ON player_notes
  FOR EACH ROW
  EXECUTE FUNCTION log_note_added();
```

**What gets logged vs. silently skipped:**
- Player added → **logged** (with player name)
- Player updated (name, club, league, best_fit, status, contract, position, market_value, agent) → **logged** (with old→new diff)
- Stats updated by Chrome Extension (only `stats_*` fields changed) → **silently skipped** (the trigger doesn't track these fields, so no noise in the activity feed)
- Note added → **logged** (with first 100 chars preview)

### 4.7 Admin Bootstrap: First User Setup

**The problem:** RLS prevents non-admins from managing `internal_teams` and user roles, but the first user signs up as `role = 'scout'` by default.

**Solution A — Manual (run once in Supabase SQL Editor after first sign-up):**

```sql
UPDATE profiles
SET role = 'admin'
WHERE email = 'your-email@example.com';

-- Verify:
SELECT id, full_name, email, role FROM profiles;
```

**Solution B — Automatic (include in migration to auto-promote first user):**

```sql
CREATE OR REPLACE FUNCTION auto_promote_first_admin()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT count(*) FROM profiles) = 1 THEN
    UPDATE profiles SET role = 'admin' WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_first_user_admin
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_promote_first_admin();
```

### 4.8 Supabase Realtime: Table Publication

Supabase Realtime does **not** enable subscriptions by default. Add this to the migration:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE player_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;
```

**Do NOT add `profiles` or `internal_teams`** — these change rarely and don't need real-time push.

---

## 5. Application Pages (3 Pages + Auth)

### 5.0 Auth Pages (Pre-App)

- **Login Page:** Email + password form. Supabase Auth handles session tokens.
- **Sign-Up Page:** Email + password + full name. Triggers the profile auto-creation.
- **Auth Guard:** React context that wraps the app; redirects unauthenticated users to login.

### 5.1 Dashboard Page (`/`)

The landing page after login. Quick overview of team activity and alerts.

**Sections:**
- **Stats Cards (top row):** Total tracked players, players added this week, expiring contracts (next 6 months), players on watchlist.
- **Recent Activity Feed:** Scrollable list from `activity_log` showing who did what (e.g., "Aviv added Lamine Yamal", "Raz updated Best Fit Team for Pedri"). Clicking an entry navigates to the player in the Master Grid.
- **Contract Expiry Alerts:** Small table showing players whose `contract_expiry` is within the next 6 months, sorted by soonest.

### 5.2 Master Grid Page (`/players`) — THE CORE

A single, powerful data table listing all tracked players. This is where 80% of the app's usage happens.

**Top Bar:**
- **Add Player Button** (blue, top-right): Opens the comprehensive Add/Edit Player modal.
- **Quick Filters:** Dropdown chips for position, league, nationality, status.
- **Search Bar:** Free-text search across player first name, last name, club, league.

**Table (TanStack Table v8):**

- **Columns (default visible):**
  1. Full Name (first + last, clickable → opens player detail panel)
  2. Age (computed from `date_of_birth`)
  3. Nationality (with flag icon)
  4. Position (colored badge)
  5. Current Club
  6. League
  7. Contract Expiry (highlighted red if < 6 months)
  8. Best Fit Team (single-select dropdown — Israeli Premier League teams from `internal_teams`)
  9. Market Value
  10. Matches (read-only, from `stats_matches` — populated by Chrome Extension)
  11. Goals (read-only, from `stats_goals` — populated by Chrome Extension)
  12. Assists (read-only, from `stats_assists` — populated by Chrome Extension)
  13. Status (active / watchlist / archived)

- **Columns (toggleable, hidden by default):**
  14. Minutes (read-only, from `stats_minutes` — populated by Chrome Extension)
  15. Preferred Foot
  16. Height
  17. Second Nationality
  18. Agent Name
  19. Added By
  20. Created At
  21. Stats Last Updated (from `stats_updated_at`)
  22. Transfermarkt URL
  23. Agent Contact
  24. Social Links
  25. Updated At
  26. Date of Birth (raw)

- **Features:**
  - Column sorting (click header)
  - Column resizing (drag header edge)
  - Column visibility toggle (settings icon)
  - Multi-column filtering
  - Inline editing for `best_fit_team_id` and `status`
  - Row selection (checkbox) for bulk actions (archive, delete)
  - Pagination or infinite scroll (TanStack Virtual if 500+ rows)
  - Real-time updates via Supabase Realtime subscriptions

**Add/Edit Player Modal (for manual data entry):**

This is a comprehensive, multi-section form opened by:
- Clicking "Add Player" button → empty form (create mode)
- Clicking "Edit" in the player detail panel → pre-filled form (edit mode)

**Form Sections:**

1. **Basic Info**
   - First Name* (text, required — optional when creating from Transfermarkt URL)
   - Last Name* (text, required — optional when creating from Transfermarkt URL)
   - Date of Birth (date picker)
   - Nationality (text with autocomplete)
   - Second Nationality (text with autocomplete)
   - Preferred Foot (select: Left / Right / Both)
   - Height cm (number input)

2. **Club & Position**
   - Current Club (text)
   - League (text with autocomplete)
   - Position (select: GK, CB, LB, RB, LWB, RWB, CDM, CM, CAM, LM, RM, LW, RW, CF, ST)
   - Contract Expiry (date picker)
   - Market Value (text, e.g., "€5M")

3. **Agent**
   - Agent Name (text)
   - Agent Contact (text — phone, email, or any format)

4. **Links & Social**
   - Transfermarkt URL (URL input) — **Primary field. Entering a valid TM player profile URL enables one-click data sync via the Chrome Extension.**
   - Instagram (URL input)
   - X / Twitter (URL input)
   - Facebook (URL input)
   - TikTok (URL input)
   - LinkedIn (URL input)
   - YouTube (URL input)
   - Website (URL input)

5. **Internal**
   - Best Fit Team (single-select dropdown — predefined Israeli Premier League teams from `internal_teams`)
   - Status (select: Active / Watchlist / Archived)

**The form does NOT include fields for stats_matches, stats_goals, stats_assists, stats_minutes, or stats_updated_at.** These are owned by the Chrome Extension and displayed as read-only in the grid and detail panel.

**Form behavior:**
- Required fields (`first_name`, `last_name`) are validated before submission. Name fields may be left blank when a `transfermarkt_url` is provided, as the Extension will populate them on first sync.
- All URL fields are validated for valid URL format.
- On submit: calls `addPlayer()` or `updatePlayer()` from the API layer, closes the modal, and shows a success toast.
- The form is scrollable if it overflows the viewport.

**Player Detail Panel (slide-out from right):**
Triggered by clicking a player name. Shows:
- Full player profile (all fields, organized by the same form sections)
- **Stats section:** A small card/table showing Matches, Goals, Assists, Minutes with a "Last synced: X" timestamp from `stats_updated_at`. If `stats_updated_at` is NULL, show "No stats yet — visit the player's Transfermarkt profile with the Scout Extension installed".
- Social links rendered as clickable icons
- Transfermarkt link as an external link button
- Notes thread (from `player_notes` — all partner notes in chronological order)
- "Add Note" textarea at the bottom
- Quick action buttons: Edit (opens the modal in edit mode), Archive, Delete (admin only)

### 5.3 Advanced Filter Page (`/filter`)

A query builder for running complex searches against the players already in the database.

**Filter Builder:**
- Add filter rows (AND logic between rows)
- Each row: Field dropdown → Operator dropdown → Value input
- **Supported fields:**
  - `first_name`, `last_name` (contains, equals)
  - `nationality`, `second_nationality` (equals, contains)
  - `position` (equals, in list)
  - `current_club`, `league` (equals, contains)
  - `preferred_foot` (equals)
  - `age` (computed from `date_of_birth`: greater than, less than, between)
  - `contract_expiry` (before date, after date, within N months)
  - `market_value` (contains — text search)
  - `height_cm` (greater than, less than, between)
  - `stats_matches`, `stats_goals`, `stats_assists`, `stats_minutes` (greater than, less than, between)
  - `status` (equals)
  - `best_fit_team` (equals, is null)
  - `agent_name` (contains, is null / is not null)

**Results:**
- Displayed in a simplified version of the Master Grid (same TanStack Table, fewer columns)
- "Export to CSV" button for sharing filtered lists
- Clicking a player navigates to their detail panel on the Master Grid

### 5.4 Settings Page (`/settings`)

**Sections:**
- **Profile:** Edit your name, avatar, preferred language
- **Language Toggle:** Switch between English and Hebrew (applies immediately via i18next)
- **Team Management (Admin only):** CRUD for the `internal_teams` table — add/edit/remove the Israeli Premier League teams that appear in the "Best Fit Team" dropdown
- **User Management (Admin only):** View all registered users, change roles (admin/scout)
- **Data Management:** Export all players as CSV/JSON

---

## 6. UI/UX Design System

### Color Palette

| Usage                        | Color     | Hex       |
| ---------------------------- | --------- | --------- |
| Background                   | White     | `#FFFFFF`  |
| Surface/Cards                | Gray-50   | `#F9FAFB`  |
| Primary (buttons, links)     | Blue-600  | `#2563EB` |
| Primary Hover                | Blue-700  | `#1D4ED8`  |
| Text Primary                 | Gray-900  | `#111827`  |
| Text Secondary               | Gray-500  | `#6B7280`  |
| Border                       | Gray-200  | `#E5E7EB`  |
| Success                      | Green-500 | `#22C55E`  |
| Warning                      | Amber-500 | `#F59E0B`  |
| Danger                       | Red-500   | `#EF4444`  |

### Typography

- **Font:** Inter (via Google Fonts) — clean, modern, excellent for data-dense UIs
- **Headings:** Inter 600 weight
- **Body:** Inter 400 weight
- **Monospace:** JetBrains Mono (for any code-like values)

### Layout

- **Sidebar navigation** (left, collapsible): Dashboard, Players (Master Grid), Filter, Settings
- **Content area:** Full width, max-width 1400px centered
- **Responsive:** Primarily designed for desktop (1280px+), gracefully degrades to tablet

### Component Library Approach

Build a small set of custom components using Tailwind rather than importing a full library (like shadcn/ui or Radix). This keeps the bundle lean and gives full design control:
- Button (primary, secondary, ghost, danger variants)
- Input, Select, Textarea, DatePicker, URLInput
- Modal / SlideOver panel
- Badge (for positions, status)
- Card
- Toast notifications
- Dropdown menu
- Tooltip
- Autocomplete (for nationality, league fields)

---

## 7. Folder Structure

```
Scout/
├── public/
│   └── favicon.svg
├── src/
│   ├── api/                            # Supabase client & data wrappers
│   │   ├── supabase.ts                 # createClient singleton
│   │   ├── players.ts                  # CRUD: getPlayers, addPlayer, updatePlayer, archivePlayer, deletePlayer
│   │   ├── notes.ts                    # CRUD: getPlayerNotes, addNote, deleteNote
│   │   ├── teams.ts                    # CRUD: getInternalTeams, addTeam, updateTeam, deleteTeam
│   │   └── activity.ts                 # READ-ONLY: getRecentActivity (triggers handle writes)
│   │
│   ├── components/                     # Shared UI components
│   │   ├── ui/                         # Button, Input, Badge, Modal, Dropdown, Toast, etc.
│   │   ├── layout/                     # Sidebar, TopBar, PageWrapper, AuthGuard
│   │   ├── players/                    # Player-specific components
│   │   │   ├── PlayerFormModal.tsx      # The comprehensive Add/Edit form (multi-section)
│   │   │   ├── PlayerDetailPanel.tsx    # Slide-out detail view (includes read-only stats card)
│   │   │   ├── PlayerStatsCard.tsx      # Read-only display of TM stats (matches, goals, assists, mins)
│   │   │   └── SocialLinksDisplay.tsx   # Renders social_links JSONB as clickable icons
│   │   └── table/                      # TanStack Table wrappers
│   │       ├── MasterGrid.tsx          # Main table component
│   │       ├── columns.tsx             # Column definitions (includes read-only stats columns)
│   │       ├── cells/                  # Custom cell renderers
│   │       │   ├── BestFitTeamCell.tsx  # Editable single-select dropdown
│   │       │   ├── PlayerNameCell.tsx   # Clickable → opens detail panel
│   │       │   ├── PositionBadge.tsx    # Colored position badge
│   │       │   ├── ContractCell.tsx     # Red highlight if expiring soon
│   │       │   └── StatusCell.tsx       # Editable status dropdown
│   │       └── filters/                # Filter components for column headers
│   │
│   ├── pages/                          # 3 top-level pages + auth
│   │   ├── auth/
│   │   │   ├── LoginPage.tsx
│   │   │   └── SignUpPage.tsx
│   │   ├── DashboardPage.tsx           # Stats, recent activity, alerts
│   │   ├── MasterGridPage.tsx          # Page 1: Player table + Add/Edit modal
│   │   ├── AdvancedFilterPage.tsx      # Page 2: Query builder + results
│   │   └── SettingsPage.tsx            # Page 3: Users, i18n, teams
│   │
│   ├── hooks/                          # Custom React hooks
│   │   ├── useAuth.ts                  # Auth state, login, logout, sign-up
│   │   ├── usePlayers.ts              # TanStack Query: fetch, mutate, cache players
│   │   ├── useNotes.ts                # TanStack Query: fetch, add notes
│   │   ├── useTeams.ts               # TanStack Query: fetch internal teams
│   │   ├── useActivity.ts            # TanStack Query: READ-ONLY fetch activity log
│   │   └── useRealtimeSync.ts         # Supabase Realtime subscription wrapper
│   │
│   ├── i18n/                           # Internationalization
│   │   ├── config.ts                   # i18next initialization
│   │   ├── en.json                     # English translations
│   │   └── he.json                     # Hebrew translations
│   │
│   ├── types/                          # TypeScript interfaces
│   │   ├── player.ts                   # Player, PlayerInsert, PlayerUpdate, SocialLinks
│   │   ├── note.ts                     # Note, NoteInsert
│   │   ├── team.ts                     # InternalTeam
│   │   ├── activity.ts                # ActivityLogEntry
│   │   └── database.ts               # Supabase generated types (via CLI)
│   │
│   ├── lib/                            # Utilities
│   │   ├── formatters.ts              # Date, age calculator, relative time formatters
│   │   ├── constants.ts               # Position list, status list, nationality list, etc.
│   │   └── validators.ts             # Form validation (required fields, URL format, etc.)
│   │
│   ├── App.tsx                         # Router + layout shell
│   ├── main.tsx                        # Entry point
│   └── index.css                       # Tailwind directives + global styles
│
├── extension/                          # Chrome Extension (Manifest V3, TypeScript)
│   ├── manifest.json                   # Extension manifest — host_permissions for transfermarkt.com
│   ├── content_script.ts               # Extracts all player fields from TM DOM
│   ├── background.ts                   # Service Worker: receives data, looks up/creates player, PATCHes Supabase
│   ├── popup.html / popup.ts           # Extension popup UI (sync status, auth state)
│   ├── tsconfig.json
│   ├── package.json
│   └── README.md                       # How to load the unpacked extension in Chrome
│
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql      # Full schema: tables, indexes, RLS, triggers, realtime (LIVE)
│       └── 002_add_tm_stats.sql        # Adds transfermarkt_url, fbref_url (deprecated), stats columns (LIVE)
│
├── .env.local                          # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
├── .env.local.example                  # Template for team members (committed to git, no real values)
├── .gitignore                          # Includes .env.local, .env*.local, node_modules, dist
├── tailwind.config.ts
├── tsconfig.json
├── vite.config.ts
├── package.json
└── README.md
```

---

## 8. Implementation Roadmap (Claude Code Phases)

### Phase 1: Foundation ✅ COMPLETE

1. ~~Initialize Vite + React + TypeScript project directly in the `Scout/` directory~~
2. ~~Install and configure: Tailwind CSS, React Router, react-i18next, TanStack Query, TanStack Table, @dnd-kit/core, Lucide React~~
3. ~~Create `.gitignore` and `.env.local.example`~~
4. ~~Create `supabase.ts` client singleton~~
5. ~~Write `001_initial_schema.sql` migration file~~
6. ~~Build auth pages (Login, Sign-Up) and AuthGuard context~~
7. ~~Build layout shell (Sidebar, TopBar, PageWrapper)~~
8. ~~Set up React Router with routes~~
9. ~~Initialize git repo and make first commit~~

### Phase 2: Core — Master Grid + Player Form ✅ COMPLETE

1. ~~Create `002_add_tm_stats.sql` migration — write the file, manually run it in Supabase SQL Editor~~
2. ~~Regenerate Supabase types after the migration~~
3. ~~Build the `players.ts` API layer (CRUD functions)~~
4. ~~Build `usePlayers` hook with TanStack Query~~
5. ~~Build column definitions (`columns.tsx`) — include read-only stats columns~~
6. ~~Build custom cell renderers (BestFitTeamCell, PositionBadge, ContractCell, StatusCell, PlayerNameCell)~~
7. ~~Assemble the MasterGrid component with sorting, filtering, column visibility~~
8. ~~Build the PlayerFormModal~~
9. ~~Build the PlayerDetailPanel (slide-out) — includes read-only PlayerStatsCard~~
10. ~~Build the PlayerStatsCard component~~
11. ~~Build the SocialLinksDisplay component~~
12. ~~Wire up Supabase Realtime for live updates~~

### Phase 3: Notes + Activity ✅ COMPLETE

1. ~~Build `notes.ts` and `activity.ts` API layers~~
2. ~~Build `useNotes` and `useActivity` hooks~~
3. ~~Add the notes thread to the PlayerDetailPanel~~
4. ~~Build the Dashboard page (stats cards, activity feed, contract alerts)~~

### Phase 4: Advanced Filter ✅ COMPLETE

1. ~~Build the filter query builder UI (add/remove filter rows, field/operator/value selectors)~~
2. ~~Build the dynamic Supabase query generator~~
3. ~~Display results in a simplified grid~~
4. ~~Add CSV export functionality~~

### Phase 5: Settings + Polish ✅ COMPLETE

1. ~~Build Settings page sections (Profile, Language, Team Management, User Management)~~
2. ~~Complete i18n (translate all UI strings to Hebrew in `he.json`)~~
3. ~~Add toast notifications for all CRUD operations~~
4. ~~Add loading states and error handling throughout~~
5. ~~Finalize mobile responsiveness, TanStack Virtual grid, and @dnd-kit/core drag-and-drop column interactions~~
6. ~~Perform RLS Security Audit and lock down tables with `auth.uid()` multi-tenant isolation and Admin role bypasses~~
7. ~~Prepare for Vercel Deploy~~

### Phase 6: Local Python FBref Scraper

**Status: Frozen / Permanently Superseded**

> **Blocker (2026-04-01):** FBref is protected by **Cloudflare Turnstile in managed mode** — an interactive human verification challenge that cannot be bypassed by automation. Playwright, curl_cffi, cookie injection, and persistent Chrome profiles all failed.
>
> **Final decision (Phase 10):** The FBref scraper is permanently retired. The Chrome Extension + Transfermarkt architecture delivers all required data more reliably from a single source. This phase will not be revisited.

### Phase 7: V2 Dashboard Rebuild ✅ COMPLETE

1. ~~Removed dead "Notes" and "Contract Alert" widgets~~
2. ~~New KPI Cards: Total Players, On Watchlist, Teams Scouted, Countries Scouted~~
3. ~~Built `TopPerformersWidget.tsx`, `RecentProspectsWidget.tsx`, `DepthPipelineWidget.tsx`~~
4. ~~Security Audit: data minimization (explicit `.select()`), PostgREST injection patched, error obfuscation, typed interfaces~~

### Phase 8: Dual-Source Data Pipeline (Chrome Extension) ✅ COMPLETE

**Status:** Complete. (Superseded architecturally by Phase 10, but all work was foundational.)

Built the Chrome Extension with FBref + Transfermarkt dual-source architecture and background-orchestrated fetch. Phase 10 simplified this to TM-only.

### Phase 9: Step-by-Step Scraper Rebuild ✅ COMPLETE (Superseded by Phase 10)

1. ~~Step 0: Documentation & Security Alignment~~
2. ~~Step 1: Master Grid UI — all 28 DB fields now accessible as toggleable columns~~
3. ~~Step 2: Interactive data mapping — finalized source assignments for all 20 scrapable fields~~
4. ~~Step 3: Superseded by Phase 10 (TM-only migration eliminated dual-source complexity)~~

### Phase 10: Total Migration to Transfermarkt ✅ COMPLETE

> **Status:** Complete. FBref retired. Transfermarkt is the exclusive data source.

**Why:** FBref became permanently blocked by Cloudflare Turnstile. Transfermarkt provides all 28 player fields from a single page, eliminating dual-source complexity.

1. ~~**Content Script** — Completely rewritten to extract all data from TM player profile DOM: name, DOB, nationalities, height, foot, position, club, league, contract, market value, agent, social links, and season stats~~
2. ~~**Background Worker** — Simplified from ~617 lines to ~170 lines. Receives DOM-extracted data, looks up player by `transfermarkt_url`, PATCHes Supabase. Auto-creates new players if not found~~
3. ~~**Manifest** — Content script now matches `*://*.transfermarkt.com/*/profil/spieler/*`. FBref removed from host_permissions~~
4. ~~**Player Form** — `transfermarkt_url` is now the primary URL field. Name fields optional when TM URL provided~~
5. ~~**UI Copy** — All FBref references updated to Transfermarkt~~
6. ~~**i18n Audit** — Dead translation keys removed. All active keys verified~~
7. ~~**Security Audit** — RLS policies hardened against role escalation. Hardcoded secrets removed~~
8. ~~**`weight_kg` removed** — Field dropped from form, grid columns, and filter options~~

**Data source mapping (all from Transfermarkt):**

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

### Phase 11: Advanced Analytics & Comparison Engine *(Planned)*

> **Status:** Placeholder. Details to be defined.

Planned scope:
- Side-by-side player comparison view (select 2–5 players, compare stats and profile fields)
- Radar chart / spider chart visualizations for player attributes
- Position-adjusted performance benchmarking (e.g., goals per 90 relative to position average)
- Saved comparison sets (persist across sessions via Supabase)
- Shareable comparison links for partner discussion

---

## 9. Key Decisions Log

| Decision                    | Choice                          | Rationale                                                               |
| --------------------------- | ------------------------------- | ----------------------------------------------------------------------- |
| Desktop vs Web              | Web (SPA) + Chrome Extension    | Zero installation for partners; Extension adds data automation          |
| Data entry method           | Hybrid: manual UI + Extension   | Manual for corrections; Chrome Extension for Transfermarkt auto-import  |
| Stats data source           | Transfermarkt (Chrome Extension)| Single source for all fields; FBref blocked by Cloudflare Turnstile    |
| Extension architecture      | Manifest V3, content + background | Background Service Worker orchestrates lookups and Supabase writes    |
| Stats ownership             | Chrome Extension only           | Stats fields are read-only in UI; Extension is the sole writer          |
| Single data source          | Transfermarkt only              | Eliminated dual-source complexity; TM provides all required fields      |
| Table library               | TanStack Table v8               | Headless, full design control, sort/filter/edit built-in                |
| State management            | TanStack Query                  | Server-state focused, caching, background refetch                       |
| Social links storage        | JSONB column                    | Flexible — only populated links are stored, no wasted columns           |
| Best Fit Team               | FK to `internal_teams`          | Predefined single-select of Israeli Premier League teams                |
| Backend hosting             | Supabase only                   | Extension writes via authenticated JS client — no middleware needed     |
| CSS framework               | Tailwind CSS                    | Utility-first, minimal bundle, full design control                      |
| Component library           | Custom (no shadcn)              | Lean bundle, no dependency on Radix primitives                          |
| i18n library                | react-i18next                   | Industry standard, JSON files, easy for non-devs to edit               |
| Activity logging            | DB triggers                     | Tamper-proof, catches all changes, no frontend race conditions          |
| Player name fields          | Separate first/last             | Better for sorting, filtering, and form UX than a single field         |

---

## 10. Notes for Claude Code Development

- **Always generate Supabase types** after schema changes: `npx supabase gen types typescript --project-id <ref> > src/types/database.ts`
- **Use the anon key in the frontend and Extension.** The anon key + RLS + authenticated user session is sufficient for all writes. There is no service role key in application code.
- **TanStack Table columns are defined once in `columns.tsx`** and reused across the Master Grid and Advanced Filter results.
- **All Supabase calls go through the `src/api/` layer** — pages and components never call Supabase directly.
- **Real-time subscriptions are managed in `useRealtimeSync.ts`** — subscribe on mount, unsubscribe on unmount, invalidate TanStack Query cache on changes. Only `players`, `player_notes`, and `activity_log` have Realtime enabled.
- **Activity logging is handled entirely by database triggers** — the frontend does NOT have a `logActivity()` function. The `activity.ts` file is READ-ONLY.
- **Environment variables** must be prefixed with `VITE_` to be accessible in the frontend (Vite requirement).
- **Admin bootstrap** must be done after the first user signs up — see Section 4.7.
- **Age is computed, not stored.** The `date_of_birth` field is in the database; the age displayed in the grid is calculated at render time.
- **The PlayerFormModal is used for both Add and Edit.** In create mode, it opens empty. In edit mode, it receives a `player` prop and pre-fills all fields.
- **Stats fields are READ-ONLY in the UI.** The columns `stats_matches`, `stats_goals`, `stats_assists`, `stats_minutes`, and `stats_updated_at` must NEVER appear in the PlayerFormModal or any editable form. They are displayed in the Master Grid and PlayerDetailPanel as non-editable values. The Chrome Extension is the only writer.
- **Social links are stored as a JSONB object** where only non-empty links are included. When rendering, iterate over the keys and display only the ones that have values. Use Lucide icons for each platform.
- **`transfermarkt_url` is the primary player identifier** for the Chrome Extension. The Extension looks up players by this URL and auto-creates them if not found.
- **`fbref_url` is deprecated.** The column exists in the DB for backward compatibility but is not used in any active code path. Do not add logic that reads or writes it.
- **`weight_kg` is not tracked.** The column was dropped from the data model. Do not add it back to forms, grid columns, or filter options.
- **Best Fit Team** is a single-select dropdown populated from the `internal_teams` table, which contains predefined Israeli Premier League teams. It is not a free-text field.

---

## 11. Manual Setup Tasks (Before / During Development)

These steps require browser interaction and cannot be done by Claude Code:

**Before starting Claude Code (already done for Phase 1):**

1. ~~Create a Supabase project at app.supabase.com.~~
2. ~~Copy credentials from Supabase Dashboard → Settings → API.~~
3. ~~Enable `pg_trgm` extension in Dashboard → Database → Extensions.~~

**At the start of Phase 2 (already done):**

4. ~~Run `002_add_tm_stats.sql`~~ — migration already applied to production.

**When deploying to Vercel:**

5. **Connect GitHub repo to Vercel** at vercel.com. Set framework to "Vite". Add environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

**For the Chrome Extension:**

6. **Load the unpacked extension:** Open Chrome → `chrome://extensions` → Enable Developer Mode → "Load unpacked" → select the `extension/` directory.
7. **Sign in:** The Extension uses the same Supabase Auth session as the web app. Users must be logged in to the web app in the same browser for the Extension to write to Supabase.

---

## 12. Security Model

| Secret / Credential                | Where it lives                          | Exposed to browser? | Notes |
| ---------------------------------- | --------------------------------------- | ------------------- | ----- |
| `VITE_SUPABASE_URL`                | `.env.local` → bundled into frontend    | Yes                 | Public by design (just the project URL) |
| `VITE_SUPABASE_ANON_KEY`           | `.env.local` → bundled into frontend    | Yes                 | Public by design — restricted by RLS |
| Supabase Auth session token        | Browser localStorage (managed by SDK)  | Yes                 | Scoped to the logged-in user; expires |
| `SUPABASE_SERVICE_ROLE_KEY`        | **Not used in any application code**    | No                  | Not present in frontend or Extension. Only accessible via Supabase Dashboard for manual SQL operations. |
| Database password                  | Supabase Dashboard only                 | No                  | Never referenced in application code |

**`.gitignore` protection:** `.env.local` and `.env*.local` are gitignored from the first commit. The `.env.local.example` template is committed as documentation.

> **April 2026 Security Audit milestones:**
> - RLS policies hardened against role escalation: scouts can no longer self-promote to admin via direct API calls.
> - All policies verified to use `auth.uid()` with correct subquery guards on the `profiles` table.
> - Hardcoded service role keys removed from all application code paths (Extension, frontend).
> - Data minimization confirmed: all Supabase queries use explicit `.select('col1, col2, ...')` instead of `.select('*')`.
> - PostgREST error bodies obfuscated from the client console to prevent schema leakage.

---

*Last updated: April 3, 2026*
*Status: READY FOR MVP VERCEL DEPLOYMENT — Phases 1–5, 7–10 complete. Phase 6 permanently retired. Phase 11 planned.*
