// Player and Team Types
export interface Player {
  id: string;
  name: string;
  handicap: number;
  team: 'brown' | 'rusty';
}

export interface Team {
  name: string;
  captain: string;
  color: string;
  players: Player[];
}

// Course Types
export interface HoleInfo {
  number: number;
  par: number;
  handicapRank: number; // 1 = hardest hole, 18 = easiest
  yardage: number;
}

export interface Course {
  id: string;
  name: string;
  holes: HoleInfo[];
  totalPar: number;
}

// Match Types
export type MatchFormat = 'fourball' | 'singles';
export type MatchStatus = 'not_started' | 'in_progress' | 'complete';

export interface Match {
  id: string;
  day: 1 | 2;
  format: MatchFormat;
  courseId: string;
  teamBrownPlayers: string[]; // Player IDs
  teamRustyPlayers: string[]; // Player IDs
  status: MatchStatus;
  currentHole: number;
  brownScore: number; // Match play score (holes up)
  rustyScore: number;
  result?: MatchResult;
}

export interface MatchResult {
  winner: 'brown' | 'rusty' | 'tie';
  pointsAwarded: number;
  finalScore: string; // e.g., "3&2" or "1UP" or "AS"
}

// Scoring Types
export interface HoleScore {
  matchId: string;
  holeNumber: number;
  playerId: string;
  grossScore: number;
  netScore: number;
  dots: number; // Handicap strokes received on this hole
}

export interface MatchScore {
  matchId: string;
  holeNumber: number;
  brownBestBall: number; // Best net score for Team Brown
  rustyBestBall: number; // Best net score for Team Rusty
  holeWinner: 'brown' | 'rusty' | 'halved';
  matchStatus: string; // e.g., "Brown 2UP", "AS" (all square)
}

// Leaderboard Types
export interface TeamStanding {
  team: 'brown' | 'rusty';
  points: number;
  matchesWon: number;
  matchesLost: number;
  matchesTied: number;
  matchesRemaining: number;
}

// Database Types (matching Supabase schema)
export interface DbMatch {
  id: string;
  day: number;
  format: string;
  course_id: string;
  team_brown_players: string[];
  team_rusty_players: string[];
  status: string;
  current_hole: number;
  brown_score: number;
  rusty_score: number;
  result: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbHoleScore {
  id: string;
  match_id: string;
  hole_number: number;
  player_id: string;
  gross_score: number;
  net_score: number;
  dots: number;
  created_at: string;
}
