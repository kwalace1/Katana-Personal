import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Mail, Calendar, Plug, AlertCircle, CheckCircle2 } from 'lucide-react'
import type { CrmIntegrationSettings } from '@/lib/customer-crm-api'
import * as crmApi from '@/lib/customer-crm-api'
import { getCrmOAuthStartUrl, type CrmOAuthProvider } from '@/lib/crm-oauth-client'
import { supabase } from '@/lib/supabase'
import { toast } from '@/hooks/use-toast'
import { useSearchParams } from 'react-router-dom'

export function CrmIntegrationsPanel() {
  const [settings, setSettings] = useState<CrmIntegrationSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    void crmApi.getIntegrationSettings().then((s) => {
      setSettings(s)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (searchParams.get('crm_oauth') === 'connected') {
      toast({ title: 'Connected', description: 'Email or calendar integration is now linked.' })
      void crmApi.getIntegrationSettings().then(setSettings)
      searchParams.delete('crm_oauth')
      searchParams.delete('crm_oauth_error')
      setSearchParams(searchParams, { replace: true })
    }
    const err = searchParams.get('crm_oauth_error')
    if (err) {
      toast({ title: 'Connection failed', description: decodeURIComponent(err), variant: 'destructive' })
      searchParams.delete('crm_oauth_error')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const startOAuth = async (integration: CrmOAuthProvider) => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) {
      toast({ title: 'Sign in required', description: 'Please sign in to connect integrations.' })
      return
    }
    const url = `${getCrmOAuthStartUrl(integration)}&access_token=${encodeURIComponent(token)}`
    window.location.href = url
  }

  if (loading) return null

  const emailOk = settings?.email_connected
  const calendarOk = settings?.calendar_connected

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Plug className="h-4 w-4" />
          Integrations
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Connect email and calendar to sync touchpoints with customer records (OAuth)
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Email</span>
            </div>
            {emailOk ? (
              <Badge className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {settings?.email_provider}
              </Badge>
            ) : (
              <Badge variant="outline">Not connected</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => void startOAuth('gmail')}>
              Connect Gmail
            </Button>
            <Button size="sm" variant="outline" onClick={() => void startOAuth('outlook')}>
              Connect Outlook
            </Button>
          </div>
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Calendar</span>
            </div>
            {calendarOk ? (
              <Badge className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {settings?.calendar_provider}
              </Badge>
            ) : (
              <Badge variant="outline">Not connected</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => void startOAuth('google_calendar')}>
              Google Calendar
            </Button>
            <Button size="sm" variant="outline" onClick={() => void startOAuth('outlook_calendar')}>
              Outlook Calendar
            </Button>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            Server env vars required: <code className="text-[10px]">GOOGLE_CLIENT_ID</code>,{' '}
            <code className="text-[10px]">GOOGLE_CLIENT_SECRET</code>,{' '}
            <code className="text-[10px]">AZURE_CLIENT_ID</code>,{' '}
            <code className="text-[10px]">AZURE_CLIENT_SECRET</code>, and{' '}
            <code className="text-[10px]">SUPABASE_SERVICE_ROLE_KEY</code>. Redirect URIs must include{' '}
            <code className="text-[10px]">/api/crm-oauth?action=callback&amp;vendor=google|microsoft</code>.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
