'use client'

import { useState } from 'react'
import { Profile } from '@/lib/types'

interface AdminUserListProps {
  initialUsers: Profile[]
}

type FilterTab = 'pending' | 'approved' | 'all'

export default function AdminUserList({ initialUsers }: AdminUserListProps) {
  const [users, setUsers] = useState<Profile[]>(initialUsers)
  const [activeTab, setActiveTab] = useState<FilterTab>('pending')
  const [loading, setLoading] = useState<string | null>(null)

  const filteredUsers = users.filter(user => {
    if (activeTab === 'pending') return !user.is_approved
    if (activeTab === 'approved') return user.is_approved
    return true
  })

  const pendingCount = users.filter(u => !u.is_approved).length
  const approvedCount = users.filter(u => u.is_approved).length

  const handleApprove = async (userId: string) => {
    setLoading(userId)
    try {
      const response = await fetch(`/api/admin/users/${userId}/approve`, {
        method: 'POST',
      })

      if (response.ok) {
        setUsers(prev =>
          prev.map(u =>
            u.id === userId
              ? { ...u, is_approved: true, approved_at: new Date().toISOString() }
              : u
          )
        )
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to approve user')
      }
    } catch (error) {
      console.error('Error approving user:', error)
      alert('Failed to approve user')
    } finally {
      setLoading(null)
    }
  }

  const handleReject = async (userId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to reject and remove ${userEmail}? They will need to sign up again.`)) {
      return
    }

    setLoading(userId)
    try {
      const response = await fetch(`/api/admin/users/${userId}/reject`, {
        method: 'POST',
      })

      if (response.ok) {
        setUsers(prev => prev.filter(u => u.id !== userId))
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to reject user')
      }
    } catch (error) {
      console.error('Error rejecting user:', error)
      alert('Failed to reject user')
    } finally {
      setLoading(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'pending'
              ? 'bg-amber-500 text-white'
              : 'bg-white text-stone-600 hover:bg-stone-100'
          }`}
        >
          Pending ({pendingCount})
        </button>
        <button
          onClick={() => setActiveTab('approved')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'approved'
              ? 'bg-green-500 text-white'
              : 'bg-white text-stone-600 hover:bg-stone-100'
          }`}
        >
          Approved ({approvedCount})
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'all'
              ? 'bg-purple-500 text-white'
              : 'bg-white text-stone-600 hover:bg-stone-100'
          }`}
        >
          All ({users.length})
        </button>
      </div>

      {/* User List */}
      {filteredUsers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-8 text-center">
          <p className="text-stone-500">
            {activeTab === 'pending'
              ? 'No pending users'
              : activeTab === 'approved'
              ? 'No approved users'
              : 'No users found'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-purple-50 border-b border-purple-100">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-medium text-stone-600">User</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-stone-600">Status</th>
                <th className="text-left px-6 py-3 text-sm font-medium text-stone-600">Signed Up</th>
                <th className="text-right px-6 py-3 text-sm font-medium text-stone-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-50">
              {filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-purple-50/50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-stone-800">{user.email}</p>
                      {user.display_name && (
                        <p className="text-sm text-stone-500">{user.display_name}</p>
                      )}
                      {user.is_admin && (
                        <span className="inline-block mt-1 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                          Admin
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {user.is_approved ? (
                      <span className="inline-flex items-center gap-1 text-green-600">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Approved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-600">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-stone-500">
                    {formatDate(user.created_at)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      {!user.is_approved && (
                        <button
                          onClick={() => handleApprove(user.id)}
                          disabled={loading === user.id}
                          className="px-3 py-1.5 bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          {loading === user.id ? 'Approving...' : 'Approve'}
                        </button>
                      )}
                      {!user.is_admin && (
                        <button
                          onClick={() => handleReject(user.id, user.email)}
                          disabled={loading === user.id}
                          className="px-3 py-1.5 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          {loading === user.id ? 'Removing...' : 'Remove'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
