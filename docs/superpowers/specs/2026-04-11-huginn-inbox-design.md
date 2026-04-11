# Huginn — Inbox MVP Design Spec

## Context

Huginn is a personal project management app / second brain for a founder. It needs to be a mobile-first PWA that works in the browser but feels native on phone. This spec covers the initial setup and first screen: the Inbox for capturing thoughts via text and voice.

## Tech Stack

- **Frontend:** React + Vite + TypeScript
- **Styling:** Tailwind CSS
- **Backend:** Supabase (Postgres, Auth, RLS)
- **PWA:** vite-plugin-pwa with service worker auto-register
- **Voice:** Web Speech API (browser-native, no external API)

## Architecture: Feature Modules

```
huginn/
├── public/
│   ├── manifest.json
│   └── icons/
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   └── routes.tsx
│   ├── features/
│   │   └── inbox/
│   │       ├── components/
│   │       │   ├── ThoughtInput.tsx
│   │       │   ├── ThoughtList.tsx
│   │       │   ├── ThoughtCard.tsx
│   │       │   ├── VoiceButton.tsx
│   │       │   └── ClassifyDrawer.tsx
│   │       ├── hooks/
│   │       │   ├── useThoughts.ts
│   │       │   └── useVoiceRecorder.ts
│   │       └── index.ts
│   ├── shared/
│   │   ├── components/
│   │   │   └── Layout.tsx
│   │   ├── hooks/
│   │   │   └── useAuth.ts
│   │   └── lib/
│   │       ├── supabase.ts
│   │       └── types.ts
│   ├── pages/
│   │   ├── InboxPage.tsx
│   │   └── LoginPage.tsx
│   └── main.tsx
├── index.html
├── tailwind.config.ts
├── vite.config.ts
├── tsconfig.json
└── package.json
```

Pages are thin shells that compose feature components. Features own their components and hooks. Shared holds cross-cutting code (Supabase client, auth, types).

## Database Schema

All tables include `user_id uuid references auth.users(id)` for RLS. All have RLS enabled with policies: authenticated users can SELECT, INSERT, UPDATE, DELETE only their own rows.

### thoughts
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default gen_random_uuid() |
| user_id | uuid | FK auth.users(id), NOT NULL |
| body | text | NOT NULL |
| source | text | NOT NULL, check ('text', 'voice') |
| audio_url | text | nullable |
| status | text | NOT NULL, default 'inbox', check ('inbox', 'filed', 'archived') |
| type | text | nullable, check ('idea', 'task', 'note') |
| tags | text[] | nullable, default '{}' |
| project_id | uuid | FK projects(id), nullable |
| created_at | timestamptz | default now() |

### projects
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default gen_random_uuid() |
| user_id | uuid | FK auth.users(id), NOT NULL |
| name | text | NOT NULL |
| description | text | nullable |
| color | text | NOT NULL |
| status | text | NOT NULL, default 'active', check ('idea', 'active', 'hold', 'done') |
| pinned | boolean | default false |
| created_at | timestamptz | default now() |

### tasks
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default gen_random_uuid() |
| user_id | uuid | FK auth.users(id), NOT NULL |
| project_id | uuid | FK projects(id), NOT NULL |
| title | text | NOT NULL |
| notes | text | nullable |
| status | text | NOT NULL, default 'todo', check ('todo', 'doing', 'done') |
| from_thought_id | uuid | FK thoughts(id), nullable |
| due_date | date | nullable |
| created_at | timestamptz | default now() |

### notes
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default gen_random_uuid() |
| user_id | uuid | FK auth.users(id), NOT NULL |
| project_id | uuid | FK projects(id), NOT NULL |
| title | text | nullable |
| body | text | NOT NULL |
| from_thought_id | uuid | FK thoughts(id), nullable |
| created_at | timestamptz | default now() |

## Authentication

- Supabase Auth with email/password sign-up and login
- `useAuth` hook wraps `supabase.auth.onAuthStateChange`, exposes `{ user, loading, signIn, signUp, signOut }`
- Protected routes: no session → redirect to `/login`
- Supabase client initialized with project URL + anon key from env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)

## Inbox Screen (First Screen)

### Layout: Chat-style (bottom-anchored input)
- Full-height mobile viewport
- Header: app name "Huginn" + inbox count
- Scrollable thought list (middle area, newest first)
- Bottom-anchored input bar: auto-growing textarea + mic button

### ThoughtInput
- Auto-growing `<textarea>` with no character limit (placeholder: "What's on your mind?")
- Enter submits, Shift+Enter for newline
- Mic button to the right of the input
- On submit: inserts into `thoughts` table with `source: 'text'`, `status: 'inbox'`
- Optimistic UI: thought appears in list immediately, rolls back on error

### VoiceButton + useVoiceRecorder
- Uses `webkitSpeechRecognition` / `SpeechRecognition` (Web Speech API)
- Tap to start recording: button pulses red, shows recording duration
- Tap again to stop: transcription fills the textarea, user can edit before submitting
- `isSupported` check: mic button hidden if browser lacks support
- Hook returns: `{ isRecording, transcript, startRecording, stopRecording, isSupported }`

### ThoughtList + ThoughtCard
- Fetches thoughts where `status = 'inbox'`, ordered `created_at DESC`
- Each card shows: body text, relative timestamp ("2 min ago"), source icon (text vs voice)
- Voice thoughts show a small mic icon badge
- No swipe actions in MVP — just a readable list

### ClassifyDrawer (post-save)
- After a thought is saved, a lightweight bottom drawer slides up
- Two optional fields:
  - **Type:** single-select chips — Idea / Task / Note
  - **Project:** dropdown of existing projects (fetched from `projects` table), or "None"
- "Do later" button dismisses the drawer without changes
- If filled in: updates the thought record with `type` and/or `project_id`
- Drawer auto-dismisses after saving classification
- Appears over the thought list, does not block the input bar

### Data Flow
1. User types or records a thought
2. Submit → `supabase.from('thoughts').insert({ body, source, user_id: session.user.id })`
3. Optimistic update adds thought to top of list
4. ClassifyDrawer slides up with Type + Project fields
5. User classifies (optional) → `supabase.from('thoughts').update({ type, project_id }).eq('id', thought.id)`
6. Or user taps "Do later" → drawer dismisses, thought stays unclassified

## PWA Configuration

- `vite-plugin-pwa` with `registerType: 'autoUpdate'`
- Manifest: name "Huginn", short_name "Huginn", display "standalone", background_color "#1a1a2e", theme_color "#1a1a2e"
- Service worker caches app shell (HTML, JS, CSS, icons)
- Data requires network (Supabase queries are online-only for MVP)

## Visual Design

- **Theme:** Dark — navy background (#1a1a2e), card surfaces (#2a2a4a), white/light gray text
- **Accent:** Purple (#6c5ce7) for interactive elements (mic button, submit)
- **Typography:** System font stack (-apple-system, sans-serif)
- **Spacing:** Comfortable padding, rounded corners (12-20px radius)
- **Mobile-first:** 100vh layout, safe-area insets for notched devices

## Verification Plan

1. **Project setup:** `npm run dev` starts without errors, loads in browser
2. **PWA:** Chrome DevTools > Application > Manifest shows correctly; "Add to Home Screen" prompt works
3. **Auth:** Can sign up, log in, log out; protected routes redirect correctly
4. **Database:** Supabase dashboard shows all 4 tables with correct columns and RLS policies
5. **Inbox — text:** Type a thought, press Enter → appears in list immediately
6. **Inbox — voice:** Tap mic, speak, stop → transcription appears in textarea, submit saves it with source "voice"
7. **Mobile:** Test in Chrome DevTools mobile viewport (iPhone SE, iPhone 14 Pro) — layout fills screen, input anchored to bottom, no horizontal scroll
8. **RLS:** Create thoughts as user A, log in as user B → user B sees empty inbox
