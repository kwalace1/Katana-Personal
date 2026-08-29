import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Bell,
  ChevronRight,
  Cloud,
  Database,
  Link2,
  Palette,
  Shield,
  Smartphone,
  Sparkles,
  User,
  Wrench,
  Zap,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { usePlusStatus } from '@/components/PlusPaywall'
import { useAuth } from '@/contexts/AuthContext'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { readIntegrationStatus } from '@/lib/integrations/status'
import { pageEnterSubtle } from '@/lib/motion-ui'
import { parseAskPersonality, ASK_PERSONALITIES } from '@/modules/assistant/personality'
import { SettingsGroup, SettingsRow } from '../components/settings-ui'
import { useLocalRefresh } from '@/hooks/useLocalRefresh'

export function SettingsHub() {
  const { user, profile } = useAuth()
  const { cloudEnabled, cloudUser, cloudProfile } = useCloudAuth()
  const plus = usePlusStatus()
  const { tick } = useLocalRefresh()
  void tick

  const integrations = user ? readIntegrationStatus(user.id) : null
  const askVoice = ASK_PERSONALITIES.find((p) => p.id === parseAskPersonality(profile?.preferences))?.label

  const connectionDetail = integrations
    ? integrations.calendarConnected && integrations.healthConnected
      ? 'Calendar & health connected'
      : integrations.calendarConnected
        ? 'Calendar connected'
        : integrations.healthConnected
          ? 'Health connected'
          : 'Google, Fitbit, Strava, .ics'
    : 'Calendars & health apps'

  return (
    <motion.div {...pageEnterSubtle} className="kp-page max-w-2xl">
      <PageHeader title="Settings" description="Your space, your rules." eyebrow="You" />

      <SettingsGroup>
        <Link
          to="/settings/profile"
          className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-secondary/40"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15 font-display text-lg text-primary">
            {(profile?.display_name || 'Y').charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{profile?.display_name || 'Your profile'}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {cloudUser ? 'Cloud · Friends · Circles' : 'Local-first on this device'}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground/70" />
        </Link>
      </SettingsGroup>

      <SettingsGroup title="General">
        <SettingsRow to="/settings/appearance" icon={Palette} label="Appearance" value="Accent & theme" />
        <SettingsRow to="/settings/notifications" icon={Bell} label="Notifications" value="Reminders & nudges" />
        <SettingsRow to="/settings/ask" icon={Sparkles} label="Ask coach voice" value={askVoice} />
      </SettingsGroup>

      <SettingsGroup title="Integrations">
        <SettingsRow
          to="/settings/connections"
          icon={Link2}
          label="Connections"
          detail={connectionDetail}
        />
      </SettingsGroup>

      <SettingsGroup title="Privacy">
        <SettingsRow to="/settings/privacy" icon={Shield} label="Privacy & data" value="What stays local" />
        <SettingsRow to="/settings/backup" icon={Database} label="Install & backup" value="Copy & restore" />
      </SettingsGroup>

      <SettingsGroup title="Accountability">
        <SettingsRow
          to="/settings/plus"
          icon={Zap}
          label="Katana Plus"
          value={plus ? 'Active' : 'Free'}
          detail={plus ? 'Deeper Ask · integrations · push' : 'Unlock the accountability pack'}
        />
      </SettingsGroup>

      {cloudEnabled ? (
        <SettingsGroup title="Together">
          <SettingsRow
            to="/settings/together"
            icon={Cloud}
            label={cloudUser ? 'Together account' : 'Sign in to Together'}
            value={cloudUser ? cloudProfile?.friendCode : undefined}
            detail={
              cloudUser
                ? cloudProfile?.displayName || 'Signed in'
                : 'Friends, Circles, and selective sharing'
            }
          />
          {cloudUser ? (
            <>
              <SettingsRow to="/settings/sync" icon={Cloud} label="Cloud sync" detail="Tasks, habits, calendar" />
              <SettingsRow to="/settings/sharing" icon={User} label="What friends can see" detail="Off by default" />
            </>
          ) : null}
        </SettingsGroup>
      ) : null}

      <SettingsGroup title="More">
        <SettingsRow to="/settings/advanced" icon={Wrench} label="Advanced" detail="Demo data & tips" />
        <SettingsRow
          to="/settings/backup"
          icon={Smartphone}
          label="Install on your phone"
          detail="Add to Home Screen"
        />
      </SettingsGroup>
    </motion.div>
  )
}
