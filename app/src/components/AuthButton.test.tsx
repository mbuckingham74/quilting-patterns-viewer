/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AuthButton from './AuthButton'

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

// Mock Supabase client
const mockGetSession = vi.fn()
const mockSignOut = vi.fn()
const mockOnAuthStateChange = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: mockGetSession,
      signOut: mockSignOut,
      onAuthStateChange: mockOnAuthStateChange,
    },
    from: mockFrom,
  }),
}))

describe('AuthButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Suppress console.log from component
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // Default mock implementations
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('loading state', () => {
    it('shows loading skeleton initially', () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null })

      render(<AuthButton />)

      // Should show skeleton during loading
      const skeleton = document.querySelector('.animate-pulse')
      expect(skeleton).toBeInTheDocument()
    })
  })

  describe('unauthenticated state', () => {
    it('shows Sign in link when user is not authenticated', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null })

      render(<AuthButton />)

      await waitFor(() => {
        expect(screen.getByText('Sign in')).toBeInTheDocument()
      })

      const signInLink = screen.getByText('Sign in')
      expect(signInLink.closest('a')).toHaveAttribute('href', '/auth/login')
    })
  })

  describe('authenticated state', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
    }

    beforeEach(() => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null,
      })
    })

    it('shows user email when authenticated', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { is_admin: false }, error: null }),
          }),
        }),
      })

      render(<AuthButton />)

      await waitFor(() => {
        expect(screen.getByText('test@example.com')).toBeInTheDocument()
      })
    })

    it('shows Account link when authenticated', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { is_admin: false }, error: null }),
          }),
        }),
      })

      render(<AuthButton />)

      await waitFor(() => {
        expect(screen.getByText('Account')).toBeInTheDocument()
      })

      const accountLink = screen.getByText('Account')
      expect(accountLink.closest('a')).toHaveAttribute('href', '/account')
    })

    it('shows Sign out button when authenticated', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { is_admin: false }, error: null }),
          }),
        }),
      })

      render(<AuthButton />)

      await waitFor(() => {
        expect(screen.getByText('Sign out')).toBeInTheDocument()
      })
    })

    it('does not show Admin link for non-admin users', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { is_admin: false }, error: null }),
          }),
        }),
      })

      render(<AuthButton />)

      await waitFor(() => {
        expect(screen.getByText('Account')).toBeInTheDocument()
      })

      expect(screen.queryByText('Admin')).not.toBeInTheDocument()
    })

    it('shows Admin link for admin users', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { is_admin: true }, error: null }),
          }),
        }),
      })

      render(<AuthButton />)

      await waitFor(() => {
        expect(screen.getByText('Admin')).toBeInTheDocument()
      })

      const adminLink = screen.getByText('Admin')
      expect(adminLink.closest('a')).toHaveAttribute('href', '/admin')
    })
  })

  describe('sign out', () => {
    it('calls signOut and redirects on sign out click', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      mockGetSession.mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null,
      })
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { is_admin: false }, error: null }),
          }),
        }),
      })
      mockSignOut.mockResolvedValue({ error: null })

      // Mock window.location.href
      const originalLocation = window.location
      delete (window as any).location
      window.location = { href: '' } as any

      render(<AuthButton />)

      await waitFor(() => {
        expect(screen.getByText('Sign out')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Sign out'))

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalled()
      })

      expect(window.location.href).toBe('/')

      // Restore
      window.location = originalLocation
    })
  })

  describe('auth state changes', () => {
    it('subscribes to auth state changes', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null })

      render(<AuthButton />)

      await waitFor(() => {
        expect(mockOnAuthStateChange).toHaveBeenCalled()
      })
    })

    it('unsubscribes on unmount', async () => {
      const mockUnsubscribe = vi.fn()
      mockOnAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: mockUnsubscribe } },
      })
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null })

      const { unmount } = render(<AuthButton />)

      await waitFor(() => {
        expect(screen.getByText('Sign in')).toBeInTheDocument()
      })

      unmount()

      expect(mockUnsubscribe).toHaveBeenCalled()
    })

    it('updates user state on auth state change', async () => {
      let authCallback: ((event: string, session: any) => void) | null = null
      mockOnAuthStateChange.mockImplementation((callback) => {
        authCallback = callback
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      })
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null })

      render(<AuthButton />)

      await waitFor(() => {
        expect(screen.getByText('Sign in')).toBeInTheDocument()
      })

      // Simulate auth state change to signed in
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { is_admin: false }, error: null }),
          }),
        }),
      })

      if (authCallback) {
        authCallback('SIGNED_IN', { user: { id: 'user-123', email: 'new@example.com' } })
      }

      await waitFor(() => {
        expect(screen.getByText('new@example.com')).toBeInTheDocument()
      })
    })
  })

  describe('error handling', () => {
    it('handles session error gracefully', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: new Error('Session error'),
      })

      render(<AuthButton />)

      await waitFor(() => {
        expect(screen.getByText('Sign in')).toBeInTheDocument()
      })
    })

    it('handles profile fetch error gracefully', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      mockGetSession.mockResolvedValue({
        data: { session: { user: mockUser } },
        error: null,
      })
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: new Error('Profile error') }),
          }),
        }),
      })

      render(<AuthButton />)

      await waitFor(() => {
        expect(screen.getByText('test@example.com')).toBeInTheDocument()
      })

      // Admin should default to false on error
      expect(screen.queryByText('Admin')).not.toBeInTheDocument()
    })
  })
})
