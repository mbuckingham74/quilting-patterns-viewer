/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import TopPatternsList from './TopPatternsList'

describe('TopPatternsList', () => {
  const samplePatterns = [
    {
      id: 1,
      file_name: 'butterfly_pattern.qli',
      thumbnail_url: 'https://example.com/thumb1.png',
      author: 'Jane Doe',
      download_count: 45,
      favorite_count: 12,
    },
    {
      id: 2,
      file_name: 'flower_border.qli',
      thumbnail_url: 'https://example.com/thumb2.png',
      author: 'John Smith',
      download_count: 32,
      favorite_count: 8,
    },
    {
      id: 3,
      file_name: 'geometric_swirl.qli',
      thumbnail_url: null,
      author: null,
      download_count: 18,
      favorite_count: 3,
    },
  ]

  it('renders the title', () => {
    render(<TopPatternsList patterns={samplePatterns} />)

    expect(screen.getByText('Top Downloaded Patterns')).toBeInTheDocument()
  })

  it('renders empty state when no patterns', () => {
    render(<TopPatternsList patterns={[]} />)

    expect(screen.getByText('No download data yet')).toBeInTheDocument()
  })

  it('renders pattern names', () => {
    render(<TopPatternsList patterns={samplePatterns} />)

    expect(screen.getByText('butterfly_pattern.qli')).toBeInTheDocument()
    expect(screen.getByText('flower_border.qli')).toBeInTheDocument()
    expect(screen.getByText('geometric_swirl.qli')).toBeInTheDocument()
  })

  it('renders author names when available', () => {
    render(<TopPatternsList patterns={samplePatterns} />)

    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('John Smith')).toBeInTheDocument()
  })

  it('renders download counts', () => {
    render(<TopPatternsList patterns={samplePatterns} />)

    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText('32')).toBeInTheDocument()
    expect(screen.getByText('18')).toBeInTheDocument()
  })

  it('renders ranking numbers', () => {
    render(<TopPatternsList patterns={samplePatterns} />)

    expect(screen.getByText('1.')).toBeInTheDocument()
    expect(screen.getByText('2.')).toBeInTheDocument()
    expect(screen.getByText('3.')).toBeInTheDocument()
  })

  it('renders links to pattern pages', () => {
    render(<TopPatternsList patterns={samplePatterns} />)

    const links = screen.getAllByRole('link')
    // Each pattern has 3 links: thumbnail, filename, and admin edit
    // So 3 patterns = 9 total links
    expect(links).toHaveLength(9)
    // First pattern links
    expect(links[0]).toHaveAttribute('href', '/patterns/1') // thumbnail
    expect(links[1]).toHaveAttribute('href', '/patterns/1') // filename
    expect(links[2]).toHaveAttribute('href', '/admin/patterns/1/edit') // edit
    // Second pattern links
    expect(links[3]).toHaveAttribute('href', '/patterns/2')
    expect(links[4]).toHaveAttribute('href', '/patterns/2')
    expect(links[5]).toHaveAttribute('href', '/admin/patterns/2/edit')
    // Third pattern links
    expect(links[6]).toHaveAttribute('href', '/patterns/3')
    expect(links[7]).toHaveAttribute('href', '/patterns/3')
    expect(links[8]).toHaveAttribute('href', '/admin/patterns/3/edit')
  })

  it('renders thumbnail images when available', () => {
    render(<TopPatternsList patterns={samplePatterns} />)

    const images = screen.getAllByRole('img')
    expect(images).toHaveLength(2) // Only 2 patterns have thumbnails
  })

  it('renders placeholder when thumbnail is missing', () => {
    const { container } = render(<TopPatternsList patterns={samplePatterns} />)

    // Pattern 3 has no thumbnail, should show placeholder icon
    const placeholderIcons = container.querySelectorAll('svg')
    expect(placeholderIcons.length).toBeGreaterThan(0)
  })
})
