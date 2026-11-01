import { describe, it, expect } from 'vitest'
import { buildContinuationPrompt, resumeCommand } from './continuation'
import type { Project, Item, Plan } from './types'

const project: Project = {
  id: 'pr', created_at: null, slug: 'p', name: 'Verkefni', repo_path: 'D:/repo', context_bundle: null, context_bundle_at: null,
}
const item = (over: Partial<Item> = {}): Item => ({
  id: '1a2b3c4d-0000-4000-8000-000000000000', created_at: null, project_id: 'pr', module_id: null, title: 'Titill',
  summary: 'Samantekt', body: 'Lýsing', status: 'waiting', waiting_on: null, tags: [], pos_x: 0, pos_y: 0, source_ref: null,
  next_step: 'Næsta skref', next_prompt: null, created_by: 'u', updated_by: null, updated_at: '2026-01-01T00:00:00Z',
  closed_at: null, ...over,
})
const plan = (over: Partial<Plan> = {}): Plan => ({
  id: 'pl1', created_at: null, project_id: 'pr', item_id: 'i1', name: 'Plan A', path: 'docs/plan-a.md',
  status: 'todo', position: 0, updated_at: '2026-01-01T00:00:00Z', ...over,
})

describe('buildContinuationPrompt', () => {
  it('names the item by title and the 8 character id the CLI takes', () => {
    expect(buildContinuationPrompt(item()).split('\n')[0]).toBe('Huginn verk #1a2b3c4d: Titill')
  })
  it('points at the mirror folder by the 6 character id suffix and says to sync first', () => {
    const out = buildContinuationPrompt(item())
    expect(out).toContain('huginn sync')
    expect(out).toContain('docs/huginn sem endar á 1a2b3c:')
    expect(out).toContain('huginn file get')
    expect(out).toContain('/huginn')
  })
  it('does not repeat what item.md carries', () => {
    const out = buildContinuationPrompt(item())
    expect(out).not.toContain('Samantekt')
    expect(out).not.toContain('Lýsing')
    expect(out).not.toContain('Næsta skref')
    expect(out).not.toContain('D:/repo')
  })
  it('lists the source and asks to read it when there is one', () => {
    const out = buildContinuationPrompt(item({ source_ref: 'docs/progress/109-kiosk.md' }))
    expect(out.split('\n')[1]).toBe('Heimild: docs/progress/109-kiosk.md')
    expect(out).toContain('og heimildina')
    expect(buildContinuationPrompt(item())).not.toContain('eimild')
  })
  it('ends with next_prompt verbatim after a blank line', () => {
    const out = buildContinuationPrompt(item({ next_prompt: 'LOKAORÐ næsta prompt' }))
    expect(out.endsWith('\n\nLOKAORÐ næsta prompt')).toBe(true)
  })
})

describe('resumeCommand', () => {
  it('suggests opus when the item is ready or building', () => {
    expect(resumeCommand(project, item({ status: 'ready' }), []).command).toBe('claude --model opus')
    expect(resumeCommand(project, item({ status: 'building' }), []).command).toBe('claude --model opus')
  })
  it('suggests opus when a plan is todo or building', () => {
    expect(resumeCommand(project, item(), [plan({ status: 'todo' })]).command).toBe('claude --model opus')
    expect(resumeCommand(project, item(), [plan({ status: 'building' })]).command).toBe('claude --model opus')
  })
  it('uses plain claude otherwise', () => {
    expect(resumeCommand(project, item(), [plan({ status: 'done' })]).command).toBe('claude')
    expect(resumeCommand(project, item({ status: 'new' }), []).command).toBe('claude')
  })
  it('gives the project folder, or null', () => {
    expect(resumeCommand(project, item(), []).folder).toBe('D:/repo')
    expect(resumeCommand({ ...project, repo_path: null }, item(), []).folder).toBeNull()
  })
})
