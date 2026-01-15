import { ReactNode } from 'react'

interface StatCardProps {
  title: string
  value: number | string
  subtitle?: string
  icon: ReactNode
  color?: 'purple' | 'indigo' | 'blue' | 'green' | 'amber' | 'rose'
}

const colorClasses = {
  purple: 'bg-purple-100 text-purple-600',
  indigo: 'bg-indigo-100 text-indigo-600',
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-green-100 text-green-600',
  amber: 'bg-amber-100 text-amber-600',
  rose: 'bg-rose-100 text-rose-600',
}

export default function StatCard({ title, value, subtitle, icon, color = 'purple' }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-stone-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-stone-900">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs text-stone-500">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}
