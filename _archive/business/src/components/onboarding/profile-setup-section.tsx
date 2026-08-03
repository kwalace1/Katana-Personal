import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  computeProfileCompleteness,
  getOnboardingPrompts,
  type CompletenessField,
  type CompletenessResult,
  type SkippedFieldPrompt,
} from '@/lib/profile-completeness'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Check, UserCircle } from 'lucide-react'
import { ProfileEditDialog } from './profile-edit-dialog'

const PROFILE_FIELD_KEYS = new Set(['full_name', 'avatar_url', 'department', 'job_title'])

async function loadOrgSettingsForCompleteness(
  organizationId: string | undefined,
): Promise<Record<string, unknown> | null> {
  if (!organizationId) return null
  const { data } = await supabase
    .from('organizations')
    .select('settings, name')
    .eq('id', organizationId)
    .single()
  if (data?.name && data.name !== 'My Organization') {
    const settings = (data.settings as Record<string, unknown>) ?? {}
    return { ...settings, _hasName: true }
  }
  return null
}

function getScoreStyles(score: number) {
  if (score >= 80) {
    return { text: 'text-green-600', progress: '[&>div]:bg-green-500' }
  }
  if (score >= 50) {
    return { text: 'text-yellow-600', progress: '[&>div]:bg-yellow-500' }
  }
  return { text: 'text-orange-600', progress: '[&>div]:bg-orange-500' }
}

interface SetupStepProps {
  field: CompletenessField
  status: 'complete' | 'current' | 'upcoming'
  connectorComplete: boolean
  isLast: boolean
  onSelect: (field: CompletenessField) => void
}

function SetupStep({ field, status, connectorComplete, isLast, onSelect }: SetupStepProps) {
  const clickable = !field.filled

  return (
    <div className="flex items-start flex-1 min-w-[4.5rem] max-w-[7rem]">
      <div className="flex flex-col items-center flex-1 gap-2">
        <button
          type="button"
          disabled={!clickable}
          onClick={() => clickable && onSelect(field)}
          className={cn(
            'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
            status === 'complete' &&
              'border-green-500 bg-green-500/10 text-green-600',
            status === 'current' &&
              'border-primary bg-primary/10 text-primary ring-2 ring-primary/25',
            status === 'upcoming' &&
              'border-muted-foreground/30 bg-muted/30 text-muted-foreground',
            clickable && 'cursor-pointer hover:border-primary/60 hover:bg-primary/5',
            !clickable && 'cursor-default',
          )}
          aria-label={`${field.label}${field.filled ? ' — completed' : ' — incomplete'}`}
        >
          {status === 'complete' ? (
            <Check className="h-5 w-5" strokeWidth={2.5} />
          ) : (
            <span className="h-2.5 w-2.5 rounded-full bg-current opacity-60" />
          )}
        </button>
        <span
          className={cn(
            'text-center text-[11px] leading-tight px-0.5',
            status === 'complete' && 'text-muted-foreground line-through',
            status === 'current' && 'font-medium text-foreground',
            status === 'upcoming' && 'text-muted-foreground',
          )}
        >
          {field.label}
        </span>
      </div>
      {!isLast && (
        <div
          className={cn(
            'mt-5 h-0.5 flex-1 min-w-[0.75rem] rounded-full transition-colors',
            connectorComplete ? 'bg-green-500/70' : 'bg-border',
          )}
          aria-hidden
        />
      )}
    </div>
  )
}

export function ProfileSetupSection() {
  const { profile, organization } = useAuth()
  const navigate = useNavigate()
  const [result, setResult] = useState<CompletenessResult | null>(null)
  const [prompts, setPrompts] = useState<SkippedFieldPrompt[]>([])
  const [profileEditOpen, setProfileEditOpen] = useState(false)

  const load = useCallback(async () => {
    const orgSettings = await loadOrgSettingsForCompleteness(organization?.id)
    setResult(computeProfileCompleteness(profile, orgSettings))
    setPrompts(getOnboardingPrompts(profile, orgSettings))
  }, [profile, organization?.id])

  useEffect(() => {
    void load()
  }, [load])

  const handleFieldSelect = (field: CompletenessField) => {
    if (PROFILE_FIELD_KEYS.has(field.key) || field.route === '/settings/organization') {
      setProfileEditOpen(true)
    } else {
      navigate(field.route)
    }
  }

  if (!result) return null
  if (result.score === 100 && prompts.length === 0) return null

  const { text: scoreColor, progress: progressColor } = getScoreStyles(result.score)
  const firstIncompleteKey = result.missingFields[0]?.key ?? null

  return (
    <>
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-primary" />
              Profile Setup
            </CardTitle>
            <span className={cn('text-2xl font-bold tabular-nums shrink-0', scoreColor)}>
              {result.score}%
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Progress value={result.score} className={cn('h-2', progressColor)} />

          <div className="overflow-x-auto pb-1 -mx-1 px-1">
            <div className="flex w-full min-w-[32rem] justify-between">
              {result.fields.map((field, index) => {
                const status = field.filled
                  ? 'complete'
                  : field.key === firstIncompleteKey
                    ? 'current'
                    : 'upcoming'
                return (
                  <SetupStep
                    key={field.key}
                    field={field}
                    status={status}
                    connectorComplete={field.filled}
                    isLast={index === result.fields.length - 1}
                    onSelect={handleFieldSelect}
                  />
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <ProfileEditDialog
        open={profileEditOpen}
        onOpenChange={(open) => {
          setProfileEditOpen(open)
          if (!open) void load()
        }}
      />
    </>
  )
}
