import { parseMessageContent } from '@/lib/comms-message-content'
import type { MessageAttachment } from '@/lib/comms-api'

interface MessageContentProps {
  content: string
  className?: string
  attachments?: MessageAttachment[]
}

/** Escape HTML then apply light markdown + autolink + @mention highlights. */
function renderRichText(raw: string): string {
  let text = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Code backticks
  text = text.replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1 py-0.5 text-[0.85em]">$1</code>')
  // Bold / italic
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>')
  // Autolink URLs
  text = text.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-primary underline underline-offset-2">$1</a>'
  )
  // @mentions (including @channel)
  text = text.replace(
    /@([A-Za-z0-9._+-]+(?:\s+[A-Za-z0-9._+-]+){0,3}|channel)/gi,
    '<span class="text-primary font-medium bg-primary/10 rounded px-0.5">@$1</span>'
  )
  // Newlines
  text = text.replace(/\n/g, '<br />')
  return text
}

export function MessageContent({ content, className = '', attachments }: MessageContentProps) {
  const parsed = parseMessageContent(content)

  if (parsed.type === 'gif') {
    return (
      <div className={`selectable-text ${className}`.trim()}>
        <img
          src={parsed.url}
          alt="GIF"
          className="max-w-xs max-h-64 rounded-lg object-contain"
          loading="lazy"
        />
        {attachments && attachments.length > 0 && (
          <AttachmentList attachments={attachments} />
        )}
      </div>
    )
  }

  return (
    <div className={`selectable-text ${className}`.trim()}>
      <p
        className={`text-foreground whitespace-pre-wrap break-words ${className.includes('text-') ? '' : 'text-sm'}`}
        dangerouslySetInnerHTML={{ __html: renderRichText(parsed.text) }}
      />
      {attachments && attachments.length > 0 && (
        <AttachmentList attachments={attachments} />
      )}
    </div>
  )
}

function AttachmentList({ attachments }: { attachments: MessageAttachment[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {attachments.map((att) => {
        const isImage = Boolean(att.mime_type?.startsWith('image/'))
        const url = att.public_url
        if (isImage && url) {
          return (
            <a key={att.id} href={url} target="_blank" rel="noopener noreferrer">
              <img
                src={url}
                alt={att.file_name}
                className="max-w-[200px] max-h-40 rounded-md border object-cover"
                loading="lazy"
              />
            </a>
          )
        }
        return (
          <a
            key={att.id}
            href={url ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs hover:bg-muted"
          >
            <span className="truncate max-w-[180px]">{att.file_name}</span>
          </a>
        )
      })}
    </div>
  )
}
