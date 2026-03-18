'use client';

import { Match, HoleScore, DotAllocation, Player } from '@/lib/types';
import { getPlayer, COURSES } from '@/lib/constants';
import { getDotsForHole, getHoleByHoleStatus } from '@/lib/scoring';
import ScoreDisplay, { ScoreLegend } from './ScoreDisplay';

interface MastersScorecardProps {
  match: Match;
  scores: HoleScore[];
  dotAllocations: DotAllocation[];
  currentHole?: number;
  pendingScores?: Record<string, number>;
}

/**
 * Masters-style scorecard matching the official Masters Tournament scorecard.
 * Features:
 * - Clean green header with hole numbers
 * - Yardages row
 * - Handicap (HDCP) row
 * - Par row
 * - Player scores with Masters circle/square styling
 * - Match play running score
 */
export default function MastersScorecard({
  match,
  scores,
  dotAllocations,
  currentHole,
  pendingScores = {},
}: MastersScorecardProps) {
  const course = COURSES[match.courseId];
  const allocMap = new Map(dotAllocations.map(a => [a.playerId, a]));

  const allPlayers = [...match.team1Players, ...match.team2Players]
    .map(id => getPlayer(id))
    .filter(Boolean) as Player[];

  const team1Players = match.team1Players.map(id => getPlayer(id)).filter(Boolean) as Player[];
  const team2Players = match.team2Players.map(id => getPlayer(id)).filter(Boolean) as Player[];
  const team1HasBrown = team1Players.some(p => p.team === 'BROWN');

  // Calculate match play status
  const holeStatus = getHoleByHoleStatus(match, scores, dotAllocations);

  // Get score for a player on a hole
  const getScore = (playerId: string, hole: number) => {
    if (currentHole === hole && pendingScores[playerId] !== undefined) {
      return pendingScores[playerId];
    }
    return scores.find(s => s.playerId === playerId && s.hole === hole)?.grossScore;
  };

  // Calculate totals
  const getPlayerTotal = (playerId: string, startHole: number, endHole: number) => {
    let total = 0;
    for (let h = startHole; h <= endHole; h++) {
      const score = getScore(playerId, h);
      if (score) total += score;
    }
    return total > 0 ? total : null;
  };

  // Calculate running match play score
  const getMatchPlayStatus = (throughHole: number) => {
    let team1Wins = 0;
    let team2Wins = 0;
    for (let h = 1; h <= throughHole; h++) {
      const status = holeStatus[h - 1];
      if (status?.winner === 'team1') team1Wins++;
      else if (status?.winner === 'team2') team2Wins++;
    }
    const diff = team1Wins - team2Wins;
    if (diff > 0) return { leader: 'team1', margin: diff };
    if (diff < 0) return { leader: 'team2', margin: -diff };
    return { leader: 'tied', margin: 0 };
  };

  const front9Par = course?.par.slice(0, 9).reduce((a, b) => a + b, 0) || 36;
  const back9Par = course?.par.slice(9, 18).reduce((a, b) => a + b, 0) || 36;
  const totalPar = front9Par + back9Par;

  const front9Yards = course?.yardages.slice(0, 9).reduce((a, b) => a + b, 0) || 0;
  const back9Yards = course?.yardages.slice(9, 18).reduce((a, b) => a + b, 0) || 0;
  const totalYards = front9Yards + back9Yards;

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header with Legend */}
      <div className="px-4 py-3 bg-masters-cream border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-serif text-lg font-bold text-masters-black">Official Score Card</h3>
        <ScoreLegend />
      </div>

      {/* Front 9 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {/* Hole Row */}
            <tr className="bg-masters-green text-white">
              <th className="sticky left-0 z-10 bg-masters-green px-3 py-2 text-left font-medium min-w-[80px]">Hole</th>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(hole => (
                <th
                  key={hole}
                  className={`px-2 py-2 text-center font-bold min-w-[40px] ${
                    currentHole === hole ? 'bg-masters-gold text-masters-black' : ''
                  }`}
                >
                  {hole}
                </th>
              ))}
              <th className="px-3 py-2 text-center font-bold min-w-[50px] bg-masters-green/80">Out</th>
            </tr>

            {/* Yardage Row */}
            <tr className="bg-masters-green/90 text-white/90">
              <td className="sticky left-0 z-10 bg-masters-green/90 px-3 py-1.5 text-left text-xs">Yards</td>
              {course?.yardages.slice(0, 9).map((yds, i) => (
                <td key={i} className="px-2 py-1.5 text-center text-xs">{yds}</td>
              ))}
              <td className="px-3 py-1.5 text-center text-xs font-medium">{front9Yards}</td>
            </tr>

            {/* HDCP Row */}
            <tr className="bg-masters-green/80 text-white/80">
              <td className="sticky left-0 z-10 bg-masters-green/80 px-3 py-1.5 text-left text-xs">HDCP</td>
              {course?.handicapIndex.slice(0, 9).map((hdcp, i) => (
                <td key={i} className="px-2 py-1.5 text-center text-xs">{hdcp}</td>
              ))}
              <td className="px-3 py-1.5 text-center text-xs"></td>
            </tr>

            {/* Par Row */}
            <tr className="bg-masters-green text-white">
              <td className="sticky left-0 z-10 bg-masters-green px-3 py-2 text-left font-medium">Par</td>
              {course?.par.slice(0, 9).map((par, i) => (
                <td key={i} className="px-2 py-2 text-center font-medium">{par}</td>
              ))}
              <td className="px-3 py-2 text-center font-bold">{front9Par}</td>
            </tr>
          </thead>

          <tbody>
            {allPlayers.map((player, idx) => {
              const alloc = allocMap.get(player.id);
              const front9Total = getPlayerTotal(player.id, 1, 9);
              const isTeam1 = match.team1Players.includes(player.id);

              return (
                <tr
                  key={player.id}
                  className={`border-b border-gray-100 ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  }`}
                >
                  <td className={`sticky left-0 z-10 px-3 py-3 text-left ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  } ${player.team === 'BROWN' ? 'font-semibold text-masters-black' : 'font-medium text-masters-gray'}`}>
                    <span className="truncate max-w-[70px] block">{player.name.split(' ')[0]}</span>
                  </td>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(hole => {
                    const score = getScore(player.id, hole);
                    const par = course?.par[hole - 1] || 4;
                    const dots = alloc ? getDotsForHole(alloc, hole) : 0;
                    const netScore = score !== undefined ? score - dots : undefined;
                    const holeResult = holeStatus[hole - 1];

                    // Check if this player had the winning best ball (not a push)
                    const isTeam1Player = match.team1Players.includes(player.id);
                    const teamWonHole = holeResult?.winner === (isTeam1Player ? 'team1' : 'team2');
                    const isBestBall = netScore !== undefined && (
                      (isTeam1Player && netScore === holeResult?.team1Net) ||
                      (!isTeam1Player && netScore === holeResult?.team2Net)
                    );
                    const showWinHighlight = teamWonHole && isBestBall && holeResult?.winner !== 'halved';

                    return (
                      <td
                        key={hole}
                        className={`px-1 py-2 text-center ${
                          currentHole === hole ? 'bg-masters-gold/20' :
                          showWinHighlight ? 'bg-green-100' : ''
                        }`}
                      >
                        <div className="flex flex-col items-center">
                          {dots > 0 && (
                            <div className="flex items-center gap-px mb-0.5">
                              {Array.from({ length: dots }).map((_, i) => (
                                <span key={i} className="w-1.5 h-1.5 rounded-full bg-masters-gold" />
                              ))}
                            </div>
                          )}
                          {score !== undefined ? (
                            <ScoreDisplay grossScore={score} par={par} size="sm" />
                          ) : (
                            <span className="text-gray-300 text-sm">–</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center font-bold text-masters-black bg-gray-100">
                    {front9Total ?? '–'}
                  </td>
                </tr>
              );
            })}

            {/* Match Play Row */}
            <tr className="bg-masters-green text-white border-t-2 border-masters-gold">
              <td className="sticky left-0 z-10 bg-masters-green px-3 py-2 text-left font-medium text-xs">Match</td>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(hole => {
                const status = holeStatus[hole - 1];
                const matchStatus = getMatchPlayStatus(hole);

                return (
                  <td key={hole} className="px-1 py-2 text-center text-xs">
                    {status?.winner === 'team1' ? (
                      <span className={team1HasBrown ? 'text-amber-300' : 'text-orange-300'}>●</span>
                    ) : status?.winner === 'team2' ? (
                      <span className={team1HasBrown ? 'text-orange-300' : 'text-amber-300'}>●</span>
                    ) : status?.winner === 'halved' ? (
                      <span className="text-masters-gold">–</span>
                    ) : (
                      <span className="text-white/30">·</span>
                    )}
                  </td>
                );
              })}
              <td className="px-3 py-2 text-center font-bold text-xs">
                {(() => {
                  const status = getMatchPlayStatus(9);
                  if (status.leader === 'tied') return 'AS';
                  const leader = status.leader === 'team1' ? (team1HasBrown ? 'B' : 'R') : (team1HasBrown ? 'R' : 'B');
                  return `${leader} ${status.margin}UP`;
                })()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Back 9 */}
      <div className="overflow-x-auto border-t-4 border-masters-green">
        <table className="w-full text-sm">
          <thead>
            {/* Hole Row */}
            <tr className="bg-masters-green text-white">
              <th className="sticky left-0 z-10 bg-masters-green px-3 py-2 text-left font-medium min-w-[80px]">Hole</th>
              {[10, 11, 12, 13, 14, 15, 16, 17, 18].map(hole => (
                <th
                  key={hole}
                  className={`px-2 py-2 text-center font-bold min-w-[40px] ${
                    currentHole === hole ? 'bg-masters-gold text-masters-black' : ''
                  }`}
                >
                  {hole}
                </th>
              ))}
              <th className="px-3 py-2 text-center font-bold min-w-[50px] bg-masters-green/80">In</th>
              <th className="px-3 py-2 text-center font-bold min-w-[50px] bg-masters-green/60">Total</th>
            </tr>

            {/* Yardage Row */}
            <tr className="bg-masters-green/90 text-white/90">
              <td className="sticky left-0 z-10 bg-masters-green/90 px-3 py-1.5 text-left text-xs">Yards</td>
              {course?.yardages.slice(9, 18).map((yds, i) => (
                <td key={i} className="px-2 py-1.5 text-center text-xs">{yds}</td>
              ))}
              <td className="px-3 py-1.5 text-center text-xs font-medium">{back9Yards}</td>
              <td className="px-3 py-1.5 text-center text-xs font-medium">{totalYards}</td>
            </tr>

            {/* HDCP Row */}
            <tr className="bg-masters-green/80 text-white/80">
              <td className="sticky left-0 z-10 bg-masters-green/80 px-3 py-1.5 text-left text-xs">HDCP</td>
              {course?.handicapIndex.slice(9, 18).map((hdcp, i) => (
                <td key={i} className="px-2 py-1.5 text-center text-xs">{hdcp}</td>
              ))}
              <td className="px-3 py-1.5 text-center text-xs"></td>
              <td className="px-3 py-1.5 text-center text-xs"></td>
            </tr>

            {/* Par Row */}
            <tr className="bg-masters-green text-white">
              <td className="sticky left-0 z-10 bg-masters-green px-3 py-2 text-left font-medium">Par</td>
              {course?.par.slice(9, 18).map((par, i) => (
                <td key={i} className="px-2 py-2 text-center font-medium">{par}</td>
              ))}
              <td className="px-3 py-2 text-center font-bold">{back9Par}</td>
              <td className="px-3 py-2 text-center font-bold">{totalPar}</td>
            </tr>
          </thead>

          <tbody>
            {allPlayers.map((player, idx) => {
              const alloc = allocMap.get(player.id);
              const front9Total = getPlayerTotal(player.id, 1, 9);
              const back9Total = getPlayerTotal(player.id, 10, 18);
              const total = (front9Total || 0) + (back9Total || 0);

              return (
                <tr
                  key={player.id}
                  className={`border-b border-gray-100 ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  }`}
                >
                  <td className={`sticky left-0 z-10 px-3 py-3 text-left ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  } ${player.team === 'BROWN' ? 'font-semibold text-masters-black' : 'font-medium text-masters-gray'}`}>
                    <span className="truncate max-w-[70px] block">{player.name.split(' ')[0]}</span>
                  </td>
                  {[10, 11, 12, 13, 14, 15, 16, 17, 18].map(hole => {
                    const score = getScore(player.id, hole);
                    const par = course?.par[hole - 1] || 4;
                    const dots = alloc ? getDotsForHole(alloc, hole) : 0;
                    const netScore = score !== undefined ? score - dots : undefined;
                    const holeResult = holeStatus[hole - 1];

                    // Check if this player had the winning best ball (not a push)
                    const isTeam1Player = match.team1Players.includes(player.id);
                    const teamWonHole = holeResult?.winner === (isTeam1Player ? 'team1' : 'team2');
                    const isBestBall = netScore !== undefined && (
                      (isTeam1Player && netScore === holeResult?.team1Net) ||
                      (!isTeam1Player && netScore === holeResult?.team2Net)
                    );
                    const showWinHighlight = teamWonHole && isBestBall && holeResult?.winner !== 'halved';

                    return (
                      <td
                        key={hole}
                        className={`px-1 py-2 text-center ${
                          currentHole === hole ? 'bg-masters-gold/20' :
                          showWinHighlight ? 'bg-green-100' : ''
                        }`}
                      >
                        <div className="flex flex-col items-center">
                          {dots > 0 && (
                            <div className="flex items-center gap-px mb-0.5">
                              {Array.from({ length: dots }).map((_, i) => (
                                <span key={i} className="w-1.5 h-1.5 rounded-full bg-masters-gold" />
                              ))}
                            </div>
                          )}
                          {score !== undefined ? (
                            <ScoreDisplay grossScore={score} par={par} size="sm" />
                          ) : (
                            <span className="text-gray-300 text-sm">–</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center font-bold text-masters-black bg-gray-100">
                    {back9Total ?? '–'}
                  </td>
                  <td className="px-3 py-2 text-center font-bold text-masters-black bg-gray-200">
                    {total > 0 ? total : '–'}
                  </td>
                </tr>
              );
            })}

            {/* Match Play Row */}
            <tr className="bg-masters-green text-white border-t-2 border-masters-gold">
              <td className="sticky left-0 z-10 bg-masters-green px-3 py-2 text-left font-medium text-xs">Match</td>
              {[10, 11, 12, 13, 14, 15, 16, 17, 18].map(hole => {
                const status = holeStatus[hole - 1];

                return (
                  <td key={hole} className="px-1 py-2 text-center text-xs">
                    {status?.winner === 'team1' ? (
                      <span className={team1HasBrown ? 'text-amber-300' : 'text-orange-300'}>●</span>
                    ) : status?.winner === 'team2' ? (
                      <span className={team1HasBrown ? 'text-orange-300' : 'text-amber-300'}>●</span>
                    ) : status?.winner === 'halved' ? (
                      <span className="text-masters-gold">–</span>
                    ) : (
                      <span className="text-white/30">·</span>
                    )}
                  </td>
                );
              })}
              <td className="px-3 py-2 text-center font-bold text-xs">
                {(() => {
                  const status = getMatchPlayStatus(18);
                  const back9Status = (() => {
                    let t1 = 0, t2 = 0;
                    for (let h = 10; h <= 18; h++) {
                      const s = holeStatus[h - 1];
                      if (s?.winner === 'team1') t1++;
                      else if (s?.winner === 'team2') t2++;
                    }
                    const diff = t1 - t2;
                    if (diff > 0) return { leader: 'team1', margin: diff };
                    if (diff < 0) return { leader: 'team2', margin: -diff };
                    return { leader: 'tied', margin: 0 };
                  })();

                  if (back9Status.leader === 'tied') return 'AS';
                  const leader = back9Status.leader === 'team1' ? (team1HasBrown ? 'B' : 'R') : (team1HasBrown ? 'R' : 'B');
                  return `${leader} ${back9Status.margin}UP`;
                })()}
              </td>
              <td className="px-3 py-2 text-center font-bold text-xs bg-masters-gold text-masters-black">
                {(() => {
                  const status = getMatchPlayStatus(18);
                  if (status.leader === 'tied') return 'AS';
                  const leader = status.leader === 'team1' ? (team1HasBrown ? 'B' : 'R') : (team1HasBrown ? 'R' : 'B');
                  return `${leader} ${status.margin}UP`;
                })()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
