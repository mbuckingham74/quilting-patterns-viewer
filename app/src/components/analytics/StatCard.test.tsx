/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatCard from './StatCard'

describe('StatCard', () => {
  const defaultProps = {
    title: 'Total Users',
    value: 100,
    icon: <svg data-testid="icon" />,
  }

  it('renders the title', () => {
    render(<StatCard {...defaultProps} />)

    expect(screen.getByText('Total Users')).toBeInTheDocument()
  })

  it('renders numeric values with locale formatting', () => {
    render(<StatCard {...defaultProps} value={1234567} />)

    expect(screen.getByText('1,234,567')).toBeInTheDocument()
  })

  it('renders string values as-is', () => {
    render(<StatCard {...defaultProps} value="N/A" />)

    expect(screen.getByText('N/A')).toBeInTheDocument()
  })

  it('renders the subtitle when provided', () => {
    render(<StatCard {...defaultProps} subtitle="+5 new this week" />)

    expect(screen.getByText('+5 new this week')).toBeInTheDocument()
  })

  it('does not render subtitle when not provided', () => {
    render(<StatCard {...defaultProps} />)

    expect(screen.queryByText(/week/)).not.toBeInTheDocument()
  })

  it('renders the icon', () => {
    render(<StatCard {...defaultProps} />)

    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })

  it('applies correct color classes for purple', () => {
    const { container } = render(<StatCard {...defaultProps} color="purple" />)

    const iconContainer = container.querySelector('.bg-purple-100')
    expect(iconContainer).toBeInTheDocument()
  })

  it('applies correct color classes for indigo', () => {
    const { container } = render(<StatCard {...defaultProps} color="indigo" />)

    const iconContainer = container.querySelector('.bg-indigo-100')
    expect(iconContainer).toBeInTheDocument()
  })

  it('applies correct color classes for green', () => {
    const { container } = render(<StatCard {...defaultProps} color="green" />)

    const iconContainer = container.querySelector('.bg-green-100')
    expect(iconContainer).toBeInTheDocument()
  })

  it('defaults to purple when no color specified', () => {
    const { container } = render(<StatCard {...defaultProps} />)

    const iconContainer = container.querySelector('.bg-purple-100')
    expect(iconContainer).toBeInTheDocument()
  })
})
