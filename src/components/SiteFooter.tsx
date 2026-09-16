import { Link } from 'react-router-dom'
import { BrandMark } from '@/components/BrandMark'
import { SUPPORT_EMAIL } from '@/lib/brand'
import { cn } from '@/lib/utils'

export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        'mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-6 text-xs text-muted-foreground',
        className,
      )}
    >
      <BrandMark to="/" compact />
      <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link to="/privacy" className="hover:text-foreground">
          Privacy
        </Link>
        <Link to="/terms" className="hover:text-foreground">
          Terms
        </Link>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-foreground">
          Support
        </a>
      </nav>
    </footer>
  )
}
