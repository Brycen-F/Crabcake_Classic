import { Player, Match, HoleScore, DotAllocation, MatchResult } from './types';
import { getPlayer } from './constants';

/**
 * Calculate course handicap from handicap index using the WHS (World Handicap System) formula.
 *
 * Course Handicap = Handicap Index × (Slope Rating / 113) + (Course Rating - Par)
 *
 * @param handicapIndex - Player's handicap index
 * @param slope - Course slope rating for the tees being played (113 = standard)
 * @param rating - Course rating for the tees being played
 * @param par - Total par for the course
 * @returns Course handicap rounded to nearest whole number
 *
 * @example
 * // Mid Pines White: Slope 136, Rating 70.4, Par 72
 * getCourseHandicap(9.7, 136, 70.4, 72)  // returns 10 (9.7 × 136/113 + (70.4-72) = 10.07 → 10)
 * getCourseHandicap(19.3, 136, 70.4, 72) // returns 22 (19.3 × 136/113 + (70.4-72) = 21.63 → 22)
 */
export function getCourseHandicap(
  handicapIndex: number,
  slope: number,
  rating: number,
  par: number
): number {
  return Math.round(handicapIndex * (slope / 113) + (rating - par));
}

/**
 * Calculate dot (handicap stroke) allocations for all players in a match group.
 *
 * In four-ball match play, strokes are given "off the low ball" — meaning each
 * player's strokes are calculated relative to the lowest course handicap in the group.
 *
 * The calculation uses the WHS formula:
 * 1. Convert each player's handicap index to course handicap using slope, rating, and par
 * 2. Find the minimum course handicap in the group
 * 3. Each player receives (their course handicap - min course handicap) strokes
 *
 * Strokes are assigned to holes starting with the most difficult (handicap index = 1),
 * then the second most difficult (index = 2), and so on.
 *
 * @param players - Array of Player objects in the match group
 * @param course - Course data with handicapIndex, slope, rating, and par
 * @returns Array of DotAllocation objects, one per player
 *
 * @example
 * // At Mid Pines (slope 136, rating 70.4, par 72):
 * // Player handicap indexes: 9.7, 19.3, 13.1, 18.7
 * // Course handicaps: 10, 22, 14, 21
 * // Min course handicap: 10
 * // Strokes received: 0, 12, 4, 11
 */
export function calculateDots(
  players: Player[],
  course: { handicapIndex: number[]; slope: number; rating: number; par: number[] }
): DotAllocation[] {
  if (players.length === 0) return [];

  const totalPar = course.par.reduce((sum, p) => sum + p, 0);

  // Convert handicap indexes to course handicaps
  const playerCourseHandicaps = players.map(p => ({
    player: p,
    courseHandicap: getCourseHandicap(p.handicap, course.slope, course.rating, totalPar)
  }));

  // Find minimum course handicap
  const minCourseHandicap = Math.min(...playerCourseHandicaps.map(p => p.courseHandicap));

  // Create array of holes sorted by difficulty (handicap index rank 1 = hardest)
  const holesByDifficulty = course.handicapIndex
    .map((rank, i) => ({ hole: i + 1, rank }))
    .sort((a, b) => a.rank - b.rank);

  return playerCourseHandicaps.map(({ player, courseHandicap }) => {
    const strokesReceived = courseHandicap - minCourseHandicap;
    const holesWithDot: number[] = [];

    if (strokesReceived > 0) {
      // Assign dots to holes, wrapping around for high handicaps
      // Each full "round" of 18 gives one dot per hole, then remainder goes to hardest
      let remainingStrokes = strokesReceived;

      while (remainingStrokes > 0) {
        const strokesThisRound = Math.min(remainingStrokes, 18);
        for (let i = 0; i < strokesThisRound; i++) {
          holesWithDot.push(holesByDifficulty[i].hole);
        }
        remainingStrokes -= strokesThisRound;
      }
    }

    return {
      playerId: player.id,
      strokesReceived,
      holesWithDot: holesWithDot.sort((a, b) => a - b),
    };
  });
}

/**
 * Calculate net score for a hole given gross score and dot status.
 *
 * @param grossScore - The player's gross (actual) score on the hole
 * @param hasDotOnHole - Whether the player receives a stroke on this hole
 * @returns Net score (gross minus stroke if applicable)
 *
 * @example
 * getNetScore(5, true)  // returns 4
 * getNetScore(5, false) // returns 5
 */
export function getNetScore(grossScore: number, hasDotOnHole: boolean): number {
  return grossScore - (hasDotOnHole ? 1 : 0);
}

/**
 * Calculate match play result for a four-ball (best ball) match.
 *
 * Each team's score on a hole is the LOWER net score of its two players.
 * Match play scoring: +1 if team1 wins hole, -1 if team2 wins, 0 for halve.
 *
 * Nassau scoring awards points for three segments:
 * - Front 9: Sum of holes 1-9. Positive = team1 wins, negative = team2, zero = halved.
 * - Back 9: Sum of holes 10-18 (independent of front 9).
 * - Total 18: Sum of all 18 holes.
 *
 * @param team1NetScores - Array of [player1NetScores[], player2NetScores[]] for team 1
 * @param team2NetScores - Array of [player1NetScores[], player2NetScores[]] for team 2
 * @returns Object with front9, back9, and total results ('team1' | 'team2' | 'halved')
 *
 * @example
 * // Team 1 best balls: [4,3,4,5,3,4,5,3,4, 4,3,5,4,3,4,5,4,4]
 * // Team 2 best balls: [4,4,4,4,4,4,4,4,4, 4,4,4,4,4,4,4,4,4]
 * // Front 9: team1 wins more holes → 'team1'
 */
export function calculateMatchPlayResult(
  team1NetScores: number[][],
  team2NetScores: number[][]
): { front9: 'team1' | 'team2' | 'halved'; back9: 'team1' | 'team2' | 'halved'; total: 'team1' | 'team2' | 'halved' } {
  let front9Sum = 0;
  let back9Sum = 0;

  for (let hole = 0; hole < 18; hole++) {
    // Get best ball (lowest net score) for each team on this hole
    const team1Best = Math.min(
      ...team1NetScores.map(playerScores => playerScores[hole]).filter(s => s > 0)
    );
    const team2Best = Math.min(
      ...team2NetScores.map(playerScores => playerScores[hole]).filter(s => s > 0)
    );

    // Match play: +1 team1 wins, -1 team2 wins, 0 halve
    let holeResult = 0;
    if (team1Best < team2Best) holeResult = 1;
    else if (team2Best < team1Best) holeResult = -1;

    if (hole < 9) {
      front9Sum += holeResult;
    } else {
      back9Sum += holeResult;
    }
  }

  const totalSum = front9Sum + back9Sum;

  const getWinner = (sum: number): 'team1' | 'team2' | 'halved' => {
    if (sum > 0) return 'team1';
    if (sum < 0) return 'team2';
    return 'halved';
  };

  return {
    front9: getWinner(front9Sum),
    back9: getWinner(back9Sum),
    total: getWinner(totalSum),
  };
}

/**
 * Calculate total team points across all match results.
 *
 * @param matchResults - Array of MatchResult objects from completed matches
 * @returns Object with total points for Team Brown and Team Rusty
 *
 * @example
 * getTotalTeamPoints([
 *   { teamBrownPoints: 2, teamRustyPoints: 1, ... },
 *   { teamBrownPoints: 1.5, teamRustyPoints: 1.5, ... }
 * ])
 * // returns { brown: 3.5, rusty: 2.5 }
 */
export function getTotalTeamPoints(
  matchResults: MatchResult[]
): { brown: number; rusty: number } {
  return matchResults.reduce(
    (acc, result) => ({
      brown: acc.brown + result.teamBrownPoints,
      rusty: acc.rusty + result.teamRustyPoints,
    }),
    { brown: 0, rusty: 0 }
  );
}

/**
 * Get display classification for a score relative to par.
 *
 * @param grossScore - The player's gross score on the hole
 * @param par - The par for the hole
 * @returns Score classification string
 *
 * @example
 * getScoreDisplay(3, 4) // returns 'birdie'
 * getScoreDisplay(2, 4) // returns 'eagle'
 * getScoreDisplay(4, 4) // returns 'par'
 * getScoreDisplay(5, 4) // returns 'bogey'
 * getScoreDisplay(6, 4) // returns 'double+'
 */
export function getScoreDisplay(
  grossScore: number,
  par: number
): 'eagle' | 'birdie' | 'par' | 'bogey' | 'double+' {
  const diff = grossScore - par;
  if (diff <= -2) return 'eagle';
  if (diff === -1) return 'birdie';
  if (diff === 0) return 'par';
  if (diff === 1) return 'bogey';
  return 'double+';
}

// =============================================================================
// Helper functions used by other parts of the app
// =============================================================================

/**
 * Calculate dot allocations from player IDs (convenience wrapper).
 * Used by match pages that have player IDs rather than Player objects.
 */
export function calculateDotAllocations(
  playerIds: string[],
  course: { handicapIndex: number[]; slope: number; rating: number; par: number[] }
): DotAllocation[] {
  const players = playerIds.map(id => getPlayer(id)).filter(Boolean) as Player[];
  return calculateDots(players, course);
}

/**
 * Get the number of dots a player has on a specific hole.
 * Handles cases where a player may have multiple dots (handicap > 18).
 */
export function getDotsForHole(allocation: DotAllocation, hole: number): number {
  return allocation.holesWithDot.filter(h => h === hole).length;
}

/**
 * Calculate Nassau result from hole scores.
 * Nassau = front 9 (1pt), back 9 (1pt), total (1pt) = 3 points per match
 */
export function calculateNassauResult(
  match: Match,
  scores: HoleScore[],
  dotAllocations: DotAllocation[]
): MatchResult {
  const allocMap = new Map(dotAllocations.map(a => [a.playerId, a]));

  // Build net score arrays for each player
  const buildPlayerNetScores = (playerIds: string[]): number[][] => {
    return playerIds.map(playerId => {
      const alloc = allocMap.get(playerId);
      const netScores: number[] = [];
      for (let hole = 1; hole <= 18; hole++) {
        const holeScore = scores.find(s => s.playerId === playerId && s.hole === hole);
        if (holeScore) {
          const dots = alloc ? getDotsForHole(alloc, hole) : 0;
          netScores.push(holeScore.grossScore - dots);
        } else {
          netScores.push(Infinity); // No score yet
        }
      }
      return netScores;
    });
  };

  const team1NetScores = buildPlayerNetScores(match.team1Players);
  const team2NetScores = buildPlayerNetScores(match.team2Players);

  const { front9, back9, total } = calculateMatchPlayResult(team1NetScores, team2NetScores);

  // Calculate points (1 for win, 0.5 for halve)
  const calcPoints = (winner: 'team1' | 'team2' | 'halved') => {
    if (winner === 'team1') return { t1: 1, t2: 0 };
    if (winner === 'team2') return { t1: 0, t2: 1 };
    return { t1: 0.5, t2: 0.5 };
  };

  const f9 = calcPoints(front9);
  const b9 = calcPoints(back9);
  const tot = calcPoints(total);

  const team1Points = f9.t1 + b9.t1 + tot.t1;
  const team2Points = f9.t2 + b9.t2 + tot.t2;

  // Map team1/team2 points to BROWN/RUSTY
  const team1HasBrown = match.team1Players.some(id => {
    const p = getPlayer(id);
    return p?.team === 'BROWN';
  });

  const teamBrownPoints = team1HasBrown ? team1Points : team2Points;
  const teamRustyPoints = team1HasBrown ? team2Points : team1Points;

  return {
    matchId: match.id,
    front9Winner: front9,
    back9Winner: back9,
    totalWinner: total,
    team1Points,
    team2Points,
    teamBrownPoints,
    teamRustyPoints,
  };
}

/**
 * Calculate team standings from all match results.
 */
export function calculateTeamStandings(matches: Match[]): {
  brown: { points: number; possiblePoints: number };
  rusty: { points: number; possiblePoints: number };
} {
  const results = matches.filter(m => m.result).map(m => m.result!);
  const { brown, rusty } = getTotalTeamPoints(results);
  const totalPossible = matches.length * 3; // 3 points per match (Nassau)

  return {
    brown: { points: brown, possiblePoints: totalPossible },
    rusty: { points: rusty, possiblePoints: totalPossible },
  };
}

/**
 * Get current hole-by-hole status for a match.
 */
export function getHoleByHoleStatus(
  match: Match,
  scores: HoleScore[],
  dotAllocations: DotAllocation[]
): { hole: number; team1Net: number | null; team2Net: number | null; winner: 'team1' | 'team2' | 'halved' | null }[] {
  const allocMap = new Map(dotAllocations.map(a => [a.playerId, a]));
  const results = [];

  for (let hole = 1; hole <= 18; hole++) {
    const holeScores = scores.filter(s => s.hole === hole);

    if (holeScores.length === 0) {
      results.push({ hole, team1Net: null, team2Net: null, winner: null });
      continue;
    }

    const team1Scores = match.team1Players.map(pid => {
      const score = holeScores.find(s => s.playerId === pid);
      const alloc = allocMap.get(pid);
      const dots = alloc ? getDotsForHole(alloc, hole) : 0;
      return score ? score.grossScore - dots : null;
    }).filter((n): n is number => n !== null && n > 0);

    const team2Scores = match.team2Players.map(pid => {
      const score = holeScores.find(s => s.playerId === pid);
      const alloc = allocMap.get(pid);
      const dots = alloc ? getDotsForHole(alloc, hole) : 0;
      return score ? score.grossScore - dots : null;
    }).filter((n): n is number => n !== null && n > 0);

    const team1Net = team1Scores.length > 0 ? Math.min(...team1Scores) : null;
    const team2Net = team2Scores.length > 0 ? Math.min(...team2Scores) : null;

    let winner: 'team1' | 'team2' | 'halved' | null = null;
    if (team1Net !== null && team2Net !== null) {
      if (team1Net < team2Net) winner = 'team1';
      else if (team2Net < team1Net) winner = 'team2';
      else winner = 'halved';
    }

    results.push({ hole, team1Net, team2Net, winner });
  }

  return results;
}

/**
 * Format score relative to par.
 */
export function formatScoreToPar(score: number, par: number): string {
  const diff = score - par;
  if (diff === 0) return 'E';
  if (diff > 0) return `+${diff}`;
  return `${diff}`;
}

// =============================================================================
// TEST BLOCK - Worked Example
// =============================================================================
/*
// Example: Match 1 at Mid Pines (White tees: Slope 136, Rating 70.4, Par 72)
// Steve/Dobs vs Drew/Brycen

const testPlayers: Player[] = [
  { id: 'steve',  name: 'Steve',  handicap: 9.7,  team: 'BROWN' },
  { id: 'dobs',   name: 'Dobs',   handicap: 19.3, team: 'BROWN' },
  { id: 'drew',   name: 'Drew',   handicap: 13.1, team: 'RUSTY' },
  { id: 'brycen', name: 'Brycen', handicap: 18.7, team: 'RUSTY' },
];

const midPinesCourse = {
  handicapIndex: [5, 15, 7, 13, 9, 1, 3, 17, 11, 2, 18, 8, 10, 16, 12, 6, 14, 4],
  slope: 136,
  rating: 70.4,
  par: [4, 3, 4, 4, 5, 5, 4, 3, 4, 5, 3, 4, 3, 4, 5, 4, 4, 4], // total 72
};

const allocations = calculateDots(testPlayers, midPinesCourse);

// Expected results using WHS formula: HI × (Slope/113) + (Rating - Par)
// Steve:  9.7 × (136/113) + (70.4-72) = 11.67 - 1.6 = 10.07 → 10
// Dobs:   19.3 × (136/113) + (70.4-72) = 23.23 - 1.6 = 21.63 → 22
// Drew:   13.1 × (136/113) + (70.4-72) = 15.77 - 1.6 = 14.17 → 14
// Brycen: 18.7 × (136/113) + (70.4-72) = 22.51 - 1.6 = 20.91 → 21
//
// Min course handicap: 10 (Steve)
//
// Steve:  10 - 10 = 0 strokes
// Drew:   14 - 10 = 4 strokes
// Brycen: 21 - 10 = 11 strokes
// Dobs:   22 - 10 = 12 strokes  ← Dobs strokes on hole 15 (HDCP 12)

console.log('Course Handicap Calculation (WHS Formula):');
testPlayers.forEach(p => {
  const ch = getCourseHandicap(p.handicap, 136, 70.4, 72);
  console.log(`${p.name}: HI ${p.handicap} → CH ${ch}`);
});

console.log('\nDot Allocations:');
allocations.forEach(a => {
  console.log(`${a.playerId}: ${a.strokesReceived} strokes on holes ${a.holesWithDot.join(', ')}`);
});

// Test getNetScore
console.log('\nNet Score Tests:');
console.log(`Gross 5 with dot: ${getNetScore(5, true)}`);   // 4
console.log(`Gross 5 no dot: ${getNetScore(5, false)}`);    // 5

// Test getScoreDisplay
console.log('\nScore Display Tests:');
console.log(`2 on par 4: ${getScoreDisplay(2, 4)}`);  // eagle
console.log(`3 on par 4: ${getScoreDisplay(3, 4)}`);  // birdie
console.log(`4 on par 4: ${getScoreDisplay(4, 4)}`);  // par
console.log(`5 on par 4: ${getScoreDisplay(5, 4)}`);  // bogey
console.log(`6 on par 4: ${getScoreDisplay(6, 4)}`);  // double+
*/
