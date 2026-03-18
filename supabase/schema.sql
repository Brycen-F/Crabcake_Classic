-- Crabcake Classic Database Schema
-- Run this in Supabase SQL Editor to create the required tables

-- Matches table
CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  round INTEGER NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('fourball', 'singles')),
  course_id TEXT NOT NULL,
  team1_players TEXT[] NOT NULL,
  team2_players TEXT[] NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'complete')),
  current_hole INTEGER NOT NULL DEFAULT 1,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hole scores table
CREATE TABLE IF NOT EXISTS hole_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  hole INTEGER NOT NULL CHECK (hole >= 1 AND hole <= 18),
  gross_score INTEGER NOT NULL CHECK (gross_score >= 1 AND gross_score <= 15),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(match_id, player_id, hole)
);

-- Enable Row Level Security (but allow all operations for this private app)
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE hole_scores ENABLE ROW LEVEL SECURITY;

-- Allow all operations (no auth required for private trip app)
CREATE POLICY "Allow all operations on matches" ON matches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on hole_scores" ON hole_scores FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE matches;
ALTER PUBLICATION supabase_realtime ADD TABLE hole_scores;

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_matches_round ON matches(round);
CREATE INDEX IF NOT EXISTS idx_hole_scores_match_id ON hole_scores(match_id);
CREATE INDEX IF NOT EXISTS idx_hole_scores_player_hole ON hole_scores(match_id, player_id, hole);
