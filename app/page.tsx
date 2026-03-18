'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Match, HoleScore, DotAllocation } from '@/lib/types';
import { PRESET_MATCHUPS, COURSES, getPlayer, PLAYERS } from '@/lib/constants';
import { supabase, subscribeToLeaderboard } from '@/lib/supabase';
import { calculateDotAllocations, calculateNassauResult, getHoleByHoleStatus } from '@/lib/scoring';
import Round3Setup from '@/components/Round3Setup';

const STORAGE_KEY = 'crabcake_round3_matches';

// Load Round 3 matches from localStorage
function loadRound3FromStorage(): Match[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    const data = JSON.parse(stored);
    return data.map((m: any) => ({
      id: m.id,
      round: m.round,
      format: m.format as 'fourball' | 'singles',
      courseId: m.course_id,
      team1Players: m.team1_players,
      team2Players: m.team2_players,
      label: m.label,
      status: m.status as 'not_started' | 'in_progress' | 'complete',
      currentHole: m.current_hole,
    }));
  } catch {
    return [];
  }
}

const INITIAL_MATCHES: Match[] = PRESET_MATCHUPS.map(m => ({
  id: m.id,
  round: m.round,
  format: 'fourball' as const,
  courseId: m.course,
  team1Players: m.team1,
  team2Players: m.team2,
  label: m.label,
  status: 'not_started' as const,
  currentHole: 1,
}));

export default function HomePage() {
  const [matches, setMatches] = useState<Match[]>(INITIAL_MATCHES);
  const [allScores, setAllScores] = useState<HoleScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRound, setSelectedRound] = useState<number | 'all' | 'players'>('all');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const fetchMatches = useCallback(async () => {
    let round3Matches: Match[] = [];

    // Try Supabase first
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .order('round', { ascending: true });

      if (!error && data && data.length > 0) {
        const supabaseMatches: Match[] = data.map(m => ({
          id: m.id,
          round: m.round,
          format: m.format as 'fourball' | 'singles',
          courseId: m.course_id,
          team1Players: m.team1_players,
          team2Players: m.team2_players,
          label: m.label,
          status: m.status as 'not_started' | 'in_progress' | 'complete',
          currentHole: m.current_hole,
          result: m.result ? JSON.parse(m.result) : undefined,
        }));

        // Merge: use Supabase data for matches that exist there, keep presets for others
        const supabaseIds = new Set(supabaseMatches.map(m => m.id));
        const mergedMatches = [
          ...INITIAL_MATCHES.filter(m => !supabaseIds.has(m.id)),
          ...supabaseMatches,
        ].sort((a, b) => {
          if (a.round !== b.round) return a.round - b.round;
          return a.id.localeCompare(b.id);
        });

        setMatches(mergedMatches);
        return;
      }
    } catch (err) {
      console.log('Supabase not available');
    }

    // Fallback: Load Round 3 from localStorage and merge with presets
    round3Matches = loadRound3FromStorage();
    const mergedMatches = [...INITIAL_MATCHES, ...round3Matches].sort((a, b) => {
      if (a.round !== b.round) return a.round - b.round;
      return a.id.localeCompare(b.id);
    });
    setMatches(mergedMatches);
  }, []);

  const fetchAllScores = useCallback(async () => {
    try {
      const { data } = await supabase.from('hole_scores').select('*');
      if (data) {
        setAllScores(data.map(s => ({
          matchId: s.match_id,
          playerId: s.player_id,
          hole: s.hole,
          grossScore: s.gross_score,
          createdAt: s.created_at,
        })));
      }
    } catch (err) {
      console.log('No scores yet');
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchMatches(), fetchAllScores()]);
    setLastRefresh(new Date());
    setRefreshing(false);
  }, [fetchMatches, fetchAllScores]);

  useEffect(() => {
    async function initialLoad() {
      await fetchMatches();
      await fetchAllScores();
      setLastRefresh(new Date());
      setLoading(false);
    }

    initialLoad();

    // Real-time subscriptions
    const matchChannel = subscribeToLeaderboard(() => {
      fetchMatches();
      setLastRefresh(new Date());
    });

    const scoresChannel = supabase
      .channel('all-scores')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hole_scores' }, () => {
        fetchAllScores();
        fetchMatches();
        setLastRefresh(new Date());
      })
      .subscribe();

    // Polling fallback - refresh every 30 seconds for reliability on mobile
    const pollInterval = setInterval(() => {
      fetchMatches();
      fetchAllScores();
      setLastRefresh(new Date());
    }, 30000);

    return () => {
      supabase.removeChannel(matchChannel);
      supabase.removeChannel(scoresChannel);
      clearInterval(pollInterval);
    };
  }, [fetchMatches, fetchAllScores]);

  const allDotAllocations = useMemo(() => {
    const map = new Map<string, DotAllocation[]>();
    matches.forEach(match => {
      const course = COURSES[match.courseId];
      if (course) {
        const allPlayerIds = [...match.team1Players, ...match.team2Players];
        const allocations = calculateDotAllocations(allPlayerIds, course);
        map.set(match.id, allocations);
      }
    });
    return map;
  }, [matches]);

  // Enhanced match data with live status
  const enrichedMatches = useMemo(() => {
    return matches.map(match => {
      const matchScores = allScores.filter(s => s.matchId === match.id);
      const dots = allDotAllocations.get(match.id) || [];
      const holesPlayed = new Set(matchScores.map(s => s.hole)).size;

      // Get hole-by-hole status
      const holeStatus = getHoleByHoleStatus(match, matchScores, dots);
      const team1Wins = holeStatus.filter(h => h.winner === 'team1').length;
      const team2Wins = holeStatus.filter(h => h.winner === 'team2').length;

      // Determine match status text
      let statusText = 'Not Started';
      let statusColor = 'text-masters-gray';

      if (holesPlayed > 0) {
        const diff = team1Wins - team2Wins;
        const team1IsBrown = getPlayer(match.team1Players[0])?.team === 'BROWN';
        if (diff === 0) {
          statusText = 'AS';
          statusColor = 'text-masters-black';
        } else {
          const brownLeading = (diff > 0 && team1IsBrown) || (diff < 0 && !team1IsBrown);
          statusText = `${brownLeading ? 'B' : 'R'} ${Math.abs(diff)}UP`;
          statusColor = 'text-masters-green font-bold';
        }
      }

      // Check if match is complete
      const allPlayers = [...match.team1Players, ...match.team2Players];
      const isComplete = matchScores.length >= 18 * allPlayers.length;

      let result = match.result;
      if (isComplete && !result) {
        result = calculateNassauResult(match, matchScores, dots);
      }

      return {
        ...match,
        holesPlayed,
        team1Wins,
        team2Wins,
        statusText,
        statusColor,
        isLive: holesPlayed > 0 && holesPlayed < 18,
        isComplete,
        result,
      };
    });
  }, [matches, allScores, allDotAllocations]);

  // Calculate team totals
  const teamTotals = useMemo(() => {
    let brownPoints = 0;
    let rustyPoints = 0;

    enrichedMatches.forEach(match => {
      if (match.result) {
        brownPoints += match.result.teamBrownPoints;
        rustyPoints += match.result.teamRustyPoints;
      }
    });

    return { brown: brownPoints, rusty: rustyPoints };
  }, [enrichedMatches]);

  const filteredMatches = selectedRound === 'all'
    ? enrichedMatches
    : selectedRound === 'players'
    ? []
    : enrichedMatches.filter(m => m.round === selectedRound);

  // Calculate player stats for the Players tab
  const playerStats = useMemo(() => {
    return PLAYERS.map(player => {
      // Find matches this player participated in
      const playerMatches = enrichedMatches.filter(m =>
        m.team1Players.includes(player.id) || m.team2Players.includes(player.id)
      );

      // Calculate gross scores per round
      const getGrossTotal = (roundNum: number) => {
        const match = playerMatches.find(m => m.round === roundNum);
        if (!match) return null;
        const matchScores = allScores.filter(s => s.matchId === match.id && s.playerId === player.id);
        if (matchScores.length === 0) return null;
        return matchScores.reduce((sum, s) => sum + s.grossScore, 0);
      };

      const r1 = getGrossTotal(1);
      const r2 = getGrossTotal(2);
      const r3 = getGrossTotal(3);
      const total = (r1 || 0) + (r2 || 0) + (r3 || 0);
      const hasScores = r1 !== null || r2 !== null || r3 !== null;

      // Calculate points contributed (split for fourball, full for singles)
      let points = 0;
      playerMatches.forEach(match => {
        if (match.result) {
          const isTeam1 = match.team1Players.includes(player.id);
          const teamPoints = isTeam1 ? match.result.team1Points : match.result.team2Points;
          // Split for fourball (2 players), full for singles (1 player)
          const teammates = isTeam1 ? match.team1Players.length : match.team2Players.length;
          points += teamPoints / teammates;
        }
      });

      return {
        player,
        r1,
        r2,
        r3,
        total: hasScores ? total : null,
        points,
      };
    }).sort((a, b) => {
      // Sort by total score ascending (lowest first), null scores at bottom
      if (a.total === null && b.total === null) return 0;
      if (a.total === null) return 1;
      if (b.total === null) return -1;
      return a.total - b.total;
    });
  }, [enrichedMatches, allScores]);

  const liveMatches = enrichedMatches.filter(m => m.isLive);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-masters-green font-serif text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto -mx-4 -mt-6 bg-masters-cream min-h-screen">
      {/* Team Score Hero */}
      <div className="bg-masters-green">
        {/* Main Scoreboard - Side by Side */}
        <div className="px-6 py-6">
          <div className="flex items-center justify-center">
            {/* Team Brown */}
            <div className="flex-1 text-center">
              <div className="text-white/70 text-xs font-medium tracking-widest uppercase mb-2">Brown</div>
              <div className={`text-white font-serif text-5xl font-bold ${teamTotals.brown > teamTotals.rusty ? 'text-masters-gold' : ''}`}>
                {teamTotals.brown}
              </div>
            </div>

            {/* Divider */}
            <div className="flex flex-col items-center px-4">
              <div className="w-px h-8 bg-white/20" />
              <span className="text-white/40 text-xs font-medium my-2">vs</span>
              <div className="w-px h-8 bg-white/20" />
            </div>

            {/* Team Rusty */}
            <div className="flex-1 text-center">
              <div className="text-white/70 text-xs font-medium tracking-widest uppercase mb-2">Rusty</div>
              <div className={`text-white font-serif text-5xl font-bold ${teamTotals.rusty > teamTotals.brown ? 'text-masters-gold' : ''}`}>
                {teamTotals.rusty}
              </div>
            </div>
          </div>

          {/* Match Status */}
          <div className="flex items-center justify-center gap-4 mt-5 text-xs">
            {liveMatches.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-white/80">{liveMatches.length} Live</span>
              </div>
            )}
            <div className="text-white/50">
              {enrichedMatches.filter(m => m.isComplete).length}/{enrichedMatches.length} complete
            </div>
            <button
              onClick={refreshAll}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors disabled:opacity-50"
            >
              <svg
                className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{refreshing ? 'Updating...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Round Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-[52px] z-40">
        <div className="flex">
          {(['all', 1, 2, 3, 'players'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedRound(tab)}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                selectedRound === tab
                  ? 'border-masters-green text-masters-green'
                  : 'border-transparent text-masters-gray hover:text-masters-black'
              }`}
            >
              {tab === 'all' ? 'All' : tab === 'players' ? 'Players' : `R${tab}`}
            </button>
          ))}
        </div>
      </div>

      {/* Round 3 Setup - only show when Round 3 tab is selected */}
      {selectedRound === 3 && (
        <Round3Setup
          existingMatches={enrichedMatches.filter(m => m.round === 3)}
          onMatchCreated={fetchMatches}
          onMatchDeleted={fetchMatches}
        />
      )}

      {/* Player Leaderboard - Masters style */}
      {selectedRound === 'players' && (
        <div className="bg-masters-cream">
          {/* Title */}
          <div className="px-4 py-4">
            <h2 className="text-2xl font-serif text-masters-green">Leader Board</h2>
          </div>

          {/* Table */}
          <div className="bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-masters-green/90 text-white text-[11px] font-medium uppercase tracking-wider">
                    <th className="px-2 py-2.5 text-center w-12">Pos</th>
                    <th className="px-3 py-2.5 text-left">Player</th>
                    <th className="px-2 py-2.5 text-center w-14">Tot</th>
                    <th className="px-2 py-2.5 text-center w-12">R1</th>
                    <th className="px-2 py-2.5 text-center w-12">R2</th>
                    <th className="px-2 py-2.5 text-center w-12">R3</th>
                    <th className="px-2 py-2.5 text-center w-12">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {playerStats.map((stat, idx) => {
                    // Calculate position with ties
                    const getPosition = () => {
                      if (stat.total === null) return '--';
                      const sortedTotals = playerStats
                        .filter(s => s.total !== null)
                        .map(s => s.total as number)
                        .sort((a, b) => a - b);
                      const pos = sortedTotals.indexOf(stat.total) + 1;
                      const isTied = sortedTotals.filter(t => t === stat.total).length > 1;
                      return isTied ? `T${pos}` : `${pos}`;
                    };

                    return (
                      <tr
                        key={stat.player.id}
                        className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/70'}`}
                      >
                        <td className="px-2 py-3 text-center text-masters-gray text-xs font-medium">
                          {getPosition()}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`font-semibold uppercase tracking-wide text-[13px] ${stat.player.team === 'BROWN' ? 'text-masters-green' : 'text-masters-green/60'}`}>
                            {stat.player.name.split(' ')[0]}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-center font-bold text-masters-green">
                          {stat.total !== null ? stat.total : <span className="text-gray-300">--</span>}
                        </td>
                        <td className="px-2 py-3 text-center text-masters-black">
                          {stat.r1 !== null ? stat.r1 : <span className="text-gray-300">--</span>}
                        </td>
                        <td className="px-2 py-3 text-center text-masters-black">
                          {stat.r2 !== null ? stat.r2 : <span className="text-gray-300">--</span>}
                        </td>
                        <td className="px-2 py-3 text-center text-masters-black">
                          {stat.r3 !== null ? stat.r3 : <span className="text-gray-300">--</span>}
                        </td>
                        <td className="px-2 py-3 text-center">
                          <span className={`font-semibold ${stat.player.team === 'BROWN' ? 'text-masters-green' : 'text-masters-green/60'}`}>
                            {stat.points > 0 ? stat.points.toFixed(1) : '--'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Match Leaderboard Table - hide when Players tab is selected */}
      {selectedRound !== 'players' && (
        <div className="bg-white">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-1 px-3 py-2 bg-masters-green text-white text-xs font-medium uppercase tracking-wide">
            <div className="col-span-1"></div>
            <div className="col-span-5">Match</div>
            <div className="col-span-2 text-center">Thru</div>
            <div className="col-span-2 text-center">Status</div>
            <div className="col-span-2 text-center">Pts</div>
          </div>

          {/* Match Rows */}
          {filteredMatches.length === 0 && selectedRound !== 3 ? (
            <div className="px-4 py-8 text-center text-masters-gray">
              No matches for this round yet
            </div>
          ) : filteredMatches.length === 0 && selectedRound === 3 ? (
            <div className="px-4 py-4 text-center text-masters-gray text-sm">
              Create matches above to get started
            </div>
          ) : (
          filteredMatches.map((match, idx) => {
            const course = COURSES[match.courseId];
            const team1Names = match.team1Players.map(id => getPlayer(id)?.name.split(' ')[0]).join('/');
            const team2Names = match.team2Players.map(id => getPlayer(id)?.name.split(' ')[0]).join('/');
            const team1IsBrown = getPlayer(match.team1Players[0])?.team === 'BROWN';

            return (
              <Link
                key={match.id}
                href={`/match/${match.id}`}
                className={`grid grid-cols-12 gap-1 px-3 py-3 items-center border-b border-gray-100 hover:bg-masters-cream/50 transition-colors ${
                  idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                }`}
              >
                {/* Live indicator */}
                <div className="col-span-1 flex justify-center">
                  {match.isLive ? (
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  ) : match.isComplete ? (
                    <span className="text-masters-green text-xs">✓</span>
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-gray-300" />
                  )}
                </div>

                {/* Match info */}
                <div className="col-span-5">
                  <div className="text-sm truncate">
                    <span className="font-semibold text-masters-green">{team1IsBrown ? team1Names : team2Names}</span>
                  </div>
                  <div className="text-sm text-masters-green/60 truncate mt-0.5">
                    {team1IsBrown ? team2Names : team1Names}
                  </div>
                  <div className="text-xs text-masters-gray/70 mt-1">
                    {course?.name} · R{match.round}
                  </div>
                </div>

                {/* Thru */}
                <div className="col-span-2 text-center">
                  {match.holesPlayed > 0 ? (
                    <span className="text-sm font-medium">{match.holesPlayed}</span>
                  ) : (
                    <span className="text-xs text-masters-gray">—</span>
                  )}
                </div>

                {/* Status */}
                <div className="col-span-2 text-center">
                  <span className={`text-sm ${match.statusColor}`}>
                    {match.statusText}
                  </span>
                </div>

                {/* Points */}
                <div className="col-span-2 text-center">
                  {match.result ? (
                    <div className="text-xs">
                      <span className="text-amber-600 font-medium">{match.result.teamBrownPoints}</span>
                      <span className="text-masters-gray mx-1">-</span>
                      <span className="text-orange-600 font-medium">{match.result.teamRustyPoints}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-masters-gray">—</span>
                  )}
                </div>
              </Link>
            );
          })
        )}
        </div>
      )}

      {/* Legend */}
      <div className="px-4 py-4 bg-white border-t border-gray-100">
        <div className="flex items-center justify-center gap-6 text-xs text-masters-gray">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span>Live</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-masters-green">✓</span>
            <span>Complete</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-gray-300" />
            <span>Not Started</span>
          </div>
        </div>
      </div>

      {/* Quick link to admin */}
      <div className="px-4 py-4 text-center">
        <Link
          href="/admin"
          className="text-xs text-masters-gray hover:text-masters-green transition-colors"
        >
          Admin Settings
        </Link>
      </div>
    </div>
  );
}
