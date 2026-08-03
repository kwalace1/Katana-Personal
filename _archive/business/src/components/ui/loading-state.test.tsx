import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoadingState } from './loading-state'

describe('LoadingState', () => {
  it('renders default message', () => {
    render(<LoadingState />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('renders custom message', () => {
    render(<LoadingState message="Loading your portal…" />)
    expect(screen.getByText('Loading your portal…')).toBeInTheDocument()
  })

  it('shows a spinner (loader icon)', () => {
    const { container } = render(<LoadingState />)
    const loader = container.querySelector('[class*="animate-spin"]')
    expect(loader).toBeInTheDocument()
  })
})
