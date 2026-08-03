import { Bell, BellOff, EyeOff, Eye, LogOut, Trash2, UserX, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Channel, Conversation } from '@/lib/comms-api'
import type { CommsUserPreferences } from '@/lib/comms-preferences'
import * as Prefs from '@/lib/comms-preferences'

export type CommsOptionsTarget =
  | { kind: 'channel'; channel: Channel }
  | { kind: 'conversation'; conversation: Conversation; otherUserId?: string | null }

interface CommsOptionsMenuProps {
  target: CommsOptionsTarget
  prefs: CommsUserPreferences
  currentUserId: string
  isChannelMember?: boolean
  onPrefsUpdated: () => void
  onChannelLeft?: (channelId: string) => void
  onChannelHidden?: (channelId: string) => void
  onConversationHidden?: (conversationId: string) => void
  onConversationLeft?: (conversationId: string) => void
  align?: 'start' | 'end'
  iconClassName?: string
}

export function CommsOptionsMenu({
  target,
  prefs,
  currentUserId,
  isChannelMember = true,
  onPrefsUpdated,
  onChannelLeft,
  onChannelHidden,
  onConversationHidden,
  onConversationLeft,
  align = 'end',
  iconClassName,
}: CommsOptionsMenuProps) {
  const run = async (fn: () => Promise<boolean>) => {
    const ok = await fn()
    if (ok) onPrefsUpdated()
    return ok
  }

  if (target.kind === 'channel') {
    const { channel } = target
    const isMuted = prefs.mutedChannelIds.has(channel.id)
    const isHidden = prefs.hiddenChannelIds.has(channel.id)

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 ${iconClassName ?? ''}`}
            onClick={e => e.stopPropagation()}
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} onClick={e => e.stopPropagation()}>
          <DropdownMenuItem
            onClick={() => void run(() => Prefs.setChannelMuted(channel.id, !isMuted))}
          >
            {isMuted ? (
              <>
                <Bell className="w-3.5 h-3.5 mr-2" />
                Unmute channel
              </>
            ) : (
              <>
                <BellOff className="w-3.5 h-3.5 mr-2" />
                Mute channel
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              void run(() =>
                Prefs.setChannelMentionsOnly(
                  channel.id,
                  !prefs.mentionsOnlyChannelIds.has(channel.id)
                )
              )
            }
          >
            <Bell className="w-3.5 h-3.5 mr-2" />
            {prefs.mentionsOnlyChannelIds.has(channel.id)
              ? 'Notify on all messages'
              : 'Notify on mentions only'}
          </DropdownMenuItem>
          {isHidden ? (
            <DropdownMenuItem
              onClick={() => void run(() => Prefs.unhideChannel(channel.id))}
            >
              <Eye className="w-3.5 h-3.5 mr-2" />
              Show in sidebar
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={async () => {
                const ok = await Prefs.setChannelHidden(channel.id, true)
                if (ok) {
                  onPrefsUpdated()
                  onChannelHidden?.(channel.id)
                }
              }}
            >
              <EyeOff className="w-3.5 h-3.5 mr-2" />
              Hide channel
            </DropdownMenuItem>
          )}
          {isChannelMember && channel.created_by !== currentUserId && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={async () => {
                  const ok = await Prefs.leaveChannel(channel.id)
                  if (ok) {
                    onPrefsUpdated()
                    onChannelLeft?.(channel.id)
                  }
                }}
              >
                <LogOut className="w-3.5 h-3.5 mr-2" />
                Leave channel
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const { conversation, otherUserId } = target
  const isMuted = prefs.mutedConversationIds.has(conversation.id)
  const isHidden = prefs.hiddenConversationIds.has(conversation.id)
  const otherMuted = otherUserId ? prefs.mutedUserIds.has(otherUserId) : false
  const isDirect = conversation.conversation_type === 'direct'
  const isGroup = conversation.conversation_type === 'group'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 ${iconClassName ?? ''}`}
          onClick={e => e.stopPropagation()}
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} onClick={e => e.stopPropagation()}>
        <DropdownMenuItem
          onClick={() => void run(() => Prefs.setConversationMuted(conversation.id, !isMuted))}
        >
          {isMuted ? (
            <>
              <Bell className="w-3.5 h-3.5 mr-2" />
              Unmute conversation
            </>
          ) : (
            <>
              <BellOff className="w-3.5 h-3.5 mr-2" />
              Mute conversation
            </>
          )}
        </DropdownMenuItem>
        {isDirect && otherUserId && (
          <DropdownMenuItem
            onClick={() => void run(() => Prefs.setUserMuted(otherUserId, !otherMuted))}
          >
            {otherMuted ? (
              <>
                <Bell className="w-3.5 h-3.5 mr-2" />
                Unmute person
              </>
            ) : (
              <>
                <UserX className="w-3.5 h-3.5 mr-2" />
                Mute person
              </>
            )}
          </DropdownMenuItem>
        )}
        {isHidden ? (
          <DropdownMenuItem
            onClick={() => void run(() => Prefs.unhideConversation(conversation.id))}
          >
            <Eye className="w-3.5 h-3.5 mr-2" />
            Show in sidebar
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={async () => {
              const ok = await Prefs.hideConversation(conversation.id)
              if (ok) {
                onPrefsUpdated()
                onConversationHidden?.(conversation.id)
              }
            }}
          >
            <EyeOff className="w-3.5 h-3.5 mr-2" />
            {isDirect ? 'Delete conversation' : 'Hide conversation'}
          </DropdownMenuItem>
        )}
        {(isGroup || isDirect) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={async () => {
                const ok = await Prefs.leaveConversation(conversation.id)
                if (ok) {
                  onPrefsUpdated()
                  onConversationLeft?.(conversation.id)
                }
              }}
            >
              {isDirect ? (
                <>
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  Delete & leave
                </>
              ) : (
                <>
                  <LogOut className="w-3.5 h-3.5 mr-2" />
                  Leave group
                </>
              )}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
