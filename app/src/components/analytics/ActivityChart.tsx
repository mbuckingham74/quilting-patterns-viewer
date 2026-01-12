'use client'

import { useMemo } from 'react'

interface ActivityData {
  date: string
  count: number
}

interface ActivityChartProps {
  downloads: ActivityData[]
  searches: ActivityData[]
  signups: ActivityData[]
}

export default function ActivityChart({ downloads, searches, signups }: ActivityChartProps) {
  // Find max value for scaling
  const maxValue = useMemo(() => {
    const allCounts = [...downloads, ...searches, ...signups].map(d => d.count)
    return Math.max(...allCounts, 1)
  }, [downloads, searches, signups])

  // Calculate height percentage for a value
  const getHeight = (value: number) => {
    return Math.max((value / maxValue) * 100, 2) // Minimum 2% height for visibility
  }

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Only show every 5th label to avoid crowding
  const shouldShowLabel = (index: number) => index % 5 === 0

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
      <h3 className="text-sm font-medium text-stone-700 mb-4">Activity (Last 30 Days)</h3>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-indigo-500" />
          <span className="text-stone-600">Downloads</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-purple-500" />
          <span className="text-stone-600">Searches</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span className="text-stone-600">Signups</span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-40 flex items-end gap-0.5">
        {downloads.map((d, i) => (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5">
            {/* Bars */}
            <div className="w-full flex gap-px h-32 items-end">
              <div
                className="flex-1 bg-indigo-500 rounded-t transition-all hover:bg-indigo-600"
                style={{ height: `${getHeight(d.count)}%` }}
                title={`Downloads: ${d.count}`}
              />
              <div
                className="flex-1 bg-purple-500 rounded-t transition-all hover:bg-purple-600"
                style={{ height: `${getHeight(searches[i]?.count || 0)}%` }}
                title={`Searches: ${searches[i]?.count || 0}`}
              />
              <div
                className="flex-1 bg-green-500 rounded-t transition-all hover:bg-green-600"
                style={{ height: `${getHeight(signups[i]?.count || 0)}%` }}
                title={`Signups: ${signups[i]?.count || 0}`}
              />
            </div>
            {/* Label */}
            {shouldShowLabel(i) && (
              <span className="text-[10px] text-stone-400 mt-1 whitespace-nowrap">
                {formatDate(d.date)}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Empty state */}
      {downloads.length === 0 && (
        <div className="h-40 flex items-center justify-center text-stone-400 text-sm">
          No activity data yet
        </div>
      )}
    </div>
  )
}
