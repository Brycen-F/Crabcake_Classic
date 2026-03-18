'use client';

import { DotAllocation } from '@/lib/types';
import { getDotsForHole } from '@/lib/scoring';

// Full interface for looking up dots from allocations
interface FullHoleDotIndicatorProps {
  playerId: string;
  holeNumber: number;
  dots: DotAllocation[];
  courseHandicapRank?: number; // The HDCP ranking for this hole (1 = hardest)
  showEmpty?: boolean; // Show faint circle when no dot
  size?: 'sm' | 'md';
}

// Simple interface when dot count is already computed
interface SimpleHoleDotIndicatorProps {
  dots: number; // Pre-computed dot count
  showEmpty?: boolean;
  size?: 'sm' | 'md';
}

type HoleDotIndicatorProps = FullHoleDotIndicatorProps | SimpleHoleDotIndicatorProps;

// Type guard to check if using simple interface
function isSimpleProps(props: HoleDotIndicatorProps): props is SimpleHoleDotIndicatorProps {
  return typeof props.dots === 'number';
}

/**
 * Visual indicator for handicap strokes (dots) on a specific hole for a specific player.
 *
 * Two usage modes:
 * 1. Simple: Pass `dots` as a number (pre-computed count)
 * 2. Full: Pass `playerId`, `holeNumber`, and `dots` array to look up the count
 *
 * Shows:
 * - Filled gold circle(s) if player gets stroke(s) on this hole
 * - Faint empty circle if showEmpty=true and no strokes
 * - Nothing if showEmpty=false and no strokes
 *
 * Tooltip shows: "Gets a stroke (HDCP X, Y total strokes)"
 */
export default function HoleDotIndicator(props: HoleDotIndicatorProps) {
  const { showEmpty = false, size = 'sm' } = props;

  let dotsOnHole: number;
  let courseHandicapRank: number | undefined;
  let allocation: DotAllocation | undefined;

  if (isSimpleProps(props)) {
    // Simple mode: dots is already a number
    dotsOnHole = props.dots;
  } else {
    // Full mode: look up dots from allocations
    allocation = props.dots.find(d => d.playerId === props.playerId);
    dotsOnHole = allocation ? getDotsForHole(allocation, props.holeNumber) : 0;
    courseHandicapRank = props.courseHandicapRank;
  }

  const sizeClasses = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
  };

  if (dotsOnHole === 0) {
    if (!showEmpty) return null;
    // No dot - render faint empty circle
    return (
      <span className={`${sizeClasses[size]} rounded-full border border-gray-300 inline-block opacity-30`} />
    );
  }

  // Build tooltip text
  const strokeText = dotsOnHole > 1 ? `${dotsOnHole} strokes` : 'a stroke';
  const hdcpText = courseHandicapRank ? `HDCP ${courseHandicapRank}` : '';
  const totalText = allocation && allocation.strokesReceived > 0
    ? `${allocation.strokesReceived} total`
    : '';
  const tooltipParts = [hdcpText, totalText].filter(Boolean).join(', ');
  const tooltipText = `Gets ${strokeText}${tooltipParts ? ` (${tooltipParts})` : ''}`;

  return (
    <span
      className="inline-flex items-center gap-0.5"
      title={tooltipText}
    >
      {Array.from({ length: dotsOnHole }).map((_, i) => (
        <span
          key={i}
          className={`${sizeClasses[size]} rounded-full bg-masters-gold inline-block`}
        />
      ))}
    </span>
  );
}
