import { useTranslation } from 'react-i18next'
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Project, ProjectStatus } from '../../../shared/lib/types'
import { ProjectCard } from './ProjectCard'
import { PendingInvitesPanel } from './PendingInvitesPanel'
import { LoadingScreen, EmptyState } from '../../../shared/components/Logo'
import { useTaskCounts } from '../../../shared/hooks/useTaskCounts'
import { usePendingInvites } from '../hooks/usePendingInvites'
import { useAllProjectMembers } from '../hooks/useAllProjectMembers'

interface ProjectListProps {
  projects: Project[]
  loading: boolean
  onProjectTap: (project: Project) => void
  onCreateProject?: () => void
  onReorder?: (status: ProjectStatus, orderedIds: string[]) => void
}

const STATUS_ORDER: { key: ProjectStatus; labelKey: string }[] = [
  { key: 'active', labelKey: 'projects.status.active' },
  { key: 'hold', labelKey: 'projects.status.hold' },
  { key: 'idea', labelKey: 'projects.status.idea' },
  { key: 'done', labelKey: 'projects.status.done' },
]

export function ProjectList({ projects, loading, onProjectTap, onCreateProject, onReorder }: ProjectListProps) {
  const { t } = useTranslation()
  const { counts } = useTaskCounts()
  const { count: invitesCount } = usePendingInvites()
  const membersByProject = useAllProjectMembers()

  // Require ~6px movement before a drag actually starts so card taps still
  // navigate to the board instead of being interpreted as drags.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  if (loading) {
    return <LoadingScreen message={t('projects.list.loading')} />
  }

  if (projects.length === 0 && invitesCount === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <EmptyState
          title={t('projects.list.emptyTitle')}
          hint={t('projects.list.emptyHint')}
        />
        {onCreateProject && (
          <button
            onClick={onCreateProject}
            className="mt-4 inline-flex items-center gap-2 bg-huginn-accent hover:bg-huginn-accent-hover text-white text-sm font-semibold rounded-lg px-5 py-2.5 shadow-md shadow-huginn-accent/30 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M10 3a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H4a1 1 0 1 1 0-2h5V4a1 1 0 0 1 1-1Z" />
            </svg>
            {t('projects.list.createFirst')}
          </button>
        )}
      </div>
    )
  }

  const grouped = STATUS_ORDER.map(({ key, labelKey }) => ({
    key,
    label: t(labelKey),
    items: projects.filter((p) => p.status === key),
  })).filter((g) => g.items.length > 0)

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <PendingInvitesPanel />
        {projects.length === 0 && onCreateProject && (
          <div className="flex flex-col items-center justify-center py-10">
            <EmptyState
              title={t('projects.list.emptyTitle')}
              hint={t('projects.list.emptyHintWithInvites')}
            />
            <button
              onClick={onCreateProject}
              className="mt-4 inline-flex items-center gap-2 bg-huginn-accent hover:bg-huginn-accent-hover text-white text-sm font-semibold rounded-lg px-5 py-2.5 shadow-md shadow-huginn-accent/30 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M10 3a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H4a1 1 0 1 1 0-2h5V4a1 1 0 0 1 1-1Z" />
              </svg>
              {t('projects.list.createBoard')}
            </button>
          </div>
        )}
        {grouped.map((group, groupIdx) => (
          <SortableProjectGrid
            key={group.key}
            group={group}
            isFirst={groupIdx === 0}
            counts={counts}
            membersByProject={membersByProject}
            onProjectTap={onProjectTap}
            onCreateProject={onCreateProject}
            sensors={sensors}
            onReorder={onReorder ? (orderedIds) => onReorder(group.key, orderedIds) : undefined}
          />
        ))}
      </div>
    </div>
  )
}

interface SortableProjectGridProps {
  group: { key: ProjectStatus; label: string; items: Project[] }
  isFirst: boolean
  counts: Record<string, number>
  membersByProject: Record<string, import('../../../shared/lib/types').Profile[]>
  onProjectTap: (project: Project) => void
  onCreateProject?: () => void
  sensors: ReturnType<typeof useSensors>
  onReorder?: (orderedIds: string[]) => void
}

function SortableProjectGrid({ group, isFirst, counts, membersByProject, onProjectTap, onCreateProject, sensors, onReorder }: SortableProjectGridProps) {
  const { t } = useTranslation()
  const itemIds = group.items.map((p) => p.id)

  function handleDragEnd(event: DragEndEvent) {
    if (!onReorder) return
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = itemIds.indexOf(String(active.id))
    const newIndex = itemIds.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return
    const reordered = arrayMove(itemIds, oldIndex, newIndex)
    onReorder(reordered)
  }

  return (
    <section className="mb-8">
      <h2 className="text-[11px] uppercase tracking-widest text-huginn-text-secondary font-semibold mb-3 px-0.5">
        {group.label}
      </h2>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={itemIds} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {group.items.map((project) => (
              <SortableProjectCard
                key={project.id}
                project={project}
                taskCount={counts[project.id]}
                sharedWith={membersByProject[project.id]}
                onClick={() => onProjectTap(project)}
              />
            ))}
            {isFirst && onCreateProject && (
              <NewProjectTile onClick={onCreateProject} label={t('projects.list.newProjectTile')} />
            )}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  )
}

interface SortableProjectCardProps {
  project: Project
  taskCount?: number
  sharedWith?: import('../../../shared/lib/types').Profile[]
  onClick: () => void
}

function SortableProjectCard({ project, taskCount, sharedWith, onClick }: SortableProjectCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={isDragging ? 'opacity-40' : ''}
    >
      <ProjectCard
        project={project}
        taskCount={taskCount}
        sharedWith={sharedWith}
        onClick={onClick}
      />
    </div>
  )
}

function NewProjectTile({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="h-32 w-full rounded-xl border border-dashed border-huginn-border bg-huginn-card/40 hover:bg-huginn-card hover:border-huginn-accent/60 transition-colors flex flex-col items-center justify-center gap-1.5 text-huginn-text-muted hover:text-huginn-text-primary group"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 group-hover:text-huginn-accent transition-colors">
        <path d="M10 3a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H4a1 1 0 1 1 0-2h5V4a1 1 0 0 1 1-1Z" />
      </svg>
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}
