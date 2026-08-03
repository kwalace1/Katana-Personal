import { getTodayDateKey } from '@/lib/due-date-utils'
import { useState } from "react"
import emailjs from "@emailjs/browser"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Project } from "@/lib/project-data"
import { useToast } from "@/hooks/use-toast"
import {
  Share2,
  Link2,
  Mail,
  Copy,
  Check,
  Globe,
  Lock,
  Users,
  Eye,
  Edit,
  Trash2,
  Download,
  QrCode,
  Loader2,
} from "lucide-react"

const INVITATION_FROM_EMAIL = "katanatechnologysystems@gmail.com"

interface ShareViewProps {
  project: Project
}

interface SharedUser {
  id: string
  name: string
  email: string
  role: string
  permission: "view" | "edit" | "admin"
  addedDate: string
}

export function ShareView({ project }: ShareViewProps) {
  const { toast } = useToast()
  const [linkCopied, setLinkCopied] = useState(false)
  const [emailCopied, setEmailCopied] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [invitePermission, setInvitePermission] = useState<"view" | "edit" | "admin">("view")
  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([])
  const [sendingInvite, setSendingInvite] = useState(false)
  const [qrDialogOpen, setQrDialogOpen] = useState(false)

  const shareableLink = `https://katana.app/projects/${project.id}/share`

  const handleCopyProjectLink = () => {
    copyToClipboard(shareableLink, "link")
    toast({ title: "Link copied", description: "Project link copied to clipboard." })
  }

  const handleEmailSummary = () => {
    const subject = encodeURIComponent(`Project summary: ${project.name}`)
    const body = encodeURIComponent(
      `${project.name}\n\n` +
        `Progress: ${project.progress}%\n` +
        `Tasks: ${project.completedTasks} of ${project.totalTasks} completed\n\n` +
        `View project: ${shareableLink}`
    )
    window.location.href = `mailto:?subject=${subject}&body=${body}`
    toast({ title: "Email client opened", description: "Compose your email with the project summary." })
  }

  const handleExportPdf = () => {
    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      toast({ title: "Popup blocked", description: "Allow popups to export as PDF.", variant: "destructive" })
      return
    }
    const completed = project.tasks.filter((t) => t.status === "done").length
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head><title>${project.name} - Summary</title></head>
        <body style="font-family: system-ui, sans-serif; padding: 2rem; max-width: 600px; margin: 0 auto;">
          <h1>${project.name}</h1>
          <p><strong>Progress:</strong> ${project.progress}%</p>
          <p><strong>Tasks:</strong> ${completed} of ${project.tasks.length} completed</p>
          <p><strong>Link:</strong> ${shareableLink}</p>
          <p style="margin-top: 2rem; color: #666; font-size: 0.875rem;">Generated from Katana PM</p>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
    }, 250)
    toast({ title: "Print dialog opened", description: "Choose “Save as PDF” to export." })
  }

  const handleGenerateQrCode = () => {
    setQrDialogOpen(true)
  }

  const copyToClipboard = (text: string, type: "link" | "email") => {
    navigator.clipboard.writeText(text)
    if (type === "link") {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } else {
      setEmailCopied(true)
      setTimeout(() => setEmailCopied(false), 2000)
    }
  }

  const handleInvite = async () => {
    if (!inviteEmail?.trim()) return

    const serviceId =
      import.meta.env.VITE_EMAILJS_INVITE_SERVICE_ID || import.meta.env.VITE_EMAILJS_SERVICE_ID
    const templateId =
      import.meta.env.VITE_EMAILJS_INVITE_TEMPLATE_ID || import.meta.env.VITE_EMAILJS_TEMPLATE_ID
    const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

    setSendingInvite(true)
    try {
      if (serviceId && templateId && publicKey) {
        await emailjs.send(
          serviceId,
          templateId,
          {
            to_email: inviteEmail.trim(),
            from_email: INVITATION_FROM_EMAIL,
            from_name: "Katana Technology Systems",
            project_name: project.name,
            shareable_link: shareableLink,
            permission: invitePermission,
            subject: `You're invited to collaborate on "${project.name}"`,
            message: `You have been invited to collaborate on the project "${project.name}" with ${invitePermission} access.\n\nOpen this link to get started:\n${shareableLink}\n\nThis invitation was sent from ${INVITATION_FROM_EMAIL}.`,
          },
          publicKey
        )
      }
      const newUser: SharedUser = {
        id: Date.now().toString(),
        name: inviteEmail.split("@")[0],
        email: inviteEmail.trim(),
        role: "Invited",
        permission: invitePermission,
        addedDate: getTodayDateKey(),
      }
      setSharedUsers([...sharedUsers, newUser])
      setInviteEmail("")
      setInvitePermission("view")
      if (serviceId && templateId && publicKey) {
        toast({
          title: "Invitation sent",
          description: `An invitation was sent from ${INVITATION_FROM_EMAIL} to ${inviteEmail.trim()}.`,
        })
      } else {
        toast({
          title: "Invitee added",
          description: "EmailJS is not configured for invites. Add them to the list and configure EmailJS to send from " + INVITATION_FROM_EMAIL,
        })
      }
    } catch (err) {
      console.error("Error sending invite:", err)
      toast({
        title: "Failed to send invitation",
        description: "The invitee was not added. Check EmailJS config or try again.",
        variant: "destructive",
      })
    } finally {
      setSendingInvite(false)
    }
  }

  const handleRemoveUser = (userId: string) => {
    setSharedUsers(sharedUsers.filter(u => u.id !== userId))
  }

  const handleChangePermission = (userId: string, permission: "view" | "edit" | "admin") => {
    setSharedUsers(sharedUsers.map(u => 
      u.id === userId ? { ...u, permission } : u
    ))
  }

  const getPermissionIcon = (permission: string) => {
    switch (permission) {
      case "view":
        return <Eye className="w-3 h-3" />
      case "edit":
        return <Edit className="w-3 h-3" />
      case "admin":
        return <Users className="w-3 h-3" />
      default:
        return <Eye className="w-3 h-3" />
    }
  }

  const getPermissionColor = (permission: string) => {
    switch (permission) {
      case "view":
        return "border-blue-500 text-blue-600 bg-blue-500/10"
      case "edit":
        return "border-yellow-500 text-yellow-600 bg-yellow-500/10"
      case "admin":
        return "border-purple-500 text-purple-600 bg-purple-500/10"
      default:
        return "border-blue-500 text-blue-600 bg-blue-500/10"
    }
  }

  return (
    <div className="space-y-6">
      {/* Public sharing is not available yet — keep controls honest for pilot */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Project Visibility
          </CardTitle>
          <CardDescription>
            Public link sharing is not available yet
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg opacity-70">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <Label htmlFor="public-access" className="text-base font-semibold">
                  Public Access
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Anyone with the link can view this project
              </p>
              <p className="text-xs text-muted-foreground">
                Coming soon — invite team members below instead.
              </p>
            </div>
            <Switch
              id="public-access"
              checked={false}
              disabled
              aria-disabled
            />
          </div>
        </CardContent>
      </Card>

      {/* Invite Team Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Invite Team Members
          </CardTitle>
          <CardDescription>
            Share this project with specific people
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email Address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleInvite()}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-permission">Permission Level</Label>
              <Select
                value={invitePermission}
                onValueChange={(value: "view" | "edit" | "admin") => setInvitePermission(value)}
              >
                <SelectTrigger id="invite-permission">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      <div>
                        <p className="font-medium">View</p>
                        <p className="text-xs text-muted-foreground">Can view project details</p>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="edit">
                    <div className="flex items-center gap-2">
                      <Edit className="w-4 h-4" />
                      <div>
                        <p className="font-medium">Edit</p>
                        <p className="text-xs text-muted-foreground">Can edit tasks and content</p>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <div>
                        <p className="font-medium">Admin</p>
                        <p className="text-xs text-muted-foreground">Full access and management</p>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={() => handleInvite()} className="w-full" disabled={sendingInvite}>
              {sendingInvite ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Mail className="w-4 h-4 mr-2" />
              )}
              {sendingInvite ? "Sending…" : "Send Invitation"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* People with Access */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              People with Access
            </div>
            <Badge variant="secondary">{sharedUsers.length} members</Badge>
          </CardTitle>
          <CardDescription>
            Manage access and permissions for this project
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sharedUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium">No one has access yet</p>
              <p className="text-xs mt-1">Invite team members to collaborate on this project</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sharedUsers.map((user, index) => (
                <div key={user.id}>
                  {index > 0 && <Separator className="my-3" />}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-semibold">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                        <p className="text-xs text-muted-foreground">Added {user.addedDate}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={user.permission}
                        onValueChange={(value: "view" | "edit" | "admin") =>
                          handleChangePermission(user.id, value)
                        }
                      >
                        <SelectTrigger className="w-32">
                          <div className="flex items-center gap-2">
                            {getPermissionIcon(user.permission)}
                            <SelectValue />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="view">View</SelectItem>
                          <SelectItem value="edit">Edit</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveUser(user.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Quick Actions
          </CardTitle>
          <CardDescription>
            Common sharing and export options
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <Button variant="outline" className="justify-start" onClick={handleCopyProjectLink}>
              <Copy className="w-4 h-4 mr-2" />
              Copy Project Link
            </Button>
            <Button variant="outline" className="justify-start" onClick={handleEmailSummary}>
              <Mail className="w-4 h-4 mr-2" />
              Email Summary
            </Button>
            <Button variant="outline" className="justify-start" onClick={handleExportPdf}>
              <Download className="w-4 h-4 mr-2" />
              Export as PDF
            </Button>
            <Button variant="outline" className="justify-start" onClick={handleGenerateQrCode}>
              <QrCode className="w-4 h-4 mr-2" />
              Generate QR Code
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code</DialogTitle>
            <DialogDescription>
              Scan to open the project share link
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareableLink)}`}
              alt="QR code for project link"
              className="rounded-lg border"
            />
            <p className="text-xs text-muted-foreground text-center break-all">{shareableLink}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                copyToClipboard(shareableLink, "link")
                toast({ title: "Link copied", description: "Project link copied to clipboard." })
              }}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy link
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Statistics – one rectangular bar */}
      <Card className="overflow-hidden border-border bg-card/50">
        <div className="stat-bar">
          <div className="stat-bar-item">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Eye className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="stat-bar-label">Total Views</p>
              <p className="text-2xl font-bold tabular-nums">0</p>
              <p className="text-xs text-muted-foreground">No views yet</p>
            </div>
          </div>
          <div className="stat-bar-item">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="stat-bar-label">Active Viewers</p>
              <p className="text-2xl font-bold tabular-nums">{sharedUsers.length}</p>
              <p className="text-xs text-muted-foreground">Team members with access</p>
            </div>
          </div>
          <div className="stat-bar-item">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Link2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="stat-bar-label">Shared Links</p>
              <p className="text-2xl font-bold tabular-nums">0</p>
              <p className="text-xs text-muted-foreground">Times link was copied</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

