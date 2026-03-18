'use client';

import { getScoreDisplay } from '@/lib/scoring';

interface ScoreDisplayProps {
  grossScore: number;
  par: number;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Masters-style score display component.
 * Matches the official Masters scorecard styling:
 * - Eagle: double circle (green outline)
 * - Birdie: single circle (green outline)
 * - Par: plain number
 * - Bogey: single square (green outline)
 * - Double+: double square (green outline)
 */
export default function ScoreDisplay({ grossScore, par, size = 'md' }: ScoreDisplayProps) {
  const scoreType = getScoreDisplay(grossScore, par);

  const sizeConfig = {
    sm: { outer: 'w-6 h-6', inner: 'w-4 h-4', text: 'text-xs', border: 'border' },
    md: { outer: 'w-8 h-8', inner: 'w-6 h-6', text: 'text-sm', border: 'border-2' },
    lg: { outer: 'w-12 h-12', inner: 'w-9 h-9', text: 'text-xl', border: 'border-2' },
  };

  const config = sizeConfig[size];

  // Eagle: double circle
  if (scoreType === 'eagle') {
    return (
      <div className={`relative inline-flex items-center justify-center ${config.outer}`}>
        <div className={`absolute inset-0 rounded-full ${config.border} border-masters-green`} />
        <div className={`absolute rounded-full ${config.border} border-masters-green ${config.inner}`} />
        <span className={`relative z-10 font-bold text-masters-green ${config.text}`}>{grossScore}</span>
      </div>
    );
  }

  // Birdie: single circle
  if (scoreType === 'birdie') {
    return (
      <div className={`inline-flex items-center justify-center rounded-full ${config.border} border-masters-green ${config.outer}`}>
        <span className={`font-bold text-masters-green ${config.text}`}>{grossScore}</span>
      </div>
    );
  }

  // Par: plain number
  if (scoreType === 'par') {
    return (
      <div className={`inline-flex items-center justify-center ${config.outer}`}>
        <span className={`font-medium text-masters-black ${config.text}`}>{grossScore}</span>
      </div>
    );
  }

  // Bogey: single square
  if (scoreType === 'bogey') {
    return (
      <div className={`inline-flex items-center justify-center ${config.border} border-masters-green ${config.outer}`}>
        <span className={`font-bold text-masters-green ${config.text}`}>{grossScore}</span>
      </div>
    );
  }

  // Double bogey+: double square
  return (
    <div className={`relative inline-flex items-center justify-center ${config.outer}`}>
      <div className={`absolute inset-0 ${config.border} border-masters-green`} />
      <div className={`absolute ${config.border} border-masters-green ${config.inner}`} />
      <span className={`relative z-10 font-bold text-masters-green ${config.text}`}>{grossScore}</span>
    </div>
  );
}

/**
 * Score legend component for displaying on scorecards
 */
export function ScoreLegend() {
  return (
    <div className="flex items-center gap-4 text-xs text-masters-gray">
      <div className="flex items-center gap-1.5">
        <div className="relative w-5 h-5">
          <div className="absolute inset-0 rounded-full border border-masters-green" />
          <div className="absolute inset-0.5 rounded-full border border-masters-green" />
        </div>
        <span>Eagle</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-5 h-5 rounded-full border border-masters-green" />
        <span>Birdie</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-5 h-5 border border-masters-green" />
        <span>Bogey</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="relative w-5 h-5">
          <div className="absolute inset-0 border border-masters-green" />
          <div className="absolute inset-0.5 border border-masters-green" />
        </div>
        <span>D Bogey +</span>
      </div>
    </div>
  );
}
