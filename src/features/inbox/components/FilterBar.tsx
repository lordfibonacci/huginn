type FilterType = 'all' | 'idea' | 'task' | 'note'
type SortType = 'newest' | 'priority'

interface FilterBarProps {
  activeFilter: FilterType
  onFilterChange: (filter: FilterType) => void
  sortBy: SortType
  onSortChange: (sort: SortType) => void
}

const FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'idea', label: 'Ideas' },
  { value: 'task', label: 'Tasks' },
  { value: 'note', label: 'Notes' },
]

export function FilterBar({ activeFilter, onFilterChange, sortBy, onSortChange }: FilterBarProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-huginn-border">
      <div className="flex gap-2 flex-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => onFilterChange(f.value)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              activeFilter === f.value
                ? 'bg-huginn-accent text-white shadow-md shadow-huginn-accent/40'
                : 'bg-huginn-card text-gray-400 hover:bg-huginn-hover hover:text-gray-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <button
        onClick={() => onSortChange(sortBy === 'newest' ? 'priority' : 'newest')}
        className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-white hover:bg-huginn-card rounded-lg px-3 py-1.5 transition-colors"
        title={sortBy === 'newest' ? 'Sort by priority' : 'Sort by newest'}
      >
        {sortBy === 'newest' ? (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm.75 4.75v3.69l2.28 2.28a.75.75 0 1 1-1.06 1.06l-2.5-2.5A.75.75 0 0 1 9.25 11V6.75a.75.75 0 0 1 1.5 0Z" />
            </svg>
            New
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M3.5 2.75a.75.75 0 0 0-1.5 0v14.5a.75.75 0 0 0 1.5 0v-14.5ZM7.5 6a.75.75 0 0 0 0 1.5h4a.75.75 0 0 0 0-1.5h-4Zm0 4a.75.75 0 0 0 0 1.5h7a.75.75 0 0 0 0-1.5h-7Zm0 4a.75.75 0 0 0 0 1.5h10a.75.75 0 0 0 0-1.5H7.5Z" />
            </svg>
            Priority
          </>
        )}
      </button>
    </div>
  )
}
