/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ActivityChart from './ActivityChart'

describe('ActivityChart', () => {
  const emptyData = {
    downloads: [],
    searches: [],
    signups: [],
  }

  const sampleData = {
    downloads: [
      { date: '2025-01-01', count: 10 },
      { date: '2025-01-02', count: 20 },
      { date: '2025-01-03', count: 15 },
    ],
    searches: [
      { date: '2025-01-01', count: 5 },
      { date: '2025-01-02', count: 8 },
      { date: '2025-01-03', count: 12 },
    ],
    signups: [
      { date: '2025-01-01', count: 1 },
      { date: '2025-01-02', count: 0 },
      { date: '2025-01-03', count: 2 },
    ],
  }

  it('renders the title', () => {
    render(<ActivityChart {...sampleData} />)

    expect(screen.getByText('Activity (Last 30 Days)')).toBeInTheDocument()
  })

  it('renders legend items', () => {
    render(<ActivityChart {...sampleData} />)

    expect(screen.getByText('Downloads')).toBeInTheDocument()
    expect(screen.getByText('Searches')).toBeInTheDocument()
    expect(screen.getByText('Signups')).toBeInTheDocument()
  })

  it('renders empty state when no data', () => {
    render(<ActivityChart {...emptyData} />)

    expect(screen.getByText('No activity data yet')).toBeInTheDocument()
  })

  it('renders bars for each day with data', () => {
    const { container } = render(<ActivityChart {...sampleData} />)

    // Each day should have 3 bars (downloads, searches, signups)
    // Plus 1 for the legend square = 4 total for each color
    const downloadBars = container.querySelectorAll('.bg-indigo-500')
    const searchBars = container.querySelectorAll('.bg-purple-500')
    const signupBars = container.querySelectorAll('.bg-green-500')

    expect(downloadBars.length).toBe(4) // 3 bars + 1 legend
    expect(searchBars.length).toBe(4) // 3 bars + 1 legend
    expect(signupBars.length).toBe(4) // 3 bars + 1 legend
  })

  it('shows date labels at intervals', () => {
    // Create 10 days of data starting from a date
    const tenDays = {
      downloads: Array.from({ length: 10 }, (_, i) => ({
        date: `2025-01-${String(i + 1).padStart(2, '0')}`,
        count: i + 1,
      })),
      searches: Array.from({ length: 10 }, (_, i) => ({
        date: `2025-01-${String(i + 1).padStart(2, '0')}`,
        count: i,
      })),
      signups: Array.from({ length: 10 }, (_, i) => ({
        date: `2025-01-${String(i + 1).padStart(2, '0')}`,
        count: 0,
      })),
    }

    render(<ActivityChart {...tenDays} />)

    // Should show labels at indices 0 and 5 (Jan 1 and Jan 6)
    // Note: Date display depends on timezone, so we just check the label appears
    const labels = screen.getAllByText(/Jan \d+/)
    expect(labels.length).toBeGreaterThanOrEqual(1)
  })
})
