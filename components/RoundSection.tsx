'use client';

import { useState } from 'react';
import { Match, HoleScore, DotAllocation } from '@/lib/types';
import { COURSES } from '@/lib/constants';
import MatchCard from './MatchCard';

interface RoundSectionProps {
  round: number;
  courseId: string;
  matches: Match[];
  allScores: HoleScore[];
  allDotAllocations: Map<string, DotAllocation[]>;
  defaultOpen?: boolean;
}

/**
 * Collapsible round section showing all matches for a round.
 */
export default function RoundSection({
  round,
  courseId,
  matches,
  allScores,
  allDotAllocations,
  defaultOpen = true,
}: RoundSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const course = COURSES[courseId];

  const hasLiveMatch = matches.some(m => m.status === 'in_progress');
  const allComplete = matches.length > 0 && matches.every(m => m.status === 'complete');

  return (
    <div className="overflow-hidden">
      {/* Round Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-masters-green px-4 py-3 flex items-center justify-between rounded-t-lg"
      >
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-full bg-white/20 text-white flex items-center justify-center text-sm font-bold">
            {round}
          </span>
          <div className="text-left">
            <h3 className="text-white font-medium text-sm">
              Round {round} — {course?.name || 'TBD'}
            </h3>
            {course?.tees && (
              <p className="text-white/70 text-xs">{course.tees}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasLiveMatch && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              LIVE
            </span>
          )}
          {allComplete && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white">
              COMPLETE
            </span>
          )}
          <svg
            className={`w-5 h-5 text-white transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Matches */}
      {isOpen && (
        <div className="bg-masters-light-green rounded-b-lg p-3 space-y-2">
          {matches.length > 0 ? (
            matches.map(match => {
              const matchScores = allScores.filter(s => s.matchId === match.id);
              const matchDots = allDotAllocations.get(match.id) || [];
              return (
                <MatchCard
                  key={match.id}
                  match={match}
                  scores={matchScores}
                  dotAllocations={matchDots}
                />
              );
            })
          ) : (
            <div className="bg-white rounded-lg p-4 text-center">
              <p className="text-sm text-masters-gray">
                {round === 3
                  ? 'Singles matchups will be set by captains after Round 2'
                  : 'No matches scheduled'}
              </p>
              {round === 3 && (
                <a
                  href="/admin"
                  className="inline-block mt-2 px-3 py-1.5 bg-masters-green text-white rounded text-xs font-medium hover:bg-masters-green/90 transition-colors"
                >
                  Set Up Round 3
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
