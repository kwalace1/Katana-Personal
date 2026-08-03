import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  computeProfileCompleteness,
  getOnboardingPrompts,
  dismissPrompt,
  type CompletenessResult,
  type SkippedFieldPrompt,
} from '@/lib/profile-completeness'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  X,
  AlertCircle,
  Info,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Pencil,
  Compass,
  PlayCircle,
} from 'lucide-react'
import { ProfileEditDialog } from './profile-edit-dialog'
import { MODULE_TOUR_LIST, type ModuleTourId } from '@/lib/tour-definitions'
import { useTour } from '@/components/tour/tour-provider'
import { countOnboardingModules, isOnboardingTourComplete } from '@/lib/onboarding-tour'
import { GraduationCap } from 'lucide-react'
import { useModuleAccess } from '@/contexts/ModuleAccessContext'

const DISMISSED_PROMPTS_KEY = 'katana_dismissed_prompts'

const PRIORITY_STYLE = {
  high: { icon: AlertCircle, bg: 'bg-orange-500/10 border-orange-500/30', iconColor: 'text-orange-500' },
  medium: { icon: Info, bg: 'bg-blue-500/10 border-blue-500/30', iconColor: 'text-blue-500' },
  low: { icon: AlertTriangle, bg: 'bg-muted/50 border-border', iconColor: 'text-muted-foreground' },
}

interface SetupGuideSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SetupGuideSheet({ open, onOpenChange }: SetupGuideSheetProps) {
  const { profile, organization, user } = useAuth()
  const navigate = useNavigate()
  const { startTour, getStatus, refreshStatuses, startOnboardingTour, isOnboardingTourActive } =
    useTour()
  const { allowedModules } = useModuleAccess()
  const trainingModuleCount = countOnboardingModules(allowedModules)
  const [result, setResult] = useState<CompletenessResult | null>(null)
  const [prompts, setPrompts] = useState<SkippedFieldPrompt[]>([])
  const [profileEditOpen, setProfileEditOpen] = useState(false)

  const load = async () => {
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
    setPrompts(getOnboardingPrompts(profile, orgSettings))
  }

  useEffect(() => {
    if (open) load()
  }, [open, profile, organization])

  const handleResetDismissed = () => {
    localStorage.removeItem(DISMISSED_PROMPTS_KEY)
    load()
  }

  const handleProfileEdit = () => {
    setProfileEditOpen(true)
  }

  const handleStartModuleTour = (moduleId: ModuleTourId, route: string) => {
    onOpenChange(false)
    const runTour = () => startTour(moduleId)
    if (window.location.pathname !== route) {
      navigate(route)
      window.setTimeout(runTour, 800)
    } else {
      runTour()
    }
  }

  const scoreColor =
    !result
      ? ''
      : result.score >= 80
        ? 'text-green-500'
        : result.score >= 50
          ? 'text-yellow-500'
          : 'text-orange-500'

  const progressColor =
    !result
      ? ''
      : result.score >= 80
        ? '[&>div]:bg-green-500'
        : result.score >= 50
          ? '[&>div]:bg-yellow-500'
          : '[&>div]:bg-orange-500'

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[380px] sm:w-[400px] overflow-y-auto p-0">
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                <motion.div
                  className="px-6 pt-6 pb-4"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.3 }}
                >
                  <SheetHeader className="space-y-1">
                    <SheetTitle className="flex items-center gap-2 text-lg">
                      <motion.div
                        initial={{ rotate: -30, scale: 0 }}
                        animate={{ rotate: 0, scale: 1 }}
                        transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 15 }}
                      >
                        <Sparkles className="h-5 w-5 text-primary" />
                      </motion.div>
                      Setup Guide
                    </SheetTitle>
                    <SheetDescription className="text-xs">
                      Complete these steps to get the most out of Katana.
                    </SheetDescription>
                  </SheetHeader>
                </motion.div>

                {/* Completeness Score */}
                {result && (
                  <>
                    <motion.div
                      className="px-6 pb-4"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.15, duration: 0.3 }}
                    >
                      <div className="rounded-xl border bg-card p-4 space-y-3">
                        <div className="flex items-end justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Profile</p>
                            <p className="text-sm font-medium mt-0.5">Completeness</p>
                          </div>
                          <motion.span
                            className={`text-3xl font-bold tabular-nums leading-none ${scoreColor}`}
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 12 }}
                          >
                            {result.score}%
                          </motion.span>
                        </div>
                        <Progress value={result.score} className={`h-1.5 ${progressColor}`} />
                      </div>
                    </motion.div>

                    {/* Checklist */}
                    <motion.div
                      className="px-6 pb-2"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.25, duration: 0.2 }}
                    >
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        Checklist
                      </p>
                    </motion.div>
                    <div className="px-4 pb-3">
                      {result.fields.map((field, index) => {
                        const isProfileField = field.route === '/settings/organization'
                        const clickable = !field.filled && isProfileField
                        return (
                          <motion.button
                            key={field.key}
                            onClick={clickable ? handleProfileEdit : undefined}
                            className={`flex items-center gap-3 w-full text-left rounded-lg px-3 py-2 transition-colors ${
                              clickable ? 'hover:bg-muted/60 cursor-pointer' : 'cursor-default'
                            }`}
                            disabled={field.filled && !isProfileField}
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.3 + index * 0.05, duration: 0.25 }}
                          >
                            {field.filled ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                            )}
                            <span
                              className={`flex-1 text-sm ${
                                field.filled ? 'text-muted-foreground line-through decoration-muted-foreground/50' : 'font-medium'
                              }`}
                            >
                              {field.label}
                            </span>
                            {clickable && (
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                            )}
                          </motion.button>
                        )
                      })}
                    </div>

                    <motion.div
                      className="px-6 pb-4"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5, duration: 0.25 }}
                    >
                      <Button
                        size="sm"
                        className="w-full gap-2"
                        onClick={handleProfileEdit}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit Profile
                      </Button>
                    </motion.div>

                    <Separator />
                  </>
                )}

                {/* Suggestions */}
                {prompts.length > 0 && (
                  <div className="px-6 py-4 space-y-3">
                    <motion.p
                      className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4, duration: 0.2 }}
                    >
                      Suggestions
                    </motion.p>
                    <div className="space-y-2">
                      {prompts.map((prompt, index) => {
                        const style = PRIORITY_STYLE[prompt.priority]
                        const Icon = style.icon
                        return (
                          <motion.div
                            key={prompt.id}
                            className={`relative rounded-lg border p-3 ${style.bg}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: 20, transition: { duration: 0.2 } }}
                            transition={{ delay: 0.45 + index * 0.08, duration: 0.3 }}
                          >
                            <button
                              onClick={() => {
                                dismissPrompt(prompt.dismissKey)
                                setPrompts((prev) => prev.filter((p) => p.id !== prompt.id))
                              }}
                              className="absolute top-2 right-2 text-muted-foreground/60 hover:text-foreground transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                            <div className="flex items-start gap-2.5 pr-5">
                              <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${style.iconColor}`} />
                              <div className="space-y-1">
                                <p className="text-sm leading-snug">{prompt.message}</p>
                                <button
                                  className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
                                  onClick={() => {
                                    if (prompt.id.startsWith('profile-')) {
                                      handleProfileEdit()
                                    } else {
                                      onOpenChange(false)
                                      navigate(prompt.route)
                                    }
                                  }}
                                >
                                  {prompt.action}
                                  <ArrowRight className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Module tutorials */}
                <div className="px-6 py-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Compass className="h-3.5 w-3.5" />
                    Module tutorials
                  </p>

                  <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <GraduationCap className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Full system training tour</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Walk through your Launchpad, Hub, and every module you can access (
                          {trainingModuleCount} modules). Required on first login; replay
                          anytime.
                        </p>
                      </div>
                      {isOnboardingTourComplete(user?.id) ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" aria-label="Training completed" />
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="w-full gap-1"
                      disabled={isOnboardingTourActive}
                      onClick={() => {
                        onOpenChange(false)
                        startOnboardingTour({ restart: true })
                      }}
                    >
                      <GraduationCap className="h-3.5 w-3.5" />
                      {isOnboardingTourComplete(user?.id) ? 'Replay training tour' : 'Start training tour'}
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Step-by-step tours for each module. Completed tours show a checkmark.
                  </p>
                  <div className="space-y-2">
                    {MODULE_TOUR_LIST.map((module) => {
                      const status = getStatus(module.id)
                      return (
                        <div
                          key={module.id}
                          className="flex items-center gap-2 rounded-lg border p-3 bg-card"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{module.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{module.description}</p>
                          </div>
                          {status === 'completed' ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" aria-label="Tour completed" />
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="shrink-0 gap-1"
                            onClick={() => handleStartModuleTour(module.id, module.route)}
                          >
                            <PlayCircle className="h-3.5 w-3.5" />
                            {status === 'completed' ? 'Replay' : 'Start'}
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Footer */}
                <motion.div
                  className="px-6 py-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6, duration: 0.3 }}
                >
                  <button
                    className="flex items-center justify-center gap-1.5 w-full text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors py-2"
                    onClick={() => {
                      handleResetDismissed()
                      refreshStatuses()
                    }}
                  >
                    <RotateCcw className="h-3 w-3" />
                    Restore dismissed suggestions
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </SheetContent>
      </Sheet>

      <ProfileEditDialog open={profileEditOpen} onOpenChange={setProfileEditOpen} />
    </>
  )
}
