-- supabase/migrations/006_add_player_sort_order.sql
-- Adds manual sort_order to players, mirroring internal_teams pattern.

ALTER TABLE players
  ADD COLUMN sort_order integer NOT NULL DEFAULT 0;

-- Initialise each user's players with sequential order by creation date.
-- PARTITION BY added_by so each user gets their own 1, 2, 3… sequence.
WITH ordered AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY added_by ORDER BY created_at) AS rn
  FROM players
)
UPDATE players
SET sort_order = ordered.rn
FROM ordered
WHERE players.id = ordered.id;

-- Composite index: fast per-user ordered fetch
CREATE INDEX idx_players_sort_order ON players (added_by, sort_order);
