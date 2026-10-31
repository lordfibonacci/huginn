import type { Action, FileRow, Item, ItemStatus, Module, Participant, Plan, PlanStatus, Project, Question, Ruling } from './types'

export type ContinuationInput = {
  project: Project
  participants: Participant[]
  item: Item
  module: Module | null
  plans: Plan[]
  actions: Action[]
  rulings: Ruling[]
  questions: Question[]
  files: FileRow[]
}

const NONE = '(engin)'

const ITEM_STATUS: Record<ItemStatus, string> = {
  new: 'Nýtt',
  waiting: 'Bíður',
  ready: 'Tilbúið til byggingar',
  building: 'Í byggingu',
  parked: 'Í bið',
  done: 'Lokið',
  dropped: 'Hætt við',
}

const PLAN_STATUS: Record<PlanStatus, string> = {
  todo: 'Ekki byrjað',
  building: 'Í byggingu',
  done: 'Lokið',
}

function section(title: string, lines: string[]): string {
  return `## ${title}\n${lines.length > 0 ? lines.join('\n') : NONE}`
}

export function buildContinuationPrompt(input: ContinuationInput): string {
  const { project, participants, item, module, plans, actions, rulings, questions, files } = input

  const nameOf = (userId: string | null): string =>
    participants.find((p) => p.user_id === userId)?.display_name ?? '?'

  const verk = [
    `Verkefni: ${project.name}`,
    ...(module ? [`Eining: ${module.name}`] : []),
    `Verk: ${item.title}`,
    ...(item.summary ? [item.summary] : []),
  ]

  const where = [
    `Staða: ${ITEM_STATUS[item.status]}`,
    ...(item.next_step ? [`Næsta skref: ${item.next_step}`] : []),
  ]

  const planLines = plans.map((p) => `- ${p.name}, ${PLAN_STATUS[p.status]}, ${p.path ?? NONE}`)

  const actionLines = actions
    .filter((a) => a.done_at === null)
    .map((a) => `- ${nameOf(a.owner)}: ${a.body}`)

  const questionLines = questions.filter((q) => q.answer === null).map((q) => `- ${q.body}`)

  const planIds = new Set(plans.map((p) => p.id))
  const rulingLines = rulings
    .filter((r) => !r.reversed && planIds.has(r.plan_id))
    .map((r) => `- ${r.code}: ${r.body}`)

  const fileLines = files.map((f) => `- ${f.repo_path ?? f.name}`)

  const needsBuild = plans.some((p) => p.status === 'todo' || p.status === 'building')
  const run = [
    ...(project.repo_path ? [`Mappa: ${project.repo_path}`] : []),
    needsBuild ? 'claude --model opus' : 'claude',
  ]

  const parts = [
    section('Verk', verk),
    section('Hvar erum við', where),
    section('Plön', planLines),
    section('Opin handtök', actionLines),
    section('Ósvaraðar spurningar', questionLines),
    section('Úrskurðir sem skipta máli', rulingLines),
    section('Skjöl', fileLines),
    section('Keyra', run),
  ]
  const out = parts.join('\n\n')
  return item.next_prompt ? `${out}\n\n${item.next_prompt}` : out
}
