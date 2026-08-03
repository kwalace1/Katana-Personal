import { formatDateOnly } from '@/lib/due-date-utils'
import { useState, useEffect } from 'react'
import { useEmployeePortal } from '@/contexts/EmployeePortalContext'
import { useAuth } from '@/contexts/AuthContext'
import { EmployeePortalNoAccess } from '@/components/employee/EmployeePortalNoAccess'
import { EmployeePortalPageContent } from '@/components/employee/EmployeePortalPageContent'
import { LoadingState } from '@/components/ui/loading-state'
import { EmployeeAvatar } from '@/components/ui/employee-avatar'
import { resolveEmployeePhotoUrl } from '@/lib/employee-portal-profile'
import * as hrApi from '@/lib/hr-api'
import { getTimezoneFromLocation } from '@/lib/location-timezone'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  MapPin,
  Calendar,
  Briefcase,
  Clock,
  Shield,
  Bell,
  Lock,
  Edit2,
  Save,
  X,
  Loader2,
} from "lucide-react"
import {
  ModuleCustomizeControls,
  ModuleCustomizeHint,
} from '@/components/module-layout/ModuleCustomizeBar'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import { WidgetCatalogDialog } from '@/components/module-layout/WidgetCatalogDialog'
import { useModuleWidgetLayout } from '@/hooks/useModuleWidgetLayout'
import {
  EMPLOYEE_MODULE_ID,
  getEmployeeSurfaceConfig,
} from '@/lib/employee/employee-widget-layout'

const PROFILE_NOTIFICATIONS_KEY = 'employeePortal_notifications'
const PROFILE_PRIVACY_KEY = 'employeePortal_privacy'

const defaultNotifications = [
  { id: "email", label: "Email Notifications", enabled: true },
  { id: "performance", label: "Performance Reviews", enabled: true },
  { id: "goals", label: "Goal Updates", enabled: true },
  { id: "training", label: "Training Reminders", enabled: true },
  { id: "announcements", label: "Company Announcements", enabled: true },
]

const defaultPrivacy = [
  { id: "profile", label: "Show profile in directory", enabled: true },
  { id: "phone", label: "Show phone number", enabled: true },
  { id: "email", label: "Show email address", enabled: true },
  { id: "location", label: "Show location", enabled: false },
]

function loadFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as T
  } catch {}
  return defaultValue
}

export default function EmployeeProfilePage() {
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [detectingTimezone, setDetectingTimezone] = useState(false)
  const { employee, loading, error, refresh } = useEmployeePortal()
  const { profile: userProfile } = useAuth()

  const surfaceConfig = getEmployeeSurfaceConfig('profile')
  const {
    layout,
    isCustomizeMode,
    enterCustomize,
    saveAndExit,
    onLayoutChange,
    addWidget,
    removeWidget,
    availableWidgets,
    resetToDefault,
  } = useModuleWidgetLayout({
    moduleId: EMPLOYEE_MODULE_ID,
    surfaceId: surfaceConfig.id,
    catalog: surfaceConfig.catalog,
    normalize: surfaceConfig.normalize,
    toBase: surfaceConfig.toBase,
    successMessage: `${surfaceConfig.label} layout saved`,
  })

  const nameParts = (employee?.name ?? "").trim().split(" ")
  const initialProfile = employee
    ? {
        firstName: nameParts[0] ?? "",
        lastName: nameParts.slice(1).join(" ") ?? "",
        email: employee.email ?? "",
        phone: employee.phone ?? "",
        location: (employee as hrApi.Employee & { location?: string }).location ?? "",
        timezone: (employee as hrApi.Employee & { timezone?: string }).timezone ?? "",
        employeeId: employee.id.slice(0, 8),
        department: employee.department,
        position: employee.position,
        manager: employee.manager?.name ?? "",
        startDate: employee.hire_date ? formatDateOnly(employee.hire_date) : "",
        employmentType: "Full-time",
        bio: (employee as hrApi.Employee & { bio?: string }).bio ?? "",
      }
    : null

  const [profile, setProfile] = useState(initialProfile)
  const [notificationSettings, setNotificationSettings] = useState<typeof defaultNotifications>(() =>
    loadFromStorage(PROFILE_NOTIFICATIONS_KEY, defaultNotifications)
  )
  const [privacySettings, setPrivacySettings] = useState<typeof defaultPrivacy>(() =>
    loadFromStorage(PROFILE_PRIVACY_KEY, defaultPrivacy)
  )

  useEffect(() => {
    if (!employee) return
    const np = (employee.name ?? "").trim().split(" ")
    setProfile({
      firstName: np[0] ?? "",
      lastName: np.slice(1).join(" ") ?? "",
      email: employee.email ?? "",
      phone: employee.phone ?? "",
      location: (employee as hrApi.Employee & { location?: string }).location ?? "",
      timezone: (employee as hrApi.Employee & { timezone?: string }).timezone ?? "",
      employeeId: employee.id.slice(0, 8),
      department: employee.department,
      position: employee.position,
      manager: employee.manager?.name ?? "",
      startDate: employee.hire_date ? formatDateOnly(employee.hire_date) : "",
      employmentType: "Full-time",
      bio: (employee as hrApi.Employee & { bio?: string }).bio ?? "",
    })
  }, [employee])

  const handleToggleNotification = (id: string) => {
    setNotificationSettings((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
      if (typeof window !== 'undefined') localStorage.setItem(PROFILE_NOTIFICATIONS_KEY, JSON.stringify(next))
      return next
    })
  }

  const handleTogglePrivacy = (id: string) => {
    setPrivacySettings((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
      if (typeof window !== 'undefined') localStorage.setItem(PROFILE_PRIVACY_KEY, JSON.stringify(next))
      return next
    })
  }

  const handleSave = async () => {
    if (!employee || !profile) return
    setSaving(true)
    try {
      const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() || employee.name
      const baseUpdates = {
        name,
        email: profile.email.trim() || employee.email,
        phone: profile.phone?.trim() ?? undefined,
      }
      const result = await hrApi.updateEmployee(employee.id, baseUpdates)
      if (!result) {
        toast.error("Failed to save profile. Please try again.")
        return
      }
      const loc = profile.location.trim()
      const tz = profile.timezone.trim()
      const bioVal = profile.bio.trim()
      let extOk = true
      if (loc || tz || bioVal) {
        const extResult = await hrApi.updateEmployee(employee.id, {
          ...baseUpdates,
          ...(loc && { location: loc }),
          ...(tz && { timezone: tz }),
          ...(bioVal && { bio: bioVal }),
        })
        extOk = !!extResult
      }
      await refresh()
      setIsEditing(false)
      if (extOk) {
        toast.success("Profile updated")
      } else {
        toast.success("Phone and name saved. For location, timezone, and bio, run the HR profile fields migration.")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save profile")
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (initialProfile) setProfile(initialProfile)
    setIsEditing(false)
  }

  const handleDetectTimezone = async () => {
    const loc = profile?.location?.trim()
    if (!loc) {
      toast.error("Enter a location first")
      return
    }
    setDetectingTimezone(true)
    try {
      const tz = await getTimezoneFromLocation(loc)
      if (tz) {
        setProfile((p) => (p ? { ...p, timezone: tz } : p))
        toast.success(`Timezone set to ${tz}`)
      } else {
        toast.error("Could not detect timezone for that location")
      }
    } catch {
      toast.error("Could not detect timezone")
    } finally {
      setDetectingTimezone(false)
    }
  }

  const handleLocationBlur = () => {
    if (profile?.location?.trim() && !profile?.timezone?.trim()) {
      handleDetectTimezone()
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8">
        <LoadingState message="Loading profile…" />
      </div>
    )
  }
  if (!employee) {
    return <EmployeePortalNoAccess error={error ?? undefined} />
  }

  if (!profile) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8 text-muted-foreground">
        Loading profile…
      </div>
    )
  }

  return (
    <EmployeePortalPageContent>
      <div className="mb-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">My Profile</h1>
            <p className="text-muted-foreground">Manage your personal information and settings</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)}>
                <Edit2 className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={handleCancel}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Saving…" : "Save Changes"}
                </Button>
              </>
            )}
            <ModuleCustomizeControls
              customizeMode={isCustomizeMode}
              onEnterCustomize={enterCustomize}
              onDone={() => void saveAndExit()}
              dataTourCustomize="launchpad-profile-customize"
            />
          </div>
        </div>
      </div>

      {isCustomizeMode ? (
        <div className="space-y-3 mb-4">
          <ModuleCustomizeHint surfaceLabel={surfaceConfig.label} />
          <div className="flex flex-wrap items-center gap-2">
            <WidgetCatalogDialog available={availableWidgets} onAdd={addWidget} />
            <Button type="button" variant="ghost" size="sm" onClick={resetToDefault}>
              Reset layout
            </Button>
          </div>
        </div>
      ) : null}

      <ModuleWidgetCanvas
        widgets={layout.widgets}
        catalog={surfaceConfig.catalog}
        customizeMode={isCustomizeMode}
        onLayoutChange={onLayoutChange}
        onRemoveWidget={removeWidget}
        renderWidget={(widgetId) => {
          if (widgetId === 'profile_summary') {
            return (
              <Card className="h-full overflow-hidden">
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center">
                    <div className="relative">
                      <EmployeeAvatar
                        name={employee.name ?? 'Employee'}
                        photoUrl={resolveEmployeePhotoUrl(employee, userProfile?.avatar_url)}
                        size="profile"
                        className="mb-4"
                      />
                    </div>
                    <h2 className="text-2xl font-bold mb-1">
                      {profile.firstName} {profile.lastName}
                    </h2>
                    <p className="text-muted-foreground mb-2">{profile.position}</p>
                    <Badge variant="outline" className="mb-4">{profile.employmentType}</Badge>

                    <div className="w-full space-y-3 mt-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Briefcase className="w-4 h-4" />
                        <span>{profile.department}</span>
                      </div>
                      {profile.location && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="w-4 h-4" />
                          <span>{profile.location}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>Joined {profile.startDate}</span>
                      </div>
                      {profile.timezone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          <span>{profile.timezone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'personal_info') {
            return (
              <Card className="h-full overflow-hidden">
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>Update your personal details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={profile.firstName}
                        disabled={!isEditing}
                        onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={profile.lastName}
                        disabled={!isEditing}
                        onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profile.email}
                      disabled={!isEditing}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={profile.phone}
                      disabled={!isEditing}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="location">Location</Label>
                      <Input
                        id="location"
                        value={profile.location}
                        disabled={!isEditing}
                        onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                        onBlur={isEditing ? handleLocationBlur : undefined}
                        placeholder="e.g. Philadelphia, Pennsylvania"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timezone">Timezone</Label>
                      <div className="flex gap-2">
                        <Input
                          id="timezone"
                          value={profile.timezone}
                          disabled={!isEditing}
                          onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                          placeholder="Auto-detect from location"
                        />
                        {isEditing && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={handleDetectTimezone}
                            disabled={detectingTimezone || !profile.location?.trim()}
                            title="Auto-detect timezone from location"
                          >
                            {detectingTimezone ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MapPin className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Timezone is auto-detected when you blur the location field, or click the icon.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <textarea
                      id="bio"
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={profile.bio}
                      disabled={!isEditing}
                      onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    />
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'employment_details') {
            return (
              <Card className="h-full overflow-hidden">
                <CardHeader>
                  <CardTitle>Employment Details</CardTitle>
                  <CardDescription>Your work-related information (read-only)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Employee ID</Label>
                      <Input value={profile.employeeId} disabled />
                    </div>
                    <div className="space-y-2">
                      <Label>Employment Type</Label>
                      <Input value={profile.employmentType} disabled />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Position</Label>
                    <Input value={profile.position} disabled />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Department</Label>
                      <Input value={profile.department} disabled />
                    </div>
                    <div className="space-y-2">
                      <Label>Manager</Label>
                      <Input value={profile.manager} disabled />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input value={profile.startDate} disabled />
                  </div>

                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      To update employment information, please contact HR at <a href="mailto:hr@company.com" className="text-primary hover:underline">hr@company.com</a>
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'notification_prefs') {
            return (
              <Card className="h-full overflow-hidden">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Notification Preferences
                  </CardTitle>
                  <CardDescription>Choose what notifications you want to receive</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {notificationSettings.map((setting) => (
                    <div key={setting.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{setting.label}</p>
                      </div>
                      <Button
                        variant={setting.enabled ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleToggleNotification(setting.id)}
                      >
                        {setting.enabled ? "Enabled" : "Disabled"}
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'privacy_settings') {
            return (
              <Card className="h-full overflow-hidden">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Privacy Settings
                  </CardTitle>
                  <CardDescription>Control what information is visible to others</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {privacySettings.map((setting) => (
                    <div key={setting.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{setting.label}</p>
                      </div>
                      <Button
                        variant={setting.enabled ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleTogglePrivacy(setting.id)}
                      >
                        {setting.enabled ? "Visible" : "Hidden"}
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'account_security') {
            return (
              <Card className="h-full overflow-hidden">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="w-5 h-5" />
                    Account Security
                  </CardTitle>
                  <CardDescription>Your account is secured through your organization&apos;s authentication. Sign out using the menu in the header to end your session.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Password changes, two-factor authentication, and session management are handled by your organization&apos;s identity provider. Contact your IT administrator if you need to update your security settings.
                  </p>
                </CardContent>
              </Card>
            )
          }

          return null
        }}
      />
    </EmployeePortalPageContent>
  )
}
