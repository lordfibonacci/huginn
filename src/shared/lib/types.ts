// Shared types for the auth and profile layer. Vinnubord types live in src/vinnubord/lib/types.ts.

export interface Profile {
  id: string
  display_name: string | null
  email: string | null
  avatar_url: string | null
  locale: string | null
  updated_at: string
}
