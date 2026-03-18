'use client';

import { DotAllocation } from '@/lib/types';
import HoleDotIndicator from './HoleDotIndicator';

interface PlayerDotRowProps {
  playerId: string;
  playerName: string;
  dots: DotAllocation[];
  courseHandicapRanks?: number[]; // length 18, the HDCP rank per hole (1 = hardest)
  totalStrokes?: number;
  showHoleNumbers?: boolean;
  compact?: boolean;
}

/**
 * Shows all 18 holes in a horizontal strip for one player.
 * Each hole cell: small number + dot indicator underneath.
 * Used in the scorecard table header area to visualize all dots at a glance.
 *
 * Displays:
 * - Player name and total strokes received (if provided)
 * - 18 hole cells showing hole number and dot indicator
 */
export default function PlayerDotRow({
  playerId,
  playerName,
  dots,
  courseHandicapRanks,
  totalStrokes,
  showHoleNumbers = true,
  compact = false,
}: PlayerDotRowProps) {
  const allocation = dots.find(d => d.playerId === playerId);
  const strokeCount = totalStrokes ?? allocation?.strokesReceived ?? 0;

  return (
    <div className={`${compact ? 'py-1' : 'py-2'}`}>
      {/* Player info header */}
      <div className="flex items-center justify-between mb-1">
        <span className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-masters-black`}>
          {playerName}
        </span>
        {strokeCount > 0 && (
          <span className={`${compact ? 'text-[10px]' : 'text-xs'} text-masters-gray`}>
            {strokeCount} stroke{strokeCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* 18 hole strip */}
      <div className="flex gap-0.5 overflow-x-auto">
        {Array.from({ length: 18 }).map((_, i) => {
          const holeNumber = i + 1;
          const hdcpRank = courseHandicapRanks ? courseHandicapRanks[i] : undefined;

          return (
            <div
              key={holeNumber}
              className={`flex flex-col items-center ${compact ? 'min-w-[14px]' : 'min-w-[18px]'}`}
            >
              {/* Hole number */}
              {showHoleNumbers && (
                <span className={`${compact ? 'text-[8px]' : 'text-[10px]'} text-masters-gray leading-none`}>
                  {holeNumber}
                </span>
              )}
              {/* Dot indicator */}
              <div className={`${showHoleNumbers ? 'mt-0.5' : ''} flex items-center justify-center h-3`}>
                <HoleDotIndicator
                  playerId={playerId}
                  holeNumber={holeNumber}
                  dots={dots}
                  courseHandicapRank={hdcpRank}
                  showEmpty={true}
                  size="sm"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
