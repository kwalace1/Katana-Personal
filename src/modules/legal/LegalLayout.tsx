import type { ReactNode } from 'react'
import { BrandMark } from '@/components/BrandMark'
import { SiteFooter } from '@/components/SiteFooter'
import { legalProseClass } from './legal-copy'

export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: ReactNode
}) {
  return (
    <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <header className="py-2">
        <BrandMark to="/" />
      </header>
      <article className="flex-1 py-8">
        <p className="kp-section-label mb-2">Katana Personal</p>
        <h1 className="font-display text-4xl tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p>
        <div className={`mt-8 ${legalProseClass}`}>{children}</div>
      </article>
      <SiteFooter />
    </div>
  )
}
