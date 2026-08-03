import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { ErrorState } from './error-state'

function wrap(ui: React.ReactElement) {
  return <BrowserRouter>{ui}</BrowserRouter>
}

describe('ErrorState', () => {
  it('renders title and message', () => {
    render(
      wrap(<ErrorState message="Failed to load data. Please try again." />)
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Failed to load data. Please try again.')).toBeInTheDocument()
  })

  it('renders custom title', () => {
    render(
      wrap(
        <ErrorState
          title="Unable to load"
          message="Network error"
        />
      )
    )
    expect(screen.getByText('Unable to load')).toBeInTheDocument()
  })

  it('renders primary and secondary actions with correct links', () => {
    render(
      wrap(
        <ErrorState
          message="Error"
          primaryAction={{ to: '/employee', label: 'Back to portal' }}
          secondaryAction={{ to: '/', label: 'Home' }}
        />
      )
    )
    const backLink = screen.getByRole('link', { name: /back to portal/i })
    const homeLink = screen.getByRole('link', { name: /home/i })
    expect(backLink).toHaveAttribute('href', '/employee')
    expect(homeLink).toHaveAttribute('href', '/')
  })
})
