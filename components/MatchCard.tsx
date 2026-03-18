'use client';

import Link from 'next/link';
import { Match, HoleScore, DotAllocation } from '@/lib/types';
import { getPlayer, COURSES } from '@/lib/constants';
import { getHoleByHoleStatus } from '@/lib/scoring';

interface MatchCardProps {
  match: Match;
  scores?: HoleScore[];
  dotAllocations?: DotAllocation[];
}

/**
 * Match card showing team matchup with live status.
 * Shows F9/B9 status, current hole progress, and status badge.
 */
export default function MatchCard({ match, scores = [], dotAllocations = [] }: MatchCardProps) {
  const team1Players = match.team1Players.map(id => getPlayer(id)).filter(Boolean);
  const team2Players = match.team2Players.map(id => getPlayer(id)).filter(Boolean);

  // Determine team colors based on player affiliations
  const team1HasBrown = team1Players.some(p => p?.team === 'BROWN');
  const team1Label = team1Players.map(p => p!.name.split(' ')[0]).join('/');
  const team2Label = team2Players.map(p => p!.name.split(' ')[0]).join('/');

  // Calculate live match status
  const holeStatus = scores.length > 0 ? getHoleByHoleStatus(match, scores, dotAllocations) : [];
  const holesPlayed = holeStatus.filter(h => h.winner !== null).length;

  // Calculate F9 and B9 status
  const front9 = holeStatus.slice(0, 9);
  const back9 = holeStatus.slice(9, 18);

  const front9Team1Wins = front9.filter(h => h.winner === 'team1').length;
  const front9Team2Wins = front9.filter(h => h.winner === 'team2').length;
  const back9Team1Wins = back9.filter(h => h.winner === 'team1').length;
  const back9Team2Wins = back9.filter(h => h.winner === 'team2').length;

  const front9Diff = front9Team1Wins - front9Team2Wins;
  const back9Diff = back9Team1Wins - back9Team2Wins;

  const getStatusText = () => {
    if (match.status === 'not_started') return null;
    if (match.status === 'complete') {
      // Show final result
      const f9Winner = front9Diff > 0 ? (team1HasBrown ? 'Brown' : 'Rusty') : front9Diff < 0 ? (team1HasBrown ? 'Rusty' : 'Brown') : 'Halved';
      const b9Winner = back9Diff > 0 ? (team1HasBrown ? 'Brown' : 'Rusty') : back9Diff < 0 ? (team1HasBrown ? 'Rusty' : 'Brown') : 'Halved';
      return `F9: ${f9Winner} · B9: ${b9Winner}`;
    }

    // In progress
    const parts: string[] = [];

    if (holesPlayed >= 1) {
      const f9Played = front9.filter(h => h.winner !== null).length;
      if (f9Played > 0) {
        if (front9Diff > 0) {
          parts.push(`F9: ${team1HasBrown ? 'Brown' : 'Rusty'} +${Math.abs(front9Diff)}`);
        } else if (front9Diff < 0) {
          parts.push(`F9: ${team1HasBrown ? 'Rusty' : 'Brown'} +${Math.abs(front9Diff)}`);
        } else {
          parts.push('F9: AS');
        }
      }
    }

    if (holesPlayed > 9) {
      const b9Played = back9.filter(h => h.winner !== null).length;
      if (b9Played > 0) {
        if (back9Diff > 0) {
          parts.push(`B9: ${team1HasBrown ? 'Brown' : 'Rusty'} +${Math.abs(back9Diff)}`);
        } else if (back9Diff < 0) {
          parts.push(`B9: ${team1HasBrown ? 'Rusty' : 'Brown'} +${Math.abs(back9Diff)}`);
        } else {
          parts.push('B9: AS');
        }
      }
    }

    return parts.length > 0 ? parts.join(' · ') : null;
  };

  const getPointsDisplay = () => {
    if (!match.result) return null;
    const { team1Points, team2Points } = match.result;
    const brownPts = team1HasBrown ? team1Points : team2Points;
    const rustyPts = team1HasBrown ? team2Points : team1Points;
    return `Brown ${brownPts} – ${rustyPts} Rusty`;
  };

  const statusText = getStatusText();
  const pointsDisplay = getPointsDisplay();

  return (
    <Link href={`/match/${match.id}`}>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer">
        {/* Matchup */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex-1">
            <p className="font-medium text-masters-black text-sm">
              <span className={team1HasBrown ? 'text-amber-700' : 'text-orange-600'}>{team1Label}</span>
              <span className="text-masters-gray mx-2">vs</span>
              <span className={!team1HasBrown ? 'text-amber-700' : 'text-orange-600'}>{team2Label}</span>
            </p>
          </div>

          {/* Status Badge */}
          <div className="flex-shrink-0 ml-2">
            {match.status === 'in_progress' && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-masters-light-green text-masters-green">
                <span className="w-1.5 h-1.5 rounded-full bg-masters-green animate-pulse" />
                LIVE
              </span>
            )}
            {match.status === 'complete' && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-masters-gray">
                FINAL
              </span>
            )}
            {match.status === 'not_started' && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-masters-gray">
                NOT STARTED
              </span>
            )}
          </div>
        </div>

        {/* Match Status */}
        {statusText && (
          <p className="text-xs text-masters-gray mb-1">
            {statusText}
            {match.status === 'in_progress' && ` · Thru ${holesPlayed}`}
          </p>
        )}

        {/* Points Display (Final only) */}
        {pointsDisplay && match.status === 'complete' && (
          <p className="text-xs font-medium text-masters-gold">{pointsDisplay}</p>
        )}

        {/* Tap to start */}
        {match.status === 'not_started' && (
          <p className="text-xs text-masters-gray">Tap to enter scores</p>
        )}
      </div>
    </Link>
  );
}
