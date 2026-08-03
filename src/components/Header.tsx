import { useState } from "react"
import { SimpleThemeToggle } from "./SimpleThemeToggle"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/contexts/AuthContext"
import { useModuleAccess } from "@/contexts/ModuleAccessContext"
import { LayoutGrid, LogOut, Settings, HardDrive, HelpCircle, UserCog, Sparkles, BarChart3 } from "lucide-react"
import { isOperatorOrgMember } from "@/lib/platform-support-access"
import { NotificationCenter } from "@/components/NotificationCenter"
import { EmployeePortalLaunchpadLink } from "@/components/employee/EmployeePortalLaunchpadLink"
import { useNavigate } from "react-router-dom"
import { SetupGuideSheet } from "@/components/onboarding/setup-guide-sheet"
import { ProfileEditDialog } from "@/components/onboarding/profile-edit-dialog"

export function Header() {
  const navigate = useNavigate()
  const { user, profile, organization, signOut, loading, hasRole } = useAuth()
  const { hasModuleAccess } = useModuleAccess()
  const canManageOrganization = hasRole(['owner', 'admin'])
  const canSeeUsage = isOperatorOrgMember({ profile, organization, userEmail: user?.email })
  const [setupGuideOpen, setSetupGuideOpen] = useState(false)
  const [profileEditOpen, setProfileEditOpen] = useState(false)

  const handleSignOut = async () => {
    try {
      await signOut()
      window.location.href = '/'
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  const getUserInitials = () => {
    if (profile?.full_name) {
      return profile.full_name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    return user?.email?.slice(0, 2).toUpperCase() || 'U'
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-end gap-3 px-6">
        {user && hasModuleAccess('/employee') && <EmployeePortalLaunchpadLink variant="header" />}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setSetupGuideOpen(true)}
          title="Setup Guide"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
        <SimpleThemeToggle />
        {user && <NotificationCenter variant="header" />}

        {/* Profile Icon */}
        {loading ? (
          <div className="w-8 h-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        ) : user ? (
          profile ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={profile.avatar_url || undefined} alt={profile.full_name || ''} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 bg-background/95 backdrop-blur-md border-border z-50" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{profile.full_name || 'User'}</p>
                    <p className="text-xs leading-none text-muted-foreground break-all">{profile.email}</p>
                    {organization && (
                      <p className="text-xs leading-none text-muted-foreground mt-1 break-all">
                        {organization.name}
                      </p>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer" onSelect={() => setProfileEditOpen(true)}>
                  <UserCog className="mr-2 h-4 w-4" />
                  <span>Edit Profile</span>
                </DropdownMenuItem>
                {hasModuleAccess('/employee') && (
                  <DropdownMenuItem className="cursor-pointer" onSelect={() => navigate('/employee')}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    <span>Go to Employee Portal</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="cursor-pointer" onSelect={() => navigate('/hub')}>
                  <LayoutGrid className="mr-2 h-4 w-4" />
                  <span>Go to Hub</span>
                </DropdownMenuItem>
                {canSeeUsage && (
                <DropdownMenuItem className="cursor-pointer" onSelect={() => navigate('/usage')}>
                  <BarChart3 className="mr-2 h-4 w-4" />
                  <span>AI Usage &amp; Credits</span>
                </DropdownMenuItem>
                )}
                {canManageOrganization && (
                <DropdownMenuItem className="cursor-pointer" onSelect={() => navigate('/settings/organization')}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Organization Settings</span>
                </DropdownMenuItem>
                )}
                <DropdownMenuItem className="cursor-pointer" onSelect={() => navigate('/settings/storage')}>
                  <HardDrive className="mr-2 h-4 w-4" />
                  <span>Storage Management</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            // User logged in but profile not loaded - show sign out option
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                      {user?.email?.slice(0, 2).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 bg-background/95 backdrop-blur-md border-border z-50" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">Loading profile...</p>
                    <p className="text-xs leading-none text-muted-foreground break-all">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        ) : null}
      </div>

      <SetupGuideSheet open={setupGuideOpen} onOpenChange={setSetupGuideOpen} />
      <ProfileEditDialog open={profileEditOpen} onOpenChange={setProfileEditOpen} />
    </header>
  )
}

