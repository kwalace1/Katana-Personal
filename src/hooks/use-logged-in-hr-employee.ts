import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import * as hrApi from '@/lib/hr-api'
import type { Employee } from '@/lib/hr-api'

/** True when an HR employee row is the same person as the logged-in user (by id, email, or name). */
export function isEmployeeSelf(
  employee: Pick<Employee, 'id' | 'email' | 'name'>,
  loggedInEmployeeId: string | null,
  loginEmails: string[],
  loginNames: string[]
): boolean {
  if (loggedInEmployeeId && employee.id === loggedInEmployeeId) return true

  const empEmail = (employee.email ?? '').trim().toLowerCase()
  if (empEmail && loginEmails.includes(empEmail)) return true

  const empName = employee.name.trim().toLowerCase()
  if (empName && loginNames.includes(empName)) return true

  return false
}

/** Resolves the HR employee record for the currently authenticated user. */
export function useLoggedInHrEmployee() {
  const { user, profile } = useAuth()
  const [loggedInEmployeeId, setLoggedInEmployeeId] = useState<string | null>(null)

  const loginEmails = useMemo(() => {
    const set = new Set<string>()
    for (const e of [profile?.email, user?.email]) {
      const v = (e ?? '').trim().toLowerCase()
      if (v) set.add(v)
    }
    return Array.from(set)
  }, [profile?.email, user?.email])

  const loginNames = useMemo(() => {
    const set = new Set<string>()
    const meta = user?.user_metadata as Record<string, unknown> | undefined
    for (const n of [
      profile?.full_name,
      typeof meta?.full_name === 'string' ? meta.full_name : undefined,
      typeof meta?.name === 'string' ? meta.name : undefined,
    ]) {
      const v = (n ?? '').trim().toLowerCase()
      if (v) set.add(v)
    }
    return Array.from(set)
  }, [profile?.full_name, user?.user_metadata])

  useEffect(() => {
    if (loginEmails.length === 0 && loginNames.length === 0) {
      setLoggedInEmployeeId(null)
      return
    }

    let cancelled = false

    const resolve = async () => {
      for (const email of loginEmails) {
        const emp = await hrApi.getEmployeeByEmail(email)
        if (emp && !cancelled) {
          setLoggedInEmployeeId(emp.id)
          return
        }
      }

      if (loginNames.length > 0 && !cancelled) {
        const all = await hrApi.getAllEmployees()
        const match = all.find((e) => loginNames.includes(e.name.trim().toLowerCase()))
        setLoggedInEmployeeId(match?.id ?? null)
        return
      }

      if (!cancelled) setLoggedInEmployeeId(null)
    }

    void resolve()
    return () => {
      cancelled = true
    }
  }, [loginEmails, loginNames])

  const isSelf = useCallback(
    (employee: Pick<Employee, 'id' | 'email' | 'name'>) =>
      isEmployeeSelf(employee, loggedInEmployeeId, loginEmails, loginNames),
    [loggedInEmployeeId, loginEmails, loginNames]
  )

  const isSelfEmployeeId = useCallback(
    (employeeId: string) => {
      if (!employeeId) return false
      return loggedInEmployeeId != null && employeeId === loggedInEmployeeId
    },
    [loggedInEmployeeId]
  )

  return { loggedInEmployeeId, loginEmails, loginNames, isSelf, isSelfEmployeeId }
}
