import { getTodayDateKey, formatDateOnly } from '@/lib/due-date-utils'
import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { MotionPage } from '@/components/motion-page'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Users,
  TrendingUp,
  Search,
  Plus,
  Mail,
  Download,
  Brain,
  DollarSign,
  Award,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Circle,
  Edit,
  Trash2,
  Eye,
  Calendar,
  Phone,
  BarChart3,
  Target,
  Sparkles,
  Clock,
  LayoutDashboard,
  Kanban,
  Contact,
  CheckSquare,
  Flag,
  MessageSquare,
  ShoppingBag,
  Megaphone,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react"
import * as api from '@/lib/customer-success-api'
import { getHealthHistory } from '@/lib/customer-success-api'
import type { Client, ClientTask, ClientMilestone, ClientInteraction } from '@/lib/customer-success-api'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ModuleHelpButton } from '@/components/tour/module-help-button'
import { useModuleTour } from '@/components/tour/use-module-tour'
import { CrmPipelineTab } from '@/components/customers/CrmPipelineTab'
import { CrmContactsTab } from '@/components/customers/CrmContactsTab'
import { CrmLeadsTab } from '@/components/customers/CrmLeadsTab'
import { CrmCommerceTab } from '@/components/customers/CrmCommerceTab'
import { CrmCampaignsTab } from '@/components/customers/CrmCampaignsTab'
import { CrmIntegrationsPanel } from '@/components/customers/CrmIntegrationsPanel'
import { KycPortfolioSummaryBar } from '@/components/customers/KycPortfolioSummaryBar'
import { KycIcpProfileCard } from '@/components/customers/KycIcpProfileCard'
import { KycSignalBadges } from '@/components/customers/KycSignalBadges'
import { KycRiskChip } from '@/components/customers/KycRiskChip'
import { KycStatTile } from '@/components/customers/KycUi'
import { KycPortfolioTopActions } from '@/components/customers/KycPortfolioTopActions'
import { KycPortfolioPlaybooks } from '@/components/customers/KycPortfolioPlaybooks'
import { groupPortfolioPlaybooks } from '@/lib/kyc-api'
import { KYC_CLIENT_OUTREACH_LABELS } from '@/lib/kyc-client-scoring'
import { useKycPortfolioData } from '@/hooks/useKycPortfolioData'
import { CsAccountTypeBadge, customerContextLine } from '@/components/customers/CsModuleUi'
import { CsAnalyticsTab } from '@/components/customers/CsAnalyticsTab'
import { parseCustomerSuccessSearchParams, customerSuccessClientPath, type CustomerSuccessTab } from '@/lib/cs-deep-links'
import * as crmApi from '@/lib/customer-crm-api'
import type { CrmContact, CrmDeal, CrmLead, CrmCampaign, CrmQuote, CrmInvoice, CrmContract, PipelineStage, CrmStats } from '@/lib/customer-crm-api'
import { ModuleCustomizeControls, ModuleCustomizeHint } from '@/components/module-layout/ModuleCustomizeBar'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import { WidgetCatalogDialog } from '@/components/module-layout/WidgetCatalogDialog'
import { useModuleWidgetLayout } from '@/hooks/useModuleWidgetLayout'
import {
  CUSTOMERS_MODULE_ID,
  getCustomersTabSurfaceConfig,
} from '@/lib/customers/customers-widget-layout'
import { CustomerDetailCanvas } from '@/components/customers/CustomerDetailCanvas'

const CLIENTS_OUTREACH_CHIP_COLORS: Record<string, string> = {
  none: 'bg-muted text-muted-foreground',
  planned: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  contacted: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  meeting: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  completed: 'bg-green-500/10 text-green-600 dark:text-green-400',
  at_risk: 'bg-red-500/10 text-red-600 dark:text-red-400',
}

export default function CustomerSuccessPage() {
  useModuleTour('customer-success')
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState("dashboard")
  const [filterStatus, setFilterStatus] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  
  // Client management state
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [clientsSearchQuery, setClientsSearchQuery] = useState("")
  const [clientsFilterStatus, setClientsFilterStatus] = useState("all")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const surfaceConfig = getCustomersTabSurfaceConfig(activeTab)
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
    moduleId: CUSTOMERS_MODULE_ID,
    surfaceId: surfaceConfig.id,
    catalog: surfaceConfig.catalog,
    normalize: surfaceConfig.normalize,
    toBase: surfaceConfig.toBase,
    successMessage: `${surfaceConfig.label} layout saved`,
  })
  
  // Task management state
  const [selectedTask, setSelectedTask] = useState<ClientTask | null>(null)
  const [isAddTaskDialogOpen, setIsAddTaskDialogOpen] = useState(false)
  const [isEditTaskDialogOpen, setIsEditTaskDialogOpen] = useState(false)
  const [tasksSearchQuery, setTasksSearchQuery] = useState("")
  const [tasksFilterStatus, setTasksFilterStatus] = useState("all")
  
  // CSM user management state
  const [isAddCSMDialogOpen, setIsAddCSMDialogOpen] = useState(false)
  const [csmUsers, setCsmUsers] = useState<api.CSMUser[]>([])
  const [newCSMUser, setNewCSMUser] = useState({
    name: "",
    email: "",
    avatar: "",
  })
  
  // Add client form state
  const [newClient, setNewClient] = useState({
    name: "",
    accountType: "business" as "business" | "individual",
    email: "",
    phone: "",
    industry: "",
    arr: 0,
    renewalDate: "",
    npsScore: 7,
    engagementScore: 50,
    featureUsage: "Medium" as "Low" | "Medium" | "High",
    csmId: "",
  })
  
  // Edit client form state
  const [editClientData, setEditClientData] = useState({
    name: "",
    accountType: "business" as "business" | "individual",
    email: "",
    phone: "",
    industry: "",
    arr: "",
    renewalDate: "",
    healthScore: "",
    npsScore: "",
    engagementScore: "",
    featureUsage: "Medium" as "Low" | "Medium" | "High",
    csmId: "",
    portalLogins: "",
    supportTickets: "",
    lifecycleStage: "customer" as api.LifecycleStage,
  })

  // CRM data state
  const [crmDeals, setCrmDeals] = useState<CrmDeal[]>([])
  const [crmStages, setCrmStages] = useState<PipelineStage[]>([])
  const [crmContacts, setCrmContacts] = useState<CrmContact[]>([])
  const [crmLeads, setCrmLeads] = useState<CrmLead[]>([])
  const [crmCampaigns, setCrmCampaigns] = useState<CrmCampaign[]>([])
  const [crmQuotes, setCrmQuotes] = useState<CrmQuote[]>([])
  const [crmInvoices, setCrmInvoices] = useState<CrmInvoice[]>([])
  const [crmContracts, setCrmContracts] = useState<CrmContract[]>([])
  const [crmStats, setCrmStats] = useState<CrmStats>({
    openDeals: 0,
    pipelineValue: 0,
    newLeads: 0,
    activeCampaigns: 0,
    openQuotes: 0,
    unpaidInvoices: 0,
  })
  
  // Add task form state
  const [newTask, setNewTask] = useState({
    clientId: "",
    title: "",
    status: "active" as "active" | "completed" | "overdue",
    dueDate: "",
    priority: "medium" as "low" | "medium" | "high",
    assignedTo: "",
  })
  
  // Edit task form state
  const [editTaskData, setEditTaskData] = useState({
    clientId: "",
    title: "",
    status: "active" as "active" | "completed" | "overdue",
    dueDate: "",
    priority: "medium" as "low" | "medium" | "high",
    assignedTo: "",
  })

  // Milestone management state
  const [selectedMilestone, setSelectedMilestone] = useState<ClientMilestone | null>(null)
  const [isAddMilestoneDialogOpen, setIsAddMilestoneDialogOpen] = useState(false)
  const [isEditMilestoneDialogOpen, setIsEditMilestoneDialogOpen] = useState(false)
  const [milestonesSearchQuery, setMilestonesSearchQuery] = useState("")
  const [milestonesFilterStatus, setMilestonesFilterStatus] = useState<"all" | "completed" | "in-progress" | "upcoming">("all")

  // Add milestone form state
  const [newMilestone, setNewMilestone] = useState({
    clientId: "",
    title: "",
    description: "",
    status: "upcoming" as "completed" | "in-progress" | "upcoming",
    targetDate: "",
    completedDate: "",
  })

  // Edit milestone form state
  const [editMilestoneData, setEditMilestoneData] = useState({
    title: "",
    description: "",
    status: "upcoming" as "completed" | "in-progress" | "upcoming",
    targetDate: "",
    completedDate: "",
  })

  // Interaction management state
  const [selectedInteraction, setSelectedInteraction] = useState<ClientInteraction | null>(null)
  const [isAddInteractionDialogOpen, setIsAddInteractionDialogOpen] = useState(false)
  const [isEditInteractionDialogOpen, setIsEditInteractionDialogOpen] = useState(false)
  const [interactionsSearchQuery, setInteractionsSearchQuery] = useState("")
  const [interactionsFilterType, setInteractionsFilterType] = useState<"all" | "email" | "call" | "meeting" | "note">("all")

  // Add interaction form state
  const [newInteraction, setNewInteraction] = useState({
    clientId: "",
    type: "email" as "email" | "call" | "meeting" | "note",
    subject: "",
    description: "",
    csmId: "",
    interactionDate: getTodayDateKey(),
  })

  // Edit interaction form state
  const [editInteractionData, setEditInteractionData] = useState({
    type: "email" as "email" | "call" | "meeting" | "note",
    subject: "",
    description: "",
    csmId: "",
    interactionDate: "",
  })
  
  
  // Data state
  const [clients, setClients] = useState<Client[]>([])
  const { summary: kycSummary, accountRows, accountRowByClientId } = useKycPortfolioData(clients)
  const [tasks, setTasks] = useState<ClientTask[]>([])
  const [milestones, setMilestones] = useState<ClientMilestone[]>([])
  const [interactions, setInteractions] = useState<ClientInteraction[]>([])
  const [stats, setStats] = useState({
    totalClients: 0,
    atRiskCount: 0,
    avgHealthScore: 0,
    totalARR: 0,
    avgNPS: 0,
    highChurnRiskCount: 0,
    completedTasks: 0,
    totalTasks: 0,
    overdueTasks: 0,
  })
  
  // Loading / error state
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [healthTrends, setHealthTrends] = useState<Map<string, number[]>>(new Map())

  // Load all data
  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    const { tab, clientId } = parseCustomerSuccessSearchParams(searchParams.toString())
    if (tab) setActiveTab(tab)
    if (clientId && clients.length > 0) {
      const client = clients.find((c) => c.id === clientId)
      if (client) {
        setSelectedClient(client)
        setIsViewDialogOpen(true)
      }
    }
  }, [searchParams, clients])

  const syncClientUrl = (clientId: string | null, tab?: CustomerSuccessTab) => {
    const next = new URLSearchParams(searchParams)
    if (tab) next.set('tab', tab)
    else if (!next.get('tab')) next.set('tab', activeTab)
    if (clientId) next.set('client', clientId)
    else next.delete('client')
    setSearchParams(next, { replace: true })
  }

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    if (!next.get('client')) next.delete('client')
    setSearchParams(next, { replace: true })
  }

  const loadData = async () => {
    try {
      setIsLoading(true)
      setLoadError(null)

      const [
        clientsData,
        tasksData,
        milestonesData,
        interactionsData,
        statsData,
        csmUsersData,
      ] = await Promise.all([
        api.getAllClients(),
        api.getAllTasks(),
        api.getAllMilestones(),
        api.getAllInteractions(),
        api.getClientStats(),
        api.getAllCSMUsers(),
      ])

      setClients(clientsData)
      setTasks(tasksData)
      setMilestones(milestonesData)
      setInteractions(interactionsData)
      setStats(statsData)
      setCsmUsers(csmUsersData)
      void loadCrmData()
    } catch (error) {
      console.error('CustomerSuccessPage: Error loading data:', error)
      const message = error instanceof Error ? error.message : 'Failed to load customers data'
      setLoadError(message)
      toast.error('Failed to load customers', { description: message })
    } finally {
      setIsLoading(false)
    }
  }

  const loadCrmData = async () => {
    try {
      const [deals, stages, contacts, leads, campaigns, quotes, invoices, contracts, crmStatsData] =
        await Promise.all([
          crmApi.getAllDeals(),
          crmApi.getPipelineStages(),
          crmApi.getAllContacts(),
          crmApi.getAllLeads(),
          crmApi.getAllCampaigns(),
          crmApi.getAllQuotes(),
          crmApi.getAllInvoices(),
          crmApi.getAllContracts(),
          crmApi.getCrmStats(),
        ])
      setCrmDeals(deals)
      setCrmStages(stages)
      setCrmContacts(contacts)
      setCrmLeads(leads)
      setCrmCampaigns(campaigns)
      setCrmQuotes(quotes)
      setCrmInvoices(invoices)
      setCrmContracts(contracts)
      setCrmStats(crmStatsData)
      const { seedDefaultWorkflowsIfEmpty } = await import('@/lib/crm-workflows')
      void seedDefaultWorkflowsIfEmpty()
    } catch (error) {
      console.error('Error loading CRM data:', error)
      const message = error instanceof Error ? error.message : 'Failed to load CRM data'
      toast.error('Failed to load CRM data', { description: message })
    }
  }

  const refreshCrm = async () => {
    await loadCrmData()
  }

  const refreshClients = async () => {
    const [clientsData, tasksData, statsData] = await Promise.all([
      api.getAllClients(),
      api.getAllTasks(),
      api.getClientStats(),
    ])
    setClients(clientsData)
    setTasks(tasksData)
    setStats(statsData)
    setSelectedClient((prev) => {
      if (!prev) return prev
      return clientsData.find((c) => c.id === prev.id) ?? prev
    })
  }

  const leadCountByCampaign = useMemo(() => {
    const map: Record<string, number> = {}
    for (const lead of crmLeads) {
      if (lead.campaign_id) {
        map[lead.campaign_id] = (map[lead.campaign_id] ?? 0) + 1
      }
    }
    return map
  }, [crmLeads])

  useEffect(() => {
    let cancelled = false
    async function loadTrends() {
      const results = await Promise.all(
        clients.map(async (client) => {
          const history = await getHealthHistory(client.id, 5)
          return [client.id, history.map((h) => h.health_score)] as const
        })
      )
      if (cancelled) return
      setHealthTrends(new Map(results))
    }
    if (clients.length > 0) {
      void loadTrends()
    } else {
      setHealthTrends(new Map())
    }
    return () => {
      cancelled = true
    }
  }, [clients])

  const getHealthColor = (score: number) => {
    if (score >= 80) return "text-green-500"
    if (score >= 50) return "text-yellow-500"
    return "text-red-500"
  }

  const getHealthBadge = (status: string) => {
    if (status === "healthy")
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Healthy</Badge>
    if (status === "moderate")
      return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Moderate</Badge>
    return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">At Risk</Badge>
  }

  const getChurnRiskBadge = (risk: number) => {
    if (risk < 25)
      return (
        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
          <TrendingDown className="w-3 h-3 mr-1" />
          Low Risk
        </Badge>
      )
    if (risk < 60)
      return (
        <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
          <Activity className="w-3 h-3 mr-1" />
          Medium Risk
        </Badge>
      )
    return (
      <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
        <TrendingUp className="w-3 h-3 mr-1" />
        High Risk
      </Badge>
    )
  }

  const getTimeSince = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return "today"
    if (diffDays === 1) return "1 day"
    return `${diffDays} days`
  }

  const getClientTaskCounts = (clientId: string) => {
    const clientTasks = tasks.filter(t => t.client_id === clientId)
    const completed = clientTasks.filter(t => t.status === 'completed').length
    return { completed, total: clientTasks.length }
  }

  const getClientMilestoneCounts = (clientId: string) => {
    const clientMilestones = milestones.filter(m => m.client_id === clientId)
    const completed = clientMilestones.filter(m => m.status === 'completed').length
    return { completed, total: clientMilestones.length }
  }

  const getHealthTrend = (clientId: string) => {
    return healthTrends.get(clientId) || [0, 0, 0, 0, 0]
  }

  const renderCsStatsBarContent = () => (
    <div className="stat-bar">
      <div className="stat-bar-item">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Users className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="stat-bar-label">Total Customers</p>
          <p className="text-2xl font-bold tabular-nums">{stats.totalClients}</p>
        </div>
      </div>
      <div className="stat-bar-item">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Brain className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="stat-bar-label">Needs attention</p>
          <p className="text-2xl font-bold tabular-nums text-amber-600">{stats.atRiskCount}</p>
        </div>
      </div>
      <div className="stat-bar-item">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Activity className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="stat-bar-label">Avg engagement</p>
          <p className="text-2xl font-bold tabular-nums">{stats.avgHealthScore}%</p>
        </div>
      </div>
      <div className="stat-bar-item">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Target className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="stat-bar-label">Overdue tasks</p>
          <p className="text-2xl font-bold tabular-nums">{stats.overdueTasks}</p>
        </div>
      </div>
      <div className="stat-bar-item">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <DollarSign className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="stat-bar-label">Pipeline</p>
          <p className="text-2xl font-bold tabular-nums">${(crmStats.pipelineValue / 1000).toFixed(0)}K</p>
        </div>
      </div>
      <div className="stat-bar-item">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Sparkles className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="stat-bar-label">New leads</p>
          <p className="text-2xl font-bold tabular-nums">{crmStats.newLeads}</p>
        </div>
      </div>
    </div>
  )

  // Filtered clients for dashboard tab
  const dashboardFilteredClients = clients.filter((client) => {
    const statusMatch = filterStatus === "all" || client.status === filterStatus
    const searchMatch = searchQuery === "" || 
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.industry.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.csm?.name.toLowerCase().includes(searchQuery.toLowerCase())
    return statusMatch && searchMatch
  })

  const handleExportClients = () => {
    try {
      const headers = ['Customer ID', 'Name', 'Industry', 'Engagement Score', 'Status', 'Assigned to', 'Next Follow-up', 'Last Contact']
      const csvData = [
        headers.join(','),
        ...clients.map(client => [
          client.id,
          `"${client.name}"`,
          `"${client.industry}"`,
          client.health_score,
          client.status,
          `"${client.csm?.name || 'Unassigned'}"`,
          client.renewal_date,
          `"${getTimeSince(client.last_contact_date)} ago"`
        ].join(','))
      ].join('\n')

      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `clients_export_${getTodayDateKey()}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Error exporting clients:', error)
      toast.error('Failed to export client data. Please try again.')
    }
  }

  const handleViewClient = (client: Client) => {
    setSelectedClient(client)
    setIsViewDialogOpen(true)
    syncClientUrl(client.id, 'clients')
  }

  const handleViewClientById = async (clientId: string) => {
    const existing = clients.find((c) => c.id === clientId)
    if (existing) {
      handleViewClient(existing)
      return
    }
    const fetched = await api.getClientById(clientId)
    if (fetched) handleViewClient(fetched)
  }

  const handleEditClient = (client: Client) => {
    setSelectedClient(client)
    // Pre-populate the edit form with current client data
    setEditClientData({
      name: client.name,
      accountType: client.account_type ?? 'business',
      email: client.email ?? '',
      phone: client.phone ?? '',
      industry: client.industry,
      arr: client.arr.toString(),
      renewalDate: client.renewal_date,
      healthScore: client.health_score.toString(),
      npsScore: client.nps_score.toString(),
      engagementScore: client.engagement_score.toString(),
      featureUsage: client.feature_usage as "Medium" | "Low" | "High",
      csmId: client.csm_id || "",
      portalLogins: client.portal_logins.toString(),
      supportTickets: client.support_tickets.toString(),
      lifecycleStage: client.lifecycle_stage ?? 'customer',
    })
    setIsEditDialogOpen(true)
  }

  const handleDeleteClient = async (clientId: string) => {
    if (!confirm('Are you sure you want to delete this client? This action cannot be undone.')) {
      return
    }
    
    try {
      await api.deleteClient(clientId)
      // Reload all data to refresh stats
      await loadData()
      // Close any open dialogs
      setIsViewDialogOpen(false)
      setIsEditDialogOpen(false)
      setSelectedClient(null)
      toast.success('Customer deleted successfully')
    } catch (error) {
      console.error('Error deleting client:', error)
      toast.error('Failed to delete client. Please try again.')
    }
  }

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const name = newClient.name?.trim()
    if (!name) {
      toast.error('Please enter the customer name.')
      return
    }

    const nextYear = new Date()
    nextYear.setFullYear(nextYear.getFullYear() + 1)
    const defaultRenewal = nextYear.toISOString().slice(0, 10)
    
    setIsSubmitting(true)
    
    try {
      await api.createClient({
        name,
        industry: newClient.industry?.trim() ?? '',
        arr: newClient.arr ?? 0,
        renewal_date: (newClient.renewalDate?.trim() || defaultRenewal),
        last_contact_date: new Date().toISOString(),
        nps_score: newClient.npsScore,
        engagement_score: newClient.engagementScore,
        feature_usage: newClient.featureUsage,
        csm_id: newClient.csmId || null,
        portal_logins: 0,
        support_tickets: 0,
        health_score: 0,
        status: 'healthy',
        churn_risk: 0,
        churn_trend: 'stable',
        account_type: newClient.accountType,
        lifecycle_stage: 'customer',
        email: newClient.email?.trim() || null,
        phone: newClient.phone?.trim() || null,
        website: null,
        address_line1: null,
        city: null,
        state: null,
        postal_code: null,
        country: '',
      })
      
      // Reset form
      setNewClient({
        name: "",
        accountType: "business",
        email: "",
        phone: "",
        industry: "",
        arr: 0,
        renewalDate: "",
        npsScore: 7,
        engagementScore: 50,
        featureUsage: "Medium",
        csmId: "",
      })
      
      // Close dialog and reload data
      setIsAddDialogOpen(false)
      await loadData()
      toast.success('Customer added successfully!')
    } catch (error) {
      console.error('Error adding client:', error)
      toast.error('Failed to add customer. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddCSMUser = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate required fields
    if (!newCSMUser.name || !newCSMUser.email) {
      toast.error('Please fill in all required fields (Name and Email)')
      return
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newCSMUser.email)) {
      toast.error('Please enter a valid email address')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      await api.createCSMUser({
        name: newCSMUser.name,
        email: newCSMUser.email,
        avatar: newCSMUser.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(newCSMUser.name)}`,
      })
      
      // Reset form
      setNewCSMUser({
        name: "",
        email: "",
        avatar: "",
      })
      
      // Close dialog and reload data
      setIsAddCSMDialogOpen(false)
      await loadData()
      toast.success('Team member added successfully!')
    } catch (error) {
      console.error('Error adding CSM user:', error)
      toast.error('Failed to add CSM user. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveClientChanges = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedClient) return
    
    const name = editClientData.name?.trim()
    if (!name) {
      toast.error('Please enter the customer name.')
      return
    }

    const nextYear = new Date()
    nextYear.setFullYear(nextYear.getFullYear() + 1)
    const defaultRenewal = nextYear.toISOString().slice(0, 10)
    
    setIsSubmitting(true)
    
    try {
      await api.updateClient(selectedClient.id, {
        name,
        industry: editClientData.industry?.trim() ?? '',
        arr: parseInt(editClientData.arr, 10) || 0,
        renewal_date: editClientData.renewalDate?.trim() || defaultRenewal,
        nps_score: parseInt(editClientData.npsScore) || 0,
        engagement_score: parseInt(editClientData.engagementScore) || 0,
        feature_usage: editClientData.featureUsage,
        csm_id: editClientData.csmId || null,
        portal_logins: parseInt(editClientData.portalLogins) || 0,
        support_tickets: parseInt(editClientData.supportTickets) || 0,
        account_type: editClientData.accountType,
        lifecycle_stage: editClientData.lifecycleStage,
        email: editClientData.email?.trim() || null,
        phone: editClientData.phone?.trim() || null,
      })
      
      // Close dialog and reload data
      setIsEditDialogOpen(false)
      setSelectedClient(null)
      await loadData()
      toast.success('Customer updated successfully!')
    } catch (error) {
      console.error('Error updating client:', error)
      toast.error('Failed to update customer. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newTask.clientId || !newTask.title || !newTask.dueDate) {
      toast.error('Please fill in all required fields')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      await api.createTask({
        client_id: newTask.clientId,
        title: newTask.title,
        status: newTask.status,
        due_date: newTask.dueDate,
        priority: newTask.priority,
        assigned_to: newTask.assignedTo || null,
      })
      
      setNewTask({
        clientId: "",
        title: "",
        status: "active",
        dueDate: "",
        priority: "medium",
        assignedTo: "",
      })
      
      setIsAddTaskDialogOpen(false)
      await loadData()
      toast.success('Task created successfully!')
    } catch (error) {
      console.error('Error creating task:', error)
      toast.error('Failed to create task. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditTask = (task: ClientTask) => {
    setSelectedTask(task)
    setEditTaskData({
      clientId: task.client_id,
      title: task.title,
      status: task.status,
      dueDate: task.due_date,
      priority: task.priority,
      assignedTo: task.assigned_to || "",
    })
    setIsEditTaskDialogOpen(true)
  }

  const handleSaveTaskChanges = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedTask) return
    
    if (!editTaskData.title || !editTaskData.dueDate) {
      toast.error('Please fill in all required fields')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      await api.updateTask(selectedTask.id, {
        title: editTaskData.title,
        status: editTaskData.status,
        due_date: editTaskData.dueDate,
        priority: editTaskData.priority,
        assigned_to: editTaskData.assignedTo || null,
      })
      
      setIsEditTaskDialogOpen(false)
      setSelectedTask(null)
      await loadData()
      toast.success('Task updated successfully!')
    } catch (error) {
      console.error('Error updating task:', error)
      toast.error('Failed to update task. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) {
      return
    }
    
    try {
      await api.deleteTask(taskId)
      await loadData()
      toast.success('Task deleted successfully')
    } catch (error) {
      console.error('Error deleting task:', error)
      toast.error('Failed to delete task. Please try again.')
    }
  }

  // ==================== MILESTONE HANDLERS ====================

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newMilestone.clientId || !newMilestone.title || !newMilestone.targetDate) {
      toast.error('Please fill in all required fields (Client, Title, Target Date)')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      const milestoneData = {
        client_id: newMilestone.clientId,
        title: newMilestone.title,
        description: newMilestone.description || undefined,
        status: newMilestone.status,
        target_date: newMilestone.targetDate,
        completed_date: newMilestone.completedDate || undefined,
      }
      
      await api.createMilestone(milestoneData)
      
      setIsAddMilestoneDialogOpen(false)
      setNewMilestone({
        clientId: "",
        title: "",
        description: "",
        status: "upcoming",
        targetDate: "",
        completedDate: "",
      })
      await loadData()
      toast.success('Milestone created successfully!')
    } catch (error) {
      console.error('Error creating milestone:', error)
      toast.error('Failed to create milestone. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditMilestone = (milestone: ClientMilestone) => {
    setSelectedMilestone(milestone)
    setEditMilestoneData({
      title: milestone.title,
      description: milestone.description || "",
      status: milestone.status,
      targetDate: milestone.target_date,
      completedDate: milestone.completed_date || "",
    })
    setIsEditMilestoneDialogOpen(true)
  }

  const handleSaveMilestoneChanges = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedMilestone) return
    
    if (!editMilestoneData.title || !editMilestoneData.targetDate) {
      toast.error('Please fill in all required fields (Title, Target Date)')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      await api.updateMilestone(selectedMilestone.id, {
        title: editMilestoneData.title,
        description: editMilestoneData.description || undefined,
        status: editMilestoneData.status,
        target_date: editMilestoneData.targetDate,
        completed_date: editMilestoneData.completedDate || undefined,
      })
      
      setIsEditMilestoneDialogOpen(false)
      setSelectedMilestone(null)
      await loadData()
      toast.success('Milestone updated successfully!')
    } catch (error) {
      console.error('Error updating milestone:', error)
      toast.error('Failed to update milestone. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteMilestone = async (milestoneId: string) => {
    if (!confirm('Are you sure you want to delete this milestone?')) {
      return
    }
    
    try {
      await api.deleteMilestone(milestoneId)
      await loadData()
      toast.success('Milestone deleted successfully')
    } catch (error) {
      console.error('Error deleting milestone:', error)
      toast.error('Failed to delete milestone. Please try again.')
    }
  }

  // ==================== INTERACTION HANDLERS ====================

  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newInteraction.clientId || !newInteraction.subject || !newInteraction.interactionDate) {
      toast.error('Please fill in all required fields (Client, Subject, Date)')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      const interactionData = {
        client_id: newInteraction.clientId,
        type: newInteraction.type,
        subject: newInteraction.subject,
        description: newInteraction.description,
        csm_id: newInteraction.csmId || null,
        interaction_date: newInteraction.interactionDate,
      }
      
      await api.createInteraction(interactionData)
      
      setIsAddInteractionDialogOpen(false)
      setNewInteraction({
        clientId: "",
        type: "email",
        subject: "",
        description: "",
        csmId: "",
        interactionDate: getTodayDateKey(),
      })
      await loadData()
      toast.success('Interaction logged successfully!')
    } catch (error) {
      console.error('Error creating interaction:', error)
      toast.error('Failed to log interaction. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditInteraction = (interaction: ClientInteraction) => {
    setSelectedInteraction(interaction)
    setEditInteractionData({
      type: interaction.type,
      subject: interaction.subject,
      description: interaction.description,
      csmId: interaction.csm_id || "",
      interactionDate: interaction.interaction_date,
    })
    setIsEditInteractionDialogOpen(true)
  }

  const handleSaveInteractionChanges = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedInteraction) return
    
    if (!editInteractionData.subject || !editInteractionData.interactionDate) {
      toast.error('Please fill in all required fields (Subject, Date)')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      await api.updateInteraction(selectedInteraction.id, {
        type: editInteractionData.type,
        subject: editInteractionData.subject,
        description: editInteractionData.description,
        csm_id: editInteractionData.csmId || null,
        interaction_date: editInteractionData.interactionDate,
      })
      
      setIsEditInteractionDialogOpen(false)
      setSelectedInteraction(null)
      await loadData()
      toast.success('Interaction updated successfully!')
    } catch (error) {
      console.error('Error updating interaction:', error)
      toast.error('Failed to update interaction. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteInteraction = async (interactionId: string) => {
    if (!confirm('Are you sure you want to delete this interaction?')) {
      return
    }
    
    try {
      await api.deleteInteraction(interactionId)
      await loadData()
      toast.success('Interaction deleted successfully')
    } catch (error) {
      console.error('Error deleting interaction:', error)
      toast.error('Failed to delete interaction. Please try again.')
    }
  }

  // Filtered clients for the Clients tab
  const filteredClientsTab = clients
    .filter((client) => {
      const accountRow = accountRowByClientId.get(client.id)
      const statusMatch =
        clientsFilterStatus === "all" ||
        clientsFilterStatus === "needs_attention" ||
        clientsFilterStatus === "renewal_risk_high" ||
        clientsFilterStatus === "expansion_ready"
          ? true
          : client.status === clientsFilterStatus
      const attentionMatch =
        clientsFilterStatus !== "needs_attention" ||
        (accountRow != null && (accountRow.attention_score >= 8 || accountRow.status !== 'healthy'))
      const renewalRiskMatch =
        clientsFilterStatus !== "renewal_risk_high" || accountRow?.renewal_risk === 'high'
      const expansionMatch =
        clientsFilterStatus !== "expansion_ready" || accountRow?.expansion_likelihood === 'high'
      const searchMatch =
        clientsSearchQuery === "" ||
        client.name.toLowerCase().includes(clientsSearchQuery.toLowerCase()) ||
        client.industry.toLowerCase().includes(clientsSearchQuery.toLowerCase()) ||
        client.csm?.name.toLowerCase().includes(clientsSearchQuery.toLowerCase())
      return statusMatch && attentionMatch && renewalRiskMatch && expansionMatch && searchMatch
    })
    .sort((a, b) => {
      if (
        clientsFilterStatus === "needs_attention" ||
        clientsFilterStatus === "renewal_risk_high" ||
        clientsFilterStatus === "expansion_ready"
      ) {
        const aScore = accountRowByClientId.get(a.id)?.attention_score ?? 0
        const bScore = accountRowByClientId.get(b.id)?.attention_score ?? 0
        return bScore - aScore
      }
      return a.name.localeCompare(b.name)
    })

  // Filtered tasks for the Tasks tab
  const filteredTasksTab = tasks.filter((task) => {
    const statusMatch = tasksFilterStatus === "all" || task.status === tasksFilterStatus
    const searchMatch = tasksSearchQuery === "" || 
      task.title.toLowerCase().includes(tasksSearchQuery.toLowerCase()) ||
      task.client?.name.toLowerCase().includes(tasksSearchQuery.toLowerCase()) ||
      task.csm?.name.toLowerCase().includes(tasksSearchQuery.toLowerCase())
    return statusMatch && searchMatch
  })

  // Filtered milestones for the Milestones tab
  const filteredMilestonesTab = milestones.filter((milestone) => {
    const statusMatch = milestonesFilterStatus === "all" || milestone.status === milestonesFilterStatus
    const searchMatch = milestonesSearchQuery === "" || 
      milestone.title.toLowerCase().includes(milestonesSearchQuery.toLowerCase()) ||
      milestone.client?.name.toLowerCase().includes(milestonesSearchQuery.toLowerCase())
    return statusMatch && searchMatch
  })

  // Filtered interactions for the Interactions tab
  const filteredInteractionsTab = interactions.filter((interaction) => {
    const typeMatch = interactionsFilterType === "all" || interaction.type === interactionsFilterType
    const searchMatch = interactionsSearchQuery === "" || 
      interaction.subject.toLowerCase().includes(interactionsSearchQuery.toLowerCase()) ||
      interaction.client?.name.toLowerCase().includes(interactionsSearchQuery.toLowerCase()) ||
      interaction.csm?.name.toLowerCase().includes(interactionsSearchQuery.toLowerCase())
    return typeMatch && searchMatch
  })

  const getTaskStatusBadge = (status: string) => {
    if (status === "completed")
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Completed</Badge>
    if (status === "overdue")
      return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Overdue</Badge>
    return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Active</Badge>
  }

  const getMilestoneStatusBadge = (status: string) => {
    if (status === "completed")
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Completed</Badge>
    if (status === "in-progress")
      return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">In Progress</Badge>
    return <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/20">Upcoming</Badge>
  }

  const getInteractionTypeBadge = (type: string) => {
    if (type === "email")
      return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20"><Mail className="w-3 h-3 mr-1" />Email</Badge>
    if (type === "call")
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/20"><Phone className="w-3 h-3 mr-1" />Call</Badge>
    return <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20"><Users className="w-3 h-3 mr-1" />Visit</Badge>
  }

  const getPriorityBadge = (priority: string) => {
    if (priority === "high")
      return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">High</Badge>
    if (priority === "low")
      return <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/20">Low</Badge>
    return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Medium</Badge>
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading Katana Customers data...</p>
        </div>
      </div>
    )
  }

  return (
    <MotionPage subtle className="min-h-screen bg-background p-6">
      {loadError && (
        <div
          className="mb-6 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="flex-1">
            <p className="font-medium text-destructive">Could not load customers data</p>
            <p className="mt-1 text-muted-foreground">{loadError}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void loadData()}
            >
              Retry
            </Button>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-6 px-6 mb-6" data-tour="cs-header">
        <div className="py-6">
          <div className="fluid-page-header">
            <div>
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <span className="hover:text-foreground cursor-pointer transition-colors">Home</span>
                <ChevronRight className="h-4 w-4" />
                <span className="text-foreground">Katana Customers</span>
              </div>
              
              {/* Title with Icon */}
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2.5 rounded-lg">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-3xl font-bold">Katana Customers</h1>
                <ModuleHelpButton moduleId="customer-success" />
              </div>
              
              <p className="text-muted-foreground mt-2">
                CRM + customer success for B2B and B2C — pipeline, contacts, intelligence, and retention in one place
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <ModuleCustomizeControls
                customizeMode={isCustomizeMode}
                onEnterCustomize={enterCustomize}
                onDone={() => void saveAndExit()}
                dataTourCustomize="cs-customize"
              />
              <Dialog open={isAddCSMDialogOpen} onOpenChange={setIsAddCSMDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Add team member
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add team member</DialogTitle>
                    <DialogDescription>
                      Add a team member who can be assigned to customers
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddCSMUser} className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="csmName">Full Name *</Label>
                      <Input 
                        id="csmName"
                        placeholder="Sarah Johnson"
                        value={newCSMUser.name}
                        onChange={(e) => setNewCSMUser({...newCSMUser, name: e.target.value})}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="csmEmail">Email Address *</Label>
                      <Input 
                        id="csmEmail"
                        type="email"
                        placeholder="sarah.johnson@company.com"
                        value={newCSMUser.email}
                        onChange={(e) => setNewCSMUser({...newCSMUser, email: e.target.value})}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="csmAvatar">Avatar URL (Optional)</Label>
                      <Input 
                        id="csmAvatar"
                        type="url"
                        placeholder="https://example.com/avatar.jpg"
                        value={newCSMUser.avatar}
                        onChange={(e) => setNewCSMUser({...newCSMUser, avatar: e.target.value})}
                      />
                      <p className="text-xs text-muted-foreground">
                        Leave blank to auto-generate an avatar based on the name
                      </p>
                    </div>

                    <DialogFooter>
                      <Button 
                        type="button"
                        variant="outline" 
                        onClick={() => {
                          setIsAddCSMDialogOpen(false)
                          setNewCSMUser({ name: "", email: "", avatar: "" })
                        }}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <span className="animate-spin mr-2">⏳</span>
                            Adding...
                          </>
                        ) : (
                          'Add team member'
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              
              <Button variant="outline" onClick={handleExportClients}>
                <Download className="w-4 h-4 mr-2" />
                Export Data
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats – one rectangular bar (hidden on the dashboard tab, where it becomes the `stats` widget) */}
      {activeTab !== 'dashboard' && (
        <Card className="overflow-hidden border-border bg-card/50 mb-6" data-tour="cs-health">
          {renderCsStatsBarContent()}
        </Card>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList data-tour="cs-tabs" className="flex flex-wrap h-auto gap-1 p-1.5 rounded-xl border bg-muted/40">
          <TabsTrigger value="dashboard" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="pipeline" data-tour="cs-pipeline" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Kanban className="h-3.5 w-3.5" /> Pipeline
          </TabsTrigger>
          <TabsTrigger value="leads" data-tour="cs-leads" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Target className="h-3.5 w-3.5" /> Leads
          </TabsTrigger>
          <TabsTrigger value="clients" data-tour="cs-intelligence" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Users className="h-3.5 w-3.5" /> Customers
          </TabsTrigger>
          <TabsTrigger value="contacts" data-tour="cs-contacts" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Contact className="h-3.5 w-3.5" /> Contacts
          </TabsTrigger>
          <TabsTrigger value="tasks" data-tour="cs-tasks-tab" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <CheckSquare className="h-3.5 w-3.5" /> Tasks
          </TabsTrigger>
          <TabsTrigger value="milestones" data-tour="cs-milestones-tab" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Flag className="h-3.5 w-3.5" /> Milestones
          </TabsTrigger>
          <TabsTrigger value="interactions" data-tour="cs-interactions-tab" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <MessageSquare className="h-3.5 w-3.5" /> Interactions
          </TabsTrigger>
          <TabsTrigger value="commerce" data-tour="cs-commerce" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <ShoppingBag className="h-3.5 w-3.5" /> Commerce
          </TabsTrigger>
          <TabsTrigger value="campaigns" data-tour="cs-campaigns" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Megaphone className="h-3.5 w-3.5" /> Campaigns
          </TabsTrigger>
          <TabsTrigger value="analytics" data-tour="cs-analytics" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <BarChart3 className="h-3.5 w-3.5" /> Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          {isCustomizeMode ? (
            <div className="space-y-3">
              <ModuleCustomizeHint surfaceLabel="Customers dashboard" />
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
            rowHeight={36}
            renderWidget={(widgetId) => {
              if (widgetId === 'stats') {
                return (
                  <Card className="overflow-hidden border-border bg-card/50 h-full" data-tour="cs-health">
                    {renderCsStatsBarContent()}
                  </Card>
                )
              }

              if (widgetId === 'customer_list') {
                return (
                  <Card className="h-full overflow-auto" data-tour="cs-clients">
                    <CardHeader>
                      <div className="fluid-toolbar">
                        <CardTitle>Customers</CardTitle>
                        <div className="fluid-toolbar__actions" data-tour="cs-client-filters">
                          <Button
                            variant={filterStatus === "all" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setFilterStatus("all")}
                          >
                            All
                          </Button>
                          <Button
                            variant={filterStatus === "at-risk" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setFilterStatus("at-risk")}
                          >
                            Needs attention
                          </Button>
                          <Button
                            variant={filterStatus === "moderate" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setFilterStatus("moderate")}
                          >
                            Moderate
                          </Button>
                          <Button
                            variant={filterStatus === "healthy" ? "default" : "outline"}
                            size="sm"
                            onClick={() => setFilterStatus("healthy")}
                          >
                            Healthy
                          </Button>
                        </div>
                      </div>
                      <div className="relative mt-4">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                          placeholder="Search by name or industry..." 
                          className="pl-10"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {dashboardFilteredClients.length === 0 ? (
                          <div className="text-center py-8">
                            <p className="text-muted-foreground">No clients found matching your search.</p>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="mt-2"
                              onClick={() => {
                                setSearchQuery("")
                                setFilterStatus("all")
                              }}
                            >
                              Clear Filters
                            </Button>
                          </div>
                        ) : (
                          dashboardFilteredClients.map((client) => {
                            const taskCounts = getClientTaskCounts(client.id)
                            const milestoneCounts = getClientMilestoneCounts(client.id)
                            const healthTrend = getHealthTrend(client.id)
                            
                            return (
                            <div
                              key={client.id}
                              className="fluid-action-row hover:bg-muted/50"
                            >
                              <div className="fluid-action-row__content">
                                <div className="fluid-title-row">
                                  <h3 className="font-semibold">{client.name}</h3>
                                  <CsAccountTypeBadge accountType={client.account_type} />
                                  {getHealthBadge(client.status)}
                                  {getChurnRiskBadge(client.churn_risk)}
                                </div>
                                <p className="text-sm text-muted-foreground">{customerContextLine(client)}</p>
                                <div className="fluid-meta-row">
                                  <span>Last contact: {getTimeSince(client.last_contact_date)} ago</span>
                                  <span>Tasks: {taskCounts.completed}/{taskCounts.total}</span>
                                  <span>Milestones: {milestoneCounts.completed}/{milestoneCounts.total}</span>
                                  <span>Value: ${(client.arr / 1000).toFixed(0)}K</span>
                                  <span>Renewal / next: {formatDateOnly(client.renewal_date)}</span>
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <span className="text-xs text-muted-foreground">Health Trend:</span>
                                  <div className="flex h-6 items-end gap-0.5">
                                    {healthTrend.map((score, idx) => (
                                      <div
                                        key={idx}
                                        className={`w-2 rounded-t ${
                                          score >= 80 ? "bg-green-500" : score >= 50 ? "bg-yellow-500" : "bg-red-500"
                                        }`}
                                        style={{ height: `${(score / 100) * 100}%` }}
                                      />
                                    ))}
                                  </div>
                                  {client.churn_trend === "up" && <ArrowUpRight className="w-4 h-4 text-red-500" />}
                                  {client.churn_trend === "down" && <ArrowDownRight className="w-4 h-4 text-green-500" />}
                                </div>
                              </div>
                              <div className="fluid-action-row__actions">
                                <div className="text-left sm:text-right">
                                  <p className="text-sm text-muted-foreground">Engagement</p>
                                  <p className={`text-2xl font-bold ${getHealthColor(client.health_score)}`}>
                                    {client.health_score}%
                                  </p>
                                </div>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="shrink-0"
                                  onClick={() => handleViewClient(client)}
                                >
                                  View
                                </Button>
                              </div>
                            </div>
                            )
                          })
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              }

              if (widgetId === 'quick_stats') {
                return (
                  <Card className="h-full overflow-auto" data-tour="cs-quick-stats">
                    <CardHeader>
                      <CardTitle>Quick Stats</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-muted-foreground">Task Progress</span>
                          <span className="text-sm font-semibold">
                            {stats.totalTasks > 0 
                              ? Math.round((stats.completedTasks / stats.totalTasks) * 100) 
                              : 0}%
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div 
                            className="bg-primary h-2 rounded-full" 
                            style={{ 
                              width: `${stats.totalTasks > 0 
                                ? (stats.completedTasks / stats.totalTasks) * 100 
                                : 0}%` 
                            }}
                          ></div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {stats.completedTasks}/{stats.totalTasks} completed
                        </p>
                      </div>

                      <div className="pt-4 border-t space-y-2">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-red-500" />
                          <span className="text-sm">{stats.overdueTasks} tasks overdue</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-yellow-500" />
                          <span className="text-sm">{stats.atRiskCount} customers needing follow-up</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              }

              if (widgetId === 'recent_activity') {
                return (
                  <Card className="h-full overflow-auto">
                    <CardHeader>
                      <CardTitle>Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {interactions.slice(0, 4).map((interaction) => (
                          <div key={interaction.id} className="flex items-start gap-3">
                            <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm">{interaction.subject}</p>
                              <p className="text-xs text-muted-foreground">
                                {getTimeSince(interaction.interaction_date)} ago
                              </p>
                            </div>
                          </div>
                        ))}
                        {interactions.length === 0 && (
                          <div className="text-center py-4">
                            <p className="text-sm text-muted-foreground">No recent activity</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )
              }

              if (widgetId === 'integrations') {
                return (
                  <div className="h-full overflow-auto">
                    <CrmIntegrationsPanel />
                  </div>
                )
              }

              if (widgetId === 'kyc_portfolio_summary') {
                return kycSummary ? (
                  <div className="h-full overflow-auto">
                    <KycPortfolioSummaryBar
                      summary={kycSummary}
                      accountRows={accountRows}
                      onOpenClient={handleViewClientById}
                    />
                  </div>
                ) : (
                  <Card className="h-full flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">Portfolio summary unavailable</p>
                  </Card>
                )
              }

              if (widgetId === 'icp_profile') {
                return (
                  <div className="h-full overflow-auto">
                    <KycIcpProfileCard />
                  </div>
                )
              }

              if (widgetId === 'metric_total_customers') {
                return (
                  <Card className="h-full p-4 flex flex-col justify-center">
                    <p className="text-xs text-muted-foreground">Total Customers</p>
                    <p className="text-3xl font-bold tabular-nums mt-1">{stats.totalClients}</p>
                  </Card>
                )
              }

              if (widgetId === 'metric_needs_attention') {
                return (
                  <Card className="h-full p-4 flex flex-col justify-center">
                    <p className="text-xs text-muted-foreground">Needs attention</p>
                    <p className="text-3xl font-bold tabular-nums mt-1 text-amber-600">{stats.atRiskCount}</p>
                  </Card>
                )
              }

              if (widgetId === 'metric_avg_engagement') {
                return (
                  <Card className="h-full p-4 flex flex-col justify-center">
                    <p className="text-xs text-muted-foreground">Avg engagement</p>
                    <p className="text-3xl font-bold tabular-nums mt-1">{stats.avgHealthScore}%</p>
                  </Card>
                )
              }

              if (widgetId === 'metric_overdue_tasks') {
                return (
                  <Card className="h-full p-4 flex flex-col justify-center">
                    <p className="text-xs text-muted-foreground">Overdue tasks</p>
                    <p className="text-3xl font-bold tabular-nums mt-1">{stats.overdueTasks}</p>
                  </Card>
                )
              }

              if (widgetId === 'metric_pipeline') {
                return (
                  <Card className="h-full p-4 flex flex-col justify-center">
                    <p className="text-xs text-muted-foreground">Pipeline</p>
                    <p className="text-3xl font-bold tabular-nums mt-1">${(crmStats.pipelineValue / 1000).toFixed(0)}K</p>
                  </Card>
                )
              }

              if (widgetId === 'metric_new_leads') {
                return (
                  <Card className="h-full p-4 flex flex-col justify-center">
                    <p className="text-xs text-muted-foreground">New leads</p>
                    <p className="text-3xl font-bold tabular-nums mt-1">{crmStats.newLeads}</p>
                  </Card>
                )
              }

              return null
            }}
          />
        </TabsContent>

        <TabsContent value="pipeline">
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
          <CrmPipelineTab
            deals={crmDeals}
            stages={crmStages}
            clients={clients}
            csmUsers={csmUsers}
            onRefresh={refreshCrm}
            layout={{
              widgets: layout.widgets,
              catalog: surfaceConfig.catalog,
              customizeMode: isCustomizeMode,
              onLayoutChange,
              onRemoveWidget: removeWidget,
            }}
          />
        </TabsContent>

        <TabsContent value="leads">
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
          <CrmLeadsTab
            leads={crmLeads}
            campaigns={crmCampaigns}
            csmUsers={csmUsers}
            onRefresh={refreshCrm}
            layout={{
              widgets: layout.widgets,
              catalog: surfaceConfig.catalog,
              customizeMode: isCustomizeMode,
              onLayoutChange,
              onRemoveWidget: removeWidget,
            }}
          />
        </TabsContent>

        <TabsContent value="contacts">
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
          <CrmContactsTab
            contacts={crmContacts}
            clients={clients}
            onRefresh={refreshCrm}
            layout={{
              widgets: layout.widgets,
              catalog: surfaceConfig.catalog,
              customizeMode: isCustomizeMode,
              onLayoutChange,
              onRemoveWidget: removeWidget,
            }}
          />
        </TabsContent>

        <TabsContent value="commerce">
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
          <CrmCommerceTab
            quotes={crmQuotes}
            invoices={crmInvoices}
            contracts={crmContracts}
            clients={clients}
            onRefresh={refreshCrm}
            layout={{
              widgets: layout.widgets,
              catalog: surfaceConfig.catalog,
              customizeMode: isCustomizeMode,
              onLayoutChange,
              onRemoveWidget: removeWidget,
            }}
          />
        </TabsContent>

        <TabsContent value="campaigns">
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
          <CrmCampaignsTab
            campaigns={crmCampaigns}
            leadCountByCampaign={leadCountByCampaign}
            onRefresh={refreshCrm}
            layout={{
              widgets: layout.widgets,
              catalog: surfaceConfig.catalog,
              customizeMode: isCustomizeMode,
              onLayoutChange,
              onRemoveWidget: removeWidget,
            }}
          />
        </TabsContent>

        <TabsContent value="clients" className="space-y-6">
          {isCustomizeMode ? (
            <div className="space-y-3">
              <ModuleCustomizeHint surfaceLabel={surfaceConfig.label} />
              <div className="flex flex-wrap items-center gap-2">
                <WidgetCatalogDialog available={availableWidgets} onAdd={addWidget} />
                <Button type="button" variant="ghost" size="sm" onClick={resetToDefault}>
                  Reset layout
                </Button>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Customer directory</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Manage accounts and open any customer to view intelligence, signals, and relationship data
              </p>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Customer
                </Button>
              </DialogTrigger>
              <DialogContent size="md">
                    <DialogHeader>
                      <DialogTitle>Add Customer</DialogTitle>
                      <DialogDescription>
                        Add a B2B company or B2C individual — track sales, engagement, and success.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddClient} className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="accountType">Account type</Label>
                        <select
                          id="accountType"
                          className="w-full px-3 py-2 border rounded-md bg-background"
                          value={newClient.accountType}
                          onChange={(e) =>
                            setNewClient({
                              ...newClient,
                              accountType: e.target.value as 'business' | 'individual',
                            })
                          }
                        >
                          <option value="business">Business (B2B)</option>
                          <option value="individual">Individual (B2C)</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="name">
                          {newClient.accountType === 'individual' ? 'Full name *' : 'Company name *'}
                        </Label>
                        <Input 
                          id="name"
                          placeholder={newClient.accountType === 'individual' ? 'Jane Smith' : 'Acme Corp'}
                          value={newClient.name}
                          onChange={(e) => setNewClient({...newClient, name: e.target.value})}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={newClient.email}
                            onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone</Label>
                          <Input
                            id="phone"
                            value={newClient.phone}
                            onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                          />
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Optional: add industry, value, or next follow-up date. Log calls and emails on the Interactions tab.
                      </p>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="industry">Industry (optional)</Label>
                          <Input 
                            id="industry"
                            placeholder="e.g. Retail, Auto, Services"
                            value={newClient.industry}
                            onChange={(e) => setNewClient({...newClient, industry: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="arr">Annual value / ARR (optional)</Label>
                          <Input 
                            id="arr"
                            type="number"
                            min="0"
                            step="1000"
                            placeholder="0"
                            value={newClient.arr === 0 ? '' : newClient.arr}
                            onChange={(e) => setNewClient({...newClient, arr: parseInt(e.target.value, 10) || 0})}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="renewalDate">Next follow-up (optional)</Label>
                          <Input 
                            id="renewalDate"
                            type="date"
                            value={newClient.renewalDate}
                            onChange={(e) => setNewClient({...newClient, renewalDate: e.target.value})}
                          />
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Engagement is calculated from contact recency, support tickets, and activity.
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="engagementScore">Engagement score (0-100)</Label>
                          <Input 
                            id="engagementScore"
                            type="number"
                            min="0"
                            max="100"
                            placeholder="50"
                            value={newClient.engagementScore}
                            onChange={(e) => setNewClient({...newClient, engagementScore: parseInt(e.target.value) || 0})}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="featureUsage">Feature Usage</Label>
                          <select 
                            id="featureUsage"
                            className="w-full px-3 py-2 border rounded-md bg-background"
                            value={newClient.featureUsage}
                            onChange={(e) => setNewClient({...newClient, featureUsage: e.target.value as "Low" | "Medium" | "High"})}
                          >
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="csmId">Assigned to (optional)</Label>
                        <select 
                          id="csmId"
                          className="w-full px-3 py-2 border rounded-md bg-background"
                          value={newClient.csmId}
                          onChange={(e) => setNewClient({...newClient, csmId: e.target.value})}
                        >
                          <option value="">Unassigned</option>
                          {csmUsers.map((csm) => (
                            <option key={csm.id} value={csm.id}>
                              {csm.name} ({csm.email})
                            </option>
                          ))}
                        </select>
                        {csmUsers.length === 0 && (
                          <p className="text-xs text-muted-foreground">
                            No team members yet. Add one using the "Add team member" button in the header.
                          </p>
                        )}
                      </div>

                      <DialogFooter>
                        <Button 
                          type="button"
                          variant="outline" 
                          onClick={() => {
                            setIsAddDialogOpen(false)
                            // Reset form
                            setNewClient({
                              name: "",
                              accountType: "business",
                              email: "",
                              phone: "",
                              industry: "",
                              arr: 0,
                              renewalDate: "",
                              npsScore: 7,
                              engagementScore: 50,
                              featureUsage: "Medium",
                              csmId: "",
                            })
                          }}
                          disabled={isSubmitting}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting ? (
                            <>
                              <span className="animate-spin mr-2">⏳</span>
                              Adding...
                            </>
                          ) : (
                            'Add Client'
                          )}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

          <ModuleWidgetCanvas
            widgets={layout.widgets}
            catalog={surfaceConfig.catalog}
            customizeMode={isCustomizeMode}
            onLayoutChange={onLayoutChange}
            onRemoveWidget={removeWidget}
            rowHeight={36}
            renderWidget={(widgetId) => {
              if (widgetId === 'portfolio_summary') {
                return kycSummary ? (
                  <div className="h-full overflow-auto grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                    <KycStatTile
                      icon={AlertTriangle}
                      label="At risk"
                      value={kycSummary.at_risk_count}
                      subtitle={`${kycSummary.b2b_at_risk} B2B · ${kycSummary.b2c_at_risk} B2C · $${(kycSummary.arr_at_risk / 1000).toFixed(0)}K ARR`}
                      variant="danger"
                    />
                    <KycStatTile
                      icon={ShieldAlert}
                      label="High renewal risk"
                      value={kycSummary.renewal_risk_high_count}
                      subtitle={`${kycSummary.renewals_within_90d} renewals ≤90d`}
                      variant="danger"
                    />
                    <KycStatTile
                      icon={TrendingUp}
                      label="Expansion ready"
                      value={kycSummary.expansion_high_count}
                      subtitle="High expansion likelihood"
                      variant="success"
                    />
                    <KycStatTile
                      icon={Calendar}
                      label="Renewals ≤90d"
                      value={kycSummary.renewals_within_90d}
                      subtitle={`${kycSummary.renewals_within_30d} within 30 days`}
                      variant="warning"
                    />
                    <KycStatTile
                      icon={Users}
                      label="Portfolio mix"
                      value={`${kycSummary.b2b_count} / ${kycSummary.b2c_count}`}
                      subtitle="B2B accounts · B2C consumers"
                      variant="default"
                    />
                    <KycStatTile
                      icon={DollarSign}
                      label="Avg health"
                      value={`${kycSummary.avg_health_score}%`}
                      subtitle={`${kycSummary.high_attention_count} need attention now`}
                      variant={kycSummary.avg_health_score >= 70 ? 'success' : kycSummary.avg_health_score >= 40 ? 'warning' : 'danger'}
                    />
                  </div>
                ) : (
                  <Card className="h-full flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">Portfolio summary unavailable</p>
                  </Card>
                )
              }

              if (widgetId === 'top_actions') {
                return accountRows.length > 0 ? (
                  <div className="h-full overflow-auto">
                    <KycPortfolioTopActions rows={accountRows} onOpenClient={handleViewClientById} />
                  </div>
                ) : (
                  <Card className="h-full flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">No account actions</p>
                  </Card>
                )
              }

              if (widgetId === 'outreach_pipeline') {
                return kycSummary ? (
                  <Card className="h-full overflow-auto">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Renewal & expansion plays</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(kycSummary.outreach_by_status).map(([key, count]) => (
                          <span
                            key={key}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${CLIENTS_OUTREACH_CHIP_COLORS[key] ?? 'bg-muted text-muted-foreground'}`}
                          >
                            {KYC_CLIENT_OUTREACH_LABELS[key] ?? key}
                            <span className="tabular-nums font-bold">{count}</span>
                          </span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="h-full flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">Outreach pipeline unavailable</p>
                  </Card>
                )
              }

              if (widgetId === 'playbooks') {
                const playbooks = groupPortfolioPlaybooks(accountRows)
                return playbooks.length > 0 ? (
                  <div className="h-full overflow-auto">
                    <KycPortfolioPlaybooks playbooks={playbooks} />
                  </div>
                ) : (
                  <Card className="h-full flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">No playbooks yet</p>
                  </Card>
                )
              }

              if (widgetId === 'client_filters') {
                return (
                  <div className="h-full overflow-auto flex items-center gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        placeholder="Search by name or industry..." 
                        className="pl-10"
                        value={clientsSearchQuery}
                        onChange={(e) => setClientsSearchQuery(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={clientsFilterStatus === "all" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setClientsFilterStatus("all")}
                      >
                        All ({clients.length})
                      </Button>
                      <Button
                        variant={clientsFilterStatus === "healthy" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setClientsFilterStatus("healthy")}
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Healthy
                      </Button>
                      <Button
                        variant={clientsFilterStatus === "moderate" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setClientsFilterStatus("moderate")}
                      >
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Moderate
                      </Button>
                      <Button
                        variant={clientsFilterStatus === "at-risk" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setClientsFilterStatus("at-risk")}
                      >
                        <AlertCircle className="w-3 h-3 mr-1" />
                        At Risk
                      </Button>
                      <Button
                        variant={clientsFilterStatus === "needs_attention" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setClientsFilterStatus("needs_attention")}
                      >
                        <Brain className="w-3 h-3 mr-1" />
                        Needs attention
                      </Button>
                      <Button
                        variant={clientsFilterStatus === "renewal_risk_high" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setClientsFilterStatus("renewal_risk_high")}
                      >
                        <AlertCircle className="w-3 h-3 mr-1" />
                        High renewal risk
                      </Button>
                      <Button
                        variant={clientsFilterStatus === "expansion_ready" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setClientsFilterStatus("expansion_ready")}
                      >
                        <TrendingUp className="w-3 h-3 mr-1" />
                        Expansion ready
                      </Button>
                    </div>
                  </div>
                )
              }

              if (widgetId === 'client_directory') {
                return (
              <div className="h-full overflow-auto">
              {filteredClientsTab.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No clients found</h3>
                  <p className="text-muted-foreground mb-4">
                    {clientsSearchQuery || clientsFilterStatus !== "all" 
                      ? "Try adjusting your search or filters"
                      : "Get started by adding your first client"}
                  </p>
                  {clientsSearchQuery || clientsFilterStatus !== "all" ? (
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setClientsSearchQuery("")
                        setClientsFilterStatus("all")
                      }}
                    >
                      Clear Filters
                    </Button>
                  ) : (
                    <Button onClick={() => setIsAddDialogOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add your first customer
                    </Button>
                  )}
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Renewal risk</TableHead>
                        <TableHead>Expansion</TableHead>
                        <TableHead>Next action</TableHead>
                        <TableHead>Signals</TableHead>
                        <TableHead>Engagement</TableHead>
                        <TableHead>Assigned to</TableHead>
                        <TableHead>Next follow-up</TableHead>
                        <TableHead>Last Contact</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredClientsTab.map((client) => {
                        const accountRow = accountRowByClientId.get(client.id)
                        return (
                        <TableRow key={client.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{client.name}</div>
                              <div className="text-sm text-muted-foreground">{client.industry}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getHealthBadge(client.status)}
                          </TableCell>
                          <TableCell>
                            {accountRow ? (
                              <KycRiskChip level={accountRow.renewal_risk} />
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {accountRow ? (
                              <KycRiskChip level={accountRow.expansion_likelihood} />
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[180px]">
                            {accountRow?.primary_action ? (
                              <span className="text-xs text-muted-foreground line-clamp-2" title={accountRow.primary_action.reason}>
                                {accountRow.primary_action.label}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {accountRow?.top_signals?.length ? (
                              <KycSignalBadges keys={accountRow.top_signals} maxVisible={2} />
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-full bg-muted rounded-full h-2 max-w-[60px]">
                                <div 
                                  className={`h-2 rounded-full ${
                                    client.health_score >= 80 ? "bg-green-500" : 
                                    client.health_score >= 50 ? "bg-yellow-500" : 
                                    "bg-red-500"
                                  }`}
                                  style={{ width: `${client.health_score}%` }}
                                ></div>
                              </div>
                              <span className={`text-sm font-semibold ${getHealthColor(client.health_score)}`}>
                                {client.health_score}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {client.csm ? (
                                <>
                                  {client.csm.avatar && (
                                    <img 
                                      src={client.csm.avatar} 
                                      alt={client.csm.name}
                                      className="w-6 h-6 rounded-full"
                                    />
                                  )}
                                  <span className="text-sm">{client.csm.name}</span>
                                </>
                              ) : (
                                <span className="text-sm text-muted-foreground">Unassigned</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="w-3 h-3" />
                              {formatDateOnly(client.renewal_date)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {getTimeSince(client.last_contact_date)} ago
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleViewClient(client)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleEditClient(client)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleDeleteClient(client.id)}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
              </div>
                )
              }

              return null
            }}
          />

          <KycIcpProfileCard />

          {/* Edit Client Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent size="md">
              {selectedClient && (
                <>
                  <DialogHeader>
                    <DialogTitle>Edit Client: {selectedClient.name}</DialogTitle>
                    <DialogDescription>
                      Update client information and account details
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSaveClientChanges} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="editAccountType">Account type</Label>
                        <select
                          id="editAccountType"
                          className="w-full px-3 py-2 border rounded-md bg-background"
                          value={editClientData.accountType}
                          onChange={(e) =>
                            setEditClientData({
                              ...editClientData,
                              accountType: e.target.value as 'business' | 'individual',
                            })
                          }
                        >
                          <option value="business">Business (B2B)</option>
                          <option value="individual">Individual (B2C)</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="editLifecycle">Lifecycle stage</Label>
                        <select
                          id="editLifecycle"
                          className="w-full px-3 py-2 border rounded-md bg-background"
                          value={editClientData.lifecycleStage}
                          onChange={(e) =>
                            setEditClientData({
                              ...editClientData,
                              lifecycleStage: e.target.value as api.LifecycleStage,
                            })
                          }
                        >
                          <option value="lead">Lead</option>
                          <option value="prospect">Prospect</option>
                          <option value="customer">Customer</option>
                          <option value="churned">Churned</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="editName">
                          {editClientData.accountType === 'individual' ? 'Full name *' : 'Company name *'}
                        </Label>
                        <Input 
                          id="editName"
                          value={editClientData.name}
                          onChange={(e) => setEditClientData({...editClientData, name: e.target.value})}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="editIndustry">Industry</Label>
                        <Input 
                          id="editIndustry"
                          value={editClientData.industry}
                          onChange={(e) => setEditClientData({...editClientData, industry: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="editEmail">Email</Label>
                        <Input
                          id="editEmail"
                          type="email"
                          value={editClientData.email}
                          onChange={(e) => setEditClientData({ ...editClientData, email: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="editPhone">Phone</Label>
                        <Input
                          id="editPhone"
                          value={editClientData.phone}
                          onChange={(e) => setEditClientData({ ...editClientData, phone: e.target.value })}
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="editRenewalDate">Next follow-up *</Label>
                        <Input 
                          id="editRenewalDate"
                          type="date"
                          value={editClientData.renewalDate}
                          onChange={(e) => setEditClientData({...editClientData, renewalDate: e.target.value})}
                          required
                        />
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Engagement and status are recalculated from contact recency, feature usage, support tickets, and activity.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Engagement score (auto)</Label>
                        <p className="text-lg font-semibold">{editClientData.healthScore !== "" ? editClientData.healthScore : selectedClient?.health_score ?? "—"}%</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="editEngagement">Engagement level (0-100)</Label>
                        <Input 
                          id="editEngagement"
                          type="number"
                          min="0"
                          max="100"
                          placeholder="50"
                          value={editClientData.engagementScore}
                          onChange={(e) => setEditClientData({...editClientData, engagementScore: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="editFeatureUsage">Feature Usage</Label>
                        <select 
                          id="editFeatureUsage"
                          className="w-full px-3 py-2 border rounded-md bg-background"
                          value={editClientData.featureUsage}
                          onChange={(e) => setEditClientData({...editClientData, featureUsage: e.target.value as "Low" | "Medium" | "High"})}
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="editCsmId">Assigned to</Label>
                        <select 
                          id="editCsmId"
                          className="w-full px-3 py-2 border rounded-md bg-background"
                          value={editClientData.csmId}
                          onChange={(e) => setEditClientData({...editClientData, csmId: e.target.value})}
                        >
                          <option value="">Unassigned</option>
                          {csmUsers.map((csm) => (
                            <option key={csm.id} value={csm.id}>
                              {csm.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="editPortalLogins">Portal Logins</Label>
                        <Input 
                          id="editPortalLogins"
                          type="number"
                          min="0"
                          placeholder="0"
                          value={editClientData.portalLogins}
                          onChange={(e) => setEditClientData({...editClientData, portalLogins: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="editSupportTickets">Support Tickets</Label>
                        <Input 
                          id="editSupportTickets"
                          type="number"
                          min="0"
                          placeholder="0"
                          value={editClientData.supportTickets}
                          onChange={(e) => setEditClientData({...editClientData, supportTickets: e.target.value})}
                        />
                      </div>
                    </div>

                    <DialogFooter>
                      <Button 
                        type="button"
                        variant="outline" 
                        onClick={() => {
                          setIsEditDialogOpen(false)
                          setSelectedClient(null)
                        }}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <span className="animate-spin mr-2">⏳</span>
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="tasks">
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

          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Task Management</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Manage tasks and action items for your clients
              </p>
            </div>
            <Dialog open={isAddTaskDialogOpen} onOpenChange={setIsAddTaskDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Task
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Create New Task</DialogTitle>
                      <DialogDescription>
                        Add a new task for a client
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddTask} className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="taskClient">Client *</Label>
                        <select 
                          id="taskClient"
                          className="w-full px-3 py-2 border rounded-md bg-background"
                          value={newTask.clientId}
                          onChange={(e) => setNewTask({...newTask, clientId: e.target.value})}
                          required
                        >
                          <option value="">Select a client...</option>
                          {clients.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="taskTitle">Task Title *</Label>
                        <Input 
                          id="taskTitle"
                          placeholder="Follow up on product feedback"
                          value={newTask.title}
                          onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="taskStatus">Status</Label>
                          <select 
                            id="taskStatus"
                            className="w-full px-3 py-2 border rounded-md bg-background"
                            value={newTask.status}
                            onChange={(e) => setNewTask({...newTask, status: e.target.value as "active" | "completed" | "overdue"})}
                          >
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                            <option value="overdue">Overdue</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="taskPriority">Priority</Label>
                          <select 
                            id="taskPriority"
                            className="w-full px-3 py-2 border rounded-md bg-background"
                            value={newTask.priority}
                            onChange={(e) => setNewTask({...newTask, priority: e.target.value as "low" | "medium" | "high"})}
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="taskDueDate">Due Date *</Label>
                        <Input 
                          id="taskDueDate"
                          type="date"
                          value={newTask.dueDate}
                          onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="taskAssignedTo">Assign To</Label>
                        <select 
                          id="taskAssignedTo"
                          className="w-full px-3 py-2 border rounded-md bg-background"
                          value={newTask.assignedTo}
                          onChange={(e) => setNewTask({...newTask, assignedTo: e.target.value})}
                        >
                          <option value="">Unassigned</option>
                          {csmUsers.map((csm) => (
                            <option key={csm.id} value={csm.id}>
                              {csm.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <DialogFooter>
                        <Button 
                          type="button"
                          variant="outline" 
                          onClick={() => {
                            setIsAddTaskDialogOpen(false)
                            setNewTask({
                              clientId: "",
                              title: "",
                              status: "active",
                              dueDate: "",
                              priority: "medium",
                              assignedTo: "",
                            })
                          }}
                          disabled={isSubmitting}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting ? (
                            <>
                              <span className="animate-spin mr-2">⏳</span>
                              Creating...
                            </>
                          ) : (
                            'Create Task'
                          )}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

          <ModuleWidgetCanvas
            widgets={layout.widgets}
            catalog={surfaceConfig.catalog}
            customizeMode={isCustomizeMode}
            onLayoutChange={onLayoutChange}
            onRemoveWidget={removeWidget}
            rowHeight={36}
            renderWidget={(widgetId) => {
              if (widgetId === 'metric_overdue') {
                return (
                  <Card className="h-full flex flex-col justify-center">
                    <CardContent className="py-4">
                      <p className="text-sm text-muted-foreground">Overdue tasks</p>
                      <p className="text-2xl font-bold text-red-500">
                        {tasks.filter((t) => t.status === 'overdue').length}
                      </p>
                    </CardContent>
                  </Card>
                )
              }

              if (widgetId === 'metric_active') {
                return (
                  <Card className="h-full flex flex-col justify-center">
                    <CardContent className="py-4">
                      <p className="text-sm text-muted-foreground">Active tasks</p>
                      <p className="text-2xl font-bold">
                        {tasks.filter((t) => t.status === 'active').length}
                      </p>
                    </CardContent>
                  </Card>
                )
              }

              if (widgetId === 'metric_completed') {
                return (
                  <Card className="h-full flex flex-col justify-center">
                    <CardContent className="py-4">
                      <p className="text-sm text-muted-foreground">Completed tasks</p>
                      <p className="text-2xl font-bold text-green-600">
                        {tasks.filter((t) => t.status === 'completed').length}
                      </p>
                    </CardContent>
                  </Card>
                )
              }

              if (widgetId === 'task_filters') {
                return (
                  <div className="h-full overflow-auto flex items-center gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input 
                        placeholder="Search tasks by title, client, or assignee..." 
                        className="pl-10"
                        value={tasksSearchQuery}
                        onChange={(e) => setTasksSearchQuery(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant={tasksFilterStatus === "all" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTasksFilterStatus("all")}
                      >
                        All ({tasks.length})
                      </Button>
                      <Button
                        variant={tasksFilterStatus === "active" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTasksFilterStatus("active")}
                      >
                        Active
                      </Button>
                      <Button
                        variant={tasksFilterStatus === "completed" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTasksFilterStatus("completed")}
                      >
                        Completed
                      </Button>
                      <Button
                        variant={tasksFilterStatus === "overdue" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTasksFilterStatus("overdue")}
                      >
                        Overdue
                      </Button>
                    </div>
                  </div>
                )
              }

              if (widgetId === 'task_table') {
                return (
              <div className="h-full overflow-auto">
              {filteredTasksTab.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No tasks found</h3>
                  <p className="text-muted-foreground mb-4">
                    {tasksSearchQuery || tasksFilterStatus !== "all" 
                      ? "Try adjusting your search or filters"
                      : "Get started by creating your first task"}
                  </p>
                  {tasksSearchQuery || tasksFilterStatus !== "all" ? (
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setTasksSearchQuery("")
                        setTasksFilterStatus("all")
                      }}
                    >
                      Clear Filters
                    </Button>
                  ) : (
                    <Button onClick={() => setIsAddTaskDialogOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Your First Task
                    </Button>
                  )}
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Task</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTasksTab.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell className="font-medium">{task.title}</TableCell>
                          <TableCell>
                            {task.client ? task.client.name : 'Unknown Client'}
                          </TableCell>
                          <TableCell>
                            {getTaskStatusBadge(task.status)}
                          </TableCell>
                          <TableCell>
                            {getPriorityBadge(task.priority)}
                          </TableCell>
                          <TableCell>
                            {task.csm ? (
                              <div className="flex items-center gap-2">
                                {task.csm.avatar && (
                                  <img 
                                    src={task.csm.avatar} 
                                    alt={task.csm.name}
                                    className="w-6 h-6 rounded-full"
                                  />
                                )}
                                <span className="text-sm">{task.csm.name}</span>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {formatDateOnly(task.due_date)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleEditTask(task)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleDeleteTask(task.id)}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              </div>
                )
              }

              return null
            }}
          />

          {/* Edit Task Dialog */}
          <Dialog open={isEditTaskDialogOpen} onOpenChange={setIsEditTaskDialogOpen}>
            <DialogContent className="max-w-md">
              {selectedTask && (
                <>
                  <DialogHeader>
                    <DialogTitle>Edit Task</DialogTitle>
                    <DialogDescription>
                      Update task details
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSaveTaskChanges} className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="editTaskTitle">Task Title *</Label>
                      <Input 
                        id="editTaskTitle"
                        value={editTaskData.title}
                        onChange={(e) => setEditTaskData({...editTaskData, title: e.target.value})}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="editTaskStatus">Status</Label>
                        <select 
                          id="editTaskStatus"
                          className="w-full px-3 py-2 border rounded-md bg-background"
                          value={editTaskData.status}
                          onChange={(e) => setEditTaskData({...editTaskData, status: e.target.value as "active" | "completed" | "overdue"})}
                        >
                          <option value="active">Active</option>
                          <option value="completed">Completed</option>
                          <option value="overdue">Overdue</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="editTaskPriority">Priority</Label>
                        <select 
                          id="editTaskPriority"
                          className="w-full px-3 py-2 border rounded-md bg-background"
                          value={editTaskData.priority}
                          onChange={(e) => setEditTaskData({...editTaskData, priority: e.target.value as "low" | "medium" | "high"})}
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="editTaskDueDate">Due Date *</Label>
                      <Input 
                        id="editTaskDueDate"
                        type="date"
                        value={editTaskData.dueDate}
                        onChange={(e) => setEditTaskData({...editTaskData, dueDate: e.target.value})}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="editTaskAssignedTo">Assign To</Label>
                      <select 
                        id="editTaskAssignedTo"
                        className="w-full px-3 py-2 border rounded-md bg-background"
                        value={editTaskData.assignedTo}
                        onChange={(e) => setEditTaskData({...editTaskData, assignedTo: e.target.value})}
                      >
                        <option value="">Unassigned</option>
                        {csmUsers.map((csm) => (
                          <option key={csm.id} value={csm.id}>
                            {csm.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <DialogFooter>
                      <Button 
                        type="button"
                        variant="outline" 
                        onClick={() => {
                          setIsEditTaskDialogOpen(false)
                          setSelectedTask(null)
                        }}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <span className="animate-spin mr-2">⏳</span>
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="milestones">
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

          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Milestone Tracking</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Track key milestones and achievements for your clients
              </p>
            </div>
            <Dialog open={isAddMilestoneDialogOpen} onOpenChange={setIsAddMilestoneDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Milestone
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Create New Milestone</DialogTitle>
                      <DialogDescription>
                        Add a new milestone for a client
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddMilestone} className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="milestoneClient">Client *</Label>
                        <select
                          id="milestoneClient"
                          className="w-full px-3 py-2 border rounded-md bg-background"
                          value={newMilestone.clientId}
                          onChange={(e) => setNewMilestone({...newMilestone, clientId: e.target.value})}
                          required
                        >
                          <option value="">Select a client</option>
                          {clients.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="milestoneTitle">Milestone Title *</Label>
                        <Input
                          id="milestoneTitle"
                          value={newMilestone.title}
                          onChange={(e) => setNewMilestone({...newMilestone, title: e.target.value})}
                          placeholder="e.g., Complete onboarding"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="milestoneDescription">Description</Label>
                        <Textarea
                          id="milestoneDescription"
                          value={newMilestone.description}
                          onChange={(e) => setNewMilestone({...newMilestone, description: e.target.value})}
                          placeholder="Optional description"
                          rows={3}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="milestoneStatus">Status</Label>
                          <select
                            id="milestoneStatus"
                            className="w-full px-3 py-2 border rounded-md bg-background"
                            value={newMilestone.status}
                            onChange={(e) => setNewMilestone({...newMilestone, status: e.target.value as "completed" | "in-progress" | "upcoming"})}
                          >
                            <option value="upcoming">Upcoming</option>
                            <option value="in-progress">In Progress</option>
                            <option value="completed">Completed</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="milestoneTargetDate">Target Date *</Label>
                          <Input
                            id="milestoneTargetDate"
                            type="date"
                            value={newMilestone.targetDate}
                            onChange={(e) => setNewMilestone({...newMilestone, targetDate: e.target.value})}
                            required
                          />
                        </div>
                      </div>

                      {newMilestone.status === "completed" && (
                        <div className="space-y-2">
                          <Label htmlFor="milestoneCompletedDate">Completed Date</Label>
                          <Input
                            id="milestoneCompletedDate"
                            type="date"
                            value={newMilestone.completedDate}
                            onChange={(e) => setNewMilestone({...newMilestone, completedDate: e.target.value})}
                          />
                        </div>
                      )}

                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsAddMilestoneDialogOpen(false)
                            setNewMilestone({
                              clientId: "",
                              title: "",
                              description: "",
                              status: "upcoming",
                              targetDate: "",
                              completedDate: "",
                            })
                          }}
                          disabled={isSubmitting}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting ? (
                            <>
                              <span className="animate-spin mr-2">⏳</span>
                              Creating...
                            </>
                          ) : (
                            'Create Milestone'
                          )}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

          <ModuleWidgetCanvas
            widgets={layout.widgets}
            catalog={surfaceConfig.catalog}
            customizeMode={isCustomizeMode}
            onLayoutChange={onLayoutChange}
            onRemoveWidget={removeWidget}
            rowHeight={36}
            renderWidget={(widgetId) => {
              if (widgetId === 'metric_upcoming') {
                return (
                  <Card className="h-full flex flex-col justify-center">
                    <CardContent className="py-4">
                      <p className="text-sm text-muted-foreground">Upcoming</p>
                      <p className="text-2xl font-bold">
                        {milestones.filter((m) => m.status === 'upcoming').length}
                      </p>
                    </CardContent>
                  </Card>
                )
              }

              if (widgetId === 'metric_in_progress') {
                return (
                  <Card className="h-full flex flex-col justify-center">
                    <CardContent className="py-4">
                      <p className="text-sm text-muted-foreground">In progress</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {milestones.filter((m) => m.status === 'in-progress').length}
                      </p>
                    </CardContent>
                  </Card>
                )
              }

              if (widgetId === 'metric_completed') {
                return (
                  <Card className="h-full flex flex-col justify-center">
                    <CardContent className="py-4">
                      <p className="text-sm text-muted-foreground">Completed</p>
                      <p className="text-2xl font-bold text-green-600">
                        {milestones.filter((m) => m.status === 'completed').length}
                      </p>
                    </CardContent>
                  </Card>
                )
              }

              if (widgetId === 'milestone_filters') {
                return (
                  <div className="h-full overflow-auto flex items-center gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search milestones by title or client..."
                        className="pl-10"
                        value={milestonesSearchQuery}
                        onChange={(e) => setMilestonesSearchQuery(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant={milestonesFilterStatus === "all" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setMilestonesFilterStatus("all")}
                      >
                        All ({milestones.length})
                      </Button>
                      <Button
                        variant={milestonesFilterStatus === "upcoming" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setMilestonesFilterStatus("upcoming")}
                      >
                        Upcoming
                      </Button>
                      <Button
                        variant={milestonesFilterStatus === "in-progress" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setMilestonesFilterStatus("in-progress")}
                      >
                        In Progress
                      </Button>
                      <Button
                        variant={milestonesFilterStatus === "completed" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setMilestonesFilterStatus("completed")}
                      >
                        Completed
                      </Button>
                    </div>
                  </div>
                )
              }

              if (widgetId === 'milestone_table') {
                return (
              <div className="h-full overflow-auto">
              {filteredMilestonesTab.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No milestones found</h3>
                  <p className="text-muted-foreground mb-4">
                    {milestonesSearchQuery || milestonesFilterStatus !== "all"
                      ? "Try adjusting your search or filters"
                      : "Get started by creating your first milestone"}
                  </p>
                  {milestonesSearchQuery || milestonesFilterStatus !== "all" ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setMilestonesSearchQuery("")
                        setMilestonesFilterStatus("all")
                      }}
                    >
                      Clear Filters
                    </Button>
                  ) : (
                    <Button onClick={() => setIsAddMilestoneDialogOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Your First Milestone
                    </Button>
                  )}
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Milestone</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Target Date</TableHead>
                        <TableHead>Completed Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMilestonesTab.map((milestone) => (
                        <TableRow key={milestone.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{milestone.title}</div>
                              {milestone.description && (
                                <div className="text-sm text-muted-foreground mt-1">
                                  {milestone.description}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {milestone.client ? milestone.client.name : 'Unknown Client'}
                          </TableCell>
                          <TableCell>
                            {getMilestoneStatusBadge(milestone.status)}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {formatDateOnly(milestone.target_date)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {milestone.completed_date ? (
                              <div className="text-sm">
                                {formatDateOnly(milestone.completed_date)}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditMilestone(milestone)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteMilestone(milestone.id)}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              </div>
                )
              }

              return null
            }}
          />

          {/* Edit Milestone Dialog */}
          <Dialog open={isEditMilestoneDialogOpen} onOpenChange={setIsEditMilestoneDialogOpen}>
            <DialogContent className="max-w-md">
              {selectedMilestone && (
                <>
                  <DialogHeader>
                    <DialogTitle>Edit Milestone</DialogTitle>
                    <DialogDescription>
                      Update milestone details
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSaveMilestoneChanges} className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="editMilestoneTitle">Milestone Title *</Label>
                      <Input
                        id="editMilestoneTitle"
                        value={editMilestoneData.title}
                        onChange={(e) => setEditMilestoneData({...editMilestoneData, title: e.target.value})}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="editMilestoneDescription">Description</Label>
                      <Textarea
                        id="editMilestoneDescription"
                        value={editMilestoneData.description}
                        onChange={(e) => setEditMilestoneData({...editMilestoneData, description: e.target.value})}
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="editMilestoneStatus">Status</Label>
                        <select
                          id="editMilestoneStatus"
                          className="w-full px-3 py-2 border rounded-md bg-background"
                          value={editMilestoneData.status}
                          onChange={(e) => setEditMilestoneData({...editMilestoneData, status: e.target.value as "completed" | "in-progress" | "upcoming"})}
                        >
                          <option value="upcoming">Upcoming</option>
                          <option value="in-progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="editMilestoneTargetDate">Target Date *</Label>
                        <Input
                          id="editMilestoneTargetDate"
                          type="date"
                          value={editMilestoneData.targetDate}
                          onChange={(e) => setEditMilestoneData({...editMilestoneData, targetDate: e.target.value})}
                          required
                        />
                      </div>
                    </div>

                    {editMilestoneData.status === "completed" && (
                      <div className="space-y-2">
                        <Label htmlFor="editMilestoneCompletedDate">Completed Date</Label>
                        <Input
                          id="editMilestoneCompletedDate"
                          type="date"
                          value={editMilestoneData.completedDate}
                          onChange={(e) => setEditMilestoneData({...editMilestoneData, completedDate: e.target.value})}
                        />
                      </div>
                    )}

                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsEditMilestoneDialogOpen(false)
                          setSelectedMilestone(null)
                        }}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <span className="animate-spin mr-2">⏳</span>
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="interactions">
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

          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Communication History</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Track all client interactions and communications
              </p>
            </div>
            <Dialog open={isAddInteractionDialogOpen} onOpenChange={setIsAddInteractionDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Log Interaction
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Log New Interaction</DialogTitle>
                      <DialogDescription>
                        Record a call, email, or visit
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddInteraction} className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="interactionClient">Customer *</Label>
                        <select
                          id="interactionClient"
                          className="w-full px-3 py-2 border rounded-md bg-background"
                          value={newInteraction.clientId}
                          onChange={(e) => setNewInteraction({...newInteraction, clientId: e.target.value})}
                          required
                        >
                          <option value="">Select a customer</option>
                          {clients.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="interactionType">Type</Label>
                          <select
                            id="interactionType"
                            className="w-full px-3 py-2 border rounded-md bg-background"
                            value={newInteraction.type}
                            onChange={(e) => setNewInteraction({...newInteraction, type: e.target.value as "email" | "call" | "meeting"})}
                          >
                            <option value="email">Email</option>
                            <option value="call">Call</option>
                            <option value="meeting">Visit</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="interactionDate">Date *</Label>
                          <Input
                            id="interactionDate"
                            type="date"
                            value={newInteraction.interactionDate}
                            onChange={(e) => setNewInteraction({...newInteraction, interactionDate: e.target.value})}
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="interactionSubject">Subject *</Label>
                        <Input
                          id="interactionSubject"
                          value={newInteraction.subject}
                          onChange={(e) => setNewInteraction({...newInteraction, subject: e.target.value})}
                          placeholder="e.g., Appointment, follow-up call, quote"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="interactionDescription">Notes</Label>
                        <Textarea
                          id="interactionDescription"
                          value={newInteraction.description}
                          onChange={(e) => setNewInteraction({...newInteraction, description: e.target.value})}
                          placeholder="Add details about the interaction..."
                          rows={4}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="interactionCSM">CSM</Label>
                        <select
                          id="interactionCSM"
                          className="w-full px-3 py-2 border rounded-md bg-background"
                          value={newInteraction.csmId}
                          onChange={(e) => setNewInteraction({...newInteraction, csmId: e.target.value})}
                        >
                          <option value="">Not assigned</option>
                          {csmUsers.map((csm) => (
                            <option key={csm.id} value={csm.id}>
                              {csm.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsAddInteractionDialogOpen(false)
                            setNewInteraction({
                              clientId: "",
                              type: "email",
                              subject: "",
                              description: "",
                              csmId: "",
                              interactionDate: getTodayDateKey(),
                            })
                          }}
                          disabled={isSubmitting}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting ? (
                            <>
                              <span className="animate-spin mr-2">⏳</span>
                              Logging...
                            </>
                          ) : (
                            'Log Interaction'
                          )}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

          <ModuleWidgetCanvas
            widgets={layout.widgets}
            catalog={surfaceConfig.catalog}
            customizeMode={isCustomizeMode}
            onLayoutChange={onLayoutChange}
            onRemoveWidget={removeWidget}
            rowHeight={36}
            renderWidget={(widgetId) => {
              if (widgetId === 'metric_emails') {
                return (
                  <Card className="h-full flex flex-col justify-center">
                    <CardContent className="py-4">
                      <p className="text-sm text-muted-foreground">Emails</p>
                      <p className="text-2xl font-bold">
                        {interactions.filter((i) => i.type === 'email').length}
                      </p>
                    </CardContent>
                  </Card>
                )
              }

              if (widgetId === 'metric_calls') {
                return (
                  <Card className="h-full flex flex-col justify-center">
                    <CardContent className="py-4">
                      <p className="text-sm text-muted-foreground">Calls</p>
                      <p className="text-2xl font-bold">
                        {interactions.filter((i) => i.type === 'call').length}
                      </p>
                    </CardContent>
                  </Card>
                )
              }

              if (widgetId === 'metric_meetings') {
                return (
                  <Card className="h-full flex flex-col justify-center">
                    <CardContent className="py-4">
                      <p className="text-sm text-muted-foreground">Meetings</p>
                      <p className="text-2xl font-bold">
                        {interactions.filter((i) => i.type === 'meeting').length}
                      </p>
                    </CardContent>
                  </Card>
                )
              }

              if (widgetId === 'interaction_filters') {
                return (
                  <div className="h-full overflow-auto flex items-center gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search interactions by subject, client, or CSM..."
                        className="pl-10"
                        value={interactionsSearchQuery}
                        onChange={(e) => setInteractionsSearchQuery(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant={interactionsFilterType === "all" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setInteractionsFilterType("all")}
                      >
                        All ({interactions.length})
                      </Button>
                      <Button
                        variant={interactionsFilterType === "email" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setInteractionsFilterType("email")}
                      >
                        <Mail className="w-4 h-4 mr-1" />
                        Email
                      </Button>
                      <Button
                        variant={interactionsFilterType === "call" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setInteractionsFilterType("call")}
                      >
                        <Phone className="w-4 h-4 mr-1" />
                        Call
                      </Button>
                      <Button
                        variant={interactionsFilterType === "meeting" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setInteractionsFilterType("meeting")}
                      >
                        <Users className="w-4 h-4 mr-1" />
                        Visit
                      </Button>
                    </div>
                  </div>
                )
              }

              if (widgetId === 'interaction_table') {
                return (
              <div className="h-full overflow-auto">
              {filteredInteractionsTab.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No interactions found</h3>
                  <p className="text-muted-foreground mb-4">
                    {interactionsSearchQuery || interactionsFilterType !== "all"
                      ? "Try adjusting your search or filters"
                      : "Get started by logging your first interaction"}
                  </p>
                  {interactionsSearchQuery || interactionsFilterType !== "all" ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setInteractionsSearchQuery("")
                        setInteractionsFilterType("all")
                      }}
                    >
                      Clear Filters
                    </Button>
                  ) : (
                    <Button onClick={() => setIsAddInteractionDialogOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Log Your First Interaction
                    </Button>
                  )}
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Assigned to</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInteractionsTab.map((interaction) => (
                        <TableRow key={interaction.id}>
                          <TableCell>
                            <div className="text-sm">
                              {formatDateOnly(interaction.interaction_date)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getInteractionTypeBadge(interaction.type)}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{interaction.subject}</div>
                              {interaction.description && (
                                <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                  {interaction.description}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {interaction.client ? interaction.client.name : 'Unknown Client'}
                          </TableCell>
                          <TableCell>
                            {interaction.csm ? (
                              <div className="flex items-center gap-2">
                                {interaction.csm.avatar && (
                                  <img
                                    src={interaction.csm.avatar}
                                    alt={interaction.csm.name}
                                    className="w-6 h-6 rounded-full"
                                  />
                                )}
                                <span className="text-sm">{interaction.csm.name}</span>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditInteraction(interaction)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteInteraction(interaction.id)}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              </div>
                )
              }

              return null
            }}
          />

          {/* Edit Interaction Dialog */}
          <Dialog open={isEditInteractionDialogOpen} onOpenChange={setIsEditInteractionDialogOpen}>
            <DialogContent className="max-w-md">
              {selectedInteraction && (
                <>
                  <DialogHeader>
                    <DialogTitle>Edit Interaction</DialogTitle>
                    <DialogDescription>
                      Update interaction details
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSaveInteractionChanges} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="editInteractionType">Type</Label>
                        <select
                          id="editInteractionType"
                          className="w-full px-3 py-2 border rounded-md bg-background"
                          value={editInteractionData.type}
                          onChange={(e) => setEditInteractionData({...editInteractionData, type: e.target.value as "email" | "call" | "meeting"})}
                        >
                          <option value="email">Email</option>
                          <option value="call">Call</option>
                          <option value="meeting">Visit</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="editInteractionDate">Date *</Label>
                        <Input
                          id="editInteractionDate"
                          type="date"
                          value={editInteractionData.interactionDate}
                          onChange={(e) => setEditInteractionData({...editInteractionData, interactionDate: e.target.value})}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="editInteractionSubject">Subject *</Label>
                      <Input
                        id="editInteractionSubject"
                        value={editInteractionData.subject}
                        onChange={(e) => setEditInteractionData({...editInteractionData, subject: e.target.value})}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="editInteractionDescription">Notes</Label>
                      <Textarea
                        id="editInteractionDescription"
                        value={editInteractionData.description}
                        onChange={(e) => setEditInteractionData({...editInteractionData, description: e.target.value})}
                        rows={4}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="editInteractionCSM">CSM</Label>
                      <select
                        id="editInteractionCSM"
                        className="w-full px-3 py-2 border rounded-md bg-background"
                        value={editInteractionData.csmId}
                        onChange={(e) => setEditInteractionData({...editInteractionData, csmId: e.target.value})}
                      >
                        <option value="">Not assigned</option>
                        {csmUsers.map((csm) => (
                          <option key={csm.id} value={csm.id}>
                            {csm.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsEditInteractionDialogOpen(false)
                          setSelectedInteraction(null)
                        }}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <span className="animate-spin mr-2">⏳</span>
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
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
          <CsAnalyticsTab
            clients={clients}
            tasks={tasks}
            interactions={interactions}
            milestones={milestones}
            stats={stats}
            kycSummary={kycSummary}
            accountRows={accountRows}
            crmStats={crmStats}
            crmDeals={crmDeals}
            crmStages={crmStages}
            crmCampaigns={crmCampaigns}
            crmLeads={crmLeads}
            csmUsers={csmUsers}
            onOpenClient={handleViewClientById}
            layout={{
              widgets: layout.widgets,
              catalog: surfaceConfig.catalog,
              customizeMode: isCustomizeMode,
              onLayoutChange,
              onRemoveWidget: removeWidget,
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Global View Client Dialog - Available from any tab */}
      <Dialog
        open={isViewDialogOpen}
        onOpenChange={(open) => {
          setIsViewDialogOpen(open)
          if (!open) syncClientUrl(null)
        }}
      >
        <DialogContent size="lg">
          {selectedClient && (
            <>
              <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-5 pr-12">
                <DialogTitle className="text-2xl">{selectedClient.name}</DialogTitle>
                <DialogDescription className="text-sm">
                  {selectedClient.industry} • ID: {selectedClient.id.substring(0, 8)}
                </DialogDescription>
              </DialogHeader>
              
              <DialogBody className="px-6 py-4">
                <CustomerDetailCanvas
                  client={selectedClient}
                  taskCounts={getClientTaskCounts(selectedClient.id)}
                  milestoneCounts={getClientMilestoneCounts(selectedClient.id)}
                  interactionsCount={interactions.filter((i) => i.client_id === selectedClient.id).length}
                  getHealthColor={getHealthColor}
                  getHealthBadge={getHealthBadge}
                  getTimeSince={getTimeSince}
                  onClientUpdated={() => void refreshClients()}
                />
              </DialogBody>
              
              <DialogFooter className="shrink-0 border-t px-6 py-4">
                <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
                  Close
                </Button>
                <Button onClick={() => {
                  const client = selectedClient
                  setIsViewDialogOpen(false)
                  setTimeout(() => { if (client) handleEditClient(client) }, 150)
                }}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Client
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </MotionPage>
  )
}
