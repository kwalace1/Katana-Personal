import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Copy, ExternalLink, Link2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { publicLeadCaptureUrl } from '@/lib/public-lead-api'
import { toast } from '@/hooks/use-toast'

interface CrmLeadCaptureSettingsProps {
  campaignId?: string
}

export function CrmLeadCaptureSettings({ campaignId }: CrmLeadCaptureSettingsProps) {
  const { organization } = useAuth()
  const slug = organization?.slug

  const captureUrl = useMemo(() => {
    if (!slug) return ''
    return publicLeadCaptureUrl(slug, campaignId)
  }, [slug, campaignId])

  const copyUrl = () => {
    if (!captureUrl) return
    void navigator.clipboard.writeText(captureUrl)
    toast({ title: 'Link copied', description: 'Share this URL on your website or in ads.' })
  }

  if (!slug) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Organization slug not found — set up your organization to enable public lead capture.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Public lead capture
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Share this link on your website, ads, or email — submissions create leads in the Leads tab
          {campaignId ? ' and attribute to this campaign' : ''}.
        </p>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Input readOnly value={captureUrl} className="font-mono text-xs flex-1 min-w-[200px]" />
        <Button type="button" variant="outline" size="sm" onClick={copyUrl}>
          <Copy className="h-4 w-4 mr-1" />
          Copy
        </Button>
        <Button type="button" variant="outline" size="sm" asChild>
          <a href={captureUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-1" />
            Preview
          </a>
        </Button>
      </CardContent>
    </Card>
  )
}
