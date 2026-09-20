import { Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BrandMark } from '@/components/BrandMark'
import { SiteFooter } from '@/components/SiteFooter'
import { SUPPORT_EMAIL } from '@/lib/brand'
import { iosDownloadUrl } from '@/lib/web-app-lock'

export function OpenInIosScreen({
  title,
  body,
  deepLink,
}: {
  title: string
  body: string
  deepLink?: string
}) {
  const download = iosDownloadUrl()

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-5 py-12">
      <div className="kp-surface w-full max-w-md p-8">
        <BrandMark to="/" />
        <span className="mt-8 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Smartphone className="h-5 w-5" />
        </span>
        <h1 className="font-display mt-4 text-2xl tracking-tight">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
        <div className="mt-6 flex flex-col gap-3">
          {deepLink ? (
            <Button asChild className="min-h-12 w-full" size="lg">
              <a href={deepLink}>Open in Katana</a>
            </Button>
          ) : null}
          {download ? (
            <Button
              asChild
              variant={deepLink ? 'outline' : 'default'}
              className="min-h-12 w-full"
              size="lg"
            >
              <a href={download} target="_blank" rel="noreferrer">
                Get the iPhone app
              </a>
            </Button>
          ) : null}
        </div>
        {!download ? (
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Katana is an iPhone app. If you already have TestFlight, open it there. Questions:{' '}
            <a className="underline-offset-4 hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
              {SUPPORT_EMAIL}
            </a>
          </p>
        ) : null}
        <SiteFooter className="mt-10" />
      </div>
    </div>
  )
}
