#!/usr/bin/env node
// Import a Trello board JSON export into Huginn (Supabase).
//
// Usage:
//   HUGINN_EMAIL=heimir@730.is HUGINN_PASSWORD=xxxxx \
//     node scripts/import-trello-to-huginn.mjs <path-to-trello.json>
//
// Reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from .env. Signs in as the
// given user (so RLS inserts succeed under that user_id) and maps the Trello
// export into huginn_projects / lists / tasks / labels / checklists / items /
// comments / attachments.
//
// Not imported: file attachments (links preserved), members, power-ups,
// custom fields, card stickers, reactions.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// --- Load .env (minimal parser — we only need two keys) ---
const envPath = path.join(PROJECT_ROOT, '.env');
if (!fs.existsSync(envPath)) {
  console.error('.env not found at', envPath);
  process.exit(1);
}
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(l => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')];
    }),
);

const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;
const EMAIL = process.env.HUGINN_EMAIL;
const PASSWORD = process.env.HUGINN_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}
if (!EMAIL || !PASSWORD) {
  console.error('Missing HUGINN_EMAIL or HUGINN_PASSWORD env vars.');
  console.error('Example: HUGINN_EMAIL=heimir@730.is HUGINN_PASSWORD=xxx node scripts/import-trello-to-huginn.mjs ./file.json');
  process.exit(1);
}

const jsonPath = process.argv[2];
if (!jsonPath) {
  console.error('Usage: node scripts/import-trello-to-huginn.mjs <path-to-trello-export.json>');
  process.exit(1);
}

const trello = JSON.parse(fs.readFileSync(path.resolve(jsonPath), 'utf8'));

// --- Trello color name -> Huginn hex ---
const LABEL_COLOR_MAP = {
  green:       '#00b894',
  green_light: '#00b894',
  green_dark:  '#00b894',
  yellow:      '#fdcb6e',
  yellow_light:'#fdcb6e',
  yellow_dark: '#fdcb6e',
  orange:      '#e17055',
  orange_light:'#e17055',
  orange_dark: '#e17055',
  red:         '#e17055',
  red_light:   '#e17055',
  red_dark:    '#e17055',
  purple:      '#6c5ce7',
  purple_light:'#6c5ce7',
  purple_dark: '#6c5ce7',
  blue:        '#0984e3',
  blue_light:  '#0984e3',
  blue_dark:   '#0984e3',
  sky:         '#00cec9',
  sky_light:   '#00cec9',
  sky_dark:    '#00cec9',
  lime:        '#00b894',
  lime_light:  '#00b894',
  lime_dark:   '#00b894',
  pink:        '#e84393',
  pink_light:  '#e84393',
  pink_dark:   '#e84393',
  black:       '#636e72',
  black_light: '#636e72',
  black_dark:  '#636e72',
};
const mapLabelColor = c => LABEL_COLOR_MAP[c] || '#636e72';

// --- Sign in ---
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
console.log(`Signing in as ${EMAIL}…`);
const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
  email: EMAIL,
  password: PASSWORD,
});
if (authErr || !auth.user) {
  console.error('Sign-in failed:', authErr?.message);
  process.exit(1);
}
const userId = auth.user.id;
console.log(`  -> user_id = ${userId}`);

const log = (...a) => console.log('·', ...a);

async function insertOne(table, row) {
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (error) throw new Error(`${table}: ${error.message} :: ${JSON.stringify(row).slice(0, 200)}`);
  return data;
}

// --- 1. Project ---
log(`Creating project "${trello.name}"…`);
const project = await insertOne('huginn_projects', {
  user_id: userId,
  name: trello.name,
  description: trello.desc || null,
  color: '#6c5ce7',
  status: 'active',
  pinned: false,
  background: '#1e1e3e',
});
log(`  project_id = ${project.id}`);

// --- 2. Labels ---
const labelIdMap = new Map();
const labels = trello.labels || [];
log(`Creating ${labels.length} labels…`);
for (const lbl of labels) {
  const row = await insertOne('huginn_labels', {
    project_id: project.id,
    user_id: userId,
    name: lbl.name || '',
    color: mapLabelColor(lbl.color),
  });
  labelIdMap.set(lbl.id, row.id);
}

// --- 3. Lists (preserve Trello's pos ordering) ---
const listIdMap = new Map();
const openLists = (trello.lists || []).filter(l => !l.closed).sort((a, b) => a.pos - b.pos);
log(`Creating ${openLists.length} lists…`);
for (let i = 0; i < openLists.length; i++) {
  const list = openLists[i];
  const row = await insertOne('huginn_lists', {
    project_id: project.id,
    user_id: userId,
    name: list.name,
    position: (i + 1) * 1000,
    archived: false,
  });
  listIdMap.set(list.id, row.id);
}

// --- 4. Cards (tasks) ---
const cardIdMap = new Map();
const openCards = (trello.cards || []).filter(c => !c.closed && listIdMap.has(c.idList));
log(`Creating ${openCards.length} tasks…`);
// Group cards by list and assign sequential integer positions within each list
const cardsByList = new Map();
for (const c of openCards) {
  if (!cardsByList.has(c.idList)) cardsByList.set(c.idList, []);
  cardsByList.get(c.idList).push(c);
}
for (const arr of cardsByList.values()) arr.sort((a, b) => a.pos - b.pos);
const cardPosMap = new Map();
for (const [, arr] of cardsByList) {
  arr.forEach((c, i) => cardPosMap.set(c.id, (i + 1) * 1000));
}

let cardCount = 0;
const orderedCards = openCards.slice().sort((a, b) => a.pos - b.pos);
for (const card of orderedCards) {
  const row = await insertOne('huginn_tasks', {
    user_id: userId,
    project_id: project.id,
    list_id: listIdMap.get(card.idList),
    title: card.name || '(untitled)',
    notes: card.desc || null,
    status: card.dueComplete ? 'done' : 'todo',
    priority: null,
    position: cardPosMap.get(card.id),
    from_thought_id: null,
    start_date: card.start || null,
    due_date: card.due || null,
    recurring: null,
  });
  cardIdMap.set(card.id, row.id);

  // Labels on this card
  for (const oldLabelId of card.idLabels || []) {
    const newLabelId = labelIdMap.get(oldLabelId);
    if (!newLabelId) continue;
    try {
      await insertOne('huginn_task_labels', { task_id: row.id, label_id: newLabelId });
    } catch (e) { console.warn(`  ! label skip: ${e.message}`); }
  }

  // URL attachments (skip file uploads — they'd need re-download + re-upload to storage)
  for (const att of card.attachments || []) {
    if (att.url && !att.isUpload) {
      try {
        await insertOne('huginn_attachments', {
          task_id: row.id,
          user_id: userId,
          name: att.name || att.url,
          url: att.url,
          type: 'link',
          size: null,
          is_cover: false,
        });
      } catch (e) { console.warn(`  ! attachment skip on "${card.name}": ${e.message}`); }
    }
  }

  cardCount++;
  if (cardCount % 10 === 0) log(`  ${cardCount}/${openCards.length}`);
}

// --- 5. Checklists + items ---
const checklists = trello.checklists || [];
log(`Creating ${checklists.length} checklists…`);
const sortedChecklists = checklists.slice().sort((a, b) => a.pos - b.pos);
// Per-card sequential checklist positions
const clPosPerCard = new Map();
for (const cl of sortedChecklists) {
  const n = (clPosPerCard.get(cl.idCard) || 0) + 1;
  clPosPerCard.set(cl.idCard, n);
  const newTaskId = cardIdMap.get(cl.idCard);
  if (!newTaskId) continue;
  const checklist = await insertOne('huginn_checklists', {
    task_id: newTaskId,
    user_id: userId,
    name: cl.name,
    position: n * 1000,
  });
  const sortedItems = (cl.checkItems || []).slice().sort((a, b) => a.pos - b.pos);
  for (let j = 0; j < sortedItems.length; j++) {
    const item = sortedItems[j];
    try {
      await insertOne('huginn_checklist_items', {
        task_id: newTaskId,
        checklist_id: checklist.id,
        user_id: userId,
        text: item.name,
        checked: item.state === 'complete',
        position: (j + 1) * 1000,
      });
    } catch (e) { console.warn(`  ! item skip: ${e.message}`); }
  }
}

// --- 6. Comments (from actions) ---
const comments = (trello.actions || []).filter(a => a.type === 'commentCard' && a.data?.card?.id && a.data?.text);
if (comments.length) {
  log(`Creating ${comments.length} comments…`);
  // Trello returns actions newest-first; reverse so chronological order is preserved.
  for (const c of comments.reverse()) {
    const newTaskId = cardIdMap.get(c.data.card.id);
    if (!newTaskId) continue;
    const author = c.memberCreator?.fullName || 'unknown';
    const when = c.date ? c.date.slice(0, 10) : '';
    const prefix = `_Imported from Trello — ${author}${when ? ` · ${when}` : ''}_\n\n`;
    try {
      await insertOne('huginn_comments', {
        task_id: newTaskId,
        user_id: userId,
        body: prefix + c.data.text,
      });
    } catch (e) { console.warn(`  ! comment skip: ${e.message}`); }
  }
}

console.log('\n✓ Done.');
console.log(`  Project: ${project.name}  (id=${project.id})`);
console.log(`  Lists: ${listIdMap.size} | Tasks: ${cardIdMap.size} | Labels: ${labelIdMap.size}`);
console.log('  Open Huginn and you should see the new board.');
console.log('\nNote: file attachments (uploads), card members, custom fields, and Trello power-ups were not migrated.');

await supabase.auth.signOut();
