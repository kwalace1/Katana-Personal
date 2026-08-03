import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, User, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import * as CommsApi from '@/lib/comms-api'
import type { Conversation, UserProfileSummary } from '@/lib/comms-api'

interface NewConversationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  currentUserId: string
  onConversationCreated: (conversation: Conversation) => void
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map(p => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function NewConversationDialog({
  open,
  onOpenChange,
  organizationId,
  currentUserId,
  onConversationCreated,
}: NewConversationDialogProps) {
  const [search, setSearch] = useState('')
  const [members, setMembers] = useState<UserProfileSummary[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    CommsApi.getOrganizationMembers(organizationId || undefined).then(m => {
      setMembers(m.filter(u => u.id !== currentUserId))
      setLoading(false)
    })
  }, [open, organizationId, currentUserId])

  useEffect(() => {
    if (!open) {
      setSearch('')
      setSelected(new Set())
    }
  }, [open])

  const filteredMembers = useMemo(() => {
    if (!search) return members
    const q = search.toLowerCase()
    return members.filter(
      m =>
        m.full_name?.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    )
  }, [members, search])

  const toggleMember = (userId: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const handleCreate = async () => {
    if (selected.size === 0) return
    setCreating(true)
    try {
      let conversation: Conversation | null = null

      if (selected.size === 1) {
        const [otherUserId] = selected
        conversation = await CommsApi.getOrCreateDirectConversation(otherUserId, organizationId)
      } else {
        const selectedNames = Array.from(selected)
          .map(id => members.find(m => m.id === id)?.full_name || 'Unknown')
          .join(', ')
        conversation = await CommsApi.createGroupConversation(
          selectedNames,
          Array.from(selected),
          organizationId
        )
      }

      if (conversation) {
        onConversationCreated(conversation)
        onOpenChange(false)
      } else {
        toast.error('Failed to create conversation')
      }
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <DialogHeader>
            <DialogTitle>New Conversation</DialogTitle>
            <DialogDescription>
              Select one or more people to message
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-4">
            {/* Selected badges */}
            {selected.size > 0 && (
              <div className="flex flex-wrap gap-1">
                {Array.from(selected).map(userId => {
                  const member = members.find(m => m.id === userId)
                  return (
                    <Badge
                      key={userId}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => toggleMember(userId)}
                    >
                      {member?.full_name || member?.email}
                      <span className="ml-1 text-muted-foreground">&times;</span>
                    </Badge>
                  )
                })}
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search people..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>

            {/* Member list */}
            <ScrollArea className="h-60">
              {loading ? (
                <div className="text-center text-sm text-muted-foreground py-8">Loading...</div>
              ) : filteredMembers.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-8">
                  {search ? 'No matches found' : 'No team members found'}
                </div>
              ) : (
                <AnimatePresence>
                  {filteredMembers.map(member => {
                    const isSelected = selected.has(member.id)
                    return (
                      <motion.button
                        key={member.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => toggleMember(member.id)}
                        className={`flex items-center gap-3 w-full p-2 rounded-lg transition-colors ${
                          isSelected
                            ? 'bg-primary/10'
                            : 'hover:bg-muted'
                        }`}
                      >
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={member.avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(member.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-sm font-medium truncate">
                            {member.full_name || 'Unnamed'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {member.email}
                          </p>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-primary shrink-0" />
                        )}
                      </motion.button>
                    )
                  })}
                </AnimatePresence>
              )}
            </ScrollArea>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={selected.size === 0 || creating}
              >
                {creating
                  ? 'Starting...'
                  : selected.size === 1
                    ? 'Start Chat'
                    : `Create Group (${selected.size})`}
              </Button>
            </div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
