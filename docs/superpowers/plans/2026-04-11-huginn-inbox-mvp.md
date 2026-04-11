# Huginn Inbox MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the Huginn PWA project from scratch with Supabase backend and build the mobile-first Inbox screen for capturing thoughts via text and voice.

**Architecture:** Feature-module React app with Vite + TypeScript + Tailwind. Supabase for auth, database, and RLS. All tables prefixed with `huginn_` (shared Supabase project). Chat-style bottom-anchored input with post-save classify drawer.

**Tech Stack:** React 19, Vite 6, TypeScript, Tailwind CSS 4, Supabase JS v2, vite-plugin-pwa, Web Speech API

**Supabase Project:** `czdjxtsjgughimlazdmu` (Conor Documentation)
**Supabase URL:** `https://czdjxtsjgughimlazdmu.supabase.co`
**Supabase Anon Key:** stored in `.env` as `VITE_SUPABASE_ANON_KEY`

---

## Task 1: Scaffold Vite + React + TypeScript project

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/app/App.tsx`, `.env`, `.gitignore`

- [ ] **Step 1: Initialize the project with Vite**

```bash
cd c:/Dropbox/Huginn/huginn
npm create vite@latest . -- --template react-ts
```

Select "Ignore files and continue" if prompted about existing files (the docs/ folder).

- [ ] **Step 2: Install core dependencies**

```bash
npm install @supabase/supabase-js react-router-dom
npm install -D tailwindcss @tailwindcss/vite vite-plugin-pwa
```

- [ ] **Step 3: Configure Tailwind via Vite plugin**

Replace the contents of `vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Huginn',
        short_name: 'Huginn',
        description: 'Personal project management & second brain',
        display: 'standalone',
        background_color: '#1a1a2e',
        theme_color: '#1a1a2e',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
```

- [ ] **Step 4: Set up Tailwind CSS entry**

Replace `src/index.css` with:

```css
@import "tailwindcss";
```

- [ ] **Step 5: Create .env file**

```
VITE_SUPABASE_URL=https://czdjxtsjgughimlazdmu.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6ZGp4dHNqZ3VnaGltbGF6ZG11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExOTgxNjUsImV4cCI6MjA2Njc3NDE2NX0.q4ye8AyNfXBCWQGx5MDStM5ldSmy7ckzGwF3Q4J09bA
```

- [ ] **Step 6: Update .gitignore**

Ensure `.env` and `.superpowers/` are in `.gitignore`:

```
node_modules
dist
.env
.superpowers/
```

- [ ] **Step 7: Create placeholder PWA icons**

```bash
mkdir -p public/icons
```

Create simple 192x192 and 512x512 PNG placeholder icons (solid purple squares with "H" text, or use any placeholder).

- [ ] **Step 8: Clean up Vite boilerplate**

Remove `src/App.css`, `src/assets/`. Replace `src/App.tsx` with a minimal shell (will be replaced in Task 5):

```tsx
function App() {
  return <div className="min-h-screen bg-[#1a1a2e] text-white">Huginn</div>
}

export default App
```

Update `src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

Move `src/App.tsx` to `src/app/App.tsx` and update the import in `main.tsx`.

- [ ] **Step 9: Verify dev server starts**

```bash
npm run dev
```

Expected: opens at `http://localhost:5173`, shows "Huginn" on dark background, no console errors.

- [ ] **Step 10: Initialize git and commit**

```bash
git init
git add -A
git commit -m "chore: scaffold Vite + React + TS + Tailwind + PWA project"
```

---

## Task 2: Run Supabase migrations via MCP

**Files:**
- Create: `src/shared/lib/types.ts` (DB types)

This task uses the Supabase MCP tool `apply_migration`. All table names are prefixed with `huginn_`.

- [ ] **Step 1: Create huginn_projects table**

Use `mcp__plugin_supabase_supabase__apply_migration` with:
- `project_id`: `czdjxtsjgughimlazdmu`
- `name`: `create_huginn_projects`
- `query`:

```sql
CREATE TABLE huginn_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  name text NOT NULL,
  description text,
  color text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('idea', 'active', 'hold', 'done')),
  pinned boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE huginn_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects"
  ON huginn_projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects"
  ON huginn_projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON huginn_projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
  ON huginn_projects FOR DELETE
  USING (auth.uid() = user_id);
```

- [ ] **Step 2: Create huginn_thoughts table**

Use `mcp__plugin_supabase_supabase__apply_migration` with:
- `project_id`: `czdjxtsjgughimlazdmu`
- `name`: `create_huginn_thoughts`
- `query`:

```sql
CREATE TABLE huginn_thoughts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  body text NOT NULL,
  source text NOT NULL CHECK (source IN ('text', 'voice')),
  audio_url text,
  status text NOT NULL DEFAULT 'inbox' CHECK (status IN ('inbox', 'filed', 'archived')),
  type text CHECK (type IN ('idea', 'task', 'note')),
  tags text[] DEFAULT '{}',
  project_id uuid REFERENCES huginn_projects(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE huginn_thoughts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own thoughts"
  ON huginn_thoughts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own thoughts"
  ON huginn_thoughts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own thoughts"
  ON huginn_thoughts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own thoughts"
  ON huginn_thoughts FOR DELETE
  USING (auth.uid() = user_id);
```

- [ ] **Step 3: Create huginn_tasks table**

Use `mcp__plugin_supabase_supabase__apply_migration` with:
- `project_id`: `czdjxtsjgughimlazdmu`
- `name`: `create_huginn_tasks`
- `query`:

```sql
CREATE TABLE huginn_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  project_id uuid REFERENCES huginn_projects(id) NOT NULL,
  title text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done')),
  from_thought_id uuid REFERENCES huginn_thoughts(id),
  due_date date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE huginn_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tasks"
  ON huginn_tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tasks"
  ON huginn_tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks"
  ON huginn_tasks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks"
  ON huginn_tasks FOR DELETE
  USING (auth.uid() = user_id);
```

- [ ] **Step 4: Create huginn_notes table**

Use `mcp__plugin_supabase_supabase__apply_migration` with:
- `project_id`: `czdjxtsjgughimlazdmu`
- `name`: `create_huginn_notes`
- `query`:

```sql
CREATE TABLE huginn_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  project_id uuid REFERENCES huginn_projects(id) NOT NULL,
  title text,
  body text NOT NULL,
  from_thought_id uuid REFERENCES huginn_thoughts(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE huginn_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notes"
  ON huginn_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes"
  ON huginn_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes"
  ON huginn_notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes"
  ON huginn_notes FOR DELETE
  USING (auth.uid() = user_id);
```

- [ ] **Step 5: Verify tables exist**

Use `mcp__plugin_supabase_supabase__list_tables` with `project_id: czdjxtsjgughimlazdmu`, `schemas: ["public"]`, `verbose: true`.

Confirm all 4 `huginn_*` tables appear with correct columns and RLS enabled.

- [ ] **Step 6: Write TypeScript types**

Create `src/shared/lib/types.ts`:

```ts
export type ThoughtSource = 'text' | 'voice'
export type ThoughtStatus = 'inbox' | 'filed' | 'archived'
export type ThoughtType = 'idea' | 'task' | 'note'
export type ProjectStatus = 'idea' | 'active' | 'hold' | 'done'
export type TaskStatus = 'todo' | 'doing' | 'done'

export interface Thought {
  id: string
  user_id: string
  body: string
  source: ThoughtSource
  audio_url: string | null
  status: ThoughtStatus
  type: ThoughtType | null
  tags: string[]
  project_id: string | null
  created_at: string
}

export interface Project {
  id: string
  user_id: string
  name: string
  description: string | null
  color: string
  status: ProjectStatus
  pinned: boolean
  created_at: string
}

export interface Task {
  id: string
  user_id: string
  project_id: string
  title: string
  notes: string | null
  status: TaskStatus
  from_thought_id: string | null
  due_date: string | null
  created_at: string
}

export interface Note {
  id: string
  user_id: string
  project_id: string
  title: string | null
  body: string
  from_thought_id: string | null
  created_at: string
}
```

- [ ] **Step 7: Commit**

```bash
git add src/shared/lib/types.ts
git commit -m "feat: add DB types for huginn tables"
```

---

## Task 3: Supabase client + Auth

**Files:**
- Create: `src/shared/lib/supabase.ts`, `src/shared/hooks/useAuth.ts`, `src/pages/LoginPage.tsx`

- [ ] **Step 1: Create Supabase client**

Create `src/shared/lib/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

- [ ] **Step 2: Create useAuth hook**

Create `src/shared/hooks/useAuth.ts`:

```ts
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signUp(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return { user, loading, signIn, signUp, signOut }
}
```

- [ ] **Step 3: Create LoginPage**

Create `src/pages/LoginPage.tsx`:

```tsx
import { useState } from 'react'
import { useAuth } from '../shared/hooks/useAuth'

export function LoginPage() {
  const { signIn, signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (isSignUp) {
        await signUp(email, password)
      } else {
        await signIn(email, password)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold text-white text-center">Huginn</h1>
        <p className="text-sm text-gray-400 text-center">
          {isSignUp ? 'Create your account' : 'Sign in to continue'}
        </p>

        {error && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full bg-[#2a2a4a] text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#6c5ce7] placeholder-gray-500"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full bg-[#2a2a4a] text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#6c5ce7] placeholder-gray-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#6c5ce7] text-white font-semibold rounded-xl py-3 disabled:opacity-50"
        >
          {loading ? '...' : isSignUp ? 'Sign Up' : 'Sign In'}
        </button>
        <button
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          className="w-full text-sm text-gray-400 hover:text-white"
        >
          {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/shared/lib/supabase.ts src/shared/hooks/useAuth.ts src/pages/LoginPage.tsx
git commit -m "feat: add Supabase client, useAuth hook, and login page"
```

---

## Task 4: Router + Protected Routes

**Files:**
- Create: `src/app/routes.tsx`, `src/pages/InboxPage.tsx` (placeholder)
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Create placeholder InboxPage**

Create `src/pages/InboxPage.tsx`:

```tsx
export function InboxPage() {
  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white p-4">
      <h1 className="text-xl font-bold">Inbox</h1>
      <p className="text-gray-400 mt-2">Thoughts will appear here.</p>
    </div>
  )
}
```

- [ ] **Step 2: Create routes with auth guard**

Create `src/app/routes.tsx`:

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../shared/hooks/useAuth'
import { LoginPage } from '../pages/LoginPage'
import { InboxPage } from '../pages/InboxPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  if (user) return <Navigate to="/" replace />
  return <>{children}</>
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <InboxPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 3: Update App.tsx to use router**

Replace `src/app/App.tsx`:

```tsx
import { AppRouter } from './routes'

function App() {
  return <AppRouter />
}

export default App
```

- [ ] **Step 4: Verify auth flow**

```bash
npm run dev
```

Expected: navigating to `http://localhost:5173` redirects to `/login`. After signing up and logging in, redirects to `/` showing the placeholder inbox.

- [ ] **Step 5: Commit**

```bash
git add src/app/App.tsx src/app/routes.tsx src/pages/InboxPage.tsx
git commit -m "feat: add router with protected routes and auth guard"
```

---

## Task 5: useThoughts hook

**Files:**
- Create: `src/features/inbox/hooks/useThoughts.ts`

- [ ] **Step 1: Create useThoughts hook**

Create `src/features/inbox/hooks/useThoughts.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { Thought } from '../../../shared/lib/types'

export function useThoughts() {
  const [thoughts, setThoughts] = useState<Thought[]>([])
  const [loading, setLoading] = useState(true)

  const fetchThoughts = useCallback(async () => {
    const { data, error } = await supabase
      .from('huginn_thoughts')
      .select('*')
      .eq('status', 'inbox')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch thoughts:', error)
      return
    }
    setThoughts(data as Thought[])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchThoughts()
  }, [fetchThoughts])

  async function addThought(body: string, source: 'text' | 'voice'): Promise<Thought | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const optimisticThought: Thought = {
      id: crypto.randomUUID(),
      user_id: user.id,
      body,
      source,
      audio_url: null,
      status: 'inbox',
      type: null,
      tags: [],
      project_id: null,
      created_at: new Date().toISOString(),
    }

    setThoughts((prev) => [optimisticThought, ...prev])

    const { data, error } = await supabase
      .from('huginn_thoughts')
      .insert({ body, source, user_id: user.id })
      .select()
      .single()

    if (error) {
      console.error('Failed to add thought:', error)
      setThoughts((prev) => prev.filter((t) => t.id !== optimisticThought.id))
      return null
    }

    setThoughts((prev) =>
      prev.map((t) => (t.id === optimisticThought.id ? (data as Thought) : t))
    )
    return data as Thought
  }

  async function classifyThought(
    thoughtId: string,
    updates: { type?: 'idea' | 'task' | 'note'; project_id?: string }
  ) {
    const { error } = await supabase
      .from('huginn_thoughts')
      .update(updates)
      .eq('id', thoughtId)

    if (error) {
      console.error('Failed to classify thought:', error)
      return false
    }

    setThoughts((prev) =>
      prev.map((t) => (t.id === thoughtId ? { ...t, ...updates } : t))
    )
    return true
  }

  return { thoughts, loading, addThought, classifyThought, count: thoughts.length }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/inbox/hooks/useThoughts.ts
git commit -m "feat: add useThoughts hook with optimistic updates"
```

---

## Task 6: useVoiceRecorder hook

**Files:**
- Create: `src/features/inbox/hooks/useVoiceRecorder.ts`

- [ ] **Step 1: Create useVoiceRecorder hook**

Create `src/features/inbox/hooks/useVoiceRecorder.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react'

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList
  resultIndex: number
}

const SpeechRecognition =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [duration, setDuration] = useState(0)
  const recognitionRef = useRef<InstanceType<NonNullable<typeof SpeechRecognition>> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isSupported = SpeechRecognition !== null

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setIsRecording(false)
    setDuration(0)
  }, [])

  const startRecording = useCallback(() => {
    if (!SpeechRecognition) return

    setTranscript('')
    setDuration(0)

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let final = ''
      for (let i = 0; i < event.results.length; i++) {
        final += event.results[i][0].transcript
      }
      setTranscript(final)
    }

    recognition.onerror = () => {
      stopRecording()
    }

    recognition.onend = () => {
      setIsRecording(false)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }

    recognition.start()
    recognitionRef.current = recognition
    setIsRecording(true)

    timerRef.current = setInterval(() => {
      setDuration((d) => d + 1)
    }, 1000)
  }, [stopRecording])

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  return { isRecording, transcript, duration, startRecording, stopRecording, isSupported }
}
```

- [ ] **Step 2: Add Web Speech API type declarations**

Create `src/speech.d.ts`:

```ts
interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((event: { results: SpeechRecognitionResultList; resultIndex: number }) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition
}

interface Window {
  SpeechRecognition?: SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/inbox/hooks/useVoiceRecorder.ts src/speech.d.ts
git commit -m "feat: add useVoiceRecorder hook with Web Speech API"
```

---

## Task 7: ThoughtCard component

**Files:**
- Create: `src/features/inbox/components/ThoughtCard.tsx`

- [ ] **Step 1: Create ThoughtCard**

Create `src/features/inbox/components/ThoughtCard.tsx`:

```tsx
import type { Thought } from '../../../shared/lib/types'

function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function ThoughtCard({ thought }: { thought: Thought }) {
  return (
    <div className="bg-[#2a2a4a] rounded-xl p-3 mb-2">
      <div className="flex items-start gap-2">
        {thought.source === 'voice' && (
          <span className="text-xs mt-0.5 shrink-0" title="Voice note">
            🎤
          </span>
        )}
        <p className="text-sm text-gray-100 whitespace-pre-wrap break-words flex-1">
          {thought.body}
        </p>
      </div>
      <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
        <span>{timeAgo(thought.created_at)}</span>
        {thought.type && (
          <span className="bg-[#1a1a2e] px-2 py-0.5 rounded-full">
            {thought.type}
          </span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/inbox/components/ThoughtCard.tsx
git commit -m "feat: add ThoughtCard component with time-ago display"
```

---

## Task 8: ThoughtList component

**Files:**
- Create: `src/features/inbox/components/ThoughtList.tsx`

- [ ] **Step 1: Create ThoughtList**

Create `src/features/inbox/components/ThoughtList.tsx`:

```tsx
import type { Thought } from '../../../shared/lib/types'
import { ThoughtCard } from './ThoughtCard'

interface ThoughtListProps {
  thoughts: Thought[]
  loading: boolean
}

export function ThoughtList({ thoughts, loading }: ThoughtListProps) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    )
  }

  if (thoughts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500 text-sm">
          No thoughts yet. Type one below.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2">
      {thoughts.map((thought) => (
        <ThoughtCard key={thought.id} thought={thought} />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/inbox/components/ThoughtList.tsx
git commit -m "feat: add ThoughtList component"
```

---

## Task 9: VoiceButton component

**Files:**
- Create: `src/features/inbox/components/VoiceButton.tsx`

- [ ] **Step 1: Create VoiceButton**

Create `src/features/inbox/components/VoiceButton.tsx`:

```tsx
interface VoiceButtonProps {
  isRecording: boolean
  duration: number
  onToggle: () => void
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function VoiceButton({ isRecording, duration, onToggle }: VoiceButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
        isRecording
          ? 'bg-red-500 animate-pulse'
          : 'bg-[#6c5ce7] hover:bg-[#5b4bd5]'
      }`}
      title={isRecording ? 'Stop recording' : 'Start voice note'}
    >
      {isRecording ? (
        <span className="text-xs font-mono text-white">{formatDuration(duration)}</span>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-5 h-5 text-white"
        >
          <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z" />
          <path d="M17 11a1 1 0 0 1 2 0 7 7 0 0 1-6 6.93V20h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-2.07A7 7 0 0 1 5 11a1 1 0 0 1 2 0 5 5 0 0 0 10 0Z" />
        </svg>
      )}
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/inbox/components/VoiceButton.tsx
git commit -m "feat: add VoiceButton component with recording state"
```

---

## Task 10: ThoughtInput component

**Files:**
- Create: `src/features/inbox/components/ThoughtInput.tsx`

- [ ] **Step 1: Create ThoughtInput**

Create `src/features/inbox/components/ThoughtInput.tsx`:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { useVoiceRecorder } from '../hooks/useVoiceRecorder'
import { VoiceButton } from './VoiceButton'
import type { Thought } from '../../../shared/lib/types'

interface ThoughtInputProps {
  onSubmit: (body: string, source: 'text' | 'voice') => Promise<Thought | null>
}

export function ThoughtInput({ onSubmit }: ThoughtInputProps) {
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [source, setSource] = useState<'text' | 'voice'>('text')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const {
    isRecording,
    transcript,
    duration,
    startRecording,
    stopRecording,
    isSupported,
  } = useVoiceRecorder()

  // Auto-grow textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
  }, [body])

  // Fill transcript into input when recording stops
  useEffect(() => {
    if (!isRecording && transcript) {
      setBody(transcript)
      setSource('voice')
      textareaRef.current?.focus()
    }
  }, [isRecording, transcript])

  const handleToggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording()
    } else {
      setBody('')
      setSource('voice')
      startRecording()
    }
  }, [isRecording, startRecording, stopRecording])

  async function handleSubmit() {
    const trimmed = body.trim()
    if (!trimmed || submitting) return

    setSubmitting(true)
    const result = await onSubmit(trimmed, source)
    setSubmitting(false)

    if (result) {
      setBody('')
      setSource('text')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="border-t border-[#2a2a4a] bg-[#1a1a2e] px-3 py-3 pb-[env(safe-area-inset-bottom,12px)]">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => {
            setBody(e.target.value)
            if (source === 'voice') setSource('text')
          }}
          onKeyDown={handleKeyDown}
          placeholder={isRecording ? 'Listening...' : "What's on your mind?"}
          disabled={isRecording}
          rows={1}
          className="flex-1 bg-[#2a2a4a] text-white rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6c5ce7] placeholder-gray-500 resize-none disabled:opacity-50"
        />
        {isSupported && (
          <VoiceButton
            isRecording={isRecording}
            duration={duration}
            onToggle={handleToggleRecording}
          />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/inbox/components/ThoughtInput.tsx
git commit -m "feat: add ThoughtInput with auto-grow textarea and voice support"
```

---

## Task 11: ClassifyDrawer component

**Files:**
- Create: `src/features/inbox/components/ClassifyDrawer.tsx`

- [ ] **Step 1: Create ClassifyDrawer**

Create `src/features/inbox/components/ClassifyDrawer.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { supabase } from '../../../shared/lib/supabase'
import type { Project, ThoughtType } from '../../../shared/lib/types'

interface ClassifyDrawerProps {
  thoughtId: string
  onClassify: (thoughtId: string, updates: { type?: 'idea' | 'task' | 'note'; project_id?: string }) => Promise<boolean>
  onDone: () => void
}

const TYPE_OPTIONS: { value: ThoughtType; label: string }[] = [
  { value: 'idea', label: 'Idea' },
  { value: 'task', label: 'Task' },
  { value: 'note', label: 'Note' },
]

export function ClassifyDrawer({ thoughtId, onClassify, onDone }: ClassifyDrawerProps) {
  const [selectedType, setSelectedType] = useState<ThoughtType | null>(null)
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [saving, setSaving] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Trigger slide-up animation
    requestAnimationFrame(() => setVisible(true))

    supabase
      .from('huginn_projects')
      .select('*')
      .eq('status', 'active')
      .order('name')
      .then(({ data }) => {
        if (data) setProjects(data as Project[])
      })
  }, [])

  function dismiss() {
    setVisible(false)
    setTimeout(onDone, 200)
  }

  async function handleSave() {
    if (!selectedType && !selectedProject) {
      dismiss()
      return
    }

    setSaving(true)
    const updates: { type?: 'idea' | 'task' | 'note'; project_id?: string } = {}
    if (selectedType) updates.type = selectedType
    if (selectedProject) updates.project_id = selectedProject

    await onClassify(thoughtId, updates)
    setSaving(false)
    dismiss()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={dismiss}>
      <div
        className={`w-full bg-[#2a2a4a] rounded-t-2xl p-4 pb-[env(safe-area-inset-bottom,16px)] transition-transform duration-200 ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mb-4" />

        <p className="text-sm text-gray-400 mb-3">Classify this thought</p>

        {/* Type chips */}
        <div className="flex gap-2 mb-4">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() =>
                setSelectedType(selectedType === opt.value ? null : opt.value)
              }
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedType === opt.value
                  ? 'bg-[#6c5ce7] text-white'
                  : 'bg-[#1a1a2e] text-gray-300 hover:bg-[#3a3a5a]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Project dropdown */}
        {projects.length > 0 && (
          <select
            value={selectedProject ?? ''}
            onChange={(e) => setSelectedProject(e.target.value || null)}
            className="w-full bg-[#1a1a2e] text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6c5ce7] mb-4 appearance-none"
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={dismiss}
            className="flex-1 text-sm text-gray-400 py-2"
          >
            Do later
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-[#6c5ce7] text-white text-sm font-semibold rounded-xl py-2 disabled:opacity-50"
          >
            {saving ? '...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/inbox/components/ClassifyDrawer.tsx
git commit -m "feat: add ClassifyDrawer with type chips and project dropdown"
```

---

## Task 12: Feature barrel export + InboxPage assembly

**Files:**
- Create: `src/features/inbox/index.ts`
- Modify: `src/pages/InboxPage.tsx`

- [ ] **Step 1: Create barrel export**

Create `src/features/inbox/index.ts`:

```ts
export { ThoughtInput } from './components/ThoughtInput'
export { ThoughtList } from './components/ThoughtList'
export { ClassifyDrawer } from './components/ClassifyDrawer'
export { useThoughts } from './hooks/useThoughts'
```

- [ ] **Step 2: Build the full InboxPage**

Replace `src/pages/InboxPage.tsx`:

```tsx
import { useState } from 'react'
import { useAuth } from '../shared/hooks/useAuth'
import { ThoughtInput, ThoughtList, ClassifyDrawer, useThoughts } from '../features/inbox'

export function InboxPage() {
  const { signOut } = useAuth()
  const { thoughts, loading, addThought, classifyThought, count } = useThoughts()
  const [classifyThoughtId, setClassifyThoughtId] = useState<string | null>(null)

  async function handleSubmit(body: string, source: 'text' | 'voice') {
    const thought = await addThought(body, source)
    if (thought) {
      setClassifyThoughtId(thought.id)
    }
    return thought
  }

  return (
    <div className="h-[100dvh] bg-[#1a1a2e] text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a4a]">
        <div>
          <h1 className="text-xl font-bold">Huginn</h1>
          <p className="text-xs text-gray-500">
            {count} thought{count !== 1 ? 's' : ''} in inbox
          </p>
        </div>
        <button
          onClick={signOut}
          className="text-xs text-gray-500 hover:text-white"
        >
          Sign out
        </button>
      </header>

      {/* Thought list */}
      <ThoughtList thoughts={thoughts} loading={loading} />

      {/* Input bar */}
      <ThoughtInput onSubmit={handleSubmit} />

      {/* Classify drawer */}
      {classifyThoughtId && (
        <ClassifyDrawer
          thoughtId={classifyThoughtId}
          onClassify={classifyThought}
          onDone={() => setClassifyThoughtId(null)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/inbox/index.ts src/pages/InboxPage.tsx
git commit -m "feat: assemble InboxPage with all inbox components"
```

---

## Task 13: Final verification

- [ ] **Step 1: Start dev server and verify**

```bash
npm run dev
```

Walk through the full flow:
1. Navigate to `http://localhost:5173` — should redirect to `/login`
2. Sign up with email/password — should redirect to inbox
3. Type a thought, press Enter — appears in list, classify drawer slides up
4. Tap "Do later" — drawer dismisses
5. Type another thought — classify as "Idea", tap Save
6. Click mic button (Chrome/Edge) — speak, stop, transcript appears in textarea, submit
7. Check thought list shows newest first, voice notes have mic icon
8. Sign out — redirects to login

- [ ] **Step 2: Check mobile viewport**

In Chrome DevTools, toggle device toolbar (Ctrl+Shift+M), select iPhone 14 Pro:
- Layout fills viewport, no horizontal scroll
- Input bar anchored at bottom
- Thought list scrolls independently
- Classify drawer slides up from bottom

- [ ] **Step 3: Check PWA manifest**

Chrome DevTools > Application > Manifest:
- Name shows "Huginn"
- Display is "standalone"
- Theme color is #1a1a2e

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during verification"
```
