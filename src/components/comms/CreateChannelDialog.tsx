import { useState } from 'react'
import { motion } from 'framer-motion'
import { Hash, Lock } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import * as CommsApi from '@/lib/comms-api'
import type { Channel } from '@/lib/comms-api'

interface CreateChannelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  onChannelCreated: (channel: Channel) => void
}

export function CreateChannelDialog({
  open,
  onOpenChange,
  organizationId,
  onChannelCreated,
}: CreateChannelDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [channelType, setChannelType] = useState<Channel['channel_type']>('general')
  const [isPrivate, setIsPrivate] = useState(false)
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Channel name is required')
      return
    }
    setCreating(true)
    try {
      const channel = await CommsApi.createChannel({
        name: name.trim(),
        description: description.trim() || null,
        channel_type: channelType,
        is_private: channelType === 'announcement' ? false : isPrivate,
        posting_mode: channelType === 'announcement' ? 'admins_only' : 'open',
        organization_id: organizationId,
      })
      if (channel) {
        toast.success(`Channel #${channel.name} created`)
        onChannelCreated(channel)
        onOpenChange(false)
        resetForm()
      } else {
        toast.error('Failed to create channel')
      }
    } finally {
      setCreating(false)
    }
  }

  const resetForm = () => {
    setName('')
    setDescription('')
    setChannelType('general')
    setIsPrivate(false)
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
            <DialogTitle className="flex items-center gap-2">
              {isPrivate ? <Lock className="w-5 h-5" /> : <Hash className="w-5 h-5" />}
              Create Channel
            </DialogTitle>
            <DialogDescription>
              Create a new communication channel for your team
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="channel-name">Channel Name</Label>
              <Input
                id="channel-name"
                placeholder="e.g. engineering-team"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="channel-description">Description</Label>
              <Textarea
                id="channel-description"
                placeholder="What's this channel about?"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="channel-type">Type</Label>
              <Select value={channelType} onValueChange={v => setChannelType(v as Channel['channel_type'])}>
                <SelectTrigger id="channel-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="announcement">Announcement (admins post)</SelectItem>
                  <SelectItem value="department">Department</SelectItem>
                  <SelectItem value="team">Team</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="channel-private">Private Channel</Label>
                <p className="text-xs text-muted-foreground">
                  Only invited members can see this channel
                </p>
              </div>
              <Switch
                id="channel-private"
                checked={isPrivate}
                onCheckedChange={setIsPrivate}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={creating || !name.trim()}>
                {creating ? 'Creating...' : 'Create Channel'}
              </Button>
            </div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
