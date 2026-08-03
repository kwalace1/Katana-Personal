import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  computeProfileCompleteness,
  type CompletenessResult,
} from '@/lib/profile-completeness'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Circle, ArrowRight, UserCircle } from 'lucide-react'
import { ProfileEditDialog } from './profile-edit-dialog'

export function ProfileCompletenessCard() {
  const { profile, organization } = useAuth()
  const navigate = useNavigate()
  const [result, setResult] = useState<CompletenessResult | null>(null)
  const [profileEditOpen, setProfileEditOpen] = useState(false)

  useEffect(() => {
    async function load() {
      let orgSettings: Record<string, unknown> | null = null
      if (organization?.id) {
        const { data } = await supabase
          .from('organizations')
          .select('settings, name')
          .eq('id', organization.id)
          .single()
        if (data?.name && data.name !== 'My Organization') {
          orgSettings = (data.settings as Record<string, unknown>) ?? {}
          orgSettings._hasName = true
        }
      }
      setResult(computeProfileCompleteness(profile, orgSettings))
    }
    load()
  }, [profile, organization])

  if (!result) return null
  if (result.score === 100) return null

  const scoreColor =
    result.score >= 80 ? 'text-green-600' : result.score >= 50 ? 'text-yellow-600' : 'text-orange-600'
  const progressColor =
    result.score >= 80 ? '[&>div]:bg-green-500' : result.score >= 50 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-orange-500'

  const handleAction = () => {
    if (!result.nextAction) return
    if (result.nextAction.route === '/settings/organization') {
      setProfileEditOpen(true)
    } else {
      navigate(result.nextAction.route)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <UserCircle className="h-5 w-5" />
              Profile Setup
            </CardTitle>
            <span className={`text-2xl font-bold ${scoreColor}`}>{result.score}%</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={result.score} className={`h-2 ${progressColor}`} />

          <div className="space-y-1.5">
            {result.fields.map((field) => (
              <div key={field.key} className="flex items-center gap-2 text-sm">
                {field.filled ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                )}
                <span className={field.filled ? 'text-muted-foreground line-through' : ''}>
                  {field.label}
                </span>
              </div>
            ))}
          </div>

          {result.nextAction && (
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1.5 text-xs px-3"
              onClick={handleAction}
            >
              <span className="truncate">{result.nextAction.hint}</span>
              <ArrowRight className="h-3 w-3 shrink-0" />
            </Button>
          )}
        </CardContent>
      </Card>

      <ProfileEditDialog open={profileEditOpen} onOpenChange={setProfileEditOpen} />
    </>
  )
}
