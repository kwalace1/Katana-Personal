import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { FileText, Link2, Package, Trash2, Landmark } from 'lucide-react'
import { getAllProjects, getProjectTasks } from '@/lib/supabase-api'
import { getInventoryItems } from '@/lib/inventory-api'
import {
  addJobPart,
  createDraftInvoiceFromJob,
  getJobParts,
  linkJobToProjectTask,
  removeJobPart,
  type WfmJobPart,
} from '@/lib/wfm-integrations'
import { workforceTabPath } from '@/lib/wfm-deep-links'
import { useModuleAccess } from '@/contexts/ModuleAccessContext'
import { invoiceDeepLink, financeMatchDeepLink } from '@/lib/module-integrations'
import { ModuleDiscussion } from '@/components/comms/ModuleDiscussion'
import type { Task } from '@/lib/project-data'

interface WfmJobIntegrationsPanelProps {
  jobDbId: string
  clientId: string | null
  invoiceId: string | null
  projectId: string | null
  taskId: string | null
  onUpdated?: () => void
}

export function WfmJobIntegrationsPanel({
  jobDbId,
  clientId,
  invoiceId: initialInvoiceId,
  projectId: initialProjectId,
  taskId: initialTaskId,
  onUpdated,
}: WfmJobIntegrationsPanelProps) {
  const { allowedModules, canIntegrateModules } = useModuleAccess()
  const showBilling = canIntegrateModules('workforce', 'customer-success')
  const showFinance = canIntegrateModules('customer-success', 'finance')
  const showProjects = canIntegrateModules('workforce', 'projects')
  const showInventory = canIntegrateModules('workforce', 'inventory')

  const [invoiceId, setInvoiceId] = useState(initialInvoiceId)
  const [projectId, setProjectId] = useState(initialProjectId ?? '')
  const [taskId, setTaskId] = useState(initialTaskId ?? '')
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [parts, setParts] = useState<WfmJobPart[]>([])
  const [inventoryOptions, setInventoryOptions] = useState<Array<{ id: string; label: string }>>([])
  const [selectedItemId, setSelectedItemId] = useState('')
  const [partQty, setPartQty] = useState('1')
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [linkLoading, setLinkLoading] = useState(false)
  const [partsLoading, setPartsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const hasVisibleSections = showBilling || showProjects || showInventory

  const loadParts = useCallback(async () => {
    const rows = await getJobParts(jobDbId)
    setParts(rows)
  }, [jobDbId])

  useEffect(() => {
    setInvoiceId(initialInvoiceId)
    setProjectId(initialProjectId ?? '')
    setTaskId(initialTaskId ?? '')
  }, [initialInvoiceId, initialProjectId, initialTaskId, jobDbId])

  useEffect(() => {
    if (showInventory) void loadParts()
    if (showProjects) {
      void getAllProjects().then((list) => setProjects(list.map((p) => ({ id: p.id, name: p.name }))))
    }
    if (showInventory) {
      void getInventoryItems().then((items) =>
        setInventoryOptions(
          items.slice(0, 100).map((i) => ({
            id: i.id,
            label: `${i.product_name} (${i.sku})`,
          })),
        ),
      )
    }
  }, [loadParts, jobDbId, showInventory, showProjects])

  useEffect(() => {
    if (!projectId || !showProjects) {
      setTasks([])
      return
    }
    void getProjectTasks(projectId).then(setTasks)
  }, [projectId, showProjects])

  const handleDraftInvoice = async () => {
    setInvoiceLoading(true)
    setMessage(null)
    const result = await createDraftInvoiceFromJob(jobDbId, { includePending: true })
    setInvoiceLoading(false)
    if (result.ok && result.invoiceId) {
      setInvoiceId(result.invoiceId)
      setMessage(result.error ?? `Draft invoice ${result.invoiceNumber ?? ''} created`)
      onUpdated?.()
    } else {
      setMessage(result.error ?? 'Could not create invoice')
    }
  }

  const handleSaveProjectLink = async () => {
    setLinkLoading(true)
    await linkJobToProjectTask(jobDbId, projectId || null, taskId || null)
    setLinkLoading(false)
    setMessage('Project link saved')
    onUpdated?.()
  }

  const handleAddPart = async () => {
    if (!selectedItemId) return
    const qty = Number(partQty)
    if (!qty || qty <= 0) return
    setPartsLoading(true)
    await addJobPart(jobDbId, selectedItemId, qty)
    await loadParts()
    setPartsLoading(false)
    setSelectedItemId('')
    setPartQty('1')
  }

  const handleRemovePart = async (partId: string) => {
    await removeJobPart(partId)
    await loadParts()
  }

  if (!hasVisibleSections) {
    return (
      <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
        <ModuleDiscussion contextType="job" contextId={jobDbId} title="Job discussion" />
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Link2 className="h-4 w-4" />
        Cross-module links
      </div>

      {showBilling && (
        <>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Billing</Label>
            {invoiceId ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline">Invoice linked</Badge>
                  <Link
                    to={invoiceDeepLink(invoiceId, allowedModules)}
                    className="text-xs text-primary hover:underline"
                  >
                    Open Commerce →
                  </Link>
                </div>
                {showFinance && (
                  <Link
                    to={financeMatchDeepLink()}
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <Landmark className="h-3 w-3" />
                    Match payment in Finance →
                  </Link>
                )}
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                disabled={!clientId || invoiceLoading}
                onClick={() => void handleDraftInvoice()}
              >
                <FileText className="h-4 w-4 mr-2" />
                {invoiceLoading ? 'Creating…' : 'Draft invoice from time'}
              </Button>
            )}
            {!clientId && (
              <p className="text-xs text-muted-foreground">Link a customer on this work item to bill time.</p>
            )}
          </div>
          {(showProjects || showInventory) && <Separator />}
        </>
      )}

      {showProjects && (
        <>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Projects</Label>
            <Select value={projectId || '__none'} onValueChange={(v) => setProjectId(v === '__none' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">No project</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {projectId && (
              <Select value={taskId || '__none'} onValueChange={(v) => setTaskId(v === '__none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Link task (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">No task</SelectItem>
                  {tasks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              disabled={linkLoading}
              onClick={() => void handleSaveProjectLink()}
            >
              Save project link
            </Button>
            {projectId && (
              <Link
                to={`/projects/${projectId}`}
                className="text-xs text-primary hover:underline block"
              >
                Open project →
              </Link>
            )}
          </div>
          {showInventory && <Separator />}
        </>
      )}

      {showInventory && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Package className="h-3 w-3" />
            Parts (check out on completion)
          </Label>
          {parts.length > 0 && (
            <ul className="space-y-1 text-sm">
              {parts.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    {p.item_name ?? p.item_id} × {p.quantity}
                    {p.checked_out && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        Out
                      </Badge>
                    )}
                  </span>
                  {!p.checked_out && (
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => void handleRemovePart(p.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Select value={selectedItemId || '__pick'} onValueChange={(v) => setSelectedItemId(v === '__pick' ? '' : v)}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Inventory item" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__pick" disabled>
                  Select item
                </SelectItem>
                {inventoryOptions.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={1}
              className="w-16"
              value={partQty}
              onChange={(e) => setPartQty(e.target.value)}
            />
            <Button type="button" size="sm" disabled={partsLoading || !selectedItemId} onClick={() => void handleAddPart()}>
              Add
            </Button>
          </div>
        </div>
      )}

      {message && <p className="text-xs text-muted-foreground">{message}</p>}
      <p className="text-[10px] text-muted-foreground">
        Share: {workforceTabPath('work', 'list', jobDbId)}
      </p>

      <Separator />
      <ModuleDiscussion contextType="job" contextId={jobDbId} title="Job discussion" />
    </div>
  )
}
