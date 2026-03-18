'use client';

import { Match } from '@/lib/types';
import { calculateTeamStandings } from '@/lib/scoring';

interface LeaderboardProps {
  matches: Match[];
}

/**
 * Team Points Hero Section - Shows Brown vs Rusty standings.
 * Side-by-side cards with large gold point numerals.
 * Leading team gets a gold border.
 */
export default function Leaderboard({ matches }: LeaderboardProps) {
  const standings = calculateTeamStandings(matches);
  const brownLeading = standings.brown.points > standings.rusty.points;
  const rustyLeading = standings.rusty.points > standings.brown.points;
  const tied = standings.brown.points === standings.rusty.points;

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Team Brown Card */}
      <div
        className={`bg-white rounded-xl p-4 text-center shadow-md ${
          brownLeading ? 'ring-2 ring-masters-gold' : ''
        }`}
      >
        <div className="w-10 h-10 mx-auto rounded-full bg-amber-700 flex items-center justify-center mb-2">
          <span className="text-white font-bold text-lg">B</span>
        </div>
        <h3 className="font-serif font-bold text-masters-black">Team Brown</h3>
        <p className="text-3xl font-bold text-masters-gold mt-2 font-sans">
          {standings.brown.points.toFixed(1)}
        </p>
        <p className="text-xs text-masters-gray mt-1">pts</p>
      </div>

      {/* Team Rusty Card */}
      <div
        className={`bg-white rounded-xl p-4 text-center shadow-md ${
          rustyLeading ? 'ring-2 ring-masters-gold' : ''
        }`}
      >
        <div className="w-10 h-10 mx-auto rounded-full bg-orange-600 flex items-center justify-center mb-2">
          <span className="text-white font-bold text-lg">R</span>
        </div>
        <h3 className="font-serif font-bold text-masters-black">Team Rusty</h3>
        <p className="text-3xl font-bold text-masters-gold mt-2 font-sans">
          {standings.rusty.points.toFixed(1)}
        </p>
        <p className="text-xs text-masters-gray mt-1">pts</p>
      </div>
    </div>
  );
}
