/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import TriagePatternCard from './TriagePatternCard'

// Mock next/image
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} data-testid="pattern-image" />
  ),
}))

describe('TriagePatternCard', () => {
  const defaultPattern = {
    id: 123,
    file_name: 'test-pattern.qli',
    author: 'Test Author',
    thumbnail_url: 'https://example.com/thumb.png',
    issues: [
      {
        type: 'rotation' as const,
        details: {
          orientation: 'rotate_90_cw',
          confidence: 'high',
          reason: 'Test reason',
        },
      },
    ],
  }

  const defaultProps = {
    pattern: defaultPattern,
    isSelected: false,
    isFocused: false,
    onSelect: vi.fn(),
    onTransform: vi.fn().mockResolvedValue(undefined),
    onMarkReviewed: vi.fn().mockResolvedValue(undefined),
    onExpand: vi.fn(),
    isExpanded: false,
    isTransforming: false,
    thumbnailUrl: defaultPattern.thumbnail_url,
  }

  describe('navigation links', () => {
    it('includes returnUrl in Edit link with default value', () => {
      render(<TriagePatternCard {...defaultProps} />)

      const editLink = screen.getByRole('link', { name: 'Edit' })
      // Default returnUrl is /admin/triage, which gets encoded
      expect(editLink).toHaveAttribute('href', '/admin/patterns/123/edit?returnUrl=%2Fadmin%2Ftriage')
    })

    it('pattern name links to detail page without returnUrl', () => {
      render(<TriagePatternCard {...defaultProps} />)

      const patternLink = screen.getByRole('link', { name: 'test-pattern.qli' })
      expect(patternLink).toHaveAttribute('href', '/patterns/123')
    })

    it('includes returnUrl in Add Keywords link when no_keywords issue present', () => {
      const patternWithNoKeywords = {
        ...defaultPattern,
        issues: [
          {
            type: 'no_keywords' as const,
            details: {},
          },
        ],
      }

      render(
        <TriagePatternCard
          {...defaultProps}
          pattern={patternWithNoKeywords}
          isExpanded={true}
        />
      )

      const addKeywordsLink = screen.getByRole('link', { name: '+ Add Keywords' })
      expect(addKeywordsLink).toHaveAttribute('href', '/admin/patterns/123/edit?returnUrl=%2Fadmin%2Ftriage')
    })

    it('encodes custom returnUrl with query params', () => {
      render(
        <TriagePatternCard
          {...defaultProps}
          returnUrl="/admin/triage?filter=rotation&page=2"
        />
      )

      const editLink = screen.getByRole('link', { name: 'Edit' })
      // The & and = in the query params should be encoded
      expect(editLink).toHaveAttribute(
        'href',
        '/admin/patterns/123/edit?returnUrl=%2Fadmin%2Ftriage%3Ffilter%3Drotation%26page%3D2'
      )
    })

    it('uses custom returnUrl prop', () => {
      render(
        <TriagePatternCard
          {...defaultProps}
          returnUrl="/admin/keywords"
        />
      )

      const editLink = screen.getByRole('link', { name: 'Edit' })
      expect(editLink).toHaveAttribute('href', '/admin/patterns/123/edit?returnUrl=%2Fadmin%2Fkeywords')
    })
  })

  describe('rendering', () => {
    it('displays pattern name', () => {
      render(<TriagePatternCard {...defaultProps} />)
      expect(screen.getByText('test-pattern.qli')).toBeInTheDocument()
    })

    it('displays author when provided', () => {
      render(<TriagePatternCard {...defaultProps} />)
      expect(screen.getByText('Test Author')).toBeInTheDocument()
    })

    it('displays issue badges', () => {
      render(<TriagePatternCard {...defaultProps} />)
      expect(screen.getByText('Rotate 90° CW')).toBeInTheDocument()
    })

    it('displays mirrored badge for mirror issues', () => {
      const patternWithMirror = {
        ...defaultPattern,
        issues: [
          {
            type: 'mirror' as const,
            details: {
              confidence: 'high',
              reason: 'Mirrored text detected',
            },
          },
        ],
      }

      render(<TriagePatternCard {...defaultProps} pattern={patternWithMirror} />)
      expect(screen.getByText('Mirrored')).toBeInTheDocument()
    })
  })
})
