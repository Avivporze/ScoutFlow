# Football Scouting & Player Management App — Project Plan

> **Document Purpose:** This is the single source of truth for architecture, tech stack, database schema, UI/UX decisions, and implementation roadmap. This document is the instruction manual for Claude Code — read it in full before writing any code.

---

## Revision History

| Rev | Date       | Changes                                                                  |
| --- | ---------- | ------------------------------------------------------------------------ |
| 1.0 | 2026-03-30 | Initial plan (with external API integration)                             |
| 2.0 | 2026-03-30 | 8 architectural fixes applied                                            |
| 3.0 | 2026-03-31 | **Major pivot: removed all external API integration. Pure manual CRUD MVP.** |

---

## 1. Project Overview

A web-based football (soccer) player scouting and management application for a small team of partners. It replaces scattered Excel spreadsheets and WhatsApp messages with an organized, real-time collaborative workspace.

This is a **manual-entry MVP** — all player data is entered, edited, and managed by the team directly. There is no external API integration, no background syncing, and no automated data fetching.

### Key Goals

- Centralized player database with real-time multi-user collaboration
- Monday.com-style Master Grid as the core interface
- Comprehensive manual add/edit form for entering player details
- Advanced filtering to query the player database
- Bilingual support (English + Spanish)
- Modern, clean, minimalist design (white background, blue accent buttons)

---

## 2. Tech Stack (Final)

| Layer                  | Technology                     | Why                                                                 |
| ---------------------- | ------------------------------ | ------------------------------------------------------------------- |
| **Frontend**           | Vite + React 18 + TypeScript   | Fast dev server, strong typing, largest ecosystem for complex UI    |
| **Styling**            | Tailwind CSS                   | Utility-first, easy to achieve clean minimalist design, no bloat    |
| **Table Engine**       | TanStack Table v8              | Headless — full control over rendering; supports sort, filter, edit |
| **Row Virtualization** | TanStack Virtual               | Renders only visible rows; needed if player list exceeds 500+      |
| **Drag & Drop**        | @dnd-kit/core                  | Lightweight, integrates cleanly with TanStack Table for column reorder |
| **Routing**            | React Router v6                | Standard SPA routing for the 3 pages + auth                        |
| **i18n**               | react-i18next                  | Industry standard, JSON translation files, namespace support        |
| **State Management**   | TanStack Query (React Query)   | Server state caching, background refetching, optimistic updates     |
| **Icons**              | Lucide React                   | Clean, consistent icon set that fits minimalist design              |
| **Frontend Hosting**   | Vercel (Free Tier)             | Global CDN, automatic HTTPS, preview deploys per branch, zero config |
| **Database**           | Supabase (PostgreSQL)          | Managed Postgres, 500 MB free, JSONB support, GIN indexes          |
| **Auth**               | Supabase Auth                  | Built-in email/password or magic link, RLS integration              |
| **Real-time**          | Supabase Realtime              | WebSocket subscriptions — one scout's edit appears instantly for others |
| **Storage**            | Supabase Storage               | Player photos, PDF scouting reports (1 GB free)                     |

### What We Are NOT Using (And Why)

| Rejected Option               | Reason                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------- |
| **Oracle Cloud**              | No background tasks needed — pure client-to-Supabase architecture             |
| **Supabase Edge Functions**   | No external API calls to proxy — all data is manual entry                     |
| **pg_cron / pg_net**          | No periodic background updates needed                                         |
| **External Football APIs**    | MVP is manual-entry only; external APIs can be added in a future version      |
| **Electron / Tauri**          | Web app is sufficient — zero installation for partners                        |
| **AG Grid / MUI DataGrid**    | Heavy, opinionated styling that fights custom design systems                  |

### Future Option: External API Integration

If the team later decides to integrate an external football API (e.g., API-Football) for automated player discovery and stats syncing, the architecture supports this cleanly. It would require adding Supabase Edge Functions as a proxy layer, a `pg_cron` schedule for background updates, and an additional "External Search" page. The database schema is designed so these additions don't require breaking changes — new columns like `external_api_id` and `stats_json` can be added without modifying existing fields.

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
└─────────────────────────────────────────────────────────────┘
```

**Two services, both free tier. No Edge Functions, no cron, no external APIs.**

**Total cost at launch: $0/month.**

---

## 4. Database Schema

### 4.1 Tables

#### `profiles`

Extends Supabase Auth. One row per authenticated user, auto-created on sign-up via a database trigger.

| Column               | Type         | Constraints          | Description                      |
| -------------------- | ------------ | -------------------- | -------------------------------- |
| `id`                 | `uuid`       | PK, FK → auth.users  | Matches Supabase Auth user ID    |
| `full_name`          | `text`       | NOT NULL             | Display name in the app          |
| `email`              | `text`       | NOT NULL, UNIQUE     | User email                       |
| `role`               | `text`       | DEFAULT 'scout'      | 'admin' or 'scout'               |
| `preferred_language` | `text`       | DEFAULT 'en'         | 'en' or 'es'                     |
| `avatar_url`         | `text`       | NULLABLE             | Profile image URL                |
| `created_at`         | `timestamptz`| DEFAULT now()        | Account creation time            |

#### `internal_teams`

The list of teams your scouting group manages or works with. Powers the "Best Fit Team" dropdown in the Master Grid.

| Column       | Type         | Constraints                   | Description                          |
| ------------ | ------------ | ----------------------------- | ------------------------------------ |
| `id`         | `uuid`       | PK, DEFAULT gen_random_uuid() | Auto-generated ID                    |
| `team_name`  | `text`       | NOT NULL, UNIQUE              | e.g., "FC Barcelona B", "Our Club"   |
| `league`     | `text`       | NULLABLE                      | League the team plays in             |
| `country`    | `text`       | NULLABLE                      | Country                              |
| `sort_order` | `integer`    | DEFAULT 0                     | Controls display order in dropdowns  |
| `created_at` | `timestamptz`| DEFAULT now()                 | When the team was added              |

#### `players`

The core table. One row per tracked player. Powers the Master Grid. All data is manually entered via the Add/Edit Player form.

**Basic Info:**

| Column              | Type         | Constraints                                          | Description                                 |
| ------------------- | ------------ | ---------------------------------------------------- | ------------------------------------------- |
| `id`                | `uuid`       | PK, DEFAULT gen_random_uuid()                        | Internal player ID                          |
| `first_name`        | `text`       | NOT NULL                                             | Player's first name                         |
| `last_name`         | `text`       | NOT NULL                                             | Player's last name                          |
| `date_of_birth`     | `date`       | NULLABLE                                             | DOB                                         |
| `nationality`       | `text`       | NULLABLE                                             | Primary nationality                         |
| `second_nationality`| `text`       | NULLABLE                                             | Second nationality (dual citizens)          |
| `preferred_foot`    | `text`       | NULLABLE                                             | 'Left', 'Right', 'Both'                    |
| `height_cm`         | `integer`    | NULLABLE                                             | Height in centimeters                       |
| `weight_kg`         | `integer`    | NULLABLE                                             | Weight in kilograms                         |

**Club & Position:**

| Column              | Type         | Constraints                                          | Description                                 |
| ------------------- | ------------ | ---------------------------------------------------- | ------------------------------------------- |
| `current_club`      | `text`       | NULLABLE                                             | Current club name                           |
| `league`            | `text`       | NULLABLE                                             | Current league name                         |
| `position`          | `text`       | NULLABLE                                             | Primary position (GK, CB, LB, CM, ST, etc.) |
| `contract_expiry`   | `date`       | NULLABLE                                             | Contract expiry date (for alerts)           |
| `market_value`      | `text`       | NULLABLE                                             | Estimated market value (e.g., "€5M")        |

**Agent:**

| Column              | Type         | Constraints                                          | Description                                 |
| ------------------- | ------------ | ---------------------------------------------------- | ------------------------------------------- |
| `agent_name`        | `text`       | NULLABLE                                             | Player's agent name                         |
| `agent_contact`     | `text`       | NULLABLE                                             | Agent phone, email, or other contact info   |

**Links & Social:**

| Column              | Type         | Constraints                                          | Description                                 |
| ------------------- | ------------ | ---------------------------------------------------- | ------------------------------------------- |
| `transfermarkt_url` | `text`       | NULLABLE                                             | Link to the player's Transfermarkt profile  |
| `social_links`      | `jsonb`      | DEFAULT '{}'                                         | Social media links (see structure below)    |

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

**Internal Management:**

| Column              | Type         | Constraints                                              | Description                                                  |
| ------------------- | ------------ | -------------------------------------------------------- | ------------------------------------------------------------ |
| `best_fit_team_id`  | `uuid`       | NULLABLE, FK → internal_teams(id) ON DELETE SET NULL      | Which of our teams suits this player. Resets to NULL if team deleted. |
| `status`            | `text`       | DEFAULT 'active'                                         | 'active', 'archived', 'watchlist'                            |
| `added_by`          | `uuid`       | NOT NULL, DEFAULT auth.uid(), FK → profiles(id)          | Who added this player. Defaults to current authenticated user. |
| `created_at`        | `timestamptz`| DEFAULT now()                                            | When player was first added                                  |
| `updated_at`        | `timestamptz`| DEFAULT now()                                            | Last modification time (auto-updated by trigger)             |

#### `player_notes`

Threaded notes per player. Replaces WhatsApp discussions.

| Column       | Type         | Constraints                                       | Description                        |
| ------------ | ------------ | ------------------------------------------------- | ---------------------------------- |
| `id`         | `uuid`       | PK, DEFAULT gen_random_uuid()                     | Note ID                           |
| `player_id`  | `uuid`       | NOT NULL, FK → players(id) ON DELETE CASCADE       | Which player this note is about    |
| `author_id`  | `uuid`       | NOT NULL, DEFAULT auth.uid(), FK → profiles(id)   | Who wrote the note                 |
| `content`    | `text`       | NOT NULL                                          | Note text (supports markdown)      |
| `created_at` | `timestamptz`| DEFAULT now()                                     | When the note was written          |

#### `activity_log`

Audit trail for the Dashboard's "recent activity" feed. **Populated exclusively by database triggers — never by frontend code.**

| Column       | Type         | Constraints                                       | Description                                      |
| ------------ | ------------ | ------------------------------------------------- | ------------------------------------------------ |
| `id`         | `uuid`       | PK, DEFAULT gen_random_uuid()                     | Log entry ID                                     |
| `user_id`    | `uuid`       | NULLABLE, FK → profiles(id)                       | Who performed the action                         |
| `player_id`  | `uuid`       | NULLABLE, FK → players(id) ON DELETE SET NULL       | Related player (if applicable)                   |
| `action_type`| `text`       | NOT NULL                                          | 'player_added', 'player_updated', 'note_added', 'player_archived' |
| `metadata`   | `jsonb`      | DEFAULT '{}'                                      | Additional context (e.g., which fields changed)  |
| `created_at` | `timestamptz`| DEFAULT now()                                     | When the action occurred                         |

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

- **profiles:** Users can update their own profile only. **Exception: admins can update any profile's `role` field** (for promoting scouts to admin).
- **internal_teams:** Only `admin` role can insert/update/delete.
- **players:** All authenticated users can insert and update. Only `admin` can delete.
- **player_notes:** All authenticated users can insert. Authors can update/delete their own notes.
- **activity_log:** **No direct insert/update/delete for any user.** All writes happen via `SECURITY DEFINER` trigger functions that bypass RLS. The audit log is tamper-proof.

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

The trigger functions use `SECURITY DEFINER` to bypass RLS on the `activity_log` table. They use `auth.uid()` to capture the current user.

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

  -- Only log if something meaningful changed (skip updated_at-only changes)
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

**What gets logged:**
- Player added → logged (with player name)
- Player updated (name, club, league, best_fit, status, contract, position, market_value, agent) → logged (with old→new diff)
- Note added → logged (with first 100 chars preview)

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
  8. Best Fit Team (editable dropdown — pulls from `internal_teams`)
  9. Market Value
  10. Status (active / watchlist / archived)

- **Columns (toggleable, hidden by default):**
  11. Preferred Foot
  12. Height
  13. Weight
  14. Second Nationality
  15. Agent Name
  16. Added By
  17. Created At

- **Features:**
  - Column sorting (click header)
  - Column resizing (drag header edge)
  - Column visibility toggle (settings icon)
  - Multi-column filtering
  - Inline editing for `best_fit_team_id` and `status`
  - Row selection (checkbox) for bulk actions (archive, delete)
  - Pagination or infinite scroll (TanStack Virtual if 500+ rows)
  - Real-time updates via Supabase Realtime subscriptions

**Add/Edit Player Modal (the ONLY way to add or update players):**

This is a comprehensive, multi-section form opened by:
- Clicking "Add Player" button → empty form (create mode)
- Clicking "Edit" in the player detail panel → pre-filled form (edit mode)

**Form Sections:**

1. **Basic Info**
   - First Name* (text, required)
   - Last Name* (text, required)
   - Date of Birth (date picker)
   - Nationality (text with autocomplete)
   - Second Nationality (text with autocomplete)
   - Preferred Foot (select: Left / Right / Both)
   - Height cm (number input)
   - Weight kg (number input)

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
   - Transfermarkt URL (URL input)
   - Instagram (URL input)
   - X / Twitter (URL input)
   - Facebook (URL input)
   - TikTok (URL input)
   - LinkedIn (URL input)
   - YouTube (URL input)
   - Website (URL input)

5. **Internal**
   - Best Fit Team (select dropdown from `internal_teams`)
   - Status (select: Active / Watchlist / Archived)

**Form behavior:**
- Required fields (`first_name`, `last_name`) are validated before submission.
- All URL fields are validated for valid URL format.
- On submit: calls `addPlayer()` or `updatePlayer()` from the API layer, closes the modal, and shows a success toast.
- The form is scrollable if it overflows the viewport.

**Player Detail Panel (slide-out from right):**
Triggered by clicking a player name. Shows:
- Full player profile (all fields, organized by the same form sections)
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
  - `height_cm`, `weight_kg` (greater than, less than, between)
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
- **Language Toggle:** Switch between English and Spanish (applies immediately via i18next)
- **Team Management (Admin only):** CRUD for the `internal_teams` table — add/edit/remove the teams that appear in the "Best Fit Team" dropdown
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
│   │   │   ├── PlayerDetailPanel.tsx    # Slide-out detail view
│   │   │   └── SocialLinksDisplay.tsx   # Renders social_links JSONB as clickable icons
│   │   └── table/                      # TanStack Table wrappers
│   │       ├── MasterGrid.tsx          # Main table component
│   │       ├── columns.tsx             # Column definitions
│   │       ├── cells/                  # Custom cell renderers
│   │       │   ├── BestFitTeamCell.tsx  # Editable dropdown
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
│   │   └── es.json                     # Spanish translations
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
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql      # Full schema: tables, indexes, RLS, triggers, realtime
│
├── .env.local                          # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
├── .env.local.example                  # Template for team members (committed to git, no real values)
├── .gitignore                          # Includes .env.local and .env*.local
├── tailwind.config.ts
├── tsconfig.json
├── vite.config.ts
├── package.json
└── README.md
```

---

## 8. Implementation Roadmap (Claude Code Phases)

### Phase 1: Foundation

1. Initialize Vite + React + TypeScript project directly in the `Scout/` directory (this IS the root — do not create a subfolder)
2. Install and configure: Tailwind CSS, React Router, react-i18next, TanStack Query, TanStack Table, @dnd-kit/core, Lucide React
3. Create `.gitignore` (include `.env.local`, `.env*.local`, `node_modules`, `dist`)
4. Create `.env.local.example` with placeholder values
5. Create `supabase.ts` client singleton
6. Write `001_initial_schema.sql` migration file (all tables, indexes, RLS policies, triggers, realtime publication, admin bootstrap trigger)
7. Build auth pages (Login, Sign-Up) and AuthGuard context
8. Build layout shell (Sidebar with 4 nav items, TopBar, PageWrapper)
9. Set up React Router with routes: `/`, `/players`, `/filter`, `/settings`
10. Initialize git repo and make first commit

### Phase 2: Core — Master Grid + Player Form

1. Build the `players.ts` API layer (CRUD functions)
2. Build `usePlayers` hook with TanStack Query
3. Build column definitions (`columns.tsx`)
4. Build custom cell renderers (BestFitTeamCell, PositionBadge, ContractCell, StatusCell, PlayerNameCell)
5. Assemble the MasterGrid component with sorting, filtering, column visibility
6. Build the **PlayerFormModal** — the comprehensive multi-section Add/Edit form
7. Build the PlayerDetailPanel (slide-out)
8. Build the SocialLinksDisplay component
9. Wire up Supabase Realtime for live updates

### Phase 3: Notes + Activity

1. Build `notes.ts` and `activity.ts` API layers
2. Build `useNotes` and `useActivity` hooks
3. Add the notes thread to the PlayerDetailPanel
4. Build the Dashboard page (stats cards, activity feed, contract alerts)

### Phase 4: Advanced Filter

1. Build the filter query builder UI (add/remove filter rows, field/operator/value selectors)
2. Build the dynamic Supabase query generator
3. Display results in a simplified grid
4. Add CSV export functionality

### Phase 5: Settings + Polish

1. Build Settings page sections (Profile, Language, Team Management, User Management)
2. Complete i18n (translate all UI strings to Spanish in `es.json`)
3. Add toast notifications for all CRUD operations
4. Add loading states and error handling throughout
5. Deploy to Vercel
6. Testing and bug fixes

---

## 9. Key Decisions Log

| Decision                    | Choice             | Rationale                                                          |
| --------------------------- | ------------------ | ------------------------------------------------------------------ |
| Desktop vs Web              | Web (SPA)          | Zero installation for partners, instant updates, real-time native  |
| Data entry method           | Manual only (MVP)  | Eliminates API complexity; external API can be added later         |
| Table library               | TanStack Table v8  | Headless, full design control, sort/filter/edit built-in           |
| State management            | TanStack Query     | Server-state focused, caching, background refetch                  |
| Social links storage        | JSONB column       | Flexible — only populated links are stored, no wasted columns      |
| Best Fit Team               | FK to internal_teams | Dropdown powered by a manageable list, not free text             |
| Backend hosting             | Supabase only      | No Edge Functions or cron needed for manual CRUD                   |
| CSS framework               | Tailwind CSS       | Utility-first, minimal bundle, full design control                 |
| Component library           | Custom (no shadcn) | Lean bundle, no dependency on Radix primitives                     |
| i18n library                | react-i18next      | Industry standard, JSON files, easy for non-devs to edit           |
| Activity logging            | DB triggers        | Tamper-proof, catches all changes, no frontend race conditions     |
| Player name fields          | Separate first/last | Better for sorting, filtering, and form UX than a single field    |

---

## 10. Notes for Claude Code Development

- **Always generate Supabase types** after schema changes: `npx supabase gen types typescript --project-id <ref> > src/types/database.ts`
- **Use the anon key in the frontend.** There is no service role key in this architecture — RLS handles all access control.
- **TanStack Table columns are defined once in `columns.tsx`** and reused across the Master Grid and Advanced Filter results.
- **All Supabase calls go through the `src/api/` layer** — pages and components never call Supabase directly.
- **Real-time subscriptions are managed in `useRealtimeSync.ts`** — subscribe on mount, unsubscribe on unmount, invalidate TanStack Query cache on changes. Only `players`, `player_notes`, and `activity_log` have Realtime enabled.
- **Activity logging is handled entirely by database triggers** — the frontend does NOT have a `logActivity()` function. The `activity.ts` file is READ-ONLY.
- **Environment variables** must be prefixed with `VITE_` to be accessible in the frontend (Vite requirement).
- **Admin bootstrap** must be done after the first user signs up — see Section 4.7. If the auto-promote trigger is in the migration, this is automatic.
- **Age is computed, not stored.** The `date_of_birth` field is in the database; the age displayed in the grid is calculated at render time in the frontend (`new Date().getFullYear() - dob.getFullYear()` adjusted for month/day). This avoids stale age data.
- **The PlayerFormModal is used for both Add and Edit.** In create mode, it opens empty. In edit mode, it receives a `player` prop and pre-fills all fields. The same component handles both cases.
- **Social links are stored as a JSONB object** where only non-empty links are included. When rendering, iterate over the keys and display only the ones that have values. Use Lucide icons for each platform.
- **No external API calls exist in this codebase.** If someone asks Claude Code to add API integration, direct them to the "Future Option" note in Section 2.

---

## 11. Manual Setup Tasks (Before / During Development)

These steps require browser interaction and cannot be done by Claude Code:

**Before starting Claude Code:**

1. **Create a Supabase project** at app.supabase.com. Pick a name, set a database password, choose `eu-central-1` region.
2. **Copy credentials** from Supabase Dashboard → Settings → API: the `Project URL` and the `anon public` key.
3. **Enable Postgres extensions** in Dashboard → Database → Extensions: enable `pg_trgm` (for fuzzy name search).

**After Claude Code writes the migration file:**

4. **Run the SQL migration** by pasting `001_initial_schema.sql` into Supabase Dashboard → SQL Editor and clicking "Run".
5. **Sign up as the first user** through the app's sign-up page.
6. **Verify admin promotion** (if auto-promote trigger is in migration) or run the manual admin SQL from Section 4.7.

**When deploying to Vercel:**

7. **Connect GitHub repo to Vercel** at vercel.com. Set framework to "Vite". Add environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

---

## 12. Security Model

| Secret                       | Where it lives                        | Exposed to browser? | Risk |
| ---------------------------- | ------------------------------------- | -------------------- | ---- |
| `VITE_SUPABASE_URL`          | `.env.local` → bundled into frontend  | Yes                  | **None** — public by design (just the project URL) |
| `VITE_SUPABASE_ANON_KEY`     | `.env.local` → bundled into frontend  | Yes                  | **None** — public by design, restricted by RLS |
| Database password            | Supabase Dashboard only               | No                   | Never referenced in app code |

**There are no secret keys in this architecture.** The Supabase anon key is designed to be public — all security is enforced by Row Level Security policies in PostgreSQL. There are no Edge Functions, no service role keys, and no external API keys.

**`.gitignore` protection:** `.env.local` and `.env*.local` are gitignored from the first commit. A `.env.local.example` with placeholder values is committed as documentation.

---

*Last updated: March 31, 2026*
*Status: FINAL — approved for development in Claude Code*
