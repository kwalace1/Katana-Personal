import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import * as hrApi from '@/lib/hr-api'
import type { Employee } from '@/lib/hr-api'
import {
  getWorkerSession,
  resolveTechnicianForEmployee,
  type WfmWorkerSession,
} from '@/lib/wfm-worker'
import type { Technician } from '@/lib/wfm-api'
import { useLoggedInHrEmployee } from '@/hooks/use-logged-in-hr-employee'

export interface WfmCurrentUser {
  /** Auth display name (profile → metadata → email). */
  displayName: string
  email: string | null
  employee: Employee | null
  employeeId: string | null
  technician: Technician | null
  session: WfmWorkerSession | null
}

/** Resolves logged-in auth user → HR employee → workforce technician roster entry. */
export function useWfmCurrentUser() {
  const { user, profile } = useAuth()
  const { loggedInEmployeeId } = useLoggedInHrEmployee()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [technician, setTechnician] = useState<Technician | null>(null)
  const [session, setSession] = useState<WfmWorkerSession | null>(null)
  const [loading, setLoading] = useState(true)

  const displayName = useMemo(() => {
    const fromProfile = profile?.full_name?.trim()
    if (fromProfile) return fromProfile
    const meta = user?.user_metadata as { full_name?: string; name?: string } | undefined
    if (meta?.full_name?.trim()) return meta.full_name.trim()
    if (meta?.name?.trim()) return meta.name.trim()
    if (employee?.name?.trim()) return employee.name.trim()
    if (technician?.name?.trim()) return technician.name.trim()
    return profile?.email ?? user?.email ?? 'You'
  }, [profile, user, employee, technician])

  const email = profile?.email ?? user?.email ?? employee?.email ?? technician?.email ?? null

  const reload = useCallback(async () => {
    if (!loggedInEmployeeId) {
      setEmployee(null)
      setTechnician(null)
      setSession(null)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const emp = await hrApi.getEmployeeById(loggedInEmployeeId)
      if (!emp) {
        setEmployee(null)
        setTechnician(null)
        setSession(null)
        return
      }
      setEmployee(emp)

      const tech = await resolveTechnicianForEmployee({
        employeeId: emp.id,
        email: emp.email ?? email,
        name: emp.name,
        authUserId: user?.id,
      })
      setTechnician(tech)

      if (tech) {
        const workerSession = await getWorkerSession(tech.id)
        setSession(workerSession)
      } else {
        setSession(null)
      }
    } catch (e) {
      console.error('useWfmCurrentUser failed:', e)
      setEmployee(null)
      setTechnician(null)
      setSession(null)
    } finally {
      setLoading(false)
    }
  }, [loggedInEmployeeId, email, user?.id])

  useEffect(() => {
    void reload()
  }, [reload])

  const currentUser: WfmCurrentUser = useMemo(
    () => ({
      displayName,
      email,
      employee,
      employeeId: loggedInEmployeeId,
      technician,
      session,
    }),
    [displayName, email, employee, loggedInEmployeeId, technician, session],
  )

  return { ...currentUser, loading, reload }
}
