import { useCallback, useEffect, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { updateCompany, type KYICompanyDetail } from '@/lib/kyi-api'
import {
  getNorthstarFramework,
  saveNorthstarFramework,
  getCompanyInvestorCategories,
  createCompanyInvestorCategory,
  updateCompanyInvestorCategory,
  deleteCompanyInvestorCategory,
  slugifyKey,
  type KyiNorthstarFramework,
  type KyiCompanyInvestorCategory,
  type NorthstarKeyLabelItem,
  type NorthstarPipelineStageItem,
  type NorthstarTierItem,
} from '@/lib/kyi-northstar'

export interface KyiNorthstarSettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  company: KYICompanyDetail
  onSaved?: () => void
}

function StringListEditor({
  label,
  description,
  items,
  onChange,
  placeholder,
}: {
  label: string
  description?: string
  items: string[]
  onChange: (items: string[]) => void
  placeholder?: string
}) {
  return (
    <div className="space-y-2">
      <div>
        <Label className="text-sm">{label}</Label>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={item}
              onChange={(e) => {
                const next = [...items]
                next[i] = e.target.value
                onChange(next)
              }}
              placeholder={placeholder}
              className="text-sm"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, ''])}>
        <Plus className="w-3.5 h-3.5 mr-1" />
        Add item
      </Button>
    </div>
  )
}

function KeyLabelListEditor({
  label,
  description,
  items,
  onChange,
}: {
  label: string
  description?: string
  items: NorthstarKeyLabelItem[]
  onChange: (items: NorthstarKeyLabelItem[]) => void
}) {
  return (
    <div className="space-y-2">
      <div>
        <Label className="text-sm">{label}</Label>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={item.key + i} className="flex gap-2 items-start">
            <div className="flex-1 space-y-1">
              <Input
                value={item.label}
                onChange={(e) => {
                  const next = [...items]
                  next[i] = { ...item, label: e.target.value }
                  onChange(next)
                }}
                placeholder="Label"
                className="text-sm"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 mt-0.5 text-muted-foreground hover:text-destructive"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          const label = 'New item'
          onChange([...items, { key: slugifyKey(`${label}_${items.length + 1}`), label }])
        }}
      >
        <Plus className="w-3.5 h-3.5 mr-1" />
        Add
      </Button>
    </div>
  )
}

export function KyiNorthstarSettingsSheet({
  open,
  onOpenChange,
  company,
  onSaved,
}: KyiNorthstarSettingsSheetProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [framework, setFramework] = useState<KyiNorthstarFramework | null>(null)
  const [categories, setCategories] = useState<KyiCompanyInvestorCategory[]>([])
  const [expandedCategoryId, setExpandedCategoryId] = useState<number | null>(null)

  const [companyForm, setCompanyForm] = useState({
    name: company.name,
    industry: company.industry ?? '',
    location: company.location ?? '',
    website: company.website ?? '',
    description: company.description ?? '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [fw, cats] = await Promise.all([
        getNorthstarFramework(company.id),
        getCompanyInvestorCategories(company.id),
      ])
      setFramework(fw)
      setCategories(cats)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [company.id])

  useEffect(() => {
    if (open) {
      setCompanyForm({
        name: company.name,
        industry: company.industry ?? '',
        location: company.location ?? '',
        website: company.website ?? '',
        description: company.description ?? '',
      })
      void load()
    }
  }, [open, company, load])

  const saveCompany = async () => {
    setSaving(true)
    try {
      await updateCompany(company.id, {
        name: companyForm.name,
        industry: companyForm.industry || null,
        location: companyForm.location || null,
        website: companyForm.website || null,
        description: companyForm.description || null,
      })
      toast.success('Company profile saved')
      onSaved?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const saveFramework = async () => {
    if (!framework) return
    setSaving(true)
    try {
      const cleanedCriteria = framework.scorecard_criteria
        .filter((c) => c.label.trim())
        .map((c) => ({ key: c.key || slugifyKey(c.label), label: c.label.trim() }))
      const cleanedStages = framework.pipeline_stages
        .filter((s) => s.label.trim())
        .map((s) => ({
          value: s.value || slugifyKey(s.label),
          label: s.label.trim(),
        }))
      const cleanedDiligence = framework.due_diligence_questions
        .filter((q) => q.label.trim())
        .map((q) => ({ key: q.key || slugifyKey(q.label), label: q.label.trim() }))
      const cleanedPriorities = framework.strategy_priorities.map((p) => p.trim()).filter(Boolean)
      const cleanedTraits = framework.ideal_profile_traits.map((t) => t.trim()).filter(Boolean)

      const saved = await saveNorthstarFramework(company.id, {
        strategy_priorities: cleanedPriorities,
        ideal_profile_traits: cleanedTraits,
        strategy_notes: framework.strategy_notes,
        pipeline_stages: cleanedStages,
        scorecard_criteria: cleanedCriteria,
        due_diligence_questions: cleanedDiligence,
        tiers: framework.tiers.filter((t) => t.label.trim()),
      })
      setFramework(saved)
      toast.success('Framework saved')
      onSaved?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleAddCategory = async () => {
    try {
      const cat = await createCompanyInvestorCategory(company.id, {
        type: 'New investor category',
        description: '',
        category_fields: ['partner', 'website', 'notes', 'current_status'],
      })
      setCategories((prev) => [...prev, cat])
      setExpandedCategoryId(cat.id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add category')
    }
  }

  const handleSaveCategory = async (cat: KyiCompanyInvestorCategory) => {
    try {
      await updateCompanyInvestorCategory(cat.id, {
        type: cat.type,
        description: cat.description,
        motivations: cat.motivations,
        cares_about: cat.cares_about,
        decision_drivers: cat.decision_drivers,
        red_flags: cat.red_flags,
        messaging_approach: cat.messaging_approach,
        outreach_angle: cat.outreach_angle,
        category_fields: cat.category_fields,
      })
      toast.success('Category saved')
      onSaved?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  const handleDeleteCategory = async (id: number) => {
    try {
      await deleteCompanyInvestorCategory(id)
      setCategories((prev) => prev.filter((c) => c.id !== id))
      toast.success('Category removed')
      onSaved?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Remove failed')
    }
  }

  const updateCategoryLocal = (id: number, patch: Partial<KyiCompanyInvestorCategory>) => {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  const updatePipelineStage = (index: number, label: string) => {
    if (!framework) return
    const next = [...framework.pipeline_stages]
    next[index] = { value: next[index]?.value || slugifyKey(label), label }
    setFramework({ ...framework, pipeline_stages: next })
  }

  const removePipelineStage = (index: number) => {
    if (!framework) return
    setFramework({
      ...framework,
      pipeline_stages: framework.pipeline_stages.filter((_, i) => i !== index),
    })
  }

  const updateTier = (index: number, patch: Partial<NorthstarTierItem>) => {
    if (!framework) return
    const next = [...framework.tiers]
    next[index] = { ...next[index]!, ...patch }
    setFramework({ ...framework, tiers: next })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>KYI customization</SheetTitle>
          <SheetDescription>
            Tailor investor categories, evaluation criteria, and pipeline stages for {company.name}.
          </SheetDescription>
        </SheetHeader>

        {loading || !framework ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="company" className="mt-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="company">Company</TabsTrigger>
              <TabsTrigger value="framework">Framework</TabsTrigger>
              <TabsTrigger value="categories">Categories</TabsTrigger>
            </TabsList>

            <TabsContent value="company" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Company name</Label>
                  <Input
                    value={companyForm.name}
                    onChange={(e) => setCompanyForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Industry</Label>
                    <Input
                      value={companyForm.industry}
                      onChange={(e) => setCompanyForm((p) => ({ ...p, industry: e.target.value }))}
                      placeholder="e.g. B2B SaaS"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Location</Label>
                    <Input
                      value={companyForm.location}
                      onChange={(e) => setCompanyForm((p) => ({ ...p, location: e.target.value }))}
                      placeholder="e.g. New York, NY"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Website</Label>
                  <Input
                    value={companyForm.website}
                    onChange={(e) => setCompanyForm((p) => ({ ...p, website: e.target.value }))}
                    placeholder="https://"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea
                    rows={3}
                    value={companyForm.description}
                    onChange={(e) => setCompanyForm((p) => ({ ...p, description: e.target.value }))}
                  />
                </div>
              </div>
              <Button onClick={saveCompany} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save company profile
              </Button>
            </TabsContent>

            <TabsContent value="framework" className="space-y-6 mt-4">
              <StringListEditor
                label="Strategy priorities"
                description="What matters most when evaluating investors (ordered)."
                items={framework.strategy_priorities}
                onChange={(strategy_priorities) => setFramework({ ...framework, strategy_priorities })}
                placeholder="e.g. Strategic value"
              />

              <Separator />

              <StringListEditor
                label="Ideal investor traits"
                description="What your ideal partner should bring beyond capital."
                items={framework.ideal_profile_traits}
                onChange={(ideal_profile_traits) => setFramework({ ...framework, ideal_profile_traits })}
              />

              <div className="space-y-1.5">
                <Label>Strategy notes</Label>
                <Textarea
                  rows={3}
                  value={framework.strategy_notes ?? ''}
                  onChange={(e) => setFramework({ ...framework, strategy_notes: e.target.value })}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-sm">Pipeline stages</Label>
                <p className="text-xs text-muted-foreground">Customize outreach stages for your raise.</p>
                {framework.pipeline_stages.map((stage, i) => (
                  <div key={stage.value + i} className="flex gap-2">
                    <Input
                      value={stage.label}
                      onChange={(e) => updatePipelineStage(i, e.target.value)}
                      className="text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removePipelineStage(i)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const label = 'New stage'
                    setFramework({
                      ...framework,
                      pipeline_stages: [
                        ...framework.pipeline_stages,
                        { value: slugifyKey(label), label },
                      ],
                    })
                  }}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add stage
                </Button>
              </div>

              <Separator />

              <KeyLabelListEditor
                label="Scorecard criteria"
                description="Rate each investor 1–5 on these criteria."
                items={framework.scorecard_criteria}
                onChange={(scorecard_criteria) =>
                  setFramework({
                    ...framework,
                    scorecard_criteria,
                    scorecard_max: scorecard_criteria.length * 5,
                  })
                }
              />

              <Separator />

              <KeyLabelListEditor
                label="Due diligence questions"
                description="Questions to answer before advancing an investor."
                items={framework.due_diligence_questions}
                onChange={(due_diligence_questions) => setFramework({ ...framework, due_diligence_questions })}
              />

              <Separator />

              <div className="space-y-2">
                <Label className="text-sm">Internal tiers</Label>
                {framework.tiers.map((tier, i) => (
                  <div key={tier.value} className="space-y-1.5 rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        T{tier.value}
                      </Badge>
                      <Input
                        value={tier.label}
                        onChange={(e) => updateTier(i, { label: e.target.value })}
                        className="text-sm h-8"
                      />
                    </div>
                    <Input
                      value={tier.description ?? ''}
                      onChange={(e) => updateTier(i, { description: e.target.value })}
                      placeholder="Description (optional)"
                      className="text-xs h-8"
                    />
                  </div>
                ))}
              </div>

              <Button onClick={saveFramework} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save framework
              </Button>
            </TabsContent>

            <TabsContent value="categories" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">
                Define the investor types you are targeting. Each category can have its own behavior profile and form
                fields.
              </p>

              <div className="space-y-3">
                {categories.map((cat) => {
                  const expanded = expandedCategoryId === cat.id
                  return (
                    <div key={cat.id} className="rounded-lg border">
                      <div className="flex items-center gap-2 p-3">
                        <button
                          type="button"
                          className="flex-1 text-left text-sm font-medium"
                          onClick={() => setExpandedCategoryId(expanded ? null : cat.id)}
                        >
                          {cat.type}
                        </button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteCategory(cat.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      {expanded && (
                        <div className="border-t p-3 space-y-3 bg-muted/20">
                          <div className="space-y-1.5">
                            <Label className="text-xs">Category name</Label>
                            <Input
                              value={cat.type}
                              onChange={(e) => updateCategoryLocal(cat.id, { type: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Description</Label>
                            <Textarea
                              rows={2}
                              value={cat.description ?? ''}
                              onChange={(e) => updateCategoryLocal(cat.id, { description: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Motivations</Label>
                            <Textarea
                              rows={2}
                              value={cat.motivations ?? ''}
                              onChange={(e) => updateCategoryLocal(cat.id, { motivations: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">What they care about</Label>
                            <Textarea
                              rows={2}
                              value={cat.cares_about ?? ''}
                              onChange={(e) => updateCategoryLocal(cat.id, { cares_about: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Decision drivers</Label>
                            <Textarea
                              rows={2}
                              value={cat.decision_drivers ?? ''}
                              onChange={(e) => updateCategoryLocal(cat.id, { decision_drivers: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Red flags</Label>
                            <Textarea
                              rows={2}
                              value={cat.red_flags ?? ''}
                              onChange={(e) => updateCategoryLocal(cat.id, { red_flags: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Messaging approach</Label>
                            <Textarea
                              rows={2}
                              value={cat.messaging_approach ?? ''}
                              onChange={(e) => updateCategoryLocal(cat.id, { messaging_approach: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Outreach angle</Label>
                            <Textarea
                              rows={2}
                              value={cat.outreach_angle ?? ''}
                              onChange={(e) => updateCategoryLocal(cat.id, { outreach_angle: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">Form fields (comma-separated keys)</Label>
                            <Input
                              value={cat.category_fields.join(', ')}
                              onChange={(e) =>
                                updateCategoryLocal(cat.id, {
                                  category_fields: e.target.value
                                    .split(',')
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                })
                              }
                              placeholder="partner, website, notes"
                            />
                          </div>
                          <Button type="button" size="sm" onClick={() => handleSaveCategory(cat)}>
                            Save category
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <Button type="button" variant="outline" onClick={handleAddCategory}>
                <Plus className="w-4 h-4 mr-2" />
                Add category
              </Button>
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  )
}
