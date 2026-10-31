// How much history loadBoard fetches. Kept apart from api.ts so the CLI parity
// test can import it without the Supabase client (ruling R3).

// Closed items (done, dropped) stay in BoardData this many days for the module history.
export const CLOSED_HISTORY_DAYS = 90
// Most recent events kept in BoardData, below the PostgREST 1000 row cap.
export const EVENTS_LIMIT = 500
