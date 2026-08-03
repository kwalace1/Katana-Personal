import { motion } from 'framer-motion'
import { OfficeProvider } from '../OfficeProvider'
import { CompactChat } from './CompactChat'

interface AgentChatPopoverProps {
  agentName: string
  moduleLabel?: string
  onClose: () => void
  onOpenFull: (agentId: string | null) => void
}

/**
 * The floating chat panel: an animated card that boots a compact
 * `OfficeProvider` and hosts a single-agent `CompactChat`. Mounted only while
 * open, so the office connection is established lazily on demand.
 */
export function AgentChatPopover({ agentName, moduleLabel, onClose, onOpenFull }: AgentChatPopoverProps) {
  return (
    <motion.div
      key="agent-chat-popover"
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className="pointer-events-auto flex h-[min(80vh,560px)] w-[min(100vw-2.5rem,384px)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      role="dialog"
      aria-label={`Chat with ${agentName}`}
    >
      <OfficeProvider variant="compact">
        <CompactChat
          agentName={agentName}
          moduleLabel={moduleLabel}
          onClose={onClose}
          onOpenFull={onOpenFull}
        />
      </OfficeProvider>
    </motion.div>
  )
}
