import { Copy, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Message } from '@/lib/comms-api'
import { getMessagePreview, isGifMessage } from '@/lib/comms-message-content'

interface MessageActionsMenuProps {
  message: Message
  onEdit?: (message: Message) => void
  onDelete?: (messageId: string) => void
  /** When true, always show Copy. Defaults to true. */
  allowCopy?: boolean
  align?: 'start' | 'end'
}

async function copyMessageContent(message: Message): Promise<void> {
  const text = isGifMessage(message.content)
    ? getMessagePreview(message.content)
    : message.content
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  } catch {
    toast.error('Could not copy message')
  }
}

export function MessageActionsMenu({
  message,
  onEdit,
  onDelete,
  allowCopy = true,
  align = 'end',
}: MessageActionsMenuProps) {
  const canEdit = Boolean(onEdit) && !isGifMessage(message.content)
  const canDelete = Boolean(onDelete)
  if (!allowCopy && !canEdit && !canDelete) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Message actions">
          <MoreHorizontal className="w-3.5 h-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        {allowCopy && (
          <DropdownMenuItem onClick={() => void copyMessageContent(message)}>
            <Copy className="w-3.5 h-3.5 mr-2" />
            Copy
          </DropdownMenuItem>
        )}
        {canEdit && onEdit && (
          <DropdownMenuItem onClick={() => onEdit(message)}>
            <Pencil className="w-3.5 h-3.5 mr-2" />
            Edit
          </DropdownMenuItem>
        )}
        {canDelete && onDelete && (
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => onDelete(message.id)}
          >
            <Trash2 className="w-3.5 h-3.5 mr-2" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
