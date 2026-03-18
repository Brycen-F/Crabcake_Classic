'use client';

import { useState } from 'react';
import { PLAYERS, COURSES, getTeamPlayers } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import { Match } from '@/lib/types';

const STORAGE_KEY = 'crabcake_round3_matches';

interface StoredMatch {
  id: string;
  round: number;
  format: string;
  course_id: string;
  team1_players: string[];
  team2_players: string[];
  label: string;
  status: string;
  current_hole: number;
}

function saveToLocalStorage(matches: StoredMatch[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
  }
}

function loadFromLocalStorage(): StoredMatch[] {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return [];
      }
    }
  }
  return [];
}

interface Round3SetupProps {
  existingMatches: Match[];
  onMatchCreated: () => void;
  onMatchDeleted: () => void;
}

export default function Round3Setup({ existingMatches, onMatchCreated, onMatchDeleted }: Round3SetupProps) {
  const [selectedBrown, setSelectedBrown] = useState<string | null>(null);
  const [selectedRusty, setSelectedRusty] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const brownPlayers = getTeamPlayers('BROWN');
  const rustyPlayers = getTeamPlayers('RUSTY');
  const course = COURSES.TOBACCO_ROAD;

  // Players already in a match
  const usedBrownIds = existingMatches.map(m => m.team1Players[0]);
  const usedRustyIds = existingMatches.map(m => m.team2Players[0]);

  const handleBrownSelect = (playerId: string) => {
    if (usedBrownIds.includes(playerId)) return;
    setSelectedBrown(selectedBrown === playerId ? null : playerId);
  };

  const handleRustySelect = (playerId: string) => {
    if (usedRustyIds.includes(playerId)) return;
    setSelectedRusty(selectedRusty === playerId ? null : playerId);
  };

  const selectedBrownPlayer = PLAYERS.find(p => p.id === selectedBrown);
  const selectedRustyPlayer = PLAYERS.find(p => p.id === selectedRusty);
  const canAddMatch = selectedBrown && selectedRusty;

  const addMatch = async () => {
    if (!selectedBrown || !selectedRusty) return;

    setSaving(true);
    // Use crypto.randomUUID() to prevent ID collisions when multiple people create matches
    const matchId = `r3-${crypto.randomUUID().slice(0, 8)}`;
    const brownPlayer = PLAYERS.find(p => p.id === selectedBrown);
    const rustyPlayer = PLAYERS.find(p => p.id === selectedRusty);

    const storedMatch: StoredMatch = {
      id: matchId,
      round: 3,
      format: 'singles',
      course_id: 'TOBACCO_ROAD',
      team1_players: [selectedBrown],
      team2_players: [selectedRusty],
      label: `${brownPlayer?.name} vs ${rustyPlayer?.name}`,
      status: 'not_started',
      current_hole: 1,
    };

    // Save to Supabase
    try {
      const { error } = await supabase.from('matches').upsert(storedMatch);
      if (error) throw error;
    } catch (err) {
      console.log('Supabase not connected, using localStorage');
    }

    // Always save to localStorage as backup
    const currentStored = loadFromLocalStorage();
    saveToLocalStorage([...currentStored, storedMatch]);

    setSelectedBrown(null);
    setSelectedRusty(null);
    setSaving(false);
    onMatchCreated();
  };

  const deleteMatch = async (matchId: string) => {
    // Delete from Supabase
    try {
      await supabase.from('matches').delete().eq('id', matchId);
    } catch (err) {
      console.log('Supabase not connected');
    }

    // Delete from localStorage
    const currentStored = loadFromLocalStorage();
    saveToLocalStorage(currentStored.filter(m => m.id !== matchId));

    onMatchDeleted();
  };

  const allMatchesCreated = existingMatches.length >= 6;

  return (
    <div className="bg-white">
      {/* Header */}
      <div className="px-4 py-3 bg-masters-green/10 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-masters-black">Day 2 Singles</h3>
            <p className="text-xs text-masters-gray">{course.name}</p>
          </div>
          <span className="text-sm text-masters-gray">{existingMatches.length}/6 matches</span>
        </div>
      </div>

      {/* Player Selection - only show if not all matches created */}
      {!allMatchesCreated && (
        <div className="p-4 border-b border-gray-100">
          <div className="grid grid-cols-2 gap-4">
            {/* Team Brown */}
            <div>
              <h4 className="font-semibold text-masters-black text-xs mb-2 text-center">Brown</h4>
              <div className="flex flex-col gap-1.5">
                {brownPlayers.map(player => {
                  const isUsed = usedBrownIds.includes(player.id);
                  const isSelected = selectedBrown === player.id;
                  return (
                    <button
                      key={player.id}
                      onClick={() => handleBrownSelect(player.id)}
                      disabled={isUsed}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between ${
                        isUsed
                          ? 'bg-masters-green/10 text-masters-green line-through opacity-60 cursor-not-allowed'
                          : isSelected
                          ? 'bg-masters-green text-white ring-2 ring-masters-green ring-offset-1'
                          : 'bg-gray-100 text-masters-black hover:bg-gray-200'
                      }`}
                    >
                      <span>{player.name.split(' ')[0]}</span>
                      <span className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-masters-gray'}`}>
                        {player.handicap}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Team Rusty */}
            <div>
              <h4 className="font-medium text-masters-gray text-xs mb-2 text-center">Rusty</h4>
              <div className="flex flex-col gap-1.5">
                {rustyPlayers.map(player => {
                  const isUsed = usedRustyIds.includes(player.id);
                  const isSelected = selectedRusty === player.id;
                  return (
                    <button
                      key={player.id}
                      onClick={() => handleRustySelect(player.id)}
                      disabled={isUsed}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between ${
                        isUsed
                          ? 'bg-masters-green/10 text-masters-green line-through opacity-60 cursor-not-allowed'
                          : isSelected
                          ? 'bg-masters-green text-white ring-2 ring-masters-green ring-offset-1'
                          : 'bg-gray-100 text-masters-black hover:bg-gray-200'
                      }`}
                    >
                      <span>{player.name.split(' ')[0]}</span>
                      <span className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-masters-gray'}`}>
                        {player.handicap}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Add Match Button */}
          {canAddMatch && (
            <button
              onClick={addMatch}
              disabled={saving}
              className="w-full mt-3 py-2.5 bg-masters-green text-white font-bold rounded-lg hover:bg-masters-green/90 transition-colors disabled:opacity-50 text-sm"
            >
              {saving ? 'Adding...' : `Add: ${selectedBrownPlayer?.name.split(' ')[0]} vs ${selectedRustyPlayer?.name.split(' ')[0]}`}
            </button>
          )}

          {!canAddMatch && existingMatches.length === 0 && (
            <p className="text-center text-xs text-masters-gray mt-3">
              Tap one player from each team to create a match
            </p>
          )}
        </div>
      )}

      {/* Existing Matches */}
      {existingMatches.length > 0 && (
        <div>
          {existingMatches.map((match, idx) => {
            const brownName = PLAYERS.find(p => p.id === match.team1Players[0])?.name || '';
            const rustyName = PLAYERS.find(p => p.id === match.team2Players[0])?.name || '';

            return (
              <div
                key={match.id}
                className={`flex items-center justify-between px-4 py-3 ${
                  idx !== existingMatches.length - 1 ? 'border-b border-gray-100' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-masters-green text-white text-xs font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div className="text-sm">
                    <span className="font-semibold text-masters-black">{brownName.split(' ')[0]}</span>
                    <span className="text-masters-gray mx-1.5">vs</span>
                    <span className="font-medium text-masters-gray">{rustyName.split(' ')[0]}</span>
                  </div>
                </div>
                <button
                  onClick={() => deleteMatch(match.id)}
                  className="w-7 h-7 rounded-full text-red-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* All Done Message */}
      {allMatchesCreated && (
        <div className="px-4 py-3 bg-green-50 text-green-700 text-sm text-center">
          All 6 singles matches are set up!
        </div>
      )}
    </div>
  );
}
