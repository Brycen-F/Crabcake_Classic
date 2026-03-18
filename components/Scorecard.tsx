'use client';

import { Match, HoleScore, DotAllocation } from '@/lib/types';
import { getPlayer, COURSES } from '@/lib/constants';
import { getDotsForHole } from '@/lib/scoring';
import HoleDotIndicator from './HoleDotIndicator';
import ScoreDisplay from './ScoreDisplay';

interface ScorecardProps {
  match: Match;
  scores: HoleScore[];
  dotAllocations: DotAllocation[];
}

/**
 * Full 18-hole scorecard display showing all players' scores.
 */
export default function Scorecard({ match, scores, dotAllocations }: ScorecardProps) {
  const course = COURSES[match.courseId];
  const allPlayerIds = [...match.team1Players, ...match.team2Players];
  const allocMap = new Map(dotAllocations.map(a => [a.playerId, a]));

  // Group scores by player and hole
  const scoresByPlayer: Record<string, Record<number, HoleScore>> = {};
  for (const score of scores) {
    if (!scoresByPlayer[score.playerId]) {
      scoresByPlayer[score.playerId] = {};
    }
    scoresByPlayer[score.playerId][score.hole] = score;
  }

  // Calculate totals
  const getPlayerTotal = (playerId: string, front9: boolean): number | null => {
    const playerScores = scoresByPlayer[playerId] || {};
    const start = front9 ? 1 : 10;
    const end = front9 ? 9 : 18;
    let total = 0;
    let hasScores = false;

    for (let hole = start; hole <= end; hole++) {
      if (playerScores[hole]) {
        total += playerScores[hole].grossScore;
        hasScores = true;
      }
    }

    return hasScores ? total : null;
  };

  const frontPar = course.par.slice(0, 9).reduce((sum, p) => sum + p, 0);
  const backPar = course.par.slice(9, 18).reduce((sum, p) => sum + p, 0);

  return (
    <div className="overflow-x-auto">
      {/* Front 9 */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-600 mb-2">Front 9</h3>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-masters-green text-white">
              <th className="p-2 text-left sticky left-0 bg-masters-green">Hole</th>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(hole => (
                <th key={hole} className="p-2 w-10 text-center">
                  {hole}
                </th>
              ))}
              <th className="p-2 w-12 text-center">OUT</th>
            </tr>
            <tr className="bg-gray-100">
              <td className="p-2 text-left sticky left-0 bg-gray-100 font-medium">Par</td>
              {course.par.slice(0, 9).map((par, i) => (
                <td key={i} className="p-2 text-center">
                  {par}
                </td>
              ))}
              <td className="p-2 text-center font-medium">{frontPar}</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="p-2 text-left sticky left-0 bg-gray-50 font-medium">Hdcp</td>
              {course.handicapIndex.slice(0, 9).map((hdcp, i) => (
                <td key={i} className="p-2 text-center text-xs text-gray-500">
                  {hdcp}
                </td>
              ))}
              <td className="p-2"></td>
            </tr>
          </thead>
          <tbody>
            {allPlayerIds.map(playerId => {
              const player = getPlayer(playerId);
              if (!player) return null;
              const playerScores = scoresByPlayer[playerId] || {};
              const alloc = allocMap.get(playerId);
              const total = getPlayerTotal(playerId, true);
              const teamClass = player.team === 'BROWN' ? 'team-brown' : 'team-rusty';

              return (
                <tr key={playerId} className={`${teamClass} border-t border-gray-200`}>
                  <td className={`p-2 text-left sticky left-0 ${teamClass} font-medium text-xs`}>
                    {player.name}
                  </td>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(holeNum => {
                    const score = playerScores[holeNum];
                    const dots = alloc ? getDotsForHole(alloc, holeNum) : 0;
                    const holePar = course.par[holeNum - 1];
                    return (
                      <td key={holeNum} className="p-2 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          {dots > 0 && <HoleDotIndicator dots={dots} size="sm" />}
                          {score ? (
                            <ScoreDisplay grossScore={score.grossScore} par={holePar} size="sm" />
                          ) : (
                            <span className="text-masters-gray">–</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="p-2 text-center font-bold">
                    {total !== null ? total : '–'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Back 9 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-600 mb-2">Back 9</h3>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-masters-green text-white">
              <th className="p-2 text-left sticky left-0 bg-masters-green">Hole</th>
              {[10, 11, 12, 13, 14, 15, 16, 17, 18].map(hole => (
                <th key={hole} className="p-2 w-10 text-center">
                  {hole}
                </th>
              ))}
              <th className="p-2 w-12 text-center">IN</th>
              <th className="p-2 w-12 text-center">TOT</th>
            </tr>
            <tr className="bg-gray-100">
              <td className="p-2 text-left sticky left-0 bg-gray-100 font-medium">Par</td>
              {course.par.slice(9, 18).map((par, i) => (
                <td key={i} className="p-2 text-center">
                  {par}
                </td>
              ))}
              <td className="p-2 text-center font-medium">{backPar}</td>
              <td className="p-2 text-center font-medium">{frontPar + backPar}</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="p-2 text-left sticky left-0 bg-gray-50 font-medium">Hdcp</td>
              {course.handicapIndex.slice(9, 18).map((hdcp, i) => (
                <td key={i} className="p-2 text-center text-xs text-gray-500">
                  {hdcp}
                </td>
              ))}
              <td className="p-2"></td>
              <td className="p-2"></td>
            </tr>
          </thead>
          <tbody>
            {allPlayerIds.map(playerId => {
              const player = getPlayer(playerId);
              if (!player) return null;
              const playerScores = scoresByPlayer[playerId] || {};
              const alloc = allocMap.get(playerId);
              const frontTotal = getPlayerTotal(playerId, true);
              const backTotal = getPlayerTotal(playerId, false);
              const total = frontTotal !== null && backTotal !== null ? frontTotal + backTotal : null;
              const teamClass = player.team === 'BROWN' ? 'team-brown' : 'team-rusty';

              return (
                <tr key={playerId} className={`${teamClass} border-t border-gray-200`}>
                  <td className={`p-2 text-left sticky left-0 ${teamClass} font-medium text-xs`}>
                    {player.name}
                  </td>
                  {[10, 11, 12, 13, 14, 15, 16, 17, 18].map(holeNum => {
                    const score = playerScores[holeNum];
                    const dots = alloc ? getDotsForHole(alloc, holeNum) : 0;
                    const holePar = course.par[holeNum - 1];
                    return (
                      <td key={holeNum} className="p-2 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          {dots > 0 && <HoleDotIndicator dots={dots} size="sm" />}
                          {score ? (
                            <ScoreDisplay grossScore={score.grossScore} par={holePar} size="sm" />
                          ) : (
                            <span className="text-masters-gray">–</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="p-2 text-center font-bold">
                    {backTotal !== null ? backTotal : '–'}
                  </td>
                  <td className="p-2 text-center font-bold">
                    {total !== null ? total : '–'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
