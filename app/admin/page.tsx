'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { PRESET_MATCHUPS, PLAYERS, COURSES, getTeamPlayers } from '@/lib/constants';
import { Match } from '@/lib/types';

const STORAGE_KEY = 'crabcake_round3_matches';
const SCORES_STORAGE_KEY = 'crabcake_scores';

interface MatchEdit {
  id: string;
  round: number;
  courseId: string;
  team1Players: string[];
  team2Players: string[];
  label: string;
}

export default function AdminPage() {
  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchEdit[]>([]);
  const [editingMatch, setEditingMatch] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load matches on mount
  useEffect(() => {
    async function loadMatches() {
      // Start with presets for R1/R2
      const presetMatches: MatchEdit[] = PRESET_MATCHUPS.map(m => ({
        id: m.id,
        round: m.round,
        courseId: m.course,
        team1Players: m.team1,
        team2Players: m.team2,
        label: m.label,
      }));

      // Try to load from Supabase
      try {
        const { data, error } = await supabase
          .from('matches')
          .select('*')
          .order('round', { ascending: true });

        if (!error && data && data.length > 0) {
          const supabaseMatches: MatchEdit[] = data.map(m => ({
            id: m.id,
            round: m.round,
            courseId: m.course_id,
            team1Players: m.team1_players,
            team2Players: m.team2_players,
            label: m.label,
          }));

          // Merge: prefer Supabase data
          const supabaseIds = new Set(supabaseMatches.map(m => m.id));
          const merged = [
            ...presetMatches.filter(m => !supabaseIds.has(m.id)),
            ...supabaseMatches,
          ].sort((a, b) => {
            if (a.round !== b.round) return a.round - b.round;
            return a.id.localeCompare(b.id);
          });
          setMatches(merged);
          return;
        }
      } catch (err) {
        console.log('Using preset matches');
      }

      setMatches(presetMatches);
    }
    loadMatches();
  }, []);

  const resetAllData = async () => {
    setResetting(true);
    setMessage(null);

    try {
      // Clear Supabase - use gt for UUID and gte for proper clearing
      const { error: scoresError } = await supabase
        .from('hole_scores')
        .delete()
        .gte('created_at', '1970-01-01');

      const { error: matchesError } = await supabase
        .from('matches')
        .delete()
        .gte('created_at', '1970-01-01');

      if (scoresError || matchesError) {
        console.log('Supabase errors:', scoresError, matchesError);
      }

      setMessage('All data has been reset!');
    } catch (err) {
      console.log('Reset error:', err);
      setMessage('Reset complete');
    }

    // Clear all localStorage
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SCORES_STORAGE_KEY);

    // Reset matches to presets
    const presetMatches: MatchEdit[] = PRESET_MATCHUPS.map(m => ({
      id: m.id,
      round: m.round,
      courseId: m.course,
      team1Players: m.team1,
      team2Players: m.team2,
      label: m.label,
    }));
    setMatches(presetMatches);

    setShowResetConfirm(false);
    setResetting(false);
  };

  const swapPlayer = async (matchId: string, team: 'team1' | 'team2', playerIndex: number, newPlayerId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    const updatedPlayers = team === 'team1'
      ? [...match.team1Players]
      : [...match.team2Players];
    updatedPlayers[playerIndex] = newPlayerId;

    const updatedMatch = {
      ...match,
      [team === 'team1' ? 'team1Players' : 'team2Players']: updatedPlayers,
    };

    // Update label
    const t1Names = updatedMatch.team1Players.map(id => PLAYERS.find(p => p.id === id)?.name.split(' ')[0]).join('/');
    const t2Names = updatedMatch.team2Players.map(id => PLAYERS.find(p => p.id === id)?.name.split(' ')[0]).join('/');
    updatedMatch.label = `${t1Names} vs ${t2Names}`;

    // Update state
    setMatches(prev => prev.map(m => m.id === matchId ? updatedMatch : m));

    // Save to Supabase
    setSaving(true);
    try {
      await supabase.from('matches').upsert({
        id: matchId,
        round: updatedMatch.round,
        format: updatedMatch.team1Players.length === 1 ? 'singles' : 'fourball',
        course_id: updatedMatch.courseId,
        team1_players: updatedMatch.team1Players,
        team2_players: updatedMatch.team2Players,
        label: updatedMatch.label,
        status: 'not_started',
        current_hole: 1,
      });
    } catch (err) {
      console.log('Save error');
    }
    setSaving(false);
    setEditingMatch(null);
  };

  const brownPlayers = getTeamPlayers('BROWN');
  const rustyPlayers = getTeamPlayers('RUSTY');

  const getAvailablePlayers = (team: 'BROWN' | 'RUSTY') => {
    // Show all players from the team - admin can swap freely
    return team === 'BROWN' ? brownPlayers : rustyPlayers;
  };

  return (
    <div className="min-h-screen bg-masters-cream -mx-4 -mt-6">
      {/* Header */}
      <div className="bg-masters-green px-4 py-5">
        <h1 className="text-xl font-serif font-bold text-white text-center">
          Admin Settings
        </h1>
        <p className="text-masters-gold text-sm text-center mt-1">
          Crabcake Classic
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Message */}
        {message && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-700 text-sm">
            {message}
          </div>
        )}

        {/* Match Editor */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-masters-black">Edit Matchups</h2>
            <p className="text-sm text-masters-gray mt-1">
              Tap a player to change them. Handicaps auto-calculate per course.
            </p>
          </div>

          {[1, 2].map(round => (
            <div key={round}>
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                <span className="text-xs font-semibold text-masters-gray uppercase tracking-wide">
                  Round {round} — {round === 1 ? 'Mid Pines' : 'Pine Needles'}
                </span>
              </div>
              {matches.filter(m => m.round === round).map(match => {
                const isEditing = editingMatch === match.id;
                return (
                  <div key={match.id} className="px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      {/* Team 1 */}
                      <div className="flex-1">
                        {match.team1Players.map((playerId, idx) => {
                          const player = PLAYERS.find(p => p.id === playerId);
                          const team = player?.team || 'BROWN';
                          if (isEditing) {
                            return (
                              <select
                                key={idx}
                                value={playerId}
                                onChange={(e) => swapPlayer(match.id, 'team1', idx, e.target.value)}
                                className="w-full mb-1 px-2 py-1.5 text-sm border rounded-lg bg-white"
                              >
                                {getAvailablePlayers(team as 'BROWN' | 'RUSTY').map(p => (
                                  <option key={p.id} value={p.id}>
                                    {p.name.split(' ')[0]} ({p.handicap})
                                  </option>
                                ))}
                              </select>
                            );
                          }
                          return (
                            <div key={idx} className="text-sm font-medium text-masters-black">
                              {player?.name.split(' ')[0]}
                            </div>
                          );
                        })}
                      </div>

                      <span className="text-xs text-masters-gray">vs</span>

                      {/* Team 2 */}
                      <div className="flex-1 text-right">
                        {match.team2Players.map((playerId, idx) => {
                          const player = PLAYERS.find(p => p.id === playerId);
                          const team = player?.team || 'RUSTY';
                          if (isEditing) {
                            return (
                              <select
                                key={idx}
                                value={playerId}
                                onChange={(e) => swapPlayer(match.id, 'team2', idx, e.target.value)}
                                className="w-full mb-1 px-2 py-1.5 text-sm border rounded-lg bg-white"
                              >
                                {getAvailablePlayers(team as 'BROWN' | 'RUSTY').map(p => (
                                  <option key={p.id} value={p.id}>
                                    {p.name.split(' ')[0]} ({p.handicap})
                                  </option>
                                ))}
                              </select>
                            );
                          }
                          return (
                            <div key={idx} className="text-sm text-masters-gray">
                              {player?.name.split(' ')[0]}
                            </div>
                          );
                        })}
                      </div>

                      {/* Edit button */}
                      <button
                        onClick={() => setEditingMatch(isEditing ? null : match.id)}
                        className={`ml-2 px-2 py-1 text-xs rounded ${
                          isEditing
                            ? 'bg-masters-green text-white'
                            : 'text-masters-green border border-masters-green'
                        }`}
                      >
                        {isEditing ? (saving ? '...' : 'Done') : 'Edit'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {/* Round 3 info */}
          <div className="px-4 py-3 bg-gray-50">
            <p className="text-xs text-masters-gray">
              Round 3 singles → Set up on Leaderboard, Round 3 tab
            </p>
          </div>
        </div>

        {/* Reset Data Card */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-masters-black">Reset Tournament</h2>
            <p className="text-sm text-masters-gray mt-1">
              Clear all scores and start fresh
            </p>
          </div>
          <div className="p-4">
            {!showResetConfirm ? (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="w-full py-3 border-2 border-red-500 text-red-500 font-bold rounded-xl hover:bg-red-50 transition-colors"
              >
                Reset All Data
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-red-600 text-sm font-medium">
                  Delete ALL scores and Round 3 matches?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={resetAllData}
                    disabled={resetting}
                    className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 disabled:opacity-50"
                  >
                    {resetting ? 'Resetting...' : 'Yes, Reset'}
                  </button>
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="flex-1 py-3 border border-gray-300 text-gray-600 font-medium rounded-xl hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* View Leaderboard Button */}
      <div className="px-4 py-4 pb-8">
        <Link
          href="/"
          className="block w-full py-3 text-center bg-masters-green text-white font-bold rounded-xl hover:bg-masters-green/90 transition-colors"
        >
          View Leaderboard
        </Link>
      </div>
    </div>
  );
}
