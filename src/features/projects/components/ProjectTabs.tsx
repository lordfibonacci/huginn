type TabType = 'thoughts' | 'tasks' | 'notes'

interface ProjectTabsProps {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
}

const TABS: { value: TabType; label: string }[] = [
  { value: 'thoughts', label: 'Thoughts' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'notes', label: 'Notes' },
]

export function ProjectTabs({ activeTab, onTabChange }: ProjectTabsProps) {
  return (
    <div className="flex border-b border-huginn-border">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onTabChange(tab.value)}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            activeTab === tab.value
              ? 'text-white border-b-2 border-huginn-accent'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
