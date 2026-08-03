"use client"

import { useState, useEffect } from "react"
import { MotionPage } from "@/components/motion-page"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/contexts/AuthContext"
import { OrgModulesIntegrationCard } from "@/components/settings/OrgModulesIntegrationCard"
import { getOrganizationUsers, updateUserRole, inviteUserToOrganization, updateOrganizationTrial, updateOrganizationSettings } from "@/lib/tenant-context"
import { Switch as SwitchToggle } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { EmployeeAvatar } from "@/components/ui/employee-avatar"
import { 
  Search, 
  Crown, 
  Shield, 
  User, 
  Eye, 
  MoreHorizontal, 
  UserCog,
  Building2,
  Mail,
  Calendar,
  UserPlus,
  Copy,
  Check
} from "lucide-react"

interface OrganizationUser {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: string
  department: string | null
  job_title: string | null
  is_active: boolean
  last_login_at: string | null
  created_at: string
}

export default function OrganizationSettingsPage() {
  const { user, profile, organization, hasRole, refreshProfile } = useAuth()
  const { toast } = useToast()
  const [users, setUsers] = useState<OrganizationUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedUser, setSelectedUser] = useState<OrganizationUser | null>(null)
  const [showChangeRoleDialog, setShowChangeRoleDialog] = useState(false)
  const [newRole, setNewRole] = useState<string>("")
  const [isUpdating, setIsUpdating] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<string>("member")
  const [inviteLinkResult, setInviteLinkResult] = useState<{ inviteLink: string; email: string } | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [trialDurationDays, setTrialDurationDays] = useState<string>("60")
  const [trialSaving, setTrialSaving] = useState(false)
  const [switchDivertSaving, setSwitchDivertSaving] = useState(false)

  const switchImportDivertOn = organization?.settings?.switch_import_divert === true

  const handleToggleSwitchDivert = async (checked: boolean) => {
    if (!organization?.id) return
    setSwitchDivertSaving(true)
    try {
      const nextSettings = {
        ...(organization.settings ?? {}),
        switch_import_divert: checked,
      }
      await updateOrganizationSettings(organization.id, nextSettings)
      await refreshProfile()
      toast({
        title: checked ? "Switch Import divert enabled" : "Switch Import divert disabled",
        description: checked
          ? "Import dialogs will show Send to Switch. Native Import remains available."
          : "Import dialogs use native Import only.",
      })
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Could not update setting",
        variant: "destructive",
      })
    } finally {
      setSwitchDivertSaving(false)
    }
  }

  useEffect(() => {
    if (organization?.id) {
      loadUsers()
    }
  }, [organization?.id])

  useEffect(() => {
    const d = (organization as { trial_duration_days?: number } | null)?.trial_duration_days
    if (typeof d === "number" && !Number.isNaN(d)) setTrialDurationDays(String(d))
  }, [organization])

  const loadUsers = async () => {
    if (!organization?.id) return
    
    setLoading(true)
    try {
      const orgUsers = await getOrganizationUsers(organization.id)
      setUsers(orgUsers as OrganizationUser[])
    } catch (error) {
      console.error('Error loading users:', error)
      toast({
        title: "Error",
        description: "Failed to load organization users",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleChangeRole = async () => {
    if (!selectedUser || !newRole) return

    setIsUpdating(true)
    try {
      await updateUserRole(selectedUser.id, newRole)
      
      toast({
        title: "Role updated",
        description: `${selectedUser.full_name || selectedUser.email} is now a ${newRole}`,
      })

      // Refresh users list
      await loadUsers()
      setShowChangeRoleDialog(false)
      setSelectedUser(null)
    } catch (error: any) {
      console.error('Error updating role:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to update user role",
        variant: "destructive",
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const openChangeRoleDialog = (user: OrganizationUser) => {
    setSelectedUser(user)
    setNewRole(user.role)
    setShowChangeRoleDialog(true)
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-4 h-4" />
      case 'admin':
        return <Shield className="w-4 h-4" />
      case 'member':
        return <User className="w-4 h-4" />
      case 'viewer':
        return <Eye className="w-4 h-4" />
      default:
        return <User className="w-4 h-4" />
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
      case 'admin':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
      case 'member':
        return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
      case 'viewer':
        return 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20'
      default:
        return 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20'
    }
  }

  const canManageUsers = hasRole(['owner', 'admin'])

  const handleCreateInvite = async () => {
    if (!inviteEmail?.trim()) {
      toast({ title: "Enter an email", variant: "destructive" })
      return
    }
    setInviteLoading(true)
    setInviteLinkResult(null)
    try {
      const result = await inviteUserToOrganization(inviteEmail.trim(), inviteRole)
      setInviteLinkResult({ inviteLink: result.inviteLink, email: result.email })
      toast({ title: "Invite created", description: "Copy the link and send it to the recipient. They can create a Katana account with this email (no Microsoft required)." })
    } catch (err: any) {
      toast({ title: "Invite failed", description: err?.message ?? "Try again.", variant: "destructive" })
    } finally {
      setInviteLoading(false)
    }
  }

  const copyInviteLink = () => {
    if (!inviteLinkResult?.inviteLink) return
    navigator.clipboard.writeText(inviteLinkResult.inviteLink)
    setCopied(true)
    toast({ title: "Link copied" })
    setTimeout(() => setCopied(false), 2000)
  }

  const filteredUsers = users.filter((u) => {
    const searchLower = searchQuery.toLowerCase()
    return (
      u.email.toLowerCase().includes(searchLower) ||
      u.full_name?.toLowerCase().includes(searchLower) ||
      u.role.toLowerCase().includes(searchLower) ||
      u.department?.toLowerCase().includes(searchLower)
    )
  })

  // Count users by role
  const roleStats = users.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  if (!organization) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto">
          <Card className="p-6">
            <p className="text-muted-foreground">Loading organization...</p>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <MotionPage subtle className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Building2 className="w-8 h-8 text-primary" />
            Organization Settings
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage users and roles for {organization.name}
          </p>
        </div>

        {/* Organization Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Crown className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Owners</p>
                <p className="text-2xl font-bold text-foreground">{roleStats.owner || 0}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Admins</p>
                <p className="text-2xl font-bold text-foreground">{roleStats.admin || 0}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <User className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Members</p>
                <p className="text-2xl font-bold text-foreground">{roleStats.member || 0}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-500/10">
                <Eye className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Viewers</p>
                <p className="text-2xl font-bold text-foreground">{roleStats.viewer || 0}</p>
              </div>
            </div>
          </Card>
        </div>

        <OrgModulesIntegrationCard />

        {hasRole(["owner", "admin"]) && (
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-2">Switch Import divert</h2>
                <p className="text-sm text-muted-foreground max-w-xl">
                  When enabled, module Import dialogs show <strong>Send to Switch</strong> (create import + open link).
                  Native Import stays available.                   Requires server env{' '}
                  <code className="text-xs">SWITCH_API_BASE_URL</code>,{' '}
                  <code className="text-xs">SWITCH_HANDOFF_CLIENT_ID</code>,{' '}
                  <code className="text-xs">SWITCH_HANDOFF_CLIENT_SECRET</code>, and{' '}
                  <code className="text-xs">SWITCH_HANDOFF_ORGANIZATION_ID</code>{' '}
                  (same values as Switch).
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="switch-import-divert">Enable divert</Label>
                <SwitchToggle
                  id="switch-import-divert"
                  checked={switchImportDivertOn}
                  disabled={switchDivertSaving}
                  onCheckedChange={(checked) => void handleToggleSwitchDivert(checked)}
                />
              </div>
            </div>
          </Card>
        )}

        {hasRole(["owner", "admin"]) && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-2">Trial window</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Default trial length for reporting (requires <code className="text-xs">trial_duration_days</code> column).
              Set subscription status to <strong>trial</strong> in the database to use banners.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1">
                <Label htmlFor="trial-days">Trial duration (days)</Label>
                <Input
                  id="trial-days"
                  type="number"
                  min={1}
                  className="w-32"
                  value={trialDurationDays}
                  onChange={(e) => setTrialDurationDays(e.target.value)}
                />
              </div>
              <Button
                disabled={trialSaving}
                onClick={async () => {
                  if (!organization?.id) return
                  const n = parseInt(trialDurationDays, 10)
                  if (Number.isNaN(n) || n < 1) {
                    toast({ title: "Invalid", description: "Enter a positive number of days.", variant: "destructive" })
                    return
                  }
                  setTrialSaving(true)
                  try {
                    await updateOrganizationTrial(organization.id, { trial_duration_days: n })
                    toast({ title: "Saved", description: "Trial duration updated." })
                  } catch (e) {
                    toast({
                      title: "Error",
                      description: e instanceof Error ? e.message : "Could not save",
                      variant: "destructive",
                    })
                  } finally {
                    setTrialSaving(false)
                  }
                }}
              >
                Save trial settings
              </Button>
            </div>
            {(organization as { trial_end_at?: string | null }).trial_end_at && (
              <p className="text-xs text-muted-foreground mt-3">
                Trial ends: {new Date((organization as { trial_end_at: string }).trial_end_at).toLocaleString()}
              </p>
            )}
          </Card>
        )}

        {/* Role Descriptions */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Role Permissions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <Crown className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-1" />
              <div>
                <p className="font-medium text-foreground">Owner</p>
                <p className="text-sm text-muted-foreground">Full access to all features, can manage billing, delete organization</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-1" />
              <div>
                <p className="font-medium text-foreground">Admin</p>
                <p className="text-sm text-muted-foreground">Can manage users, projects, and organization settings</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-green-600 dark:text-green-400 mt-1" />
              <div>
                <p className="font-medium text-foreground">Member</p>
                <p className="text-sm text-muted-foreground">Can create and manage projects, view all organization data</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Eye className="w-5 h-5 text-gray-600 dark:text-gray-400 mt-1" />
              <div>
                <p className="font-medium text-foreground">Viewer</p>
                <p className="text-sm text-muted-foreground">Read-only access to projects and organization data</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Invite by email (Katana account, no Microsoft) */}
        {canManageUsers && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Invite by email
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Send a link so they can create a Katana account with email and password (no Microsoft login). Then add them as an employee in HR to set permissions.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px] space-y-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="w-[140px] space-y-2">
                <Label htmlFor="invite-role">Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger id="invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreateInvite} disabled={inviteLoading}>
                {inviteLoading ? "Creating…" : "Create invite link"}
              </Button>
            </div>
            {inviteLinkResult && (
              <div className="mt-4 p-3 rounded-lg bg-muted/50 flex flex-wrap items-center gap-2">
                <Input
                  readOnly
                  value={inviteLinkResult.inviteLink}
                  className="flex-1 min-w-0 font-mono text-xs"
                />
                <Button variant="outline" size="sm" onClick={copyInviteLink}>
                  {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                  {copied ? "Copied" : "Copy link"}
                </Button>
                <p className="w-full text-xs text-muted-foreground mt-1">
                  Send this link to {inviteLinkResult.email}. They open it, set a password, and join {organization.name}.
                </p>
              </div>
            )}
          </Card>
        )}

        {/* Search */}
        <Card className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search users by name, email, role, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </Card>

        {/* Users List */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              Team Members ({filteredUsers.length})
            </h2>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading users...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No users found
            </div>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((orgUser) => (
                <div
                  key={orgUser.id}
                  className="flex items-center justify-between p-4 rounded-lg hover:bg-muted/50 transition-colors border border-border/40"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <EmployeeAvatar
                      name={orgUser.full_name || orgUser.email}
                      photoUrl={orgUser.avatar_url || undefined}
                      size="md"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">
                          {orgUser.full_name || orgUser.email.split('@')[0]}
                        </p>
                        {orgUser.id === user?.id && (
                          <Badge variant="outline" className="text-xs">You</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {orgUser.email}
                        </span>
                        {orgUser.job_title && (
                          <span>{orgUser.job_title}</span>
                        )}
                        {orgUser.department && (
                          <span>• {orgUser.department}</span>
                        )}
                      </div>
                      {orgUser.last_login_at && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Calendar className="w-3 h-3" />
                          Last active: {new Date(orgUser.last_login_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge 
                      variant="outline" 
                      className={`${getRoleBadgeColor(orgUser.role)} flex items-center gap-1`}
                    >
                      {getRoleIcon(orgUser.role)}
                      {orgUser.role.charAt(0).toUpperCase() + orgUser.role.slice(1)}
                    </Badge>

                    {canManageUsers && orgUser.id !== user?.id && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-background/95 backdrop-blur-md border-border">
                          <DropdownMenuLabel>Manage User</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openChangeRoleDialog(orgUser)}>
                            <UserCog className="w-4 h-4 mr-2" />
                            Change Role
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {!canManageUsers && (
          <Card className="p-4 border-yellow-500/20 bg-yellow-500/5">
            <p className="text-sm text-muted-foreground">
              ℹ️ Only owners and admins can change user roles. Contact an owner if you need to manage user permissions.
            </p>
          </Card>
        )}
      </div>

      {/* Change Role Dialog */}
      <Dialog open={showChangeRoleDialog} onOpenChange={setShowChangeRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Update the role for {selectedUser?.full_name || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Current Role</Label>
              <Badge 
                variant="outline" 
                className={`${getRoleBadgeColor(selectedUser?.role || '')} flex items-center gap-1 w-fit`}
              >
                {getRoleIcon(selectedUser?.role || '')}
                {selectedUser?.role ? selectedUser.role.charAt(0).toUpperCase() + selectedUser.role.slice(1) : ''}
              </Badge>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-role">New Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger id="new-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">
                    <div className="flex items-center gap-2">
                      <Crown className="w-4 h-4 text-purple-600" />
                      Owner
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-600" />
                      Admin
                    </div>
                  </SelectItem>
                  <SelectItem value="member">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-green-600" />
                      Member
                    </div>
                  </SelectItem>
                  <SelectItem value="viewer">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-gray-600" />
                      Viewer
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowChangeRoleDialog(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleChangeRole} 
              disabled={isUpdating || newRole === selectedUser?.role}
            >
              {isUpdating ? "Updating..." : "Update Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MotionPage>
  )
}

