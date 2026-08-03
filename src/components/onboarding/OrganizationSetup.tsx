import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Check, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { DEFAULT_POST_LOGIN_PATH } from '@/lib/auth-helpers'

export function OrganizationSetup() {
  const { organization, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    organizationName: organization?.name || '',
    industry: '',
    companySize: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (!organization) throw new Error('No organization found')

      // Update organization name and settings
      const { error } = await supabase
        .from('organizations')
        .update({
          name: formData.organizationName,
          settings: {
            industry: formData.industry,
            company_size: formData.companySize,
            onboarding_completed: true,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', organization.id)

      if (error) throw error

      // Refresh profile to get updated organization data
      await refreshProfile()

      // Navigate to hub
      navigate('/hub')
    } catch (error) {
      console.error('Error updating organization:', error)
      alert('Failed to update organization. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = () => {
    localStorage.setItem('katana_onboarding_skipped', 'true')
    navigate(DEFAULT_POST_LOGIN_PATH)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-primary/10 p-4 rounded-full">
              <Building2 className="w-12 h-12 text-primary" />
            </div>
          </div>
          <CardTitle className="text-3xl">Welcome to Katana!</CardTitle>
          <CardDescription className="text-lg">
            Let's set up your organization to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Progress indicator */}
            <div className="flex items-center justify-center gap-2 mb-8">
              <div className={`w-2 h-2 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
              <div className={`w-2 h-2 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
              <div className={`w-2 h-2 rounded-full ${step >= 3 ? 'bg-primary' : 'bg-muted'}`} />
            </div>

            {step === 1 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-2">
                  <Label htmlFor="organizationName">Organization Name</Label>
                  <Input
                    id="organizationName"
                    placeholder="Acme Corporation"
                    value={formData.organizationName}
                    onChange={(e) =>
                      setFormData({ ...formData, organizationName: e.target.value })
                    }
                    required
                  />
                  <p className="text-sm text-muted-foreground">
                    This is how your organization will appear to all members.
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSkip}
                    className="flex-1"
                  >
                    Skip for now
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={!formData.organizationName.trim()}
                    className="flex-1"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Input
                    id="industry"
                    placeholder="Technology, Manufacturing, Healthcare..."
                    value={formData.industry}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  />
                  <p className="text-sm text-muted-foreground">
                    Help us customize your experience.
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(1)}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button type="button" onClick={() => setStep(3)} className="flex-1">
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-2">
                  <Label htmlFor="companySize">Company Size</Label>
                  <select
                    id="companySize"
                    value={formData.companySize}
                    onChange={(e) =>
                      setFormData({ ...formData, companySize: e.target.value })
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">Select size</option>
                    <option value="1-10">1-10 employees</option>
                    <option value="11-50">11-50 employees</option>
                    <option value="51-200">51-200 employees</option>
                    <option value="201-500">201-500 employees</option>
                    <option value="501-1000">501-1000 employees</option>
                    <option value="1000+">1000+ employees</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep(2)}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button type="submit" disabled={loading} className="flex-1">
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Setting up...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Complete Setup
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </form>

          {/* Benefits */}
          <div className="mt-8 pt-6 border-t">
            <h4 className="font-semibold mb-3 text-center">What you get:</h4>
            <div className="grid gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>Isolated workspace for your organization</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>Invite unlimited team members</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>Collaborative project management</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>Secure data with row-level security</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}







