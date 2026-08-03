import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  getOnboardingPrompts,
  dismissPrompt,
  type SkippedFieldPrompt,
} from '@/lib/profile-completeness'
import { AlertCircle, ArrowRight, X, Info, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProfileEditDialog } from './profile-edit-dialog'

const PRIORITY_CONFIG = {
  high: { icon: AlertCircle, color: 'border-orange-500/50 bg-orange-500/5', text: 'text-orange-600' },
  medium: { icon: Info, color: 'border-blue-500/50 bg-blue-500/5', text: 'text-blue-600' },
  low: { icon: AlertTriangle, color: 'border-muted bg-muted/30', text: 'text-muted-foreground' },
}

export function OnboardingPromptsBanner() {
  const { profile, organization } = useAuth()
  const navigate = useNavigate()
  const [prompts, setPrompts] = useState<SkippedFieldPrompt[]>([])
  const [profileEditOpen, setProfileEditOpen] = useState(false)

  useEffect(() => {
    async function load() {
      let orgSettings: Record<string, unknown> | null = null
      if (organization?.id) {
        const { data } = await supabase
          .from('organizations')
          .select('settings')
          .eq('id', organization.id)
          .single()
        orgSettings = (data?.settings as Record<string, unknown>) ?? null
      }
      setPrompts(getOnboardingPrompts(profile, orgSettings))
    }
    load()
  }, [profile, organization])

  if (prompts.length === 0) return null

  const topPrompts = prompts.slice(0, 3)

  const handleAction = (prompt: SkippedFieldPrompt) => {
    if (prompt.id.startsWith('profile-')) {
      setProfileEditOpen(true)
    } else {
      navigate(prompt.route)
    }
  }

  return (
    <>
      <div className="space-y-2">
        {topPrompts.map((prompt) => {
          const config = PRIORITY_CONFIG[prompt.priority]
          const Icon = config.icon
          return (
            <div
              key={prompt.id}
              className={`flex items-center gap-3 rounded-lg border p-3 ${config.color} animate-in fade-in slide-in-from-top-2 duration-300`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${config.text}`} />
              <span className="text-sm flex-1">{prompt.message}</span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => handleAction(prompt)}
              >
                {prompt.action}
                <ArrowRight className="h-3 w-3" />
              </Button>
              <button
                onClick={() => {
                  dismissPrompt(prompt.dismissKey)
                  setPrompts((prev) => prev.filter((p) => p.id !== prompt.id))
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </div>

      <ProfileEditDialog open={profileEditOpen} onOpenChange={setProfileEditOpen} />
    </>
  )
}
