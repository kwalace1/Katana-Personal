import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Building2, Loader2, Target, User } from 'lucide-react'
import { getIcpProfile, upsertIcpProfile, type KycIcpProfile } from '@/lib/kyc-api'
import { useToast } from '@/hooks/use-toast'

function parseCsvList(value: string): string[] {
  return value
    .split(/[,;|/]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function KycIcpProfileCard() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [savingIcp, setSavingIcp] = useState(false)
  const [icpForm, setIcpForm] = useState({
    targetIndustries: '',
    targetStates: '',
    targetCountries: '',
    minDealSize: '',
    description: '',
    preferB2b: true,
    preferB2c: true,
  })

  const loadIcp = useCallback(async () => {
    setLoading(true)
    try {
      const icp = await getIcpProfile()
      setIcpForm({
        targetIndustries: icp.target_industries.join(', '),
        targetStates: icp.target_states.join(', '),
        targetCountries: icp.target_countries.join(', '),
        minDealSize: icp.min_deal_size > 0 ? String(icp.min_deal_size) : '',
        description: icp.description,
        preferB2b: icp.preferred_account_types.includes('business'),
        preferB2c: icp.preferred_account_types.includes('individual'),
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadIcp()
  }, [loadIcp])

  const handleSaveIcp = async () => {
    setSavingIcp(true)
    const preferred: string[] = []
    if (icpForm.preferB2b) preferred.push('business')
    if (icpForm.preferB2c) preferred.push('individual')
    const profile: Partial<KycIcpProfile> = {
      target_industries: parseCsvList(icpForm.targetIndustries),
      target_states: parseCsvList(icpForm.targetStates),
      target_countries: parseCsvList(icpForm.targetCountries),
      min_deal_size: parseFloat(icpForm.minDealSize) || 0,
      description: icpForm.description,
      preferred_account_types: preferred.length > 0 ? preferred : ['business', 'individual'],
    }
    const saved = await upsertIcpProfile(profile)
    setSavingIcp(false)
    if (saved) {
      toast({ title: 'ICP profile saved', description: 'Lead and account fit scoring will use these targets.' })
      void loadIcp()
    } else {
      toast({
        title: 'Could not save ICP profile',
        description: 'Run supabase-kyc-migration.sql if the table is missing.',
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading ICP profile…
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Ideal Customer Profile
        </CardTitle>
        <CardDescription>
          Defines ICP fit for leads and accounts. Industry targets apply to B2B; geo and deal size work for both.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Target customer types</Label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={icpForm.preferB2b ? 'default' : 'outline'}
              onClick={() => setIcpForm({ ...icpForm, preferB2b: !icpForm.preferB2b })}
            >
              <Building2 className="h-3.5 w-3.5 mr-1" />
              B2B
            </Button>
            <Button
              type="button"
              size="sm"
              variant={icpForm.preferB2c ? 'default' : 'outline'}
              onClick={() => setIcpForm({ ...icpForm, preferB2c: !icpForm.preferB2c })}
            >
              <User className="h-3.5 w-3.5 mr-1" />
              B2C
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="icp-industries">Target industries (B2B)</Label>
          <Input
            id="icp-industries"
            placeholder="Healthcare, SaaS, Manufacturing"
            value={icpForm.targetIndustries}
            onChange={(e) => setIcpForm({ ...icpForm, targetIndustries: e.target.value })}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="icp-states">States / regions</Label>
            <Input
              id="icp-states"
              placeholder="CA, NY, TX"
              value={icpForm.targetStates}
              onChange={(e) => setIcpForm({ ...icpForm, targetStates: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="icp-countries">Countries</Label>
            <Input
              id="icp-countries"
              placeholder="US, CA, UK"
              value={icpForm.targetCountries}
              onChange={(e) => setIcpForm({ ...icpForm, targetCountries: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="icp-deal">Minimum deal size ($)</Label>
          <Input
            id="icp-deal"
            type="number"
            min="0"
            placeholder="10000"
            value={icpForm.minDealSize}
            onChange={(e) => setIcpForm({ ...icpForm, minDealSize: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="icp-desc">Description</Label>
          <Textarea
            id="icp-desc"
            rows={3}
            placeholder="Mid-market B2B or high-value B2C segments you pursue…"
            value={icpForm.description}
            onChange={(e) => setIcpForm({ ...icpForm, description: e.target.value })}
          />
        </div>
        <Button onClick={() => void handleSaveIcp()} disabled={savingIcp}>
          {savingIcp ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Save ICP profile
        </Button>
      </CardContent>
    </Card>
  )
}
