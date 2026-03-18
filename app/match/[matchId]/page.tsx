'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Match, HoleScore, DotAllocation, Player } from '@/lib/types';
import { getPlayer, COURSES, PRESET_MATCHUPS } from '@/lib/constants';
import {
  calculateDotAllocations,
  getDotsForHole,
  calculateNassauResult,
  getHoleByHoleStatus,
} from '@/lib/scoring';
import { supabase, subscribeToMatch, subscribeToScores } from '@/lib/supabase';
import ScoreDisplay from '@/components/ScoreDisplay';
import MastersScorecard from '@/components/MastersScorecard';
import CourseHeader from '@/components/CourseHeader';

const STORAGE_KEY = 'crabcake_round3_matches';

// Load a specific Round 3 match from localStorage
function loadMatchFromStorage(matchId: string): Match | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    const data = JSON.parse(stored);
    const match = data.find((m: any) => m.id === matchId);
    if (!match) return null;
    return {
      id: match.id,
      round: match.round,
      format: match.format as 'fourball' | 'singles',
      courseId: match.course_id,
      team1Players: match.team1_players,
      team2Players: match.team2_players,
      label: match.label,
      status: match.status as 'not_started' | 'in_progress' | 'complete',
      currentHole: match.current_hole,
    };
  } catch {
    return null;
  }
}

export default function MatchPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.matchId as string;

  const [match, setMatch] = useState<Match | null>(null);
  const [scores, setScores] = useState<HoleScore[]>([]);
  const [currentHole, setCurrentHole] = useState(1);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'offline'>('synced');
  const [pendingScores, setPendingScores] = useState<Record<string, number>>({});
  const [retryQueue, setRetryQueue] = useState<HoleScore[]>([]);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [editingComplete, setEditingComplete] = useState(false);

  const touchStartX = useRef<number | null>(null);

  // Retry failed saves every 10 seconds
  useEffect(() => {
    if (retryQueue.length === 0) return;

    const retryInterval = setInterval(async () => {
      if (retryQueue.length === 0) return;

      setSyncStatus('syncing');
      const toRetry = [...retryQueue];
      let allSucceeded = true;

      for (const score of toRetry) {
        try {
          const { error } = await supabase.from('hole_scores').upsert({
            match_id: score.matchId,
            player_id: score.playerId,
            hole: score.hole,
            gross_score: score.grossScore,
          }, { onConflict: 'match_id,player_id,hole' });

          if (!error) {
            setRetryQueue(prev => prev.filter(s =>
              !(s.matchId === score.matchId && s.playerId === score.playerId && s.hole === score.hole)
            ));
          } else {
            allSucceeded = false;
          }
        } catch {
          allSucceeded = false;
        }
      }

      setSyncStatus(allSucceeded && retryQueue.length === 0 ? 'synced' : 'offline');
    }, 10000);

    return () => clearInterval(retryInterval);
  }, [retryQueue]);

  // Initialize match data
  useEffect(() => {
    async function fetchMatch() {
      try {
        const { data, error } = await supabase
          .from('matches')
          .select('*')
          .eq('id', matchId)
          .single();

        if (error || !data) {
          // Try preset first
          const preset = PRESET_MATCHUPS.find(m => m.id === matchId);
          if (preset) {
            setMatch({
              id: preset.id,
              round: preset.round,
              format: 'fourball',
              courseId: preset.course,
              team1Players: preset.team1,
              team2Players: preset.team2,
              label: preset.label,
              status: 'not_started',
              currentHole: 1,
            });
          } else {
            // Try localStorage for Round 3 matches
            const storedMatch = loadMatchFromStorage(matchId);
            if (storedMatch) {
              setMatch(storedMatch);
            }
          }
        } else {
          setMatch({
            id: data.id,
            round: data.round,
            format: data.format,
            courseId: data.course_id,
            team1Players: data.team1_players,
            team2Players: data.team2_players,
            label: data.label,
            status: data.status,
            currentHole: data.current_hole,
            result: data.result ? JSON.parse(data.result) : undefined,
          });
          setCurrentHole(data.current_hole);
        }
      } catch (err) {
        const preset = PRESET_MATCHUPS.find(m => m.id === matchId);
        if (preset) {
          setMatch({
            id: preset.id,
            round: preset.round,
            format: 'fourball',
            courseId: preset.course,
            team1Players: preset.team1,
            team2Players: preset.team2,
            label: preset.label,
            status: 'not_started',
            currentHole: 1,
          });
        } else {
          // Try localStorage for Round 3 matches
          const storedMatch = loadMatchFromStorage(matchId);
          if (storedMatch) {
            setMatch(storedMatch);
          }
        }
      } finally {
        setLoading(false);
      }
    }

    async function fetchScores() {
      try {
        const { data } = await supabase
          .from('hole_scores')
          .select('*')
          .eq('match_id', matchId);

        if (data) {
          setScores(data.map(s => ({
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
    }

    fetchMatch();
    fetchScores();

    const matchChannel = subscribeToMatch(matchId, () => fetchMatch());
    const scoresChannel = subscribeToScores(matchId, () => fetchScores());

    return () => {
      supabase.removeChannel(matchChannel);
      supabase.removeChannel(scoresChannel);
    };
  }, [matchId]);

  const dotAllocations = useMemo(() => {
    if (!match) return [];
    const course = COURSES[match.courseId];
    if (!course) return [];
    const allPlayerIds = [...match.team1Players, ...match.team2Players];
    return calculateDotAllocations(allPlayerIds, course);
  }, [match]);

  const allocMap = useMemo(() =>
    new Map(dotAllocations.map(a => [a.playerId, a])),
    [dotAllocations]
  );

  const allPlayers = useMemo(() => {
    if (!match) return [];
    return [...match.team1Players, ...match.team2Players]
      .map(id => getPlayer(id))
      .filter(Boolean) as Player[];
  }, [match]);

  const team1Players = useMemo(() =>
    match?.team1Players.map(id => getPlayer(id)).filter(Boolean) as Player[] || [],
    [match]
  );

  const team2Players = useMemo(() =>
    match?.team2Players.map(id => getPlayer(id)).filter(Boolean) as Player[] || [],
    [match]
  );

  const getExistingScore = useCallback((playerId: string, hole: number) => {
    return scores.find(s => s.playerId === playerId && s.hole === hole)?.grossScore;
  }, [scores]);

  const handleScoreChange = useCallback((playerId: string, delta: number) => {
    const currentPar = match ? COURSES[match.courseId]?.par[currentHole - 1] || 4 : 4;
    const existingScore = getExistingScore(playerId, currentHole);
    const currentValue = pendingScores[playerId] ?? existingScore ?? currentPar;
    const newScore = Math.max(1, Math.min(15, currentValue + delta));
    setPendingScores(prev => ({ ...prev, [playerId]: newScore }));
  }, [match, currentHole, pendingScores, getExistingScore]);

  const setScore = useCallback((playerId: string, score: number) => {
    setPendingScores(prev => ({ ...prev, [playerId]: score }));
  }, []);

  const saveHoleScores = async () => {
    if (!match) return;

    const allPlayerIds = [...match.team1Players, ...match.team2Players];
    setSyncStatus('syncing');
    setConflictWarning(null);

    const newScores: HoleScore[] = allPlayerIds
      .filter(id => pendingScores[id] !== undefined)
      .map(playerId => ({
        matchId: match.id,
        playerId,
        hole: currentHole,
        grossScore: pendingScores[playerId],
      }));

    if (newScores.length === 0) {
      // No changes to save
      setSyncStatus('synced');
      if (currentHole < 18) {
        // Advance to next hole
        setCurrentHole(prev => prev + 1);
        setPendingScores({});
        return;
      } else {
        // On hole 18 - check if we can complete the round
        const hole18Scores = scores.filter(s => s.hole === 18);
        if (hole18Scores.length === allPlayerIds.length) {
          // All players have scores for hole 18, complete the round
          const result = calculateNassauResult(match, scores, dotAllocations);
          setMatch(prev => prev ? { ...prev, status: 'complete', result } : null);

          // Update Supabase
          try {
            await supabase
              .from('matches')
              .update({
                status: 'complete',
                current_hole: 18,
                result: JSON.stringify(result),
              })
              .eq('id', match.id);
          } catch (err) {
            console.log('Failed to update match status');
          }
        }
        return;
      }
    }

    // Update local state immediately (optimistic update)
    const updatedScores = [
      ...scores.filter(s => !(s.hole === currentHole && newScores.some(ns => ns.playerId === s.playerId))),
      ...newScores,
    ];
    setScores(updatedScores);

    let syncFailed = false;

    // Try to save to Supabase
    try {
      // Check for conflicts first - fetch current server state
      const { data: serverScores } = await supabase
        .from('hole_scores')
        .select('*')
        .eq('match_id', match.id)
        .eq('hole', currentHole);

      // Check if someone else already entered scores
      if (serverScores && serverScores.length > 0) {
        const conflicts = serverScores.filter(ss => {
          const ourScore = newScores.find(ns => ns.playerId === ss.player_id);
          return ourScore && ourScore.grossScore !== ss.gross_score;
        });

        if (conflicts.length > 0) {
          const conflictNames = conflicts.map(c => getPlayer(c.player_id)?.name.split(' ')[0]).join(', ');
          setConflictWarning(`Note: ${conflictNames} score(s) were updated by someone else. Your entry will override.`);
        }
      }

      // Save each score
      for (const score of newScores) {
        const { error } = await supabase.from('hole_scores').upsert({
          match_id: score.matchId,
          player_id: score.playerId,
          hole: score.hole,
          gross_score: score.grossScore,
        }, { onConflict: 'match_id,player_id,hole' });

        if (error) {
          syncFailed = true;
          setRetryQueue(prev => [...prev.filter(s =>
            !(s.matchId === score.matchId && s.playerId === score.playerId && s.hole === score.hole)
          ), score]);
        }
      }

      // Update match status
      const isComplete = currentHole === 18 && newScores.length === allPlayerIds.length;
      const result = isComplete
        ? calculateNassauResult(match, updatedScores, dotAllocations)
        : undefined;

      await supabase
        .from('matches')
        .update({
          status: isComplete ? 'complete' : 'in_progress',
          current_hole: Math.min(currentHole + 1, 18),
          result: result ? JSON.stringify(result) : null,
        })
        .eq('id', match.id);

      setSyncStatus(syncFailed ? 'offline' : 'synced');
    } catch (err) {
      console.log('Supabase not available, queuing for retry');
      // Add all scores to retry queue
      setRetryQueue(prev => [...prev, ...newScores.filter(ns =>
        !prev.some(p => p.matchId === ns.matchId && p.playerId === ns.playerId && p.hole === ns.hole)
      )]);
      setSyncStatus('offline');
    }

    // Update local match state regardless of sync status
    if (editingComplete) {
      // When editing a complete match, recalculate result with new scores
      const newResult = calculateNassauResult(match, updatedScores, dotAllocations);
      setMatch(prev => prev ? { ...prev, result: newResult } : null);
      setPendingScores({});

      // Update result in Supabase
      try {
        await supabase
          .from('matches')
          .update({ result: JSON.stringify(newResult) })
          .eq('id', match.id);
      } catch (err) {
        console.log('Failed to update result');
      }
    } else {
      const isComplete = currentHole === 18 && updatedScores.filter(s => s.hole === 18).length === allPlayerIds.length;
      const result = isComplete
        ? calculateNassauResult(match, updatedScores, dotAllocations)
        : undefined;

      setMatch(prev => prev ? {
        ...prev,
        status: isComplete ? 'complete' : 'in_progress',
        currentHole: Math.min(currentHole + 1, 18),
        result,
      } : null);

      // Move to next hole
      if (currentHole < 18) {
        setCurrentHole(prev => prev + 1);
        setPendingScores({});
      }
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && currentHole > 1) {
        setCurrentHole(prev => prev - 1);
        setPendingScores({});
      } else if (diff < 0 && currentHole < 18) {
        setCurrentHole(prev => prev + 1);
        setPendingScores({});
      }
    }
    touchStartX.current = null;
  };

  if (loading || !match) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-masters-green font-serif text-xl">Loading match...</div>
      </div>
    );
  }

  const course = COURSES[match.courseId];
  const currentPar = course?.par[currentHole - 1] || 4;
  const currentHdcp = course?.handicapIndex[currentHole - 1] || 1;
  const currentYards = course?.yardages[currentHole - 1] || 0;

  const holeStatus = getHoleByHoleStatus(match, scores, dotAllocations);
  const front9Status = holeStatus.slice(0, 9);
  const back9Status = holeStatus.slice(9, 18);

  const front9Team1Wins = front9Status.filter(h => h.winner === 'team1').length;
  const front9Team2Wins = front9Status.filter(h => h.winner === 'team2').length;
  const back9Team1Wins = back9Status.filter(h => h.winner === 'team1').length;
  const back9Team2Wins = back9Status.filter(h => h.winner === 'team2').length;

  const team1HasBrown = team1Players.some(p => p.team === 'BROWN');
  const team1Short = team1Players.map(p => p.name.split(' ')[0]).join('/');
  const team2Short = team2Players.map(p => p.name.split(' ')[0]).join('/');

  // Calculate overall match status
  const totalTeam1Wins = front9Team1Wins + back9Team1Wins;
  const totalTeam2Wins = front9Team2Wins + back9Team2Wins;
  const holesPlayed = holeStatus.filter(h => h.winner !== null).length;

  const getMatchStatusDisplay = () => {
    if (holesPlayed === 0) return { text: 'Match not started', color: 'text-white/70' };

    const diff = totalTeam1Wins - totalTeam2Wins;
    if (diff === 0) return { text: 'All Square', color: 'text-masters-gold' };

    const leader = diff > 0 ? (team1HasBrown ? 'Team Brown' : 'Team Rusty') : (team1HasBrown ? 'Team Rusty' : 'Team Brown');
    const margin = Math.abs(diff);
    return { text: `${leader} ${margin} UP`, color: 'text-masters-gold' };
  };

  const matchStatusDisplay = getMatchStatusDisplay();

  const playersWithDot = allPlayers.filter(p => {
    const alloc = allocMap.get(p.id);
    return alloc && getDotsForHole(alloc, currentHole) > 0;
  });

  return (
    <div className="min-h-screen bg-masters-cream -mx-4 -mt-6">
      {/* STICKY HEADER */}
      <header className="sticky top-0 z-50 bg-masters-green/95 backdrop-blur-sm shadow-lg">
        <div className="px-4 py-2">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1 flex items-center justify-center gap-2">
              {course?.logo && (
                <div className="w-7 h-7 rounded-full bg-white/90 p-0.5 overflow-hidden flex-shrink-0">
                  <img src={course.logo} alt="" className="w-full h-full object-contain" />
                </div>
              )}
              <div className="text-center">
                <p className="text-white/70 text-xs">{course?.name} · Round {match.round}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs justify-end">
              <span className={`w-2 h-2 rounded-full ${
                syncStatus === 'synced' ? 'bg-green-400' :
                syncStatus === 'syncing' ? 'bg-yellow-400 animate-pulse' :
                syncStatus === 'offline' ? 'bg-orange-400' : 'bg-red-400'
              }`} />
              {syncStatus === 'offline' && retryQueue.length > 0 && (
                <span className="text-orange-300 text-[10px]">{retryQueue.length}</span>
              )}
            </div>
          </div>
        </div>

        {/* Players with Strokes */}
        <div className="bg-masters-black/20 px-4 py-2 border-t border-white/10">
          <div className="flex items-center justify-between">
            {/* Team 1 */}
            <div className="flex items-center gap-3">
              {team1Players.map(player => {
                const alloc = allocMap.get(player.id);
                const strokes = alloc?.strokesReceived ?? 0;
                return (
                  <div key={player.id} className="text-center">
                    <div className={`text-sm ${player.team === 'BROWN' ? 'font-semibold text-white' : 'font-medium text-white/80'}`}>
                      {player.name.split(' ')[0]}
                    </div>
                    <div className="text-xs text-masters-gold">
                      {strokes} {strokes === 1 ? 'stroke' : 'strokes'}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* VS */}
            <div className="text-white/50 text-xs font-medium">vs</div>

            {/* Team 2 */}
            <div className="flex items-center gap-3">
              {team2Players.map(player => {
                const alloc = allocMap.get(player.id);
                const strokes = alloc?.strokesReceived ?? 0;
                return (
                  <div key={player.id} className="text-center">
                    <div className={`text-sm ${player.team === 'BROWN' ? 'font-semibold text-white' : 'font-medium text-white/80'}`}>
                      {player.name.split(' ')[0]}
                    </div>
                    <div className="text-xs text-masters-gold">
                      {strokes} {strokes === 1 ? 'stroke' : 'strokes'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Match Status Bar */}
        <div className="bg-masters-black/30 px-4 py-1.5 border-t border-white/10">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/80">
              <span className="font-medium text-white">Brown</span> {team1HasBrown ? front9Team1Wins + back9Team1Wins : front9Team2Wins + back9Team2Wins}
            </span>
            <span className={`font-bold text-sm ${matchStatusDisplay.color}`}>{matchStatusDisplay.text}</span>
            <span className="text-white/80">
              {team1HasBrown ? front9Team2Wins + back9Team2Wins : front9Team1Wins + back9Team1Wins} <span className="text-white/60">Rusty</span>
            </span>
          </div>
        </div>
      </header>

      {/* COURSE HERO */}
      {course && (
        <CourseHeader
          course={course}
          round={match.round}
          matchLabel={match.label}
        />
      )}

      {/* ACTIVE HOLE INPUT */}
      {(match.status !== 'complete' || editingComplete) && (
        <div
          className="mx-4 mt-4"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Hole Info Card */}
          <div className="bg-masters-green rounded-t-xl px-4 py-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => { setCurrentHole(Math.max(1, currentHole - 1)); setPendingScores({}); }}
                disabled={currentHole === 1}
                className="w-12 h-12 flex items-center justify-center rounded-full bg-white/10 text-white disabled:opacity-30 text-2xl font-light"
              >
                ‹
              </button>
              <div className="text-center">
                <div className="flex items-center justify-center gap-2">
                  <span className="bg-masters-gold text-masters-black text-xs font-bold px-2 py-0.5 rounded">
                    HOLE
                  </span>
                  <span className="text-white font-serif font-bold text-4xl">{currentHole}</span>
                </div>
                <div className="flex items-center justify-center gap-3 mt-2 text-sm">
                  <span className="text-white/90">Par {currentPar}</span>
                  <span className="text-white/50">·</span>
                  <span className="text-masters-gold font-medium">{currentYards} yds</span>
                  <span className="text-white/50">·</span>
                  <span className="text-white/70">HDCP {currentHdcp}</span>
                </div>
              </div>
              <button
                onClick={() => { setCurrentHole(Math.min(18, currentHole + 1)); setPendingScores({}); }}
                disabled={currentHole === 18}
                className="w-12 h-12 flex items-center justify-center rounded-full bg-white/10 text-white disabled:opacity-30 text-2xl font-light"
              >
                ›
              </button>
            </div>
          </div>

          {/* Stroke Legend */}
          {playersWithDot.length > 0 && (
            <div className="bg-masters-green/90 px-4 py-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              {playersWithDot.map(p => {
                const alloc = allocMap.get(p.id);
                const dots = alloc ? getDotsForHole(alloc, currentHole) : 0;
                return (
                  <div key={p.id} className="flex items-center gap-1.5">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: dots }).map((_, i) => (
                        <span key={i} className="w-2 h-2 rounded-full bg-masters-gold" />
                      ))}
                    </div>
                    <span className="text-white/90 text-xs">
                      {p.name.split(' ')[0]} {dots > 1 ? `(${dots} strokes)` : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Conflict Warning */}
          {conflictWarning && (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-amber-700 text-xs">{conflictWarning}</span>
              <button
                onClick={() => setConflictWarning(null)}
                className="ml-auto text-amber-500 hover:text-amber-700"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Offline Warning */}
          {syncStatus === 'offline' && retryQueue.length > 0 && (
            <div className="bg-orange-50 border-b border-orange-200 px-4 py-2 flex items-center gap-2">
              <svg className="w-4 h-4 text-orange-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
              </svg>
              <span className="text-orange-700 text-xs">
                {retryQueue.length} score{retryQueue.length > 1 ? 's' : ''} waiting to sync. Will retry automatically.
              </span>
            </div>
          )}

          {/* Match Status Banner */}
          <div className="bg-white border-b border-gray-100 px-4 py-3">
            <div className="flex items-center justify-center gap-6 text-sm">
              <div className="text-center">
                <div className="font-semibold text-masters-black">Brown</div>
                <div className="text-lg font-bold text-masters-green">{team1HasBrown ? totalTeam1Wins : totalTeam2Wins}</div>
              </div>
              <div className="text-center px-4">
                <div className={`text-xs font-medium uppercase tracking-wide ${
                  totalTeam1Wins === totalTeam2Wins ? 'text-masters-gray' : 'text-masters-green'
                }`}>
                  {holesPlayed === 0 ? 'Not Started' :
                   totalTeam1Wins === totalTeam2Wins ? 'All Square' :
                   `${Math.abs(totalTeam1Wins - totalTeam2Wins)} UP`}
                </div>
                <div className="text-xs text-masters-gray mt-0.5">Thru {holesPlayed}</div>
              </div>
              <div className="text-center">
                <div className="font-medium text-masters-gray">Rusty</div>
                <div className="text-lg font-bold text-masters-green">{team1HasBrown ? totalTeam2Wins : totalTeam1Wins}</div>
              </div>
            </div>
          </div>

          {/* Score Input Grid */}
          <div className="bg-white rounded-b-xl shadow-lg">
            {allPlayers.map((player, idx) => {
              const alloc = allocMap.get(player.id);
              const dots = alloc ? getDotsForHole(alloc, currentHole) : 0;
              const existingScore = getExistingScore(player.id, currentHole);
              const displayScore = pendingScores[player.id] ?? existingScore;
              const netScore = displayScore !== undefined ? displayScore - dots : undefined;

              return (
                <div
                  key={player.id}
                  className={`flex items-center justify-between px-4 py-4 ${
                    idx !== allPlayers.length - 1 ? 'border-b border-gray-100' : ''
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={player.team === 'BROWN' ? 'font-semibold text-masters-black' : 'font-medium text-masters-gray'}>
                        {player.name.split(' ')[0]}
                      </span>
                      {dots > 0 && (
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: dots }).map((_, i) => (
                            <span key={i} className="w-2.5 h-2.5 rounded-full bg-masters-gold" />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleScoreChange(player.id, -1)}
                      className="w-12 h-12 flex items-center justify-center rounded-full border-2 border-masters-green text-masters-green text-2xl font-medium active:bg-masters-green active:text-white transition-colors"
                    >
                      −
                    </button>

                    <div className="w-16 flex flex-col items-center justify-center">
                      {displayScore !== undefined ? (
                        <>
                          <ScoreDisplay grossScore={displayScore} par={currentPar} size="lg" />
                          {dots > 0 && (
                            <span className="text-xs text-masters-green font-medium mt-1">
                              Net {netScore}
                            </span>
                          )}
                        </>
                      ) : (
                        <button
                          onClick={() => setScore(player.id, currentPar)}
                          className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 text-gray-400 text-xl font-medium hover:border-masters-green hover:text-masters-green transition-colors"
                        >
                          {currentPar}
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => handleScoreChange(player.id, 1)}
                      className="w-12 h-12 flex items-center justify-center rounded-full border-2 border-masters-green text-masters-green text-2xl font-medium active:bg-masters-green active:text-white transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Next Hole Button */}
            <div className="p-4 border-t border-gray-100">
              {editingComplete ? (
                <div className="flex gap-3">
                  <button
                    onClick={saveHoleScores}
                    disabled={syncStatus === 'syncing' || Object.keys(pendingScores).length === 0}
                    className="flex-1 h-14 bg-masters-green text-white font-bold rounded-xl text-lg hover:bg-masters-green/90 disabled:opacity-50 transition-colors"
                  >
                    {syncStatus === 'syncing' ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => setEditingComplete(false)}
                    className="px-6 h-14 border-2 border-masters-green text-masters-green font-bold rounded-xl text-lg hover:bg-masters-green/10 transition-colors"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <button
                  onClick={saveHoleScores}
                  disabled={syncStatus === 'syncing'}
                  className="w-full h-14 bg-masters-green text-white font-bold rounded-xl text-lg hover:bg-masters-green/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {syncStatus === 'syncing' ? (
                    'Saving...'
                  ) : currentHole < 18 ? (
                    <>Save & Continue to Hole {currentHole + 1} →</>
                  ) : (
                    'Complete Round'
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SCORECARD */}
      <div className="mx-4 mt-6 mb-6">
        <MastersScorecard
          match={match}
          scores={scores}
          dotAllocations={dotAllocations}
          currentHole={match.status === 'complete' ? undefined : currentHole}
          pendingScores={match.status === 'complete' ? {} : pendingScores}
        />
      </div>

      {/* Match Complete */}
      {match.status === 'complete' && match.result && !editingComplete && (
        <div className="mx-4 mb-6 bg-masters-green rounded-xl p-6 text-center">
          <h2 className="text-2xl font-serif font-bold text-white mb-2">Match Complete</h2>
          <p className="text-masters-gold text-lg font-medium">
            {match.result.team1Points > match.result.team2Points
              ? `${team1Short} wins ${match.result.team1Points}-${match.result.team2Points}`
              : match.result.team2Points > match.result.team1Points
              ? `${team2Short} wins ${match.result.team2Points}-${match.result.team1Points}`
              : `Match Halved ${match.result.team1Points}-${match.result.team2Points}`}
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <button
              onClick={() => setEditingComplete(true)}
              className="px-6 py-2 bg-masters-gold text-masters-black font-medium rounded-lg hover:bg-masters-gold/90 transition-colors"
            >
              Edit Scores
            </button>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-2 bg-white text-masters-green font-medium rounded-lg hover:bg-masters-cream transition-colors"
            >
              Back to Leaderboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
