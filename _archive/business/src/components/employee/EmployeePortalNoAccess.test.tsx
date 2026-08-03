import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { EmployeePortalNoAccess } from './EmployeePortalNoAccess'

function wrap(ui: React.ReactElement) {
  return <BrowserRouter>{ui}</BrowserRouter>
}

describe('EmployeePortalNoAccess', () => {
  it('renders title and default onboarding message', () => {
    render(wrap(<EmployeePortalNoAccess />))
    expect(screen.getByText('No portal access yet')).toBeInTheDocument()
    expect(
      screen.getByText(/your account isn't in the company directory yet/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/ask your hr team or manager to add you/i)).toBeInTheDocument()
  })

  it('renders custom error message when error prop is provided', () => {
    render(wrap(<EmployeePortalNoAccess error="Failed to load employees" />))
    expect(screen.getByText('No portal access yet')).toBeInTheDocument()
    expect(screen.getByText('Failed to load employees')).toBeInTheDocument()
  })

  it('provides Back to home and Go to HR actions', () => {
    render(wrap(<EmployeePortalNoAccess />))
    const backHome = screen.getByRole('link', { name: /back to home/i })
    const goToHr = screen.getByRole('link', { name: /go to hr/i })
    expect(backHome).toBeInTheDocument()
    expect(backHome).toHaveAttribute('href', '/')
    expect(goToHr).toBeInTheDocument()
    expect(goToHr).toHaveAttribute('href', '/hr')
  })
})
