import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import * as hrApi from '@/lib/hr-api'
import type { Employee } from '@/lib/hr-api'
import { useLoggedInHrEmployee } from '@/hooks/use-logged-in-hr-employee'

const EMPLOYEE_PORTAL_STORAGE_KEY = 'employeePortal_employeeId'

interface EmployeePortalContextType {
  employeeId: string | null
  employee: Employee | null
  setEmployeeId: (id: string | null) => void
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  /** HR employee id for the currently logged-in user (matched by email or name), if any */
  currentUserEmployeeId: string | null
  /** True when the selected employee is the logged-in user's HR record */
  isViewingSelf: boolean
}

const EmployeePortalContext = createContext<EmployeePortalContextType | undefined>(undefined)

export function EmployeePortalProvider({ children }: { children: React.ReactNode }) {
  const { loggedInEmployeeId, loginEmails, loginNames } = useLoggedInHrEmployee()

  const [currentUserEmployeeId, setCurrentUserEmployeeId] = useState<string | null>(null)
  const [employeeId, setEmployeeIdState] = useState<string | null>(null)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const setEmployeeId = useCallback((_id: string | null) => {
    // Portal only shows the logged-in user's own HR record
  }, [])

  const loadEmployee = useCallback(async (id: string | null) => {
    if (!id) {
      setEmployee(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    let skipFinally = false
    try {
      const emp = await hrApi.getEmployeeById(id)
      if (!emp) {
        setEmployeeIdState(null)
        if (typeof window !== 'undefined') localStorage.removeItem(EMPLOYEE_PORTAL_STORAGE_KEY)
        setEmployee(null)
        skipFinally = true
        return
      }
      setEmployee(emp)
    } catch (e) {
      console.error('Failed to load employee:', e)
      setError(e instanceof Error ? e.message : 'Failed to load employee')
      setEmployee(null)
    } finally {
      if (!skipFinally) setLoading(false)
    }
  }, [])

  const refresh = useCallback(async () => {
    if (employeeId) await loadEmployee(employeeId)
  }, [employeeId, loadEmployee])

  useEffect(() => {
    if (loginEmails.length === 0 && loginNames.length === 0) {
      setCurrentUserEmployeeId(null)
      setEmployeeIdState(null)
      setEmployee(null)
      setLoading(false)
      return
    }

    if (!loggedInEmployeeId) {
      setCurrentUserEmployeeId(null)
      setEmployeeIdState(null)
      setEmployee(null)
      setLoading(false)
      setError(null)
      return
    }

    setCurrentUserEmployeeId(loggedInEmployeeId)
    setEmployeeIdState(loggedInEmployeeId)
    void loadEmployee(loggedInEmployeeId)
  }, [loggedInEmployeeId, loginEmails.length, loginNames.length, loadEmployee])

  const isViewingSelf = Boolean(
    currentUserEmployeeId && employeeId === currentUserEmployeeId
  )

  const value: EmployeePortalContextType = {
    employeeId,
    employee,
    setEmployeeId,
    loading,
    error,
    refresh,
    currentUserEmployeeId,
    isViewingSelf,
  }

  return (
    <EmployeePortalContext.Provider value={value}>
      {children}
    </EmployeePortalContext.Provider>
  )
}

export function useEmployeePortal() {
  const ctx = useContext(EmployeePortalContext)
  if (ctx === undefined) {
    throw new Error('useEmployeePortal must be used within EmployeePortalProvider')
  }
  return ctx
}
