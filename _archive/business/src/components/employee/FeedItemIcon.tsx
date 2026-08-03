import {
  Target,
  BookOpen,
  FolderKanban,
  Bell,
  Award,
  Star,
  Users,
  MessageSquare,
  ClipboardList,
} from 'lucide-react'
import type { EmployeeFeedIconKind } from '@/lib/employee-portal-feed'

export function FeedItemIcon({ kind, size = 'md' }: { kind: EmployeeFeedIconKind; size?: 'sm' | 'md' }) {
  const iconClass = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'
  const wrapClass = size === 'sm' ? 'w-9 h-9' : 'w-10 h-10'

  switch (kind) {
    case 'goal':
      return (
        <div className={`${wrapClass} rounded-full bg-green-500/20 flex items-center justify-center text-green-600`}>
          <Target className={iconClass} />
        </div>
      )
    case 'training':
      return (
        <div className={`${wrapClass} rounded-full bg-blue-500/20 flex items-center justify-center text-blue-600`}>
          <BookOpen className={iconClass} />
        </div>
      )
    case 'project':
      return (
        <div className={`${wrapClass} rounded-full bg-blue-500/20 flex items-center justify-center text-blue-600`}>
          <FolderKanban className={iconClass} />
        </div>
      )
    case 'bell':
      return (
        <div className={`${wrapClass} rounded-full bg-primary/20 flex items-center justify-center text-primary`}>
          <Bell className={iconClass} />
        </div>
      )
    case 'award':
      return (
        <div className={`${wrapClass} rounded-full bg-background flex items-center justify-center border text-yellow-500`}>
          <Award className={iconClass} />
        </div>
      )
    case 'recognition':
      return (
        <div className={`${wrapClass} rounded-full bg-pink-500/20 flex items-center justify-center text-pink-600`}>
          <Star className={iconClass} />
        </div>
      )
    case 'users':
      return (
        <div className={`${wrapClass} rounded-full bg-muted flex items-center justify-center text-muted-foreground`}>
          <Users className={iconClass} />
        </div>
      )
    case 'message':
      return (
        <div className={`${wrapClass} rounded-full bg-sky-500/20 flex items-center justify-center text-sky-600`}>
          <MessageSquare className={iconClass} />
        </div>
      )
    case 'work':
      return (
        <div className={`${wrapClass} rounded-full bg-orange-500/20 flex items-center justify-center text-orange-600`}>
          <ClipboardList className={iconClass} />
        </div>
      )
    case 'star':
    case 'activity':
    default:
      return (
        <div className={`${wrapClass} rounded-full bg-muted flex items-center justify-center text-purple-500`}>
          <Star className={iconClass} />
        </div>
      )
  }
}
