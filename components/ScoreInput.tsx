'use client';

import { useState, useEffect } from 'react';
import HoleDotIndicator from './HoleDotIndicator';
import ScoreDisplay from './ScoreDisplay';

interface ScoreInputProps {
  playerId: string;
  playerName: string;
  hole: number;
  par: number;
  dots: number;
  currentScore?: number;
  onScoreChange: (playerId: string, hole: number, score: number) => void;
  disabled?: boolean;
}

/**
 * Mobile-friendly score input for a single player on a single hole.
 * Shows +/- buttons for quick score entry with Masters-style score display.
 */
export default function ScoreInput({
  playerId,
  playerName,
  hole,
  par,
  dots,
  currentScore,
  onScoreChange,
  disabled = false,
}: ScoreInputProps) {
  const [score, setScore] = useState<number | undefined>(currentScore);

  // Reset when hole changes
  useEffect(() => {
    setScore(currentScore);
  }, [hole, currentScore]);

  const handleScoreChange = (newScore: number) => {
    if (newScore < 1 || newScore > 15) return;
    setScore(newScore);
    onScoreChange(playerId, hole, newScore);
  };

  return (
    <div className={`flex items-center justify-between p-3 bg-white rounded-lg shadow-sm border border-gray-200 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex flex-col">
        <span className="font-medium text-masters-black">{playerName}</span>
        <div className="flex items-center gap-1">
          <HoleDotIndicator dots={dots} size="sm" />
          {dots > 0 && <span className="text-xs text-masters-gray">({dots} stroke{dots > 1 ? 's' : ''})</span>}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => handleScoreChange((score || par) - 1)}
          disabled={disabled || (score !== undefined && score <= 1)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-masters-light-green text-masters-green text-xl font-bold disabled:opacity-30 active:bg-masters-green active:text-white transition-colors"
          aria-label="Decrease score"
        >
          −
        </button>

        <div className="w-14 h-14 flex items-center justify-center">
          {score !== undefined ? (
            <ScoreDisplay grossScore={score} par={par} size="lg" />
          ) : (
            <span className="text-2xl font-bold text-masters-gray">–</span>
          )}
        </div>

        <button
          type="button"
          onClick={() => handleScoreChange((score || par) + 1)}
          disabled={disabled || (score !== undefined && score >= 15)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-masters-light-green text-masters-green text-xl font-bold disabled:opacity-30 active:bg-masters-green active:text-white transition-colors"
          aria-label="Increase score"
        >
          +
        </button>
      </div>
    </div>
  );
}
