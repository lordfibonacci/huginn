import { describe, it, expect } from 'vitest'
import { buildContinuationPrompt } from './continuation'
import type { Participant, Project, Item, Plan, Action, Ruling, Question, FileRow } from './types'

const project: Project = {
  id: 'pr', created_at: null, slug: 'p', name: 'Verkefni', repo_path: 'D:/repo', context_bundle: null, context_bundle_at: null,
}
const participants: Participant[] = [
  { id: 'pp1', created_at: null, project_id: 'pr', user_id: 'u-owner-uuid-1234', display_name: 'Árni', short: 'Á', is_service: false },
]
const item: Item = {
  id: 'i1', created_at: null, project_id: 'pr', module_id: null, title: 'Titill', summary: 'Samantekt', body: null,
  status: 'ready', waiting_on: null, tags: [], pos_x: 0, pos_y: 0, source_ref: null, next_step: 'Næsta skref',
  next_prompt: 'LOKAORÐ næsta prompt', created_by: 'u', updated_by: null, updated_at: '2026-01-01T00:00:00Z', closed_at: null,
}
const plan = (over: Partial<Plan> = {}): Plan => ({
  id: 'pl1', created_at: null, project_id: 'pr', item_id: 'i1', name: 'Plan A', path: 'docs/plan-a.md',
  status: 'todo', position: 0, updated_at: '2026-01-01T00:00:00Z', ...over,
})
const rulings: Ruling[] = [
  { id: 'r1', created_at: null, project_id: 'pr', plan_id: 'pl1', code: 'R1', body: 'Gildur úrskurður', cost: null, reversed: false },
  { id: 'r2', created_at: null, project_id: 'pr', plan_id: 'pl1', code: 'R2', body: 'Afturkallaður úrskurður', cost: null, reversed: true },
]
const actions: Action[] = [
  { id: 'a1', created_at: null, project_id: 'pr', item_id: 'i1', body: 'Opið handtak', owner: 'u-owner-uuid-1234', payload: null, done_at: null, done_by: null },
  { id: 'a2', created_at: null, project_id: 'pr', item_id: 'i1', body: 'Lokið handtak', owner: 'u-owner-uuid-1234', payload: null, done_at: 'x', done_by: 'u' },
]
const questions: Question[] = [
  { id: 'q1', created_at: null, project_id: 'pr', item_id: 'i1', body: 'Ósvöruð spurning', asked_by: 'u', asked_to: null, answer: null, answered_by: null, answered_at: null },
  { id: 'q2', created_at: null, project_id: 'pr', item_id: 'i1', body: 'Svöruð spurning', asked_by: 'u', asked_to: null, answer: 'já', answered_by: 'u', answered_at: 'x' },
]
const files: FileRow[] = [
  { id: 'f1', created_at: null, project_id: 'pr', item_id: 'i1', name: 'skjal.pdf', storage_path: 's', size: 1, mime: null, repo_path: 'docs/skjal.md', uploaded_by: 'u' },
  { id: 'f2', created_at: null, project_id: 'pr', item_id: 'i1', name: 'mynd.png', storage_path: 's', size: 1, mime: null, repo_path: null, uploaded_by: 'u' },
]

const build = (plans: Plan[]) =>
  buildContinuationPrompt({ project, participants, item, module: null, plans, actions, rulings, questions, files })

describe('buildContinuationPrompt', () => {
  it('has headings in order', () => {
    const out = build([plan()])
    const heads = ['Verk', 'Hvar erum við', 'Plön', 'Opin handtök', 'Ósvaraðar spurningar', 'Úrskurðir sem skipta máli', 'Skjöl', 'Keyra']
    let last = -1
    for (const h of heads) {
      const idx = out.indexOf('## ' + h)
      expect(idx).toBeGreaterThan(last)
      last = idx
    }
  })
  it('suggests opus when a plan is todo or building', () => {
    expect(build([plan({ status: 'todo' })])).toContain('claude --model opus')
    expect(build([plan({ status: 'building' })])).toContain('claude --model opus')
  })
  it('uses plain claude when all plans are done', () => {
    const out = build([plan({ status: 'done' })])
    expect(out).not.toContain('--model')
    expect(out).toContain('claude')
  })
  it('skips reversed rulings and closed entries, falls back to file name', () => {
    const out = build([plan()])
    expect(out).toContain('Gildur úrskurður')
    expect(out).not.toContain('Afturkallaður úrskurður')
    expect(out).toContain('Opið handtak')
    expect(out).not.toContain('Lokið handtak')
    expect(out).toContain('Ósvöruð spurning')
    expect(out).not.toContain('Svöruð spurning')
    expect(out).toContain('docs/skjal.md')
    expect(out).toContain('mynd.png')
    expect(out).toContain('D:/repo')
  })
  it('prints readable names and statuses, not raw ids or enums', () => {
    const out = build([plan({ status: 'todo' })])
    expect(out).toContain('- Árni: Opið handtak')
    expect(out).not.toContain('u-owner-uuid-1234')
    expect(out).toContain('Staða: Tilbúið til byggingar')
    expect(out).toContain('Plan A, Ekki byrjað, docs/plan-a.md')
    expect(out).not.toContain('todo')
    expect(build([plan({ status: 'building' })])).toContain('Plan A, Í byggingu')
    expect(build([plan({ status: 'done' })])).toContain('Plan A, Lokið')
  })
  it('falls back to ? for unknown owner', () => {
    const out = buildContinuationPrompt({ project, participants: [], item, module: null, plans: [plan()], actions, rulings, questions, files })
    expect(out).toContain('- ?: Opið handtak')
  })
  it('ends with next_prompt verbatim', () => {
    expect(build([plan()]).endsWith('LOKAORÐ næsta prompt')).toBe(true)
  })
})
