// Player and Team Types
export interface Player {
  id: string;
  name: string;
  handicap: number;
  team: 'BROWN' | 'RUSTY';
}

// Course Types
export interface CourseData {
  id: string;
  name: string;
  tees: string;
  slope: number;           // Slope rating for the tees (113 = standard)
  rating: number;          // Course rating for the tees
  handicapIndex: number[]; // length 18, value = difficulty rank 1-18
  par: number[];           // length 18
  yardages: number[];      // length 18, yardage per hole
  logo?: string;           // Path to course logo image
  photo?: string;          // Path to course hero photo
  designer?: string;       // Course architect
}

// Matchup Definition (preset matches)
export interface MatchupDefinition {
  id: string;
  round: number;
  course: string;         // key into COURSES
  team1: string[];        // array of player IDs (2 for team, 1 for singles)
  team2: string[];
  label: string;
}

// Scoring Types
export interface HoleScore {
  matchId: string;
  playerId: string;
  hole: number;           // 1-18
  grossScore: number;
  createdAt?: string;
}

// Nassau Match Result (front 9, back 9, total = 3 points per match)
export interface MatchResult {
  matchId: string;
  front9Winner: 'team1' | 'team2' | 'halved' | null;
  back9Winner:  'team1' | 'team2' | 'halved' | null;
  totalWinner:  'team1' | 'team2' | 'halved' | null;
  team1Points: number;   // 0–3
  team2Points: number;
  teamBrownPoints: number;
  teamRustyPoints: number;
}

// Dot (handicap stroke) allocation for a player in a match
export interface DotAllocation {
  playerId: string;
  strokesReceived: number;
  holesWithDot: number[]; // 1-indexed hole numbers where player gets a stroke
}

// Match state for UI
export type MatchStatus = 'not_started' | 'in_progress' | 'complete';

export interface Match {
  id: string;
  round: number;
  format: 'fourball' | 'singles';
  courseId: string;
  team1Players: string[];
  team2Players: string[];
  label: string;
  status: MatchStatus;
  currentHole: number;
  result?: MatchResult;
}

// Leaderboard Types
export interface TeamStanding {
  team: 'BROWN' | 'RUSTY';
  points: number;
  possiblePoints: number;
}

// Database Types (matching Supabase schema)
export interface DbMatch {
  id: string;
  round: number;
  format: string;
  course_id: string;
  team1_players: string[];
  team2_players: string[];
  label: string;
  status: string;
  current_hole: number;
  result: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbHoleScore {
  id: string;
  match_id: string;
  player_id: string;
  hole: number;
  gross_score: number;
  created_at: string;
}
