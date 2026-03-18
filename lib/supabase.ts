import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create a mock client if env vars are not set (for development without Supabase)
const createSupabaseClient = (): SupabaseClient => {
  if (!supabaseUrl || !supabaseAnonKey) {
    // Return a mock client that won't throw errors
    console.warn('Supabase credentials not configured. Using mock client.');
    return {
      from: () => ({
        select: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
        insert: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
        update: () => ({ eq: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }) }),
        upsert: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
        eq: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }) }),
      }),
      channel: () => ({
        on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
        subscribe: () => ({ unsubscribe: () => {} }),
      }),
      removeChannel: () => {},
    } as unknown as SupabaseClient;
  }
  return createClient(supabaseUrl, supabaseAnonKey);
};

export const supabase = createSupabaseClient();

// Real-time subscription helpers
export function subscribeToMatch(matchId: string, callback: (payload: any) => void) {
  return supabase
    .channel(`match:${matchId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'matches',
        filter: `id=eq.${matchId}`,
      },
      callback
    )
    .subscribe();
}

export function subscribeToScores(matchId: string, callback: (payload: any) => void) {
  return supabase
    .channel(`scores:${matchId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'hole_scores',
        filter: `match_id=eq.${matchId}`,
      },
      callback
    )
    .subscribe();
}

export function subscribeToLeaderboard(callback: (payload: any) => void) {
  return supabase
    .channel('leaderboard')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'matches',
      },
      callback
    )
    .subscribe();
}
