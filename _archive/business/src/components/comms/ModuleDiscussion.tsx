import { useEffect, useState } from 'react'
import { EmbeddedDiscussion } from '@/components/comms/EmbeddedDiscussion'
import { useModuleAccess } from '@/contexts/ModuleAccessContext'
import { getOrCreateChannelForContext } from '@/lib/comms-api'
import type { CommsContextType } from '@/lib/comms-api'

interface ModuleDiscussionProps {
  contextType: CommsContextType
  contextId: string
  title?: string
  /** Optional display name used when creating the dedicated Comms channel. */
  contextLabel?: string
  className?: string
}

/**
 * Embedded comms thread on a record in another module.
 * Only renders when the user has Katana Comms access.
 * Messages live on a dedicated context channel (not #General).
 */
export function ModuleDiscussion({
  contextType,
  contextId,
  title = 'Team discussion',
  contextLabel,
  className,
}: ModuleDiscussionProps) {
  const { hasModuleAccess } = useModuleAccess()
  const hasComms = hasModuleAccess('comms')
  const [channelId, setChannelId] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!hasComms || !contextId) {
      setLoading(false)
      return
    }
    let cancelled = false
    void getOrCreateChannelForContext(contextType, contextId, {
      displayName: contextLabel ?? title,
    }).then((ch) => {
      if (cancelled) return
      setChannelId(ch?.id)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [hasComms, contextId, contextType, contextLabel, title])

  if (!hasComms || !contextId) return null
  if (loading) return null

  return (
    <div className={className}>
      <EmbeddedDiscussion
        contextType={contextType}
        contextId={contextId}
        title={title}
        channelId={channelId}
      />
    </div>
  )
}
