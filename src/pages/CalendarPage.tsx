import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Mark, Wordmark, LoadingScreen } from '../shared/components/Logo'
import { CalendarView } from '../features/projects/components/CalendarView'
import { CardPopup } from '../features/projects/components/CardPopup'
import { useCalendarTasks } from '../features/agenda'
import { supabase } from '../shared/lib/supabase'
import type { Task } from '../shared/lib/types'

export function CalendarPage() {
  const { t } = useTranslation()
  const { tasks, projectMap, loading } = useCalendarTasks()
  const [selected, setSelected] = useState<Task | null>(null)

  const colorByTaskId = useMemo(() => {
    const map: Record<string, string> = {}
    for (const task of tasks) {
      if (task.project_id) {
        const p = projectMap[task.project_id]
        if (p) map[task.id] = p.color
      }
    }
    return map
  }, [tasks, projectMap])

  // Keep the popup in sync with realtime task edits.
  const visibleTask = selected ? tasks.find(t => t.id === selected.id) ?? selected : null

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

  if (loading) return <LoadingScreen message={t('common.loading')} />

  return (
    <>
      {/* Mobile header only — desktop nav is in GlobalTopBar. */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-huginn-border shrink-0 gap-4 md:hidden">
        <Link to="/projects" className="flex items-center gap-3 group shrink-0">
          <Mark size={32} />
          <div className="flex flex-col">
            <Wordmark height={20} />
            <p className="text-[11px] text-huginn-text-secondary mt-0.5">
              {t('calendar.pageSubtitle')}
            </p>
          </div>
        </Link>
      </header>

      <CalendarView
        tasks={tasks}
        onTaskTap={setSelected}
        projectColorByTaskId={colorByTaskId}
      />

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
