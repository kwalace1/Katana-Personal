import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { cn } from '@/lib/utils'

/**
 * Markdown renderer for agent messages. Typography lives in the
 * `agent-office-md` class (src/styles/office.css) so it follows the theme.
 */
export const MarkdownBody = memo(function MarkdownBody({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  return (
    <div className={cn('agent-office-md text-sm break-words', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
})
