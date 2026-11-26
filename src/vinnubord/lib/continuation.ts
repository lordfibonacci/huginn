import type { Item, Plan, Project } from './types'

// The mirror folder of an item (`huginn sync`, cli/lib/mirror.mjs) ends with
// the first 6 characters of its id, the CLI accepts the first 8.
const MIRROR_ID = 6
const CLI_ID = 8

// "Halda áfram": a short prompt that points the new session at the mirror.
// `huginn sync` writes item.md (description, where we are, open plans with
// rulings, open actions, questions, chat, file list) and saga.md (done plans
// and closed actions), copies the files next to them and skips what is
// already on disk. The prompt names item.md only: a session that reads the
// whole folder pays for history and for every attached document.
export function buildContinuationPrompt(item: Item): string {
  const lines = [`Huginn verk #${item.id.slice(0, CLI_ID)}: ${item.title}`]
  if (item.source_ref) lines.push(`Heimild: ${item.source_ref}`)
  lines.push(
    `Keyrðu huginn sync og lestu item.md í möppunni í docs/huginn sem endar á ${item.id.slice(0, MIRROR_ID)}` +
      (item.source_ref ? ', og heimildina ef hún er skrá í repoinu' : '') +
      '. Skjölin í möppunni lestu eftir /huginn: öll þegar verkið er nýtt, annars aðeins þau sem verkið kallar á. saga.md geymir lokin plön og handtök, lestu hana aðeins þegar þú þarft þau. Skrá með .pointer.json sækirðu með huginn file get. Vinndu svo eftir /huginn.',
  )
  const out = lines.join('\n')
  return item.next_prompt ? `${out}\n\n${item.next_prompt}` : out
}

// Where and how to start that session, shown next to the button. Opus when
// the item is ready or building, or a plan is not done.
export function resumeCommand(project: Project, item: Item, plans: Plan[]): { command: string; folder: string | null } {
  const build = item.status === 'ready' || item.status === 'building' || plans.some((p) => p.status !== 'done')
  return { command: build ? 'claude --model opus' : 'claude', folder: project.repo_path }
}
