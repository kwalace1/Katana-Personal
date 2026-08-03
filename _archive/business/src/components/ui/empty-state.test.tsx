import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyState } from './empty-state'

describe('EmptyState', () => {
  it('renders default title', () => {
    render(<EmptyState />)
    expect(screen.getByText('No data yet')).toBeInTheDocument()
  })

  it('renders custom title and description', () => {
    render(
      <EmptyState
        title="No employees found"
        description="Try adjusting your search or filters"
      />
    )
    expect(screen.getByText('No employees found')).toBeInTheDocument()
    expect(screen.getByText('Try adjusting your search or filters')).toBeInTheDocument()
  })

  it('renders optional action', () => {
    render(
      <EmptyState
        title="No items"
        action={<button type="button">Add item</button>}
      />
    )
    expect(screen.getByRole('button', { name: /add item/i })).toBeInTheDocument()
  })
})
