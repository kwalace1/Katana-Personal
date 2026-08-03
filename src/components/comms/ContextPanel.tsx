import { formatStoredDate } from '@/lib/due-date-utils'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Users, Hash, Lock, Calendar, Shield, UserPlus, Settings,
  Trash2, Check, Pencil, LogOut, Bell, BellOff, EyeOff, UserX,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import * as CommsApi from '@/lib/comms-api'
import type { Channel, Conversation, ChannelMember, ConversationMember, UserProfileSummary } from '@/lib/comms-api'
import type { CommsUserPreferences } from '@/lib/comms-preferences'
import * as Prefs from '@/lib/comms-preferences'

interface ContextPanelProps {
  channel: Channel | null
  conversation: Conversation | null
  currentUserId: string
  onClose: () => void
  onChannelUpdated?: (channel: Channel) => void
  onChannelDeleted?: (channelId: string) => void
  prefs: CommsUserPreferences
  onPrefsUpdated: () => void
  onChannelHidden?: (channelId: string) => void
  onChannelLeft?: (channelId: string) => void
  onConversationHidden?: (conversationId: string) => void
  onConversationLeft?: (conversationId: string) => void
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

function formatDate(iso: string): string {
  return formatStoredDate(iso, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function ContextPanel({
  channel,
  conversation,
  currentUserId,
  onClose,
  onChannelUpdated,
  onChannelDeleted,
  prefs,
  onPrefsUpdated,
  onChannelHidden,
  onChannelLeft,
  onConversationHidden,
  onConversationLeft,
}: ContextPanelProps) {
  const [channelMembers, setChannelMembers] = useState<ChannelMember[]>([])
  const [convMembers, setConvMembers] = useState<ConversationMember[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const isCreator = channel?.created_by === currentUserId
  const isAdmin = channelMembers.some(
    m => m.member_user_id === currentUserId && m.role === 'admin'
  )
  const canManage = isCreator || isAdmin

  const loadMembers = useCallback(async () => {
    setLoading(true)
    if (channel) {
      const members = await CommsApi.getChannelMembers(channel.id)
      setChannelMembers(members)
      setConvMembers([])
    } else if (conversation) {
      const members = await CommsApi.getConversationMembers(conversation.id)
      setConvMembers(members)
      setChannelMembers([])
    } else {
      setChannelMembers([])
      setConvMembers([])
    }
    setLoading(false)
  }, [channel, conversation])

  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  const handleRemoveMember = async (memberUserId: string) => {
    if (!channel) return
    const ok = await CommsApi.removeChannelMember(channel.id, memberUserId)
    if (ok) loadMembers()
  }

  const handleDeleteChannel = async () => {
    if (!channel) return
    const ok = await CommsApi.deleteChannel(channel.id)
    if (ok) onChannelDeleted?.(channel.id)
  }

  const refreshPrefs = () => onPrefsUpdated()

  const channelMuted = channel ? prefs.mutedChannelIds.has(channel.id) : false
  const channelHidden = channel ? prefs.hiddenChannelIds.has(channel.id) : false
  const convMuted = conversation ? prefs.mutedConversationIds.has(conversation.id) : false

  const members = channel
    ? channelMembers.map(m => ({
        id: m.member_user_id,
        name: m.profile?.full_name ?? m.profile?.email ?? 'Unknown',
        avatar: m.profile?.avatar_url ?? null,
        role: m.role,
      }))
    : convMembers.map(m => ({
        id: m.member_user_id,
        name: m.profile?.full_name ?? m.profile?.email ?? 'Unknown',
        avatar: m.profile?.avatar_url ?? null,
        role: null as string | null,
      }))

  return (
    <>
      <motion.div
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: 300, opacity: 1 }}
        exit={{ width: 0, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="border-l border-border bg-card shrink-0 overflow-hidden"
      >
        <div className="w-[300px]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-sm">Details</h3>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <ScrollArea className="h-[calc(100vh-8rem)]">
            <div className="p-4 space-y-4">
              {/* ── Channel Info ── */}
              {channel && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {channel.is_private ? (
                        <Lock className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Hash className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="font-medium">{channel.name}</span>
                    </div>
                    {channel.description && (
                      <p className="text-sm text-muted-foreground">{channel.description}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {channel.channel_type}
                    </Badge>
                    {channel.is_private && (
                      <Badge variant="outline" className="text-xs">
                        <Shield className="w-3 h-3 mr-1" />
                        Private
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    <span>Created {formatDate(channel.created_at)}</span>
                  </div>

                  <Separator />

                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Notifications</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start h-8 text-xs"
                      onClick={() => void Prefs.setChannelMuted(channel.id, !channelMuted).then(ok => ok && refreshPrefs())}
                    >
                      {channelMuted ? (
                        <><Bell className="w-3.5 h-3.5 mr-2" /> Unmute channel</>
                      ) : (
                        <><BellOff className="w-3.5 h-3.5 mr-2" /> Mute channel</>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start h-8 text-xs"
                      onClick={async () => {
                        const ok = await Prefs.setChannelHidden(channel.id, !channelHidden)
                        if (ok) {
                          refreshPrefs()
                          if (!channelHidden) onChannelHidden?.(channel.id)
                        }
                      }}
                    >
                      <EyeOff className="w-3.5 h-3.5 mr-2" />
                      {channelHidden ? 'Show in sidebar' : 'Hide channel'}
                    </Button>
                    {!isCreator && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start h-8 text-xs text-destructive hover:text-destructive"
                        onClick={async () => {
                          const ok = await Prefs.leaveChannel(channel.id)
                          if (ok) {
                            refreshPrefs()
                            onChannelLeft?.(channel.id)
                          }
                        }}
                      >
                        <LogOut className="w-3.5 h-3.5 mr-2" />
                        Leave channel
                      </Button>
                    )}
                  </div>

                  <Separator />
                </>
              )}

              {/* ── Conversation Info ── */}
              {conversation && (
                <>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {conversation.conversation_type === 'direct' ? 'Direct Message' : 'Group Conversation'}
                    </p>
                    {conversation.name && (
                      <p className="text-sm text-muted-foreground">{conversation.name}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    <span>Started {formatDate(conversation.created_at)}</span>
                  </div>

                  <Separator />

                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Notifications</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start h-8 text-xs"
                      onClick={() =>
                        void Prefs.setConversationMuted(conversation.id, !convMuted).then(ok => ok && refreshPrefs())
                      }
                    >
                      {convMuted ? (
                        <><Bell className="w-3.5 h-3.5 mr-2" /> Unmute conversation</>
                      ) : (
                        <><BellOff className="w-3.5 h-3.5 mr-2" /> Mute conversation</>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start h-8 text-xs"
                      onClick={async () => {
                        const ok = await Prefs.hideConversation(conversation.id)
                        if (ok) {
                          refreshPrefs()
                          onConversationHidden?.(conversation.id)
                        }
                      }}
                    >
                      <EyeOff className="w-3.5 h-3.5 mr-2" />
                      {conversation.conversation_type === 'direct'
                        ? 'Delete conversation'
                        : 'Hide conversation'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start h-8 text-xs text-destructive hover:text-destructive"
                      onClick={async () => {
                        const ok = await Prefs.leaveConversation(conversation.id)
                        if (ok) {
                          refreshPrefs()
                          onConversationLeft?.(conversation.id)
                        }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-2" />
                      {conversation.conversation_type === 'direct' ? 'Delete & leave' : 'Leave group'}
                    </Button>
                  </div>

                  <Separator />
                </>
              )}

              {/* ── Members ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Members ({members.length})</span>
                  </div>
                  {channel && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setShowAddMember(true)}
                    >
                      <UserPlus className="w-3.5 h-3.5 mr-1" />
                      Add
                    </Button>
                  )}
                </div>

                <div className="space-y-0.5">
                  <AnimatePresence>
                    {members.map(member => (
                      <motion.div
                        key={member.id}
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -12 }}
                        className="group flex items-center gap-2 py-1.5 px-1 rounded-md hover:bg-muted/50"
                      >
                        <Avatar className="w-7 h-7">
                          <AvatarImage src={member.avatar ?? undefined} />
                          <AvatarFallback className="text-[10px]">
                            {getInitials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm truncate flex-1">{member.name}</span>
                        {member.role === 'admin' && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                            admin
                          </Badge>
                        )}
                        {conversation &&
                          conversation.conversation_type === 'direct' &&
                          member.id !== currentUserId && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() =>
                                void Prefs.setUserMuted(
                                  member.id,
                                  !prefs.mutedUserIds.has(member.id)
                                ).then(ok => ok && refreshPrefs())
                              }
                              title={prefs.mutedUserIds.has(member.id) ? 'Unmute person' : 'Mute person'}
                            >
                              {prefs.mutedUserIds.has(member.id) ? (
                                <Bell className="w-3 h-3" />
                              ) : (
                                <UserX className="w-3 h-3" />
                              )}
                            </Button>
                          )}
                        {channel && canManage && member.id !== currentUserId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                            onClick={() => handleRemoveMember(member.id)}
                            title="Remove member"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        )}
                        {channel && member.id === currentUserId && !isCreator && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground"
                            onClick={() => handleRemoveMember(member.id)}
                            title="Leave channel"
                          >
                            <LogOut className="w-3 h-3" />
                          </Button>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              {/* ── Channel Settings ── */}
              {channel && canManage && (
                <>
                  <Separator />
                  <div>
                    <button
                      className="flex items-center gap-2 w-full text-left py-1"
                      onClick={() => setShowSettings(s => !s)}
                    >
                      <Settings className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Channel Settings</span>
                      <motion.span
                        animate={{ rotate: showSettings ? 180 : 0 }}
                        className="ml-auto text-muted-foreground text-xs"
                      >
                        ▾
                      </motion.span>
                    </button>

                    <AnimatePresence>
                      {showSettings && (
                        <ChannelSettingsForm
                          channel={channel}
                          onUpdated={onChannelUpdated}
                        />
                      )}
                    </AnimatePresence>
                  </div>
                </>
              )}

              {/* ── Delete Channel ── */}
              {channel && isCreator && (
                <>
                  <Separator />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Channel
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete &ldquo;{channel.name}&rdquo;?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the channel, all its messages, and remove all
                          members. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteChannel}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      </motion.div>

      {/* Add Member Dialog */}
      {channel && (
        <AddMemberDialog
          open={showAddMember}
          onOpenChange={setShowAddMember}
          channelId={channel.id}
          existingMemberIds={members.map(m => m.id)}
          onMemberAdded={loadMembers}
        />
      )}
    </>
  )
}

// ─── Inline Settings Form ────────────────────────────────────────────────────

function ChannelSettingsForm({
  channel,
  onUpdated,
}: {
  channel: Channel
  onUpdated?: (channel: Channel) => void
}) {
  const [name, setName] = useState(channel.name)
  const [description, setDescription] = useState(channel.description ?? '')
  const [channelType, setChannelType] = useState(channel.channel_type)
  const [isPrivate, setIsPrivate] = useState(channel.is_private)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const hasChanges =
    name !== channel.name ||
    description !== (channel.description ?? '') ||
    channelType !== channel.channel_type ||
    isPrivate !== channel.is_private

  const handleSave = async () => {
    if (!hasChanges || !name.trim()) return
    setSaving(true)
    const updated = await CommsApi.updateChannel(channel.id, {
      name: name.trim(),
      description: description.trim() || null,
      channel_type: channelType,
      is_private: isPrivate,
    })
    setSaving(false)
    if (updated) {
      onUpdated?.(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className="space-y-3 pt-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Name</Label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Description</Label>
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="text-sm min-h-[60px] resize-none"
            placeholder="What's this channel about?"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Type</Label>
          <Select value={channelType} onValueChange={v => setChannelType(v as Channel['channel_type'])}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="department">Department</SelectItem>
              <SelectItem value="team">Team</SelectItem>
              <SelectItem value="project">Project</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Private</Label>
          <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
        </div>

        <Button
          size="sm"
          className="w-full h-8 text-xs"
          disabled={!hasChanges || !name.trim() || saving}
          onClick={handleSave}
        >
          {saving ? 'Saving...' : saved ? (
            <><Check className="w-3 h-3 mr-1" /> Saved</>
          ) : (
            <><Pencil className="w-3 h-3 mr-1" /> Save Changes</>
          )}
        </Button>
      </div>
    </motion.div>
  )
}

// ─── Add Member Dialog ───────────────────────────────────────────────────────

function AddMemberDialog({
  open,
  onOpenChange,
  channelId,
  existingMemberIds,
  onMemberAdded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  channelId: string
  existingMemberIds: string[]
  onMemberAdded: () => void
}) {
  const [search, setSearch] = useState('')
  const [orgMembers, setOrgMembers] = useState<UserProfileSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setSearch('')
    CommsApi.getOrganizationMembers().then(members => {
      setOrgMembers(members)
      setLoading(false)
    })
  }, [open])

  const available = orgMembers.filter(
    m => !existingMemberIds.includes(m.id) &&
      (m.full_name?.toLowerCase().includes(search.toLowerCase()) ||
       m.email.toLowerCase().includes(search.toLowerCase()))
  )

  const handleAdd = async (userId: string) => {
    setAdding(userId)
    const result = await CommsApi.addChannelMember(channelId, userId)
    setAdding(null)
    if (result) {
      onMemberAdded()
      // Remove from available list immediately
      setOrgMembers(prev => prev) // trigger re-render via parent
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>Add Members</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9"
            autoFocus
          />
          <ScrollArea className="max-h-[300px]">
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
            ) : available.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                {search ? 'No matching members found' : 'All organization members are already in this channel'}
              </p>
            ) : (
              <div className="space-y-1">
                <AnimatePresence>
                  {available.map(member => (
                    <motion.div
                      key={member.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="flex items-center gap-2 py-2 px-2 rounded-md hover:bg-muted/50"
                    >
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={member.avatar_url ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(member.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {member.full_name || 'Unknown'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs shrink-0"
                        disabled={adding === member.id}
                        onClick={() => handleAdd(member.id)}
                      >
                        {adding === member.id ? '...' : (
                          <><UserPlus className="w-3 h-3 mr-1" /> Add</>
                        )}
                      </Button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
