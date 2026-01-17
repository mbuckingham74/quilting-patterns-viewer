'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ApprovedUser {
  id: string
  email: string
  display_name: string | null
  // Pre-formatted dates from server to avoid hydration mismatch
  created_at_formatted: string
  approved_at_formatted: string
  last_sign_in_at_formatted: string
}

interface ApprovedUserRowProps {
  user: ApprovedUser
}

export default function ApprovedUserRow({ user }: ApprovedUserRowProps) {
  const router = useRouter()
  const [revoking, setRevoking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRevoke = async () => {
    if (!confirm(`Are you sure you want to revoke access for ${user.email}? They will need to be re-approved to access the site.`)) {
      return
    }

    setRevoking(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/users/${user.id}/revoke`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to revoke access')
      }

      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to revoke access')
    } finally {
      setRevoking(false)
    }
  }

  return (
    <tr className="hover:bg-stone-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
            <span className="text-green-700 font-medium text-sm">
              {(user.display_name || user.email || '?')[0].toUpperCase()}
            </span>
          </div>
          <span className="text-sm font-medium text-stone-900">
            {user.display_name || '—'}
          </span>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="text-sm text-stone-600">{user.email}</span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="text-sm text-stone-500">{user.created_at_formatted}</span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="text-sm text-stone-500">{user.approved_at_formatted}</span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="text-sm text-stone-500">{user.last_sign_in_at_formatted}</span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        {error && (
          <span className="text-xs text-red-600 mr-2">{error}</span>
        )}
        <button
          onClick={handleRevoke}
          disabled={revoking}
          className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {revoking ? 'Revoking...' : 'Revoke'}
        </button>
      </td>
    </tr>
  )
}
