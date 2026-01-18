'use client'

import { TriageStats } from '@/app/api/admin/triage/route'

export type TriageFilter = 'all' | 'rotation' | 'mirror' | 'no_keywords'

interface TriageFilterTabsProps {
  filter: TriageFilter
  onFilterChange: (filter: TriageFilter) => void
  stats: TriageStats | null
  loading?: boolean
}

interface TabConfig {
  id: TriageFilter
  label: string
  getCount: (stats: TriageStats | null) => number
  activeColor: string
  badgeColor: string
}

const tabs: TabConfig[] = [
  {
    id: 'all',
    label: 'All Issues',
    getCount: (stats) => stats?.total || 0,
    activeColor: 'bg-purple-600 text-white',
    badgeColor: 'bg-purple-500'
  },
  {
    id: 'rotation',
    label: 'Rotation',
    getCount: (stats) => stats?.rotation || 0,
    activeColor: 'bg-orange-600 text-white',
    badgeColor: 'bg-orange-500'
  },
  {
    id: 'mirror',
    label: 'Mirror',
    getCount: (stats) => stats?.mirror || 0,
    activeColor: 'bg-blue-600 text-white',
    badgeColor: 'bg-blue-500'
  },
  {
    id: 'no_keywords',
    label: 'No Keywords',
    getCount: (stats) => stats?.no_keywords || 0,
    activeColor: 'bg-amber-600 text-white',
    badgeColor: 'bg-amber-500'
  }
]

export default function TriageFilterTabs({
  filter,
  onFilterChange,
  stats,
  loading
}: TriageFilterTabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const count = tab.getCount(stats)
        const isActive = filter === tab.id

        return (
          <button
            key={tab.id}
            onClick={() => onFilterChange(tab.id)}
            disabled={loading}
            className={`
              px-4 py-2 rounded-lg font-medium transition-colors
              flex items-center gap-2
              disabled:opacity-50 disabled:cursor-not-allowed
              ${
                isActive
                  ? tab.activeColor
                  : 'bg-white text-stone-700 hover:bg-stone-50 border border-stone-200'
              }
            `}
          >
            {tab.label}
            <span
              className={`
                px-2 py-0.5 rounded-full text-xs font-semibold
                ${isActive ? tab.badgeColor : 'bg-stone-100 text-stone-600'}
              `}
            >
              {loading ? '...' : count.toLocaleString()}
            </span>
          </button>
        )
      })}
    </div>
  )
}
