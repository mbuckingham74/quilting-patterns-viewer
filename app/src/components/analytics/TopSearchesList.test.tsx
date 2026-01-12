/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import TopSearchesList from './TopSearchesList'

describe('TopSearchesList', () => {
  const sampleSearches = [
    {
      query: 'butterfly',
      count: 45,
      last_searched: '2025-01-08T12:00:00Z',
    },
    {
      query: 'flowers',
      count: 32,
      last_searched: '2025-01-07T15:30:00Z',
    },
    {
      query: 'geometric patterns',
      count: 18,
      last_searched: '2025-01-06T09:00:00Z',
    },
  ]

  it('renders the title', () => {
    render(<TopSearchesList searches={sampleSearches} />)

    expect(screen.getByText('Popular Searches')).toBeInTheDocument()
  })

  it('renders empty state when no searches', () => {
    render(<TopSearchesList searches={[]} />)

    expect(screen.getByText('No search data yet')).toBeInTheDocument()
  })

  it('renders search queries with quotes', () => {
    render(<TopSearchesList searches={sampleSearches} />)

    expect(screen.getByText('"butterfly"')).toBeInTheDocument()
    expect(screen.getByText('"flowers"')).toBeInTheDocument()
    expect(screen.getByText('"geometric patterns"')).toBeInTheDocument()
  })

  it('renders search counts', () => {
    render(<TopSearchesList searches={sampleSearches} />)

    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText('32')).toBeInTheDocument()
    expect(screen.getByText('18')).toBeInTheDocument()
  })

  it('renders ranking numbers', () => {
    render(<TopSearchesList searches={sampleSearches} />)

    expect(screen.getByText('1.')).toBeInTheDocument()
    expect(screen.getByText('2.')).toBeInTheDocument()
    expect(screen.getByText('3.')).toBeInTheDocument()
  })

  it('renders formatted last searched dates', () => {
    render(<TopSearchesList searches={sampleSearches} />)

    // Dates should be formatted like "Jan 8"
    expect(screen.getByText(/Last searched Jan 8/)).toBeInTheDocument()
    expect(screen.getByText(/Last searched Jan 7/)).toBeInTheDocument()
    expect(screen.getByText(/Last searched Jan 6/)).toBeInTheDocument()
  })

  it('renders searches label', () => {
    render(<TopSearchesList searches={sampleSearches} />)

    const searchLabels = screen.getAllByText('searches')
    expect(searchLabels).toHaveLength(3)
  })
})
