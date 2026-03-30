-- ============================================================
-- Scout App — Initial Schema
-- Apply in: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================

-- Required for fuzzy player-name search (GIN trigram index)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- TABLES
-- ============================================================

-- ----------------------------------------------------------
-- profiles
-- One row per authenticated user, auto-created on sign-up.
-- ----------------------------------------------------------
CREATE TABLE profiles (
  id                  uuid         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name           text         NOT NULL,
  email               text         NOT NULL UNIQUE,
  role                text         NOT NULL DEFAULT 'scout'
                                   CHECK (role IN ('admin', 'scout')),
  preferred_language  text         NOT NULL DEFAULT 'en'
                                   CHECK (preferred_language IN ('en', 'es')),
  avatar_url          text,
  created_at          timestamptz  NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------
-- internal_teams
-- The scouting group's own teams — powers "Best Fit Team" dropdown.
-- ----------------------------------------------------------
CREATE TABLE internal_teams (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  team_name   text         NOT NULL UNIQUE,
  league      text,
  country     text,
  sort_order  integer      NOT NULL DEFAULT 0,
  created_at  timestamptz  NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------
-- players
-- Core table. One row per tracked player.
-- ----------------------------------------------------------
CREATE TABLE players (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Basic Info
  first_name          text         NOT NULL,
  last_name           text         NOT NULL,
  date_of_birth       date,
  nationality         text,
  second_nationality  text,
  preferred_foot      text         CHECK (preferred_foot IN ('Left', 'Right', 'Both')),
  height_cm           integer,
  weight_kg           integer,
  -- Club & Position
  current_club        text,
  league              text,
  position            text,
  contract_expiry     date,
  market_value        text,
  -- Agent
  agent_name          text,
  agent_contact       text,
  -- Links & Social
  transfermarkt_url   text,
  social_links        jsonb        NOT NULL DEFAULT '{}',
  -- Internal Management
  best_fit_team_id    uuid         REFERENCES internal_teams(id) ON DELETE SET NULL,
  status              text         NOT NULL DEFAULT 'active'
                                   CHECK (status IN ('active', 'archived', 'watchlist')),
  added_by            uuid         NOT NULL DEFAULT auth.uid()
                                   REFERENCES profiles(id),
  created_at          timestamptz  NOT NULL DEFAULT now(),
  updated_at          timestamptz  NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------
-- player_notes
-- Threaded notes per player — replaces WhatsApp discussions.
-- ----------------------------------------------------------
CREATE TABLE player_notes (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id   uuid         NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  author_id   uuid         NOT NULL DEFAULT auth.uid()
                           REFERENCES profiles(id),
  content     text         NOT NULL,
  created_at  timestamptz  NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------
-- activity_log
-- Audit trail. Written exclusively by DB triggers — never by
-- frontend code. The frontend is read-only on this table.
-- ----------------------------------------------------------
CREATE TABLE activity_log (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid         REFERENCES profiles(id),
  player_id    uuid         REFERENCES players(id) ON DELETE SET NULL,
  action_type  text         NOT NULL
               CHECK (action_type IN (
                 'player_added',
                 'player_updated',
                 'note_added',
                 'player_archived'
               )),
  metadata     jsonb        NOT NULL DEFAULT '{}',
  created_at   timestamptz  NOT NULL DEFAULT now()
);

-- ============================================================
-- SECTION 4.2 — INDEXES
-- ============================================================

-- Fast Master Grid filter queries
CREATE INDEX idx_players_position        ON players(position);
CREATE INDEX idx_players_league          ON players(league);
CREATE INDEX idx_players_nationality     ON players(nationality);
CREATE INDEX idx_players_best_fit_team   ON players(best_fit_team_id);
CREATE INDEX idx_players_status          ON players(status);
CREATE INDEX idx_players_contract_expiry ON players(contract_expiry);
CREATE INDEX idx_players_current_club    ON players(current_club);

-- Full-text trigram search on player name
CREATE INDEX idx_players_name ON players
  USING GIN ((first_name || ' ' || last_name) gin_trgm_ops);

-- Notes lookup by player
CREATE INDEX idx_notes_player ON player_notes(player_id);

-- Activity feed ordered by recency
CREATE INDEX idx_activity_created ON activity_log(created_at DESC);

-- ============================================================
-- SECTION 4.3 — ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players        ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_notes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log   ENABLE ROW LEVEL SECURITY;

-- --- profiles ---

CREATE POLICY "Authenticated users can read all profiles"
  ON profiles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- --- internal_teams ---

CREATE POLICY "Authenticated users can read all teams"
  ON internal_teams FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert teams"
  ON internal_teams FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update teams"
  ON internal_teams FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete teams"
  ON internal_teams FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- --- players ---

CREATE POLICY "Authenticated users can read all players"
  ON players FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert players"
  ON players FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update players"
  ON players FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Admins can delete players"
  ON players FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- --- player_notes ---

CREATE POLICY "Authenticated users can read all notes"
  ON player_notes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert notes"
  ON player_notes FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authors can update their own notes"
  ON player_notes FOR UPDATE TO authenticated
  USING (author_id = auth.uid());

CREATE POLICY "Authors can delete their own notes"
  ON player_notes FOR DELETE TO authenticated
  USING (author_id = auth.uid());

-- --- activity_log ---

CREATE POLICY "Authenticated users can read activity log"
  ON activity_log FOR SELECT TO authenticated
  USING (true);

-- No INSERT / UPDATE / DELETE policies — all writes go through
-- SECURITY DEFINER trigger functions that bypass RLS.

-- ============================================================
-- SECTION 4.4 — TRIGGER: updated_at auto-refresh
-- ============================================================

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

-- ============================================================
-- SECTION 4.5 — TRIGGER: auto-create profile on sign-up
-- ============================================================

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

-- ============================================================
-- SECTION 4.6 — TRIGGERS: automatic activity logging
-- ============================================================

-- Log when a player is ADDED
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

-- Log when a player is UPDATED (tracks changed fields)
CREATE OR REPLACE FUNCTION log_player_updated()
RETURNS TRIGGER AS $$
DECLARE
  changed_fields jsonb := '{}';
BEGIN
  IF OLD.first_name IS DISTINCT FROM NEW.first_name THEN
    changed_fields := changed_fields || jsonb_build_object(
      'first_name', jsonb_build_array(OLD.first_name, NEW.first_name));
  END IF;
  IF OLD.last_name IS DISTINCT FROM NEW.last_name THEN
    changed_fields := changed_fields || jsonb_build_object(
      'last_name', jsonb_build_array(OLD.last_name, NEW.last_name));
  END IF;
  IF OLD.current_club IS DISTINCT FROM NEW.current_club THEN
    changed_fields := changed_fields || jsonb_build_object(
      'current_club', jsonb_build_array(OLD.current_club, NEW.current_club));
  END IF;
  IF OLD.league IS DISTINCT FROM NEW.league THEN
    changed_fields := changed_fields || jsonb_build_object(
      'league', jsonb_build_array(OLD.league, NEW.league));
  END IF;
  IF OLD.best_fit_team_id IS DISTINCT FROM NEW.best_fit_team_id THEN
    changed_fields := changed_fields || jsonb_build_object(
      'best_fit_team_id', jsonb_build_array(OLD.best_fit_team_id, NEW.best_fit_team_id));
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    changed_fields := changed_fields || jsonb_build_object(
      'status', jsonb_build_array(OLD.status, NEW.status));
  END IF;
  IF OLD.contract_expiry IS DISTINCT FROM NEW.contract_expiry THEN
    changed_fields := changed_fields || jsonb_build_object(
      'contract_expiry', jsonb_build_array(OLD.contract_expiry, NEW.contract_expiry));
  END IF;
  IF OLD.position IS DISTINCT FROM NEW.position THEN
    changed_fields := changed_fields || jsonb_build_object(
      'position', jsonb_build_array(OLD.position, NEW.position));
  END IF;
  IF OLD.market_value IS DISTINCT FROM NEW.market_value THEN
    changed_fields := changed_fields || jsonb_build_object(
      'market_value', jsonb_build_array(OLD.market_value, NEW.market_value));
  END IF;
  IF OLD.agent_name IS DISTINCT FROM NEW.agent_name THEN
    changed_fields := changed_fields || jsonb_build_object(
      'agent_name', jsonb_build_array(OLD.agent_name, NEW.agent_name));
  END IF;

  -- Only log if something meaningful changed (skip updated_at-only changes)
  IF changed_fields != '{}' THEN
    INSERT INTO activity_log (user_id, player_id, action_type, metadata)
    VALUES (
      auth.uid(),
      NEW.id,
      CASE
        WHEN NEW.status = 'archived' AND OLD.status != 'archived'
        THEN 'player_archived'
        ELSE 'player_updated'
      END,
      jsonb_build_object(
        'player_name', NEW.first_name || ' ' || NEW.last_name,
        'changed_fields', changed_fields
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_player_updated
  AFTER UPDATE ON players
  FOR EACH ROW
  EXECUTE FUNCTION log_player_updated();

-- Log when a NOTE is added to a player
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

-- ============================================================
-- SECTION 4.7 — ADMIN BOOTSTRAP (Solution B: auto-promote first user)
-- ============================================================

CREATE OR REPLACE FUNCTION auto_promote_first_admin()
RETURNS TRIGGER AS $$
BEGIN
  -- If this is the first profile row, make it admin automatically
  IF (SELECT COUNT(*) FROM profiles) = 1 THEN
    UPDATE profiles SET role = 'admin' WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_first_user_admin
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_promote_first_admin();

-- ============================================================
-- SECTION 4.8 — SUPABASE REALTIME publications
-- ============================================================

-- Enable realtime for tables that need live sync.
-- Do NOT add profiles or internal_teams — they change rarely.
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE player_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;
