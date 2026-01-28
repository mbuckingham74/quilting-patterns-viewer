/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AuthTabs from './AuthTabs'

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

// Mock Supabase client
const mockSignInWithPassword = vi.fn()
const mockSignUp = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signUp: mockSignUp,
    },
    from: mockFrom,
  }),
}))

// Mock fetch for admin notification
const mockFetch = vi.fn()

describe('AuthTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe('rendering', () => {
    it('renders Sign In tab as active by default', () => {
      render(<AuthTabs />)

      const buttons = screen.getAllByRole('button', { name: 'Sign In' })
      const signInTab = buttons[0] // Tab button
      const registerTab = screen.getByRole('button', { name: 'Register' })

      expect(signInTab).toHaveClass('text-rose-600')
      expect(registerTab).not.toHaveClass('text-rose-600')
    })

    it('renders sign in form fields by default', () => {
      render(<AuthTabs />)

      expect(screen.getByLabelText('Email')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
      expect(screen.queryByLabelText('Confirm Password')).not.toBeInTheDocument()
    })

    it('renders Sign In submit button', () => {
      render(<AuthTabs />)

      // There should be both a tab and submit button with "Sign In" name
      const signInButtons = screen.getAllByRole('button', { name: 'Sign In' })
      expect(signInButtons).toHaveLength(2)
      // One should be type="submit"
      expect(signInButtons.some(btn => btn.getAttribute('type') === 'submit')).toBe(true)
    })
  })

  describe('tab switching', () => {
    it('switches to Register tab when clicked', () => {
      render(<AuthTabs />)

      fireEvent.click(screen.getByRole('button', { name: 'Register' }))

      expect(screen.getByRole('button', { name: 'Register' })).toHaveClass('text-rose-600')
      expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument()
    })

    it('switches back to Sign In tab when clicked', () => {
      render(<AuthTabs />)

      // Go to Register
      fireEvent.click(screen.getByRole('button', { name: 'Register' }))
      expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument()

      // Go back to Sign In
      fireEvent.click(screen.getAllByRole('button', { name: 'Sign In' })[0])
      expect(screen.queryByLabelText('Confirm Password')).not.toBeInTheDocument()
    })

    it('resets form fields when switching tabs', () => {
      render(<AuthTabs />)

      // Fill sign in form
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })

      // Switch to Register
      fireEvent.click(screen.getByRole('button', { name: 'Register' }))

      // Fields should be empty
      expect(screen.getByLabelText('Email')).toHaveValue('')
      expect(screen.getByLabelText('Password')).toHaveValue('')
    })

    it('clears errors when switching tabs', async () => {
      render(<AuthTabs />)

      // Switch to Register and trigger an error
      fireEvent.click(screen.getByRole('button', { name: 'Register' }))
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pass' } })
      fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'different' } })

      // Submit to trigger password mismatch error
      fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument()

      // Switch tabs - error should clear
      fireEvent.click(screen.getAllByRole('button', { name: 'Sign In' })[0])
      expect(screen.queryByText('Passwords do not match')).not.toBeInTheDocument()
    })
  })

  describe('sign in form', () => {
    it('updates email field on input', () => {
      render(<AuthTabs />)

      const emailInput = screen.getByLabelText('Email')
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })

      expect(emailInput).toHaveValue('test@example.com')
    })

    it('updates password field on input', () => {
      render(<AuthTabs />)

      const passwordInput = screen.getByLabelText('Password')
      fireEvent.change(passwordInput, { target: { value: 'mypassword' } })

      expect(passwordInput).toHaveValue('mypassword')
    })

    it('shows loading state while submitting', async () => {
      // Make the sign in hang
      mockSignInWithPassword.mockImplementation(() => new Promise(() => {}))

      render(<AuthTabs />)

      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
      // Submit the form
      fireEvent.submit(screen.getByLabelText('Email').closest('form')!)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Signing in...' })).toBeDisabled()
      })
    })

    it('redirects to /browse when user is approved', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { is_approved: true },
              error: null,
            }),
          }),
        }),
      })

      render(<AuthTabs />)

      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
      // Submit the form
      fireEvent.submit(screen.getByLabelText('Email').closest('form')!)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/browse')
      })
    })

    it('redirects to /pending-approval when user is not approved', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { is_approved: false },
              error: null,
            }),
          }),
        }),
      })

      render(<AuthTabs />)

      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
      fireEvent.submit(screen.getByLabelText('Email').closest('form')!)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/pending-approval')
      })
    })

    it('redirects to /pending-approval when profile has no is_approved field', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {},
              error: null,
            }),
          }),
        }),
      })

      render(<AuthTabs />)

      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
      fireEvent.submit(screen.getByLabelText('Email').closest('form')!)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/pending-approval')
      })
    })

    it('shows error when signInWithPassword fails', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid login credentials' },
      })

      render(<AuthTabs />)

      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpassword' } })
      fireEvent.submit(screen.getByLabelText('Email').closest('form')!)

      await waitFor(() => {
        expect(screen.getByText('Invalid login credentials')).toBeInTheDocument()
      })
    })

    it('shows error when user is null after sign in', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      render(<AuthTabs />)

      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
      fireEvent.submit(screen.getByLabelText('Email').closest('form')!)

      await waitFor(() => {
        expect(screen.getByText('Failed to sign in')).toBeInTheDocument()
      })
    })

    it('handles unexpected error during sign in', async () => {
      mockSignInWithPassword.mockRejectedValue(new Error('Network error'))

      render(<AuthTabs />)

      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
      fireEvent.submit(screen.getByLabelText('Email').closest('form')!)

      await waitFor(() => {
        expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument()
      })
      expect(console.error).toHaveBeenCalled()
    })
  })

  describe('register form', () => {
    it('renders register form fields when Register tab is active', () => {
      render(<AuthTabs />)

      fireEvent.click(screen.getByRole('button', { name: 'Register' }))

      expect(screen.getByLabelText('Email')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
      expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument()
    })

    it('shows approval notice on register tab', () => {
      render(<AuthTabs />)

      fireEvent.click(screen.getByRole('button', { name: 'Register' }))

      expect(screen.getByText(/New accounts require admin approval/)).toBeInTheDocument()
    })

    it('updates confirm password field on input', () => {
      render(<AuthTabs />)

      fireEvent.click(screen.getByRole('button', { name: 'Register' }))
      const confirmInput = screen.getByLabelText('Confirm Password')
      fireEvent.change(confirmInput, { target: { value: 'mypassword' } })

      expect(confirmInput).toHaveValue('mypassword')
    })

    it('shows error when passwords do not match', () => {
      render(<AuthTabs />)

      fireEvent.click(screen.getByRole('button', { name: 'Register' }))
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
      fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'different' } })
      fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))

      expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
      expect(mockSignUp).not.toHaveBeenCalled()
    })

    it('shows error when password is too short', () => {
      render(<AuthTabs />)

      fireEvent.click(screen.getByRole('button', { name: 'Register' }))
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'short' } })
      fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'short' } })
      fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))

      expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument()
      expect(mockSignUp).not.toHaveBeenCalled()
    })

    it('shows loading state while registering', async () => {
      // Make sign up hang
      mockSignUp.mockImplementation(() => new Promise(() => {}))

      render(<AuthTabs />)

      fireEvent.click(screen.getByRole('button', { name: 'Register' }))
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
      fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'password123' } })
      fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Creating account...' })).toBeDisabled()
      })
    })

    it('creates profile and redirects to /pending-approval for non-admin user', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null })
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { is_approved: false, is_admin: false },
            error: null,
          }),
        }),
      })

      mockSignUp.mockResolvedValue({
        data: { user: { id: 'new-user-123' } },
        error: null,
      })
      mockFrom.mockImplementation((table) => {
        if (table === 'profiles') {
          return { insert: mockInsert, select: mockSelect }
        }
        return {}
      })

      render(<AuthTabs />)

      fireEvent.click(screen.getByRole('button', { name: 'Register' }))
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'newuser@example.com' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
      fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'password123' } })
      fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))

      await waitFor(() => {
        expect(mockInsert).toHaveBeenCalledWith({
          id: 'new-user-123',
          email: 'newuser@example.com',
          is_approved: false,
          is_admin: false,
        })
      })

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/pending-approval')
      })
    })

    it('sends admin notification for non-admin users', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null })
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { is_approved: false, is_admin: false },
            error: null,
          }),
        }),
      })

      mockSignUp.mockResolvedValue({
        data: { user: { id: 'new-user-123' } },
        error: null,
      })
      mockFrom.mockImplementation((table) => {
        if (table === 'profiles') {
          return { insert: mockInsert, select: mockSelect }
        }
        return {}
      })

      render(<AuthTabs />)

      fireEvent.click(screen.getByRole('button', { name: 'Register' }))
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'newuser@example.com' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
      fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'password123' } })
      fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/admin/notify-signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'newuser@example.com' }),
        })
      })
    })

    it('does not send admin notification for admin users', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null })
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { is_approved: true, is_admin: true },
            error: null,
          }),
        }),
      })

      mockSignUp.mockResolvedValue({
        data: { user: { id: 'admin-user-123' } },
        error: null,
      })
      mockFrom.mockImplementation((table) => {
        if (table === 'profiles') {
          return { insert: mockInsert, select: mockSelect }
        }
        return {}
      })

      render(<AuthTabs />)

      fireEvent.click(screen.getByRole('button', { name: 'Register' }))
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@example.com' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
      fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'password123' } })
      fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/browse')
      })

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('redirects to /browse when user is auto-approved', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null })
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { is_approved: true, is_admin: true },
            error: null,
          }),
        }),
      })

      mockSignUp.mockResolvedValue({
        data: { user: { id: 'admin-user-123' } },
        error: null,
      })
      mockFrom.mockImplementation((table) => {
        if (table === 'profiles') {
          return { insert: mockInsert, select: mockSelect }
        }
        return {}
      })

      render(<AuthTabs />)

      fireEvent.click(screen.getByRole('button', { name: 'Register' }))
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@example.com' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
      fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'password123' } })
      fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/browse')
      })
    })

    it('shows error when signUp fails', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: null },
        error: { message: 'Email already registered' },
      })

      render(<AuthTabs />)

      fireEvent.click(screen.getByRole('button', { name: 'Register' }))
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'existing@example.com' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
      fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'password123' } })
      fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))

      await waitFor(() => {
        expect(screen.getByText('Email already registered')).toBeInTheDocument()
      })
    })

    it('shows error when user is null after signup', async () => {
      mockSignUp.mockResolvedValue({
        data: { user: null },
        error: null,
      })

      render(<AuthTabs />)

      fireEvent.click(screen.getByRole('button', { name: 'Register' }))
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
      fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'password123' } })
      fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))

      await waitFor(() => {
        expect(screen.getByText('Failed to create account')).toBeInTheDocument()
      })
    })

    it('handles profile creation error gracefully', async () => {
      const mockInsert = vi.fn().mockResolvedValue({
        error: { message: 'Profile creation failed' },
      })
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { is_approved: false, is_admin: false },
            error: null,
          }),
        }),
      })

      mockSignUp.mockResolvedValue({
        data: { user: { id: 'new-user-123' } },
        error: null,
      })
      mockFrom.mockImplementation((table) => {
        if (table === 'profiles') {
          return { insert: mockInsert, select: mockSelect }
        }
        return {}
      })

      render(<AuthTabs />)

      fireEvent.click(screen.getByRole('button', { name: 'Register' }))
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
      fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'password123' } })
      fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))

      // Should still redirect despite profile creation error
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/pending-approval')
      })
      expect(console.error).toHaveBeenCalled()
    })

    it('handles admin notification failure gracefully', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null })
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { is_approved: false, is_admin: false },
            error: null,
          }),
        }),
      })

      mockSignUp.mockResolvedValue({
        data: { user: { id: 'new-user-123' } },
        error: null,
      })
      mockFrom.mockImplementation((table) => {
        if (table === 'profiles') {
          return { insert: mockInsert, select: mockSelect }
        }
        return {}
      })
      mockFetch.mockRejectedValue(new Error('Network error'))

      render(<AuthTabs />)

      fireEvent.click(screen.getByRole('button', { name: 'Register' }))
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
      fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'password123' } })
      fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))

      // Should still redirect despite notification failure
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/pending-approval')
      })
      expect(console.error).toHaveBeenCalled()
    })

    it('handles unexpected error during registration', async () => {
      mockSignUp.mockRejectedValue(new Error('Network error'))

      render(<AuthTabs />)

      fireEvent.click(screen.getByRole('button', { name: 'Register' }))
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
      fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'password123' } })
      fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))

      await waitFor(() => {
        expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument()
      })
      expect(console.error).toHaveBeenCalled()
    })

    it('defaults to pending-approval when profile fetch returns null', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null })
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      })

      mockSignUp.mockResolvedValue({
        data: { user: { id: 'new-user-123' } },
        error: null,
      })
      mockFrom.mockImplementation((table) => {
        if (table === 'profiles') {
          return { insert: mockInsert, select: mockSelect }
        }
        return {}
      })

      render(<AuthTabs />)

      fireEvent.click(screen.getByRole('button', { name: 'Register' }))
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
      fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'password123' } })
      fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/pending-approval')
      })
    })
  })

  describe('form validation', () => {
    it('requires email field', () => {
      render(<AuthTabs />)

      const emailInput = screen.getByLabelText('Email')
      expect(emailInput).toHaveAttribute('required')
    })

    it('requires password field', () => {
      render(<AuthTabs />)

      const passwordInput = screen.getByLabelText('Password')
      expect(passwordInput).toHaveAttribute('required')
    })

    it('requires confirm password field on register', () => {
      render(<AuthTabs />)

      fireEvent.click(screen.getByRole('button', { name: 'Register' }))

      const confirmInput = screen.getByLabelText('Confirm Password')
      expect(confirmInput).toHaveAttribute('required')
    })

    it('has minLength on register password field', () => {
      render(<AuthTabs />)

      fireEvent.click(screen.getByRole('button', { name: 'Register' }))

      const passwordInput = screen.getByLabelText('Password')
      expect(passwordInput).toHaveAttribute('minLength', '6')
    })

    it('email input has type email', () => {
      render(<AuthTabs />)

      const emailInput = screen.getByLabelText('Email')
      expect(emailInput).toHaveAttribute('type', 'email')
    })

    it('password input has type password', () => {
      render(<AuthTabs />)

      const passwordInput = screen.getByLabelText('Password')
      expect(passwordInput).toHaveAttribute('type', 'password')
    })
  })

  describe('accessibility', () => {
    it('has proper labels for form fields', () => {
      render(<AuthTabs />)

      expect(screen.getByLabelText('Email')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
    })

    it('has proper placeholder text', () => {
      render(<AuthTabs />)

      expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Your password')).toBeInTheDocument()
    })

    it('has proper placeholder text on register form', () => {
      render(<AuthTabs />)

      fireEvent.click(screen.getByRole('button', { name: 'Register' }))

      expect(screen.getByPlaceholderText('At least 6 characters')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Confirm your password')).toBeInTheDocument()
    })
  })
})
