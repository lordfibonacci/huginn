import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Mark, Wordmark, EmptyState, LoadingScreen } from '../shared/components/Logo'
import { useAgendaTasks, AgendaCard } from '../features/agenda'
import { CardPopup } from '../features/projects/components/CardPopup'
import { ProjectGlyph } from '../features/projects/components/ProjectGlyph'
import { supabase } from '../shared/lib/supabase'
import type { Task, Project } from '../shared/lib/types'

export function TodayPage() {
  const { t, i18n } = useTranslation()
  const { overdueAndToday, thisWeek, myAssignments, starred, completedToday, projectMap, loading } = useAgendaTasks()
  const [selected, setSelected] = useState<Task | null>(null)
  const [weekOpen, setWeekOpen] = useState(false)

  // Re-read the selected task from the freshly-partitioned buckets so edits
  // reflect immediately. Fallback to the original if it's moved out of the
  // agenda (e.g. completed -> done status).
  const visibleTask = useMemo(() => {
    if (!selected) return null
    const all = [...overdueAndToday, ...thisWeek, ...myAssignments, ...starred]
    return all.find(t => t.id === selected.id) ?? selected
  }, [selected, overdueAndToday, thisWeek, myAssignments, starred])

  async function handleUpdate(taskId: string, updates: Record<string, unknown>) {
    const { error } = await supabase.from('huginn_tasks').update(updates).eq('id', taskId)
    if (error) {
      console.error('Failed to update task:', error)
      return false
    }
    return true
  }

  async function handleDelete(taskId: string) {
    const { error } = await supabase.from('huginn_tasks').delete().eq('id', taskId)
    if (error) {
      console.error('Failed to delete task:', error)
      return false
    }
    return true
  }

  // Group thisWeek by date for the expanded view.
  const weekByDate = useMemo(() => {
    const map: Record<string, Task[]> = {}
    for (const t of thisWeek) {
      const key = t.due_date ?? ''
      if (!map[key]) map[key] = []
      map[key].push(t)
    }
    return map
  }, [thisWeek])

  if (loading) return <LoadingScreen message={t('common.loading')} />

  const hasAnything =
    overdueAndToday.length > 0 ||
    thisWeek.length > 0 ||
    myAssignments.length > 0 ||
    starred.length > 0

  const dateLabel = new Intl.DateTimeFormat(i18n.language === 'is' ? 'is-IS' : 'en-US', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date())

  const dayFormatter = new Intl.DateTimeFormat(i18n.language === 'is' ? 'is-IS' : 'en-US', {
    weekday: 'short', day: 'numeric', month: 'short',
  })

  return (
    <>
      <header className="flex items-center justify-between px-4 py-3 border-b border-huginn-border md:px-6 md:py-2 shrink-0 gap-4">
        {/* Mobile: logo + subtitle block. Desktop: the logo lives in GlobalTopBar. */}
        <Link to="/projects" className="flex items-center gap-3 group shrink-0 md:hidden">
          <Mark size={32} />
          <div className="flex flex-col">
            <Wordmark height={20} />
            <p className="text-[11px] text-huginn-text-secondary mt-0.5 capitalize">
              {dateLabel}
            </p>
          </div>
        </Link>
        <p className="hidden md:block text-xs text-huginn-text-muted capitalize">{dateLabel}</p>
        {overdueAndToday.length > 0 && (
          <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-huginn-danger/15 text-huginn-danger shrink-0">
            {t('today.overdueChip', { count: overdueAndToday.length })}
          </span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-24 md:px-6 md:pb-8">
        <div className="max-w-2xl mx-auto pt-4 space-y-6">
          {!hasAnything && (
            <EmptyState
              title={t('today.empty.all.title')}
              hint={t('today.empty.all.hint')}
            />
          )}

          {/* Overdue & Today — always visible; renders a friendly nudge when empty */}
          <Section title={t('today.sections.overdueToday')} count={overdueAndToday.length}>
            {overdueAndToday.length === 0 ? (
              <p className="text-xs text-huginn-text-muted px-1 py-2">{t('today.empty.overdueToday')}</p>
            ) : (
              <div className="space-y-2">
                {overdueAndToday.map(task => (
                  <AgendaCard
                    key={task.id}
                    task={task}
                    project={task.project_id ? projectMap[task.project_id] : undefined}
                    onClick={() => setSelected(task)}
                  />
                ))}
              </div>
            )}
          </Section>

          {/* Due this week */}
          {thisWeek.length > 0 && (
            <Section
              title={t('today.sections.thisWeek')}
              count={thisWeek.length}
              collapsible
              open={weekOpen}
              onToggle={() => setWeekOpen(o => !o)}
            >
              {weekOpen && (
                <div className="space-y-4">
                  {Object.keys(weekByDate).sort().map(date => (
                    <div key={date}>
                      <p className="text-[11px] uppercase tracking-wide text-huginn-text-muted mb-1.5 px-1">
                        {dayFormatter.format(new Date(date + 'T00:00:00'))}
                      </p>
                      <div className="space-y-2">
                        {weekByDate[date].map(task => (
                          <AgendaCard
                            key={task.id}
                            task={task}
                            project={task.project_id ? projectMap[task.project_id] : undefined}
                            onClick={() => setSelected(task)}
                            showDue={false}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {/* My assignments — grouped by project so long lists stay scannable */}
          {myAssignments.length > 0 && (
            <Section title={t('today.sections.myWork')} count={myAssignments.length}>
              <MyAssignmentsGrouped
                tasks={myAssignments}
                projectMap={projectMap}
                onTaskTap={setSelected}
              />
            </Section>
          )}

          {/* Starred */}
          {starred.length > 0 && (
            <Section title={t('today.sections.starred')} count={starred.length}>
              <div className="space-y-2">
                {starred.map(task => (
                  <AgendaCard
                    key={task.id}
                    task={task}
                    project={task.project_id ? projectMap[task.project_id] : undefined}
                    onClick={() => setSelected(task)}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* Completed-today win footer */}
          {completedToday > 0 && (
            <div className="flex items-center gap-2 text-xs text-huginn-success px-1 pt-2 pb-4">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 1.4-1.4L8 12.58l7.3-7.3a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
              </svg>
              <span>{t('today.completedToday', { count: completedToday })}</span>
            </div>
          )}
        </div>
      </div>

      {visibleTask && (
        <CardPopup
          task={visibleTask}
          projectId={visibleTask.project_id ?? ''}
          lists={[]}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}

interface MyAssignmentsGroupedProps {
  tasks: Task[]
  projectMap: Record<string, Project>
  onTaskTap: (task: Task) => void
}

function MyAssignmentsGrouped({ tasks, projectMap, onTaskTap }: MyAssignmentsGroupedProps) {
  // Group by project_id. Default all groups expanded — small projects are fine
  // to scan; larger ones the user can collapse.
  const byProject = new Map<string, Task[]>()
  for (const t of tasks) {
    const key = t.project_id ?? ''
    if (!byProject.has(key)) byProject.set(key, [])
    byProject.get(key)!.push(t)
  }
  const groups = Array.from(byProject.entries())
    .map(([id, items]) => ({ id, project: projectMap[id], items }))
    .sort((a, b) => (a.project?.name ?? '').localeCompare(b.project?.name ?? ''))

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  return (
    <div className="space-y-3">
      {groups.map(({ id, project, items }) => {
        const isCollapsed = collapsed[id] ?? false
        return (
          <div key={id || 'unknown'}>
            <button
              type="button"
              onClick={() => setCollapsed(c => ({ ...c, [id]: !isCollapsed }))}
              className="w-full flex items-center gap-2 px-1 py-1 group"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
                fill="currentColor"
                className={`w-3 h-3 text-huginn-text-muted transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
              >
                <path d="M5.72 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.44 8 5.72 4.28a.75.75 0 0 1 0-1.06Z" />
              </svg>
              {project && <ProjectGlyph color={project.color} size={12} glow={false} />}
              <span className="text-[11px] uppercase tracking-wide font-semibold text-huginn-text-secondary group-hover:text-white transition-colors">
                {project?.name ?? ''}
              </span>
              <span className="text-[11px] text-huginn-text-muted">({items.length})</span>
            </button>
            {!isCollapsed && (
              <div className="space-y-2 mt-1.5">
                {items.map(task => (
                  <AgendaCard
                    key={task.id}
                    task={task}
                    onClick={() => onTaskTap(task)}
                    showDue={false}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

interface SectionProps {
  title: string
  count: number
  collapsible?: boolean
  open?: boolean
  onToggle?: () => void
  children: React.ReactNode
}

function Section({ title, count, collapsible, open, onToggle, children }: SectionProps) {
  return (
    <section>
      {collapsible ? (
        <button
          type="button"
          onClick={onToggle}
          className="w-full flex items-center justify-between px-1 py-1 mb-2 group"
        >
          <h2 className="text-xs font-bold uppercase tracking-wide text-huginn-text-secondary">
            {title} <span className="text-huginn-text-muted">({count})</span>
          </h2>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className={`w-3.5 h-3.5 text-huginn-text-muted transition-transform ${open ? 'rotate-90' : ''}`}
          >
            <path d="M5.72 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.44 8 5.72 4.28a.75.75 0 0 1 0-1.06Z" />
          </svg>
        </button>
      ) : (
        <h2 className="text-xs font-bold uppercase tracking-wide text-huginn-text-secondary mb-2 px-1">
          {title} <span className="text-huginn-text-muted">({count})</span>
        </h2>
      )}
      {children}
    </section>
  )
}
