import { useEffect, useState } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { MotionPage } from '@/components/motion-page'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, Loader2, Users } from 'lucide-react'
import { getPublicOrgBySlug, submitPublicLead } from '@/lib/public-lead-api'

export default function PublicLeadCapturePage() {
  const { orgSlug = '' } = useParams<{ orgSlug: string }>()
  const [searchParams] = useSearchParams()
  const campaignId = searchParams.get('campaign')

  const [org, setOrg] = useState<{ name: string; slug: string } | null>(null)
  const [loadingOrg, setLoadingOrg] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    accountType: 'business' as 'business' | 'individual',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    companyName: '',
    message: '',
  })

  useEffect(() => {
    let cancelled = false
    void getPublicOrgBySlug(orgSlug).then((info) => {
      if (cancelled) return
      setOrg(info)
      setLoadingOrg(false)
    })
    return () => {
      cancelled = true
    }
  }, [orgSlug])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.firstName.trim()) return
    setSubmitting(true)
    setError(null)
    const result = await submitPublicLead({
      orgSlug,
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone,
      companyName: form.accountType === 'business' ? form.companyName : undefined,
      accountType: form.accountType,
      message: form.message,
      campaignId,
    })
    setSubmitting(false)
    if (result.leadId) {
      setSubmitted(true)
    } else {
      setError(result.error ?? 'Something went wrong')
    }
  }

  if (loadingOrg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!org) {
    return (
      <MotionPage className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 text-center space-y-4">
            <p className="text-muted-foreground">This contact page is not available.</p>
            <Button asChild variant="outline">
              <Link to="/">Go to Katana</Link>
            </Button>
          </CardContent>
        </Card>
      </MotionPage>
    )
  }

  return (
    <MotionPage className="min-h-screen bg-gradient-to-b from-background to-muted/30 p-6">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Contact {org.name}</h1>
          <p className="text-sm text-muted-foreground">
            Tell us about yourself — we&apos;ll get back to you shortly.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{submitted ? 'Thank you!' : 'Get in touch'}</CardTitle>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="text-center py-6 space-y-3">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
                <p className="text-muted-foreground">
                  Your request was received. Someone from {org.name} will follow up soon.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>I am a</Label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={form.accountType}
                    onChange={(e) =>
                      setForm({ ...form, accountType: e.target.value as 'business' | 'individual' })
                    }
                  >
                    <option value="business">Business</option>
                    <option value="individual">Individual</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First name *</Label>
                    <Input
                      value={form.firstName}
                      onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last name</Label>
                    <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                  </div>
                </div>
                {form.accountType === 'business' && (
                  <div className="space-y-2">
                    <Label>Company</Label>
                    <Input
                      value={form.companyName}
                      onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>How can we help?</Label>
                  <Textarea
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    rows={4}
                    placeholder="Tell us what you're looking for…"
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    'Submit'
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Powered by{' '}
          <Link to="/" className="underline hover:text-foreground">
            Katana
          </Link>
        </p>
      </div>
    </MotionPage>
  )
}
