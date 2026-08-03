import type { NavigateFunction } from 'react-router-dom'
import { toast } from 'sonner'

export function navigateToCommsDirectMessage(options: {
  targetUserId: string | null
  targetEmail: string
  targetName: string
  hasCommsAccess: boolean
  navigate: NavigateFunction
}): void {
  const { targetUserId, targetEmail, targetName, hasCommsAccess, navigate } = options

  if (!hasCommsAccess) {
    toast.error('Katana Comms access required', {
      description: 'Ask your admin to enable Comms on your employee profile, or use email instead.',
    })
    if (targetEmail) {
      window.location.href = `mailto:${encodeURIComponent(targetEmail)}`
    }
    return
  }

  if (!targetUserId) {
    toast.error('No Katana account yet', {
      description: `${targetName} has not signed in to Katana. You can email them instead.`,
    })
    if (targetEmail) {
      window.location.href = `mailto:${encodeURIComponent(targetEmail)}`
    }
    return
  }

  navigate(`/comms?user=${encodeURIComponent(targetUserId)}`)
}
