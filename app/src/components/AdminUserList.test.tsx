/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import AdminUserList from './AdminUserList'
import { Profile } from '@/lib/types'

// Mock fetch
const mockFetch = vi.fn()

// Mock window.confirm
const mockConfirm = vi.fn()

// Mock window.alert
const mockAlert = vi.fn()

describe('AdminUserList', () => {
  const mockUsers: Profile[] = [
    {
      id: 'user-1',
      email: 'pending@example.com',
      display_name: 'Pending User',
      is_approved: false,
      is_admin: false,
      created_at: '2026-01-15T10:30:00Z',
    },
    {
      id: 'user-2',
      email: 'approved@example.com',
      display_name: 'Approved User',
      is_approved: true,
      is_admin: false,
      created_at: '2026-01-10T08:00:00Z',
      approved_at: '2026-01-11T09:00:00Z',
    },
    {
      id: 'user-3',
      email: 'admin@example.com',
      display_name: null,
      is_approved: true,
      is_admin: true,
      created_at: '2026-01-01T00:00:00Z',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mockFetch)
    vi.stubGlobal('confirm', mockConfirm)
    vi.stubGlobal('alert', mockAlert)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
    mockConfirm.mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe('rendering', () => {
    it('renders tabs with correct counts', () => {
      render(<AdminUserList initialUsers={mockUsers} />)

      expect(screen.getByRole('button', { name: 'Pending (1)' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Approved (2)' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'All (3)' })).toBeInTheDocument()
    })

    it('renders pending tab as active by default', () => {
      render(<AdminUserList initialUsers={mockUsers} />)

      const pendingTab = screen.getByRole('button', { name: 'Pending (1)' })
      expect(pendingTab).toHaveClass('bg-amber-500')
    })

    it('renders user table with headers', () => {
      render(<AdminUserList initialUsers={mockUsers} />)

      expect(screen.getByText('User')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
      expect(screen.getByText('Signed Up')).toBeInTheDocument()
      expect(screen.getByText('Actions')).toBeInTheDocument()
    })

    it('renders user email', () => {
      render(<AdminUserList initialUsers={mockUsers} />)

      expect(screen.getByText('pending@example.com')).toBeInTheDocument()
    })

    it('renders user display name when present', () => {
      render(<AdminUserList initialUsers={mockUsers} />)

      expect(screen.getByText('Pending User')).toBeInTheDocument()
    })

    it('renders admin badge for admin users', () => {
      render(<AdminUserList initialUsers={mockUsers} />)

      // Switch to All tab to see admin
      fireEvent.click(screen.getByRole('button', { name: 'All (3)' }))

      expect(screen.getByText('Admin')).toBeInTheDocument()
    })

    it('renders pending status for unapproved users', () => {
      render(<AdminUserList initialUsers={mockUsers} />)

      expect(screen.getByText('Pending')).toBeInTheDocument()
    })

    it('renders approved status for approved users', () => {
      render(<AdminUserList initialUsers={mockUsers} />)

      // Switch to Approved tab
      fireEvent.click(screen.getByRole('button', { name: 'Approved (2)' }))

      expect(screen.getAllByText('Approved').length).toBeGreaterThan(0)
    })

    it('formats date correctly', () => {
      render(<AdminUserList initialUsers={mockUsers} />)

      // The date format is: "Jan 15, 2026, 10:30 AM" or similar
      // Just check for part of the date
      expect(screen.getByText(/Jan 15, 2026/)).toBeInTheDocument()
    })

    it('renders empty state when no users', () => {
      render(<AdminUserList initialUsers={[]} />)

      expect(screen.getByText('No pending users')).toBeInTheDocument()
    })
  })

  describe('tab filtering', () => {
    it('shows only pending users by default', () => {
      render(<AdminUserList initialUsers={mockUsers} />)

      expect(screen.getByText('pending@example.com')).toBeInTheDocument()
      expect(screen.queryByText('approved@example.com')).not.toBeInTheDocument()
      expect(screen.queryByText('admin@example.com')).not.toBeInTheDocument()
    })

    it('switches to approved tab and shows approved users', () => {
      render(<AdminUserList initialUsers={mockUsers} />)

      fireEvent.click(screen.getByRole('button', { name: 'Approved (2)' }))

      expect(screen.queryByText('pending@example.com')).not.toBeInTheDocument()
      expect(screen.getByText('approved@example.com')).toBeInTheDocument()
      expect(screen.getByText('admin@example.com')).toBeInTheDocument()
    })

    it('switches to all tab and shows all users', () => {
      render(<AdminUserList initialUsers={mockUsers} />)

      fireEvent.click(screen.getByRole('button', { name: 'All (3)' }))

      expect(screen.getByText('pending@example.com')).toBeInTheDocument()
      expect(screen.getByText('approved@example.com')).toBeInTheDocument()
      expect(screen.getByText('admin@example.com')).toBeInTheDocument()
    })

    it('highlights active tab correctly', () => {
      render(<AdminUserList initialUsers={mockUsers} />)

      // Initially pending is active
      expect(screen.getByRole('button', { name: 'Pending (1)' })).toHaveClass('bg-amber-500')

      // Click approved
      fireEvent.click(screen.getByRole('button', { name: 'Approved (2)' }))
      expect(screen.getByRole('button', { name: 'Approved (2)' })).toHaveClass('bg-green-500')
      expect(screen.getByRole('button', { name: 'Pending (1)' })).not.toHaveClass('bg-amber-500')

      // Click all
      fireEvent.click(screen.getByRole('button', { name: 'All (3)' }))
      expect(screen.getByRole('button', { name: 'All (3)' })).toHaveClass('bg-purple-500')
    })

    it('shows correct empty state for approved tab', () => {
      const onlyPendingUsers = [mockUsers[0]]
      render(<AdminUserList initialUsers={onlyPendingUsers} />)

      fireEvent.click(screen.getByRole('button', { name: 'Approved (0)' }))

      expect(screen.getByText('No approved users')).toBeInTheDocument()
    })

    it('shows correct empty state for all tab', () => {
      render(<AdminUserList initialUsers={[]} />)

      fireEvent.click(screen.getByRole('button', { name: 'All (0)' }))

      expect(screen.getByText('No users found')).toBeInTheDocument()
    })
  })

  describe('approve action', () => {
    it('shows Approve button for pending users', () => {
      render(<AdminUserList initialUsers={mockUsers} />)

      expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument()
    })

    it('hides Approve button for approved users', () => {
      render(<AdminUserList initialUsers={mockUsers} />)

      fireEvent.click(screen.getByRole('button', { name: 'Approved (2)' }))

      expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
    })

    it('calls approve API when Approve button clicked', async () => {
      render(<AdminUserList initialUsers={mockUsers} />)

      fireEvent.click(screen.getByRole('button', { name: 'Approve' }))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/admin/users/user-1/approve', {
          method: 'POST',
        })
      })
    })

    it('shows loading state while approving', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {}))

      render(<AdminUserList initialUsers={mockUsers} />)

      fireEvent.click(screen.getByRole('button', { name: 'Approve' }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Approving...' })).toBeDisabled()
      })
    })

    it('updates user to approved on success', async () => {
      render(<AdminUserList initialUsers={mockUsers} />)

      // Initially 1 pending, 2 approved
      expect(screen.getByRole('button', { name: 'Pending (1)' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Approved (2)' })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Approve' }))

      await waitFor(() => {
        // Now 0 pending, 3 approved
        expect(screen.getByRole('button', { name: 'Pending (0)' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Approved (3)' })).toBeInTheDocument()
      })
    })

    it('shows empty state after approving last pending user', async () => {
      render(<AdminUserList initialUsers={mockUsers} />)

      fireEvent.click(screen.getByRole('button', { name: 'Approve' }))

      await waitFor(() => {
        expect(screen.getByText('No pending users')).toBeInTheDocument()
      })
    })

    it('shows alert on API error response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'User not found' }),
      })

      render(<AdminUserList initialUsers={mockUsers} />)

      fireEvent.click(screen.getByRole('button', { name: 'Approve' }))

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('User not found')
      })
    })

    it('shows default error message when API returns no error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      })

      render(<AdminUserList initialUsers={mockUsers} />)

      fireEvent.click(screen.getByRole('button', { name: 'Approve' }))

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('Failed to approve user')
      })
    })

    it('shows alert on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      render(<AdminUserList initialUsers={mockUsers} />)

      fireEvent.click(screen.getByRole('button', { name: 'Approve' }))

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('Failed to approve user')
      })
      expect(console.error).toHaveBeenCalled()
    })
  })

  describe('reject/remove action', () => {
    it('shows Remove button for non-admin users', () => {
      render(<AdminUserList initialUsers={mockUsers} />)

      expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument()
    })

    it('hides Remove button for admin users', () => {
      render(<AdminUserList initialUsers={mockUsers} />)

      fireEvent.click(screen.getByRole('button', { name: 'All (3)' }))

      // Find the admin row and check it doesn't have a Remove button
      const adminRow = screen.getByText('admin@example.com').closest('tr')
      expect(within(adminRow!).queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
    })

    it('shows confirmation dialog when Remove clicked', async () => {
      render(<AdminUserList initialUsers={mockUsers} />)

      fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

      expect(mockConfirm).toHaveBeenCalledWith(
        'Are you sure you want to reject and remove pending@example.com? They will need to sign up again.'
      )
    })

    it('does not call API when confirmation is declined', async () => {
      mockConfirm.mockReturnValue(false)

      render(<AdminUserList initialUsers={mockUsers} />)

      fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('calls reject API when confirmation is accepted', async () => {
      render(<AdminUserList initialUsers={mockUsers} />)

      fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/admin/users/user-1/reject', {
          method: 'POST',
        })
      })
    })

    it('shows loading state while removing', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {}))

      render(<AdminUserList initialUsers={mockUsers} />)

      fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Removing...' })).toBeDisabled()
      })
    })

    it('removes user from list on success', async () => {
      render(<AdminUserList initialUsers={mockUsers} />)

      expect(screen.getByText('pending@example.com')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

      await waitFor(() => {
        expect(screen.queryByText('pending@example.com')).not.toBeInTheDocument()
      })
    })

    it('updates counts after removing user', async () => {
      render(<AdminUserList initialUsers={mockUsers} />)

      expect(screen.getByRole('button', { name: 'Pending (1)' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'All (3)' })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Pending (0)' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'All (2)' })).toBeInTheDocument()
      })
    })

    it('shows alert on API error response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Cannot reject admin' }),
      })

      render(<AdminUserList initialUsers={mockUsers} />)

      fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('Cannot reject admin')
      })
    })

    it('shows default error message when API returns no error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      })

      render(<AdminUserList initialUsers={mockUsers} />)

      fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('Failed to reject user')
      })
    })

    it('shows alert on network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      render(<AdminUserList initialUsers={mockUsers} />)

      fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith('Failed to reject user')
      })
      expect(console.error).toHaveBeenCalled()
    })

    it('can remove approved non-admin user', async () => {
      render(<AdminUserList initialUsers={mockUsers} />)

      // Switch to approved tab
      fireEvent.click(screen.getByRole('button', { name: 'Approved (2)' }))

      // Find the non-admin approved user row and click Remove
      const approvedRow = screen.getByText('approved@example.com').closest('tr')
      const removeButton = within(approvedRow!).getByRole('button', { name: 'Remove' })

      fireEvent.click(removeButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/admin/users/user-2/reject', {
          method: 'POST',
        })
      })
    })
  })

  describe('multiple users interaction', () => {
    it('disables other action buttons while one action is loading', async () => {
      mockFetch.mockImplementation(() => new Promise(() => {}))

      const twoUsersData: Profile[] = [
        {
          id: 'user-a',
          email: 'a@example.com',
          display_name: null,
          is_approved: false,
          is_admin: false,
          created_at: '2026-01-15T10:30:00Z',
        },
        {
          id: 'user-b',
          email: 'b@example.com',
          display_name: null,
          is_approved: false,
          is_admin: false,
          created_at: '2026-01-14T10:30:00Z',
        },
      ]

      render(<AdminUserList initialUsers={twoUsersData} />)

      const approveButtons = screen.getAllByRole('button', { name: 'Approve' })

      // Click first approve
      fireEvent.click(approveButtons[0])

      await waitFor(() => {
        // First button shows loading
        expect(screen.getByRole('button', { name: 'Approving...' })).toBeDisabled()
        // Second button is still Approve (not disabled by the other's loading)
        expect(screen.getByRole('button', { name: 'Approve' })).not.toBeDisabled()
      })
    })
  })
})
