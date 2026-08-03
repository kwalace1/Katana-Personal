import { getTodayDateKey, formatDateOnly } from '@/lib/due-date-utils'
import { useState, useEffect } from 'react'
import { MotionPage } from '@/components/motion-page'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Download, RefreshCw, Plus, Clock, BarChart3, Package, ChevronRight, Cpu, Settings } from "lucide-react"
import { useWidgetLayout } from "@/hooks/useWidgetLayout"
import { WidgetSettingsDialog } from "@/components/projects/widgets/WidgetSettingsDialog"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts'

export default function ManufacturingPage() {
  const [activeTab, setActiveTab] = useState("overview")
  const [isAddMachineOpen, setIsAddMachineOpen] = useState(false)
  const [isMachineDetailOpen, setIsMachineDetailOpen] = useState(false)
  const [selectedMachine, setSelectedMachine] = useState<any>(null)
  const [refreshing, setRefreshing] = useState(false)
  
  // New machine form state
  const [newMachineId, setNewMachineId] = useState("")
  const [newMachineCell, setNewMachineCell] = useState("")
  const [newMachineType, setNewMachineType] = useState("")
  
  // Work order states
  const [isNewWorkOrderOpen, setIsNewWorkOrderOpen] = useState(false)
  const [isEditWorkOrderOpen, setIsEditWorkOrderOpen] = useState(false)
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<any>(null)
  const [newWOSku, setNewWOSku] = useState("")
  const [newWOQuantity, setNewWOQuantity] = useState("")
  const [newWOPriority, setNewWOPriority] = useState("medium")
  const [newWODueDate, setNewWODueDate] = useState("")
  const [newWONotes, setNewWONotes] = useState("")
  
  // Quality states
  const [isNewInspectionOpen, setIsNewInspectionOpen] = useState(false)
  const [newInspectionPart, setNewInspectionPart] = useState("")
  const [newInspectionResult, setNewInspectionResult] = useState("")
  const [newInspectionNotes, setNewInspectionNotes] = useState("")
  
  // Maintenance states
  const [isNewMaintenanceOpen, setIsNewMaintenanceOpen] = useState(false)
  const [newMaintenanceMachine, setNewMaintenanceMachine] = useState("")
  const [newMaintenanceType, setNewMaintenanceType] = useState("")
  const [newMaintenanceDate, setNewMaintenanceDate] = useState("")
  const [newMaintenanceNotes, setNewMaintenanceNotes] = useState("")

  // Analytics widget settings
  const [isAnalyticsWidgetSettingsOpen, setIsAnalyticsWidgetSettingsOpen] = useState(false)
  
  // Analytics widget layout
  const analyticsWidgetLayout = useWidgetLayout({
    defaultLayout: [
      { id: 'analytics-kpis', type: 'AnalyticsKPIs', visible: true },
      { id: 'production-efficiency', type: 'ProductionEfficiencyTrends', visible: true },
      { id: 'machine-performance', type: 'MachinePerformanceBreakdown', visible: true },
      { id: 'key-performance-indicators', type: 'KeyPerformanceIndicators', visible: true },
      { id: 'data-export', type: 'DataExportOptions', visible: true },
    ],
    storageKey: 'zmo-analytics-widgets'
  })

  // Mock data
  const kpis = {
    oee: { value: 85.2, availability: 92, performance: 88, quality: 95 },
    throughput: 24.5,
    scrap: 2.1,
    alarms: 0,
  }

  const [machines, setMachines] = useState<Array<{
    id: string
    status: string
    cell: string
    goodParts: number
    scrap: number
    oee: number
    type: string
  }>>([])

  const downtimeReasons = [
    { reason: "Equipment Failure", minutes: 45, events: 3 },
    { reason: "Setup/Changeover", minutes: 32, events: 5 },
    { reason: "Material Shortage", minutes: 18, events: 2 },
    { reason: "Quality Issue", minutes: 12, events: 1 },
  ]

  const [workOrders, setWorkOrders] = useState([
    {
      id: "WO-1234",
      sku: "PART-A-001",
      quantity: 500,
      completed: 245,
      status: "In Progress",
      eta: "2h 15m",
      priority: "high",
      dueDate: "2025-01-26",
      assignedMachine: "CNC-01",
      notes: "Rush order for customer delivery",
    },
    {
      id: "WO-1235",
      sku: "PART-B-002",
      quantity: 300,
      completed: 198,
      status: "In Progress",
      eta: "1h 45m",
      priority: "medium",
      dueDate: "2025-01-27",
      assignedMachine: "CNC-02",
      notes: "Standard production run",
    },
    {
      id: "WO-1236",
      sku: "PART-C-003",
      quantity: 400,
      completed: 0,
      status: "Queued",
      eta: "4h 30m",
      priority: "low",
      dueDate: "2025-01-28",
      assignedMachine: "Press-01",
      notes: "Inventory replenishment",
    },
  ])

  const [qualityInspections, setQualityInspections] = useState([
    {
      id: "QI-001",
      partNumber: "PART-A-001",
      inspectionDate: "2025-01-24",
      inspector: "John Smith",
      result: "Pass",
      defects: 0,
      sampleSize: 50,
      notes: "All dimensions within tolerance",
    },
    {
      id: "QI-002", 
      partNumber: "PART-B-002",
      inspectionDate: "2025-01-24",
      inspector: "Mary Johnson",
      result: "Fail",
      defects: 3,
      sampleSize: 50,
      notes: "Surface finish issues detected",
    },
    {
      id: "QI-003",
      partNumber: "PART-C-003", 
      inspectionDate: "2025-01-23",
      inspector: "John Smith",
      result: "Pass",
      defects: 1,
      sampleSize: 50,
      notes: "Minor cosmetic defect, within acceptable limits",
    },
  ])

  const [maintenanceTasks, setMaintenanceTasks] = useState([
    {
      id: "MT-001",
      machine: "CNC-01",
      type: "Preventive",
      description: "Monthly lubrication and calibration",
      scheduledDate: "2025-01-25",
      status: "Scheduled",
      technician: "Mike Wilson",
      estimatedHours: 4,
      notes: "Check spindle alignment",
    },
    {
      id: "MT-002",
      machine: "Press-01", 
      type: "Corrective",
      description: "Replace hydraulic seals",
      scheduledDate: "2025-01-24",
      status: "In Progress",
      technician: "Sarah Davis",
      estimatedHours: 6,
      notes: "Seals showing wear, replacement needed",
    },
    {
      id: "MT-003",
      machine: "CNC-02",
      type: "Preventive",
      description: "Quarterly inspection and cleaning",
      scheduledDate: "2025-01-26",
      status: "Completed",
      technician: "Mike Wilson", 
      estimatedHours: 3,
      notes: "All systems checked, no issues found",
    },
  ])

  // Chart data preparation
  const oeeTrendData = [
    { day: 'Day 1', oee: 82 },
    { day: 'Day 2', oee: 85 },
    { day: 'Day 3', oee: 83 },
    { day: 'Day 4', oee: 87 },
    { day: 'Day 5', oee: 86 },
    { day: 'Day 6', oee: 84 },
    { day: 'Day 7', oee: 85 },
  ]

  const downtimeChartData = downtimeReasons.map(r => ({
    name: r.reason,
    minutes: r.minutes,
    events: r.events,
  }))

  const machinePerformanceData = machines.map(m => ({
    name: m.id,
    oee: m.oee,
    goodParts: m.goodParts,
    scrap: m.scrap,
  }))

  const workOrderStatusData = [
    { name: 'Queued', value: workOrders.filter(wo => wo.status === 'Queued').length, color: '#3b82f6' },
    { name: 'In Progress', value: workOrders.filter(wo => wo.status === 'In Progress').length, color: '#eab308' },
    { name: 'Completed', value: workOrders.filter(wo => wo.status === 'Completed').length, color: '#22c55e' },
    { name: 'On Hold', value: workOrders.filter(wo => wo.status === 'On Hold').length, color: '#f59e0b' },
  ].filter(item => item.value > 0)

  const workOrderProgressData = workOrders.map(wo => ({
    name: wo.id,
    completed: wo.completed,
    remaining: wo.quantity - wo.completed,
    progress: ((wo.completed / wo.quantity) * 100).toFixed(1),
  }))

  const qualityResultData = [
    { name: 'Pass', value: qualityInspections.filter(qi => qi.result === 'Pass').length, color: '#22c55e' },
    { name: 'Fail', value: qualityInspections.filter(qi => qi.result === 'Fail').length, color: '#ef4444' },
  ].filter(item => item.value > 0)

  const qualityTrendData = [
    { day: 'Day 1', passRate: 95 },
    { day: 'Day 2', passRate: 97 },
    { day: 'Day 3', passRate: 94 },
    { day: 'Day 4', passRate: 96 },
    { day: 'Day 5', passRate: 98 },
    { day: 'Day 6', passRate: 95 },
    { day: 'Day 7', passRate: 97 },
  ]

  const maintenanceStatusData = [
    { name: 'Scheduled', value: maintenanceTasks.filter(mt => mt.status === 'Scheduled').length, color: '#3b82f6' },
    { name: 'In Progress', value: maintenanceTasks.filter(mt => mt.status === 'In Progress').length, color: '#eab308' },
    { name: 'Completed', value: maintenanceTasks.filter(mt => mt.status === 'Completed').length, color: '#22c55e' },
  ].filter(item => item.value > 0)

  const machineOeeBreakdownData = machines.map(m => ({
    name: m.id,
    availability: 92,
    performance: 88,
    quality: 95,
  }))

  // Load machines from database
  const loadMachines = async () => {
    try {
      const { data, error } = await supabase
        .from('zmo_machines')
        .select('*')
        .order('machine_id', { ascending: true })

      if (error) throw error

      if (data && data.length > 0) {
        const formattedMachines = data.map(m => ({
          id: m.machine_id,
          status: m.status,
          cell: m.cell,
          goodParts: m.good_parts,
          scrap: m.scrap,
          oee: Number(m.oee),
          type: m.machine_type,
        }))
        setMachines(formattedMachines)
      }
    } catch (error) {
      console.error('Error loading machines:', error)
    }
  }

  // Load machines on mount
  useEffect(() => {
    loadMachines()
  }, [])

  // Handler functions
  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await loadMachines()
      setRefreshing(false)
      alert("Manufacturing data refreshed successfully!")
    } catch (error) {
      console.error('Error refreshing:', error)
      setRefreshing(false)
      alert("Failed to refresh data. Please try again.")
    }
  }

  const handleDownloadCSV = () => {
    try {
      const headers = ['Machine ID', 'Status', 'Cell', 'Good Parts', 'Scrap', 'OEE %', 'Type']
      const csvData = [
        headers.join(','),
        ...machines.map(machine => [
          machine.id,
          machine.status,
          machine.cell,
          machine.goodParts,
          machine.scrap,
          machine.oee,
          `"${machine.type}"`
        ].join(','))
      ].join('\n')

      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `manufacturing_data_${getTodayDateKey()}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Error exporting manufacturing data:', error)
      alert('Failed to export data. Please try again.')
    }
  }

  const handleAddMachine = async () => {
    if (!newMachineId || !newMachineCell || !newMachineType) {
      alert("Please fill in all required fields")
      return
    }

    try {
      const { data, error } = await supabase
        .from('zmo_machines')
        .insert({
          machine_id: newMachineId,
          status: 'IDLE',
          cell: newMachineCell,
          machine_type: newMachineType,
          good_parts: 0,
          scrap: 0,
          oee: 0,
          availability: 0,
          performance: 0,
          quality: 0,
        })
        .select()
        .single()

      if (error) throw error

      const newMachine = {
        id: data.machine_id,
        status: data.status,
        cell: data.cell,
        goodParts: data.good_parts,
        scrap: data.scrap,
        oee: Number(data.oee),
        type: data.machine_type,
      }

      setMachines([...machines, newMachine])
      
      // Reset form
      setNewMachineId("")
      setNewMachineCell("")
      setNewMachineType("")
      setIsAddMachineOpen(false)
    } catch (error: any) {
      console.error('Error adding machine:', error)
      if (error.code === '23505') {
        alert("Machine ID already exists. Please use a different ID.")
      } else {
        alert("Failed to add machine. Please try again.")
      }
    }
  }

  const handleMachineDetail = (machine: any) => {
    setSelectedMachine(machine)
    setIsMachineDetailOpen(true)
  }

  const handleAddWorkOrder = () => {
    if (!newWOSku || !newWOQuantity || !newWODueDate) {
      alert("Please fill in all required fields")
      return
    }

    const maxId = Math.max(...workOrders.map(wo => parseInt(wo.id.split('-')[1])))
    const newWorkOrder = {
      id: `WO-${maxId + 1}`,
      sku: newWOSku,
      quantity: parseInt(newWOQuantity),
      completed: 0,
      status: "Queued",
      eta: "TBD",
      priority: newWOPriority,
      dueDate: newWODueDate,
      assignedMachine: "Unassigned",
      notes: newWONotes,
    }

    setWorkOrders([...workOrders, newWorkOrder])
    
    // Reset form
    setNewWOSku("")
    setNewWOQuantity("")
    setNewWOPriority("medium")
    setNewWODueDate("")
    setNewWONotes("")
    setIsNewWorkOrderOpen(false)
  }

  const handleEditWorkOrder = (workOrder: any) => {
    setSelectedWorkOrder(workOrder)
    setIsEditWorkOrderOpen(true)
  }

  const updateWorkOrderProgress = (woId: string, newCompleted: number) => {
    setWorkOrders(workOrders.map(wo => 
      wo.id === woId 
        ? { 
            ...wo, 
            completed: Math.min(newCompleted, wo.quantity),
            status: newCompleted >= wo.quantity ? "Completed" : "In Progress"
          }
        : wo
    ))
  }

  // Quality handlers
  const handleAddInspection = () => {
    if (!newInspectionPart || !newInspectionResult) {
      alert("Please fill in all required fields")
      return
    }

    const maxId = Math.max(...qualityInspections.map(qi => parseInt(qi.id.split('-')[1])))
    const newInspection = {
      id: `QI-${String(maxId + 1).padStart(3, '0')}`,
      partNumber: newInspectionPart,
      inspectionDate: getTodayDateKey(),
      inspector: "Current User",
      result: newInspectionResult,
      defects: newInspectionResult === "Fail" ? 1 : 0,
      sampleSize: 50,
      notes: newInspectionNotes,
    }

    setQualityInspections([newInspection, ...qualityInspections])
    
    // Reset form
    setNewInspectionPart("")
    setNewInspectionResult("")
    setNewInspectionNotes("")
    setIsNewInspectionOpen(false)
  }

  // Maintenance handlers
  const handleAddMaintenance = () => {
    if (!newMaintenanceMachine || !newMaintenanceType || !newMaintenanceDate) {
      alert("Please fill in all required fields")
      return
    }

    const maxId = Math.max(...maintenanceTasks.map(mt => parseInt(mt.id.split('-')[1])))
    const newTask = {
      id: `MT-${String(maxId + 1).padStart(3, '0')}`,
      machine: newMaintenanceMachine,
      type: newMaintenanceType,
      description: `${newMaintenanceType} maintenance for ${newMaintenanceMachine}`,
      scheduledDate: newMaintenanceDate,
      status: "Scheduled",
      technician: "Unassigned",
      estimatedHours: newMaintenanceType === "Preventive" ? 4 : 6,
      notes: newMaintenanceNotes,
    }

    setMaintenanceTasks([...maintenanceTasks, newTask])
    
    // Reset form
    setNewMaintenanceMachine("")
    setNewMaintenanceType("")
    setNewMaintenanceDate("")
    setNewMaintenanceNotes("")
    setIsNewMaintenanceOpen(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "RUN":
        return "bg-green-500"
      case "IDLE":
        return "bg-yellow-500"
      case "DOWN":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "RUN":
        return "default"
      case "IDLE":
        return "secondary"
      case "DOWN":
        return "destructive"
      default:
        return "outline"
    }
  }

  return (
    <MotionPage subtle className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-6 px-6 mb-6">
        <div className="py-6">
          <div className="flex items-center justify-between">
            <div>
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <span className="hover:text-foreground cursor-pointer transition-colors">Home</span>
                <ChevronRight className="h-4 w-4" />
                <span className="text-foreground">Katana Facilities</span>
              </div>
              
              {/* Title with Icon */}
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2.5 rounded-lg">
                  <Cpu className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-3xl font-bold">Katana Facilities</h1>
              </div>
              
              <p className="text-muted-foreground mt-2">Katana Facilities — smart factory operations</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleDownloadCSV}>
                <Download className="w-4 h-4 mr-2" />
                Download CSV
              </Button>
              <Button 
                variant="outline" 
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
              <Dialog open={isAddMachineOpen} onOpenChange={setIsAddMachineOpen}>
                <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Machine
              </Button>
                </DialogTrigger>
              </Dialog>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">OEE Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-500">{kpis.oee.value}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              A {kpis.oee.availability}% · P {kpis.oee.performance}% · Q {kpis.oee.quality}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Throughput/hr</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{kpis.throughput}</div>
            <p className="text-xs text-muted-foreground mt-1">Good parts today / hours elapsed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Scrap %</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-500">{kpis.scrap}%</div>
            <p className="text-xs text-muted-foreground mt-1">Total scrap vs total produced</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Alarms</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-500">{kpis.alarms}</div>
            <p className="text-xs text-muted-foreground mt-1">All clear</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="machines">Machines</TabsTrigger>
          <TabsTrigger value="workorders">Work Orders</TabsTrigger>
          <TabsTrigger value="quality">Quality</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Machine Grid */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-lg font-semibold">Machine Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {machines.map((machine) => (
                  <Card key={machine.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{machine.id}</CardTitle>
                        <Badge variant={getStatusBadge(machine.status)} className={getStatusColor(machine.status)}>
                          {machine.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{machine.cell}</p>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Good Parts:</span>
                        <span className="font-semibold">{machine.goodParts}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Scrap:</span>
                        <span className="font-semibold text-red-400">{machine.scrap}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">OEE:</span>
                        <span className="font-semibold text-green-400">{machine.oee}%</span>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="w-full mt-2 bg-transparent"
                        onClick={() => handleMachineDetail(machine)}
                      >
                        Details
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* OEE Trend Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    OEE 7-Day Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={oeeTrendData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="day" 
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis 
                        domain={[0, 100]}
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        label={{ value: 'OEE %', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px'
                        }}
                        formatter={(value: any) => [`${(Number(value) || 0)}%`, 'OEE']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="oee" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              {/* Top Downtime */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Top Downtime Today
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={downtimeChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis 
                        type="category" 
                        dataKey="name" 
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                        width={100}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px'
                        }}
                        formatter={(value: any) => [`${(Number(value) || 0)} min`, 'Downtime']}
                      />
                      <Bar dataKey="minutes" fill="#ef4444" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Work in Progress */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Work in Progress
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {workOrders.slice(0, 2).map((wo) => (
                    <div key={wo.id} className="p-3 bg-muted rounded-lg space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-semibold">{wo.id}</p>
                          <p className="text-xs text-muted-foreground">{wo.sku}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {wo.status}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Progress</span>
                          <span>
                            {wo.completed}/{wo.quantity}
                          </span>
                        </div>
                        <div className="h-1.5 bg-background rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${(wo.completed / wo.quantity) * 100}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">ETA: {wo.eta}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="machines" className="space-y-6">
          {/* Machine Status Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-500">{machines.filter(m => m.status === 'RUN').length}</p>
                  <p className="text-sm text-muted-foreground">Running</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-yellow-500">{machines.filter(m => m.status === 'IDLE').length}</p>
                  <p className="text-sm text-muted-foreground">Idle</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-red-500">{machines.filter(m => m.status === 'DOWN').length}</p>
                  <p className="text-sm text-muted-foreground">Down</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold">{machines.length}</p>
                  <p className="text-sm text-muted-foreground">Total Machines</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Machine List */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Machine Monitoring</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleRefresh}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Dialog open={isAddMachineOpen} onOpenChange={setIsAddMachineOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Machine
                      </Button>
                    </DialogTrigger>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {machines.map((machine) => (
                  <Card key={machine.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-4 h-4 rounded-full ${getStatusColor(machine.status)}`}></div>
                        <div>
                          <h3 className="font-semibold">{machine.id}</h3>
                          <p className="text-sm text-muted-foreground">{machine.type} • {machine.cell}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">OEE</p>
                          <p className="text-lg font-bold text-green-500">{machine.oee}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Good Parts</p>
                          <p className="text-lg font-bold">{machine.goodParts}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground">Scrap</p>
                          <p className="text-lg font-bold text-red-500">{machine.scrap}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleMachineDetail(machine)}
                          >
                            Details
                          </Button>
                          <Button 
                            size="sm"
                            variant={machine.status === 'RUN' ? 'destructive' : 'default'}
                            onClick={async () => {
                              const newStatus = machine.status === 'RUN' ? 'IDLE' : 'RUN'
                              try {
                                const { error } = await supabase
                                  .from('zmo_machines')
                                  .update({ status: newStatus })
                                  .eq('machine_id', machine.id)

                                if (error) throw error

                                setMachines(machines.map(m => 
                                  m.id === machine.id 
                                    ? { ...m, status: newStatus }
                                    : m
                                ))
                              } catch (error) {
                                console.error('Error updating machine status:', error)
                                alert("Failed to update machine status. Please try again.")
                              }
                            }}
                          >
                            {machine.status === 'RUN' ? 'Stop' : 'Start'}
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    {/* Machine Performance Bars */}
                    <div className="mt-4 grid grid-cols-3 gap-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Availability</span>
                          <span className="font-medium">92%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500" style={{ width: '92%' }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Performance</span>
                          <span className="font-medium">88%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-yellow-500" style={{ width: '88%' }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-muted-foreground">Quality</span>
                          <span className="font-medium">95%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-green-500" style={{ width: '95%' }}></div>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
                
                {machines.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No machines registered yet.</p>
                    <Dialog open={isAddMachineOpen} onOpenChange={setIsAddMachineOpen}>
                      <DialogTrigger asChild>
                        <Button className="mt-2">
                          <Plus className="w-4 h-4 mr-2" />
                          Add First Machine
                        </Button>
                      </DialogTrigger>
                    </Dialog>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Machine Performance Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Machine Performance Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={machinePerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="name" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    domain={[0, 100]}
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    label={{ value: 'OEE %', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                    formatter={(value: any) => [`${(Number(value) || 0)}%`, 'OEE']}
                  />
                  <Legend />
                  <Bar dataKey="oee" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workorders" className="space-y-6">
          {/* Work Order Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-500">{workOrders.filter(wo => wo.status === 'Queued').length}</p>
                  <p className="text-sm text-muted-foreground">Queued</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-yellow-500">{workOrders.filter(wo => wo.status === 'In Progress').length}</p>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-500">{workOrders.filter(wo => wo.status === 'Completed').length}</p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold">{workOrders.length}</p>
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Work Order Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Work Order Status Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={workOrderStatusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {workOrderStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Work Order Progress Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Work Order Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={workOrderProgressData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="name" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="completed" stackId="a" fill="#22c55e" name="Completed" />
                  <Bar dataKey="remaining" stackId="a" fill="#e5e7eb" name="Remaining" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Work Orders Management */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Work Orders</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => {
                    try {
                      const headers = ['Work Order ID', 'SKU', 'Quantity', 'Completed', 'Status', 'Priority', 'Due Date', 'Assigned Machine', 'Progress %']
                      const csvData = [
                        headers.join(','),
                        ...workOrders.map(wo => [
                          wo.id,
                          wo.sku,
                          wo.quantity,
                          wo.completed,
                          wo.status,
                          wo.priority,
                          wo.dueDate,
                          wo.assignedMachine,
                          ((wo.completed / wo.quantity) * 100).toFixed(1)
                        ].join(','))
                      ].join('\n')

                      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' })
                      const link = document.createElement('a')
                      const url = URL.createObjectURL(blob)
                      link.setAttribute('href', url)
                      link.setAttribute('download', `work_orders_${getTodayDateKey()}.csv`)
                      link.style.visibility = 'hidden'
                      document.body.appendChild(link)
                      link.click()
                      document.body.removeChild(link)
                    } catch (error) {
                      alert('Failed to export work orders. Please try again.')
                    }
                  }}>
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                  <Dialog open={isNewWorkOrderOpen} onOpenChange={setIsNewWorkOrderOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        New Work Order
                      </Button>
                    </DialogTrigger>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {workOrders.map((wo) => {
                  const progressPercent = (wo.completed / wo.quantity) * 100
                  const isOverdue = new Date(wo.dueDate) < new Date() && wo.status !== 'Completed'
                  
                  return (
                    <Card key={wo.id} className={`p-4 ${isOverdue ? 'border-red-500/50 bg-red-500/5' : ''}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-4">
                          <div>
                            <h3 className="font-semibold">{wo.id}</h3>
                            <p className="text-sm text-muted-foreground">{wo.sku}</p>
                          </div>
                          <Badge 
                            variant="outline"
                            className={
                              wo.priority === "high" ? "border-red-500/20 text-red-600 bg-red-500/10" :
                              wo.priority === "medium" ? "border-yellow-500/20 text-yellow-600 bg-yellow-500/10" :
                              "border-blue-500/20 text-blue-600 bg-blue-500/10"
                            }
                          >
                            {wo.priority} priority
                          </Badge>
                          <Badge variant="outline">
                            {wo.status}
                          </Badge>
                          {isOverdue && (
                            <Badge variant="outline" className="border-red-500/20 text-red-600 bg-red-500/10">
                              Overdue
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleEditWorkOrder(wo)}
                          >
                            Edit
                          </Button>
                          <Button 
                            size="sm"
                            onClick={() => {
                              const newCompleted = wo.completed + Math.min(50, wo.quantity - wo.completed)
                              updateWorkOrderProgress(wo.id, newCompleted)
                            }}
                            disabled={wo.status === 'Completed'}
                          >
                            +50 Parts
                          </Button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-4 text-sm mb-3">
                        <div>
                          <span className="text-muted-foreground">Quantity:</span>
                          <span className="font-medium ml-1">{wo.quantity}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Completed:</span>
                          <span className="font-medium ml-1">{wo.completed}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Due:</span>
                          <span className={`font-medium ml-1 ${isOverdue ? 'text-red-600 font-bold' : 'text-foreground'}`}>
                            {formatDateOnly(wo.dueDate)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Machine:</span>
                          <span className="font-medium ml-1">{wo.assignedMachine}</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">{progressPercent.toFixed(1)}% ({wo.completed}/{wo.quantity})</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all ${
                              wo.status === 'Completed' ? 'bg-green-500' :
                              wo.status === 'In Progress' ? 'bg-primary' :
                              'bg-muted-foreground'
                            }`}
                            style={{ width: `${progressPercent}%` }}
                          ></div>
                        </div>
                      </div>

                      {wo.notes && (
                        <div className="mt-3 p-3 bg-muted/50 border border-border rounded-lg text-sm">
                          <span className="text-muted-foreground font-medium">Notes: </span>
                          <span className="text-foreground">{wo.notes}</span>
                        </div>
                      )}
                    </Card>
                  )
                })}

                {workOrders.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No work orders created yet.</p>
                    <Dialog open={isNewWorkOrderOpen} onOpenChange={setIsNewWorkOrderOpen}>
                      <DialogTrigger asChild>
                        <Button className="mt-2">
                          <Plus className="w-4 h-4 mr-2" />
                          Create First Work Order
                        </Button>
                      </DialogTrigger>
                    </Dialog>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quality" className="space-y-6">
          {/* Quality KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-500">
                    {((qualityInspections.filter(qi => qi.result === 'Pass').length / qualityInspections.length) * 100).toFixed(1)}%
                  </p>
                  <p className="text-sm text-muted-foreground">Pass Rate</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-red-500">
                    {qualityInspections.reduce((sum, qi) => sum + qi.defects, 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Defects</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold">{qualityInspections.length}</p>
                  <p className="text-sm text-muted-foreground">Inspections Today</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-500">
                    {qualityInspections.reduce((sum, qi) => sum + qi.sampleSize, 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Parts Inspected</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quality Result Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Quality Inspection Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={qualityResultData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {qualityResultData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Quality Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                7-Day Quality Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={qualityTrendData}>
                  <defs>
                    <linearGradient id="colorPassRate" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="day" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    domain={[90, 100]}
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    label={{ value: 'Pass Rate %', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                    formatter={(value: any) => [`${(Number(value) || 0)}%`, 'Pass Rate']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="passRate" 
                    stroke="#22c55e" 
                    fillOpacity={1} 
                    fill="url(#colorPassRate)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Quality Inspections */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Quality Inspections</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => {
                    try {
                      const headers = ['Inspection ID', 'Part Number', 'Date', 'Inspector', 'Result', 'Defects', 'Sample Size', 'Pass Rate %', 'Notes']
                      const csvData = [
                        headers.join(','),
                        ...qualityInspections.map(qi => [
                          qi.id,
                          qi.partNumber,
                          qi.inspectionDate,
                          `"${qi.inspector}"`,
                          qi.result,
                          qi.defects,
                          qi.sampleSize,
                          (((qi.sampleSize - qi.defects) / qi.sampleSize) * 100).toFixed(1),
                          `"${qi.notes}"`
                        ].join(','))
                      ].join('\n')

                      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' })
                      const link = document.createElement('a')
                      const url = URL.createObjectURL(blob)
                      link.setAttribute('href', url)
                      link.setAttribute('download', `quality_inspections_${getTodayDateKey()}.csv`)
                      link.style.visibility = 'hidden'
                      document.body.appendChild(link)
                      link.click()
                      document.body.removeChild(link)
                    } catch (error) {
                      alert('Failed to export quality data. Please try again.')
                    }
                  }}>
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                  <Dialog open={isNewInspectionOpen} onOpenChange={setIsNewInspectionOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        New Inspection
                      </Button>
                    </DialogTrigger>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {qualityInspections.map((inspection) => (
                  <Card key={inspection.id} className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-4">
                        <div>
                          <h3 className="font-semibold">{inspection.id}</h3>
                          <p className="text-sm text-muted-foreground">{inspection.partNumber}</p>
                        </div>
                        <Badge 
                          variant="outline"
                          className={
                            inspection.result === "Pass" 
                              ? "border-green-500/20 text-green-600 bg-green-500/10"
                              : "border-red-500/20 text-red-600 bg-red-500/10"
                          }
                        >
                          {inspection.result}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Inspector</p>
                        <p className="font-medium">{inspection.inspector}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4 text-sm mb-3">
                      <div>
                        <span className="text-muted-foreground">Date:</span>
                        <span className="font-medium ml-1">{formatDateOnly(inspection.inspectionDate)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Sample Size:</span>
                        <span className="font-medium ml-1">{inspection.sampleSize}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Defects:</span>
                        <span className={`font-medium ml-1 ${inspection.defects > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {inspection.defects}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Pass Rate:</span>
                        <span className="font-medium ml-1">
                          {(((inspection.sampleSize - inspection.defects) / inspection.sampleSize) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {inspection.notes && (
                      <div className="mt-3 p-3 bg-muted/50 border border-border rounded-lg text-sm">
                        <span className="text-muted-foreground font-medium">Notes: </span>
                        <span className="text-foreground">{inspection.notes}</span>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-6">
          {/* Maintenance KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-500">{maintenanceTasks.filter(mt => mt.status === 'Scheduled').length}</p>
                  <p className="text-sm text-muted-foreground">Scheduled</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-yellow-500">{maintenanceTasks.filter(mt => mt.status === 'In Progress').length}</p>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-500">{maintenanceTasks.filter(mt => mt.status === 'Completed').length}</p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold">{maintenanceTasks.reduce((sum, mt) => sum + mt.estimatedHours, 0)}</p>
                  <p className="text-sm text-muted-foreground">Total Hours</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Maintenance Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Maintenance Status Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={maintenanceStatusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {maintenanceStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Maintenance Tasks */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Maintenance Schedule</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => {
                    try {
                      const headers = ['Task ID', 'Machine', 'Type', 'Description', 'Scheduled Date', 'Status', 'Technician', 'Est. Hours', 'Notes']
                      const csvData = [
                        headers.join(','),
                        ...maintenanceTasks.map(mt => [
                          mt.id,
                          mt.machine,
                          mt.type,
                          `"${mt.description}"`,
                          mt.scheduledDate,
                          mt.status,
                          `"${mt.technician}"`,
                          mt.estimatedHours,
                          `"${mt.notes}"`
                        ].join(','))
                      ].join('\n')

                      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' })
                      const link = document.createElement('a')
                      const url = URL.createObjectURL(blob)
                      link.setAttribute('href', url)
                      link.setAttribute('download', `maintenance_schedule_${getTodayDateKey()}.csv`)
                      link.style.visibility = 'hidden'
                      document.body.appendChild(link)
                      link.click()
                      document.body.removeChild(link)
                    } catch (error) {
                      alert('Failed to export maintenance data. Please try again.')
                    }
                  }}>
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                  <Dialog open={isNewMaintenanceOpen} onOpenChange={setIsNewMaintenanceOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Schedule Maintenance
                      </Button>
                    </DialogTrigger>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {maintenanceTasks.map((task) => {
                  const isOverdue = new Date(task.scheduledDate) < new Date() && task.status !== 'Completed'
                  
                  return (
                    <Card key={task.id} className={`p-4 ${isOverdue ? 'border-red-500/50 bg-red-500/5' : ''}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-4">
                          <div>
                            <h3 className="font-semibold">{task.id}</h3>
                            <p className="text-sm text-muted-foreground">{task.machine}</p>
                          </div>
                          <Badge 
                            variant="outline"
                            className={
                              task.type === "Preventive" 
                                ? "border-blue-500/20 text-blue-600 bg-blue-500/10"
                                : "border-orange-500/20 text-orange-600 bg-orange-500/10"
                            }
                          >
                            {task.type}
                          </Badge>
                          <Badge variant="outline">
                            {task.status}
                          </Badge>
                          {isOverdue && (
                            <Badge variant="outline" className="border-red-500/20 text-red-600 bg-red-500/10">
                              Overdue
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm"
                            onClick={() => {
                              const newStatus = task.status === 'Scheduled' ? 'In Progress' : 
                                              task.status === 'In Progress' ? 'Completed' : 'Scheduled'
                              setMaintenanceTasks(maintenanceTasks.map(mt => 
                                mt.id === task.id 
                                  ? { ...mt, status: newStatus }
                                  : mt
                              ))
                              alert(`${task.id} status updated to: ${newStatus}`)
                            }}
                            disabled={task.status === 'Completed'}
                          >
                            {task.status === 'Scheduled' ? 'Start' : task.status === 'In Progress' ? 'Complete' : 'Completed'}
                          </Button>
                        </div>
                      </div>
                      
                      <div className="mb-3">
                        <p className="text-sm font-medium">{task.description}</p>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                        <div>
                          <span className="text-muted-foreground">Scheduled:</span>
                          <span className={`font-medium ml-1 ${isOverdue ? 'text-red-600 font-bold' : 'text-foreground'}`}>
                            {formatDateOnly(task.scheduledDate)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Technician:</span>
                          <span className="font-medium ml-1">{task.technician}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Est. Hours:</span>
                          <span className="font-medium ml-1">{task.estimatedHours}h</span>
                        </div>
                      </div>

                      {task.notes && (
                        <div className="mt-3 p-3 bg-muted/50 border border-border rounded-lg text-sm">
                          <span className="text-muted-foreground font-medium">Notes: </span>
                          <span className="text-foreground">{task.notes}</span>
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {/* Analytics Tab Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAnalyticsWidgetSettingsOpen(true)}
            >
              <Settings className="w-4 h-4 mr-2" />
              Widget Settings
            </Button>
          </div>

          {/* Analytics KPIs */}
          {analyticsWidgetLayout.layout.find(w => w.id === 'analytics-kpis')?.visible && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-500">
                    {(machines.reduce((sum, m) => sum + m.oee, 0) / machines.length).toFixed(1)}%
                  </p>
                  <p className="text-sm text-muted-foreground">Avg OEE</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-500">
                    {machines.reduce((sum, m) => sum + m.goodParts, 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Production</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-red-500">
                    {(machines.reduce((sum, m) => sum + m.scrap, 0) / machines.reduce((sum, m) => sum + m.goodParts + m.scrap, 0) * 100).toFixed(1)}%
                  </p>
                  <p className="text-sm text-muted-foreground">Scrap Rate</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-purple-500">
                    {((qualityInspections.filter(qi => qi.result === 'Pass').length / qualityInspections.length) * 100).toFixed(1)}%
                  </p>
                  <p className="text-sm text-muted-foreground">Quality Rate</p>
                </div>
              </CardContent>
            </Card>
          </div>
          )}

          {/* Production Efficiency Chart */}
          {analyticsWidgetLayout.layout.find(w => w.id === 'production-efficiency')?.visible && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Production Efficiency Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* OEE Trend */}
                <div>
                  <h4 className="font-semibold mb-4">7-Day OEE Trend</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={oeeTrendData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="day" 
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis 
                        domain={[0, 100]}
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px'
                        }}
                        formatter={(value: any) => [`${(Number(value) || 0)}%`, 'OEE']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="oee" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Quality Trend */}
                <div>
                  <h4 className="font-semibold mb-4">7-Day Quality Trend</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={qualityTrendData}>
                      <defs>
                        <linearGradient id="colorQualityTrend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="day" 
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <YAxis 
                        domain={[90, 100]}
                        className="text-xs"
                        tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px'
                        }}
                        formatter={(value: any) => [`${(Number(value) || 0)}%`, 'Pass Rate']}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="passRate" 
                        stroke="#22c55e" 
                        fillOpacity={1} 
                        fill="url(#colorQualityTrend)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>
          )}

          {/* Machine Performance Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {analyticsWidgetLayout.layout.find(w => w.id === 'machine-performance')?.visible && (
            <Card>
              <CardHeader>
                <CardTitle>Machine Performance Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={machineOeeBreakdownData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="name" 
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis 
                      domain={[0, 100]}
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                      label={{ value: '%', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px'
                      }}
                      formatter={(value: any) => [`${(Number(value) || 0)}%`, '']}
                    />
                    <Legend />
                    <Bar dataKey="availability" fill="#3b82f6" name="Availability" />
                    <Bar dataKey="performance" fill="#eab308" name="Performance" />
                    <Bar dataKey="quality" fill="#22c55e" name="Quality" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            )}

            {analyticsWidgetLayout.layout.find(w => w.id === 'key-performance-indicators')?.visible && (
            <Card>
              <CardHeader>
                <CardTitle>Key Performance Indicators</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="font-medium">Overall Equipment Effectiveness</span>
                    <span className="text-lg font-bold text-green-500">
                      {(machines.reduce((sum, m) => sum + m.oee, 0) / machines.length).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="font-medium">Daily Throughput Rate</span>
                    <span className="text-lg font-bold text-blue-500">
                      {machines.reduce((sum, m) => sum + m.goodParts, 0)} parts/day
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="font-medium">First Pass Yield</span>
                    <span className="text-lg font-bold text-purple-500">
                      {((qualityInspections.filter(qi => qi.result === 'Pass').length / qualityInspections.length) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="font-medium">Maintenance Compliance</span>
                    <span className="text-lg font-bold text-orange-500">
                      {((maintenanceTasks.filter(mt => mt.status === 'Completed').length / maintenanceTasks.length) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
            )}
          </div>

          {/* Export All Data */}
          {analyticsWidgetLayout.layout.find(w => w.id === 'data-export')?.visible && (
          <Card>
            <CardHeader>
              <CardTitle>Data Export Options</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button variant="outline" onClick={handleDownloadCSV}>
                  <Download className="w-4 h-4 mr-2" />
                  Machine Data (CSV)
                </Button>
                <Button variant="outline" onClick={() => {
                  try {
                    const headers = ['Work Order ID', 'SKU', 'Quantity', 'Completed', 'Status', 'Priority', 'Due Date', 'Machine', 'Progress %']
                    const csvData = [
                      headers.join(','),
                      ...workOrders.map(wo => [
                        wo.id, wo.sku, wo.quantity, wo.completed, wo.status, wo.priority, wo.dueDate, wo.assignedMachine,
                        ((wo.completed / wo.quantity) * 100).toFixed(1)
                      ].join(','))
                    ].join('\n')
                    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' })
                    const link = document.createElement('a')
                    const url = URL.createObjectURL(blob)
                    link.setAttribute('href', url)
                    link.setAttribute('download', `analytics_work_orders_${getTodayDateKey()}.csv`)
                    link.style.visibility = 'hidden'
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                  } catch (error) {
                    alert('Failed to export work order data.')
                  }
                }}>
                  <Download className="w-4 h-4 mr-2" />
                  Work Orders (CSV)
                </Button>
                <Button variant="outline" onClick={() => {
                  const reportContent = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                      <title>Manufacturing Analytics Report</title>
                      <style>
                        body { font-family: Arial, sans-serif; margin: 40px; }
                        .header { text-align: center; margin-bottom: 30px; }
                        .kpi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
                        .kpi-card { border: 1px solid #ddd; padding: 20px; border-radius: 8px; text-align: center; }
                        .kpi-value { font-size: 2em; font-weight: bold; color: #2563eb; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f5f5f5; }
                      </style>
                    </head>
                    <body>
                      <div class="header">
                        <h1>Manufacturing Analytics Report</h1>
                        <p>Generated on ${new Date().toLocaleDateString()}</p>
                      </div>
                      <div class="kpi-grid">
                        <div class="kpi-card">
                          <div class="kpi-value">${(machines.reduce((sum, m) => sum + m.oee, 0) / machines.length).toFixed(1)}%</div>
                          <div>Average OEE</div>
                        </div>
                        <div class="kpi-card">
                          <div class="kpi-value">${machines.reduce((sum, m) => sum + m.goodParts, 0)}</div>
                          <div>Total Production</div>
                        </div>
                        <div class="kpi-card">
                          <div class="kpi-value">${((qualityInspections.filter(qi => qi.result === 'Pass').length / qualityInspections.length) * 100).toFixed(1)}%</div>
                          <div>Quality Rate</div>
                        </div>
                        <div class="kpi-card">
                          <div class="kpi-value">${((maintenanceTasks.filter(mt => mt.status === 'Completed').length / maintenanceTasks.length) * 100).toFixed(1)}%</div>
                          <div>Maintenance Compliance</div>
                        </div>
                      </div>
                    </body>
                    </html>
                  `
                  const printWindow = window.open('', '_blank')
                  if (printWindow) {
                    printWindow.document.write(reportContent)
                    printWindow.document.close()
                    printWindow.focus()
                    setTimeout(() => printWindow.print(), 250)
                  }
                }}>
                  <Download className="w-4 h-4 mr-2" />
                  Analytics Report (PDF)
                </Button>
              </div>
            </CardContent>
          </Card>
          )}

          {/* Widget Settings Dialog */}
          <WidgetSettingsDialog
            open={isAnalyticsWidgetSettingsOpen}
            onOpenChange={setIsAnalyticsWidgetSettingsOpen}
            layout={analyticsWidgetLayout.layout}
            onToggleWidget={analyticsWidgetLayout.toggleWidget}
            onReset={analyticsWidgetLayout.resetLayout}
          />
        </TabsContent>
      </Tabs>

      {/* Add Machine Dialog */}
      <Dialog open={isAddMachineOpen} onOpenChange={setIsAddMachineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Machine</DialogTitle>
            <DialogDescription>Register a new machine in the manufacturing system</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="machine-id">Machine ID *</Label>
              <Input 
                id="machine-id"
                placeholder="e.g., CNC-03, Press-02"
                value={newMachineId}
                onChange={(e) => setNewMachineId(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="machine-cell">Manufacturing Cell *</Label>
              <Select value={newMachineCell} onValueChange={setNewMachineCell}>
                <SelectTrigger id="machine-cell">
                  <SelectValue placeholder="Select cell" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cell-A">Cell-A</SelectItem>
                  <SelectItem value="Cell-B">Cell-B</SelectItem>
                  <SelectItem value="Cell-C">Cell-C</SelectItem>
                  <SelectItem value="Cell-D">Cell-D</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="machine-type">Machine Type *</Label>
              <Select value={newMachineType} onValueChange={setNewMachineType}>
                <SelectTrigger id="machine-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CNC Machine">CNC Machine</SelectItem>
                  <SelectItem value="Hydraulic Press">Hydraulic Press</SelectItem>
                  <SelectItem value="Injection Molding">Injection Molding</SelectItem>
                  <SelectItem value="Assembly Station">Assembly Station</SelectItem>
                  <SelectItem value="Quality Station">Quality Station</SelectItem>
                  <SelectItem value="Packaging Line">Packaging Line</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-4">
              <Button className="flex-1" onClick={handleAddMachine}>
                Add Machine
              </Button>
              <Button variant="outline" onClick={() => {
                setIsAddMachineOpen(false)
                setNewMachineId("")
                setNewMachineCell("")
                setNewMachineType("")
              }}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Machine Detail Dialog */}
      <Dialog open={isMachineDetailOpen} onOpenChange={setIsMachineDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedMachine?.id} - Machine Details</DialogTitle>
            <DialogDescription>Detailed information and controls for {selectedMachine?.id}</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Machine Status */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center">
                    <div className={`inline-flex items-center justify-center w-3 h-3 rounded-full mb-2 ${getStatusColor(selectedMachine?.status || '')}`}></div>
                    <p className="text-sm font-medium">{selectedMachine?.status}</p>
                    <p className="text-xs text-muted-foreground">Current Status</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-500">{selectedMachine?.oee}%</p>
                    <p className="text-xs text-muted-foreground">Overall OEE</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{selectedMachine?.goodParts}</p>
                    <p className="text-xs text-muted-foreground">Good Parts Today</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Machine Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Machine Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Machine Type</p>
                    <p className="font-medium">{selectedMachine?.type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Manufacturing Cell</p>
                    <p className="font-medium">{selectedMachine?.cell}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Scrap Count</p>
                    <p className="font-medium text-red-500">{selectedMachine?.scrap}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Efficiency</p>
                    <p className="font-medium">{selectedMachine ? ((selectedMachine.goodParts / (selectedMachine.goodParts + selectedMachine.scrap)) * 100).toFixed(1) : 0}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-4">
              <Button variant="outline" onClick={() => {
                alert(`Starting maintenance mode for ${selectedMachine?.id}\n\nThis would:\n• Set machine to maintenance status\n• Log maintenance start time\n• Notify operators`)
              }}>
                Start Maintenance
              </Button>
              <Button variant="outline" onClick={() => {
                alert(`Resetting counters for ${selectedMachine?.id}\n\nThis would:\n• Reset good parts counter\n• Reset scrap counter\n• Log reset event`)
              }}>
                Reset Counters
              </Button>
            </div>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setIsMachineDetailOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Work Order Dialog */}
      <Dialog open={isNewWorkOrderOpen} onOpenChange={setIsNewWorkOrderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Work Order</DialogTitle>
            <DialogDescription>Add a new production work order to the system</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="wo-sku">SKU/Part Number *</Label>
              <Input 
                id="wo-sku"
                placeholder="e.g., PART-A-001"
                value={newWOSku}
                onChange={(e) => setNewWOSku(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="wo-quantity">Quantity *</Label>
                <Input 
                  id="wo-quantity"
                  type="number"
                  placeholder="Enter quantity"
                  value={newWOQuantity}
                  onChange={(e) => setNewWOQuantity(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="wo-priority">Priority *</Label>
                <Select value={newWOPriority} onValueChange={setNewWOPriority}>
                  <SelectTrigger id="wo-priority">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="wo-due-date">Due Date *</Label>
              <Input 
                id="wo-due-date"
                type="date"
                value={newWODueDate}
                onChange={(e) => setNewWODueDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="wo-notes">Notes</Label>
              <Textarea 
                id="wo-notes"
                placeholder="Additional notes or special instructions..."
                value={newWONotes}
                onChange={(e) => setNewWONotes(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button className="flex-1" onClick={handleAddWorkOrder}>
                Create Work Order
              </Button>
              <Button variant="outline" onClick={() => {
                setIsNewWorkOrderOpen(false)
                setNewWOSku("")
                setNewWOQuantity("")
                setNewWOPriority("medium")
                setNewWODueDate("")
                setNewWONotes("")
              }}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Work Order Dialog */}
      <Dialog open={isEditWorkOrderOpen} onOpenChange={setIsEditWorkOrderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Work Order - {selectedWorkOrder?.id}</DialogTitle>
            <DialogDescription>Update work order details and progress</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-wo-completed">Completed Quantity</Label>
                <Input 
                  id="edit-wo-completed"
                  type="number"
                  placeholder="Enter completed quantity"
                  max={selectedWorkOrder?.quantity}
                  onChange={(e) => {
                    const newCompleted = parseInt(e.target.value) || 0
                    updateWorkOrderProgress(selectedWorkOrder?.id, newCompleted)
                  }}
                  defaultValue={selectedWorkOrder?.completed}
                />
              </div>
              <div>
                <Label htmlFor="edit-wo-machine">Assigned Machine</Label>
                <Select 
                  value={selectedWorkOrder?.assignedMachine} 
                  onValueChange={(value) => {
                    setWorkOrders(workOrders.map(wo => 
                      wo.id === selectedWorkOrder?.id 
                        ? { ...wo, assignedMachine: value }
                        : wo
                    ))
                  }}
                >
                  <SelectTrigger id="edit-wo-machine">
                    <SelectValue placeholder="Select machine" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Unassigned">Unassigned</SelectItem>
                    {machines.map((machine) => (
                      <SelectItem key={machine.id} value={machine.id}>
                        {machine.id} ({machine.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="edit-wo-status">Status</Label>
              <Select 
                value={selectedWorkOrder?.status} 
                onValueChange={(value) => {
                  setWorkOrders(workOrders.map(wo => 
                    wo.id === selectedWorkOrder?.id 
                      ? { ...wo, status: value }
                      : wo
                  ))
                }}
              >
                <SelectTrigger id="edit-wo-status">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Queued">Queued</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="On Hold">On Hold</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-4">
              <Button 
                className="flex-1" 
                onClick={() => setIsEditWorkOrderOpen(false)}
              >
                Save Changes
              </Button>
              <Button 
                variant="destructive"
                onClick={() => {
                  if (window.confirm(`Are you sure you want to delete work order ${selectedWorkOrder?.id}?`)) {
                    setWorkOrders(workOrders.filter(wo => wo.id !== selectedWorkOrder?.id))
                    setIsEditWorkOrderOpen(false)
                  }
                }}
              >
                Delete
              </Button>
              <Button variant="outline" onClick={() => setIsEditWorkOrderOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Inspection Dialog */}
      <Dialog open={isNewInspectionOpen} onOpenChange={setIsNewInspectionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Quality Inspection</DialogTitle>
            <DialogDescription>Record a quality inspection for a part</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="inspection-part">Part Number *</Label>
              <Input 
                id="inspection-part"
                placeholder="e.g., PART-A-001"
                value={newInspectionPart}
                onChange={(e) => setNewInspectionPart(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="inspection-result">Inspection Result *</Label>
              <Select value={newInspectionResult} onValueChange={setNewInspectionResult}>
                <SelectTrigger id="inspection-result">
                  <SelectValue placeholder="Select result" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pass">Pass</SelectItem>
                  <SelectItem value="Fail">Fail</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="inspection-notes">Notes</Label>
              <Textarea 
                id="inspection-notes"
                placeholder="Inspection details, defects found, recommendations..."
                value={newInspectionNotes}
                onChange={(e) => setNewInspectionNotes(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button className="flex-1" onClick={handleAddInspection}>
                Record Inspection
              </Button>
              <Button variant="outline" onClick={() => {
                setIsNewInspectionOpen(false)
                setNewInspectionPart("")
                setNewInspectionResult("")
                setNewInspectionNotes("")
              }}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Maintenance Dialog */}
      <Dialog open={isNewMaintenanceOpen} onOpenChange={setIsNewMaintenanceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Maintenance</DialogTitle>
            <DialogDescription>Schedule maintenance for a machine</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="maintenance-machine">Machine *</Label>
              <Select value={newMaintenanceMachine} onValueChange={setNewMaintenanceMachine}>
                <SelectTrigger id="maintenance-machine">
                  <SelectValue placeholder="Select machine" />
                </SelectTrigger>
                <SelectContent>
                  {machines.map((machine) => (
                    <SelectItem key={machine.id} value={machine.id}>
                      {machine.id} ({machine.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="maintenance-type">Maintenance Type *</Label>
              <Select value={newMaintenanceType} onValueChange={setNewMaintenanceType}>
                <SelectTrigger id="maintenance-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Preventive">Preventive</SelectItem>
                  <SelectItem value="Corrective">Corrective</SelectItem>
                  <SelectItem value="Emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="maintenance-date">Scheduled Date *</Label>
              <Input 
                id="maintenance-date"
                type="date"
                value={newMaintenanceDate}
                onChange={(e) => setNewMaintenanceDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="maintenance-notes">Notes</Label>
              <Textarea 
                id="maintenance-notes"
                placeholder="Maintenance details, parts needed, special instructions..."
                value={newMaintenanceNotes}
                onChange={(e) => setNewMaintenanceNotes(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button className="flex-1" onClick={handleAddMaintenance}>
                Schedule Maintenance
              </Button>
              <Button variant="outline" onClick={() => {
                setIsNewMaintenanceOpen(false)
                setNewMaintenanceMachine("")
                setNewMaintenanceType("")
                setNewMaintenanceDate("")
                setNewMaintenanceNotes("")
              }}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </MotionPage>
  )
}
