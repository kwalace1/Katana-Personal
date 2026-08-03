import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier, type Supplier } from "@/lib/inventory-api"
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Package,
  Mail,
  Phone,
  MapPin,
  TrendingUp,
  Clock,
  Truck,
} from "lucide-react"
import { isSupabaseConfigured } from "@/lib/supabase"
import {
  InventoryShell,
  InventoryContent,
  InventorySubpageHeader,
  InventoryNotConfigured,
  InventorySearchInput,
  InventoryEmptyState,
} from "@/components/inventory/InventoryUi"

export function SuppliersList() {
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 6
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [newSupplier, setNewSupplier] = useState({
    name: "",
    contact_name: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
  })
  const [viewSupplier, setViewSupplier] = useState<Supplier | null>(null)
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null)
  const [editForm, setEditForm] = useState({
    name: "",
    contact_name: "",
    email: "",
    phone: "",
    address: "",
    lead_time: "0",
    notes: "",
  })
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetchSuppliers()
  }, [])

  const fetchSuppliers = async () => {
    setLoading(true)
    try {
      const data = await getSuppliers()
      setSuppliers(data)
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddSupplier = async () => {
    if (!newSupplier.name.trim()) return
    setSubmitting(true)
    try {
      await createSupplier({
        name: newSupplier.name.trim(),
        contact_name: newSupplier.contact_name || null,
        email: newSupplier.email || null,
        phone: newSupplier.phone || null,
        address: newSupplier.address || null,
        performance_score: 100,
        lead_time: 0,
        total_orders: 0,
        on_time_delivery: 100,
        notes: newSupplier.notes || null,
        is_active: true,
      })
      setIsAddOpen(false)
      setNewSupplier({ name: "", contact_name: "", email: "", phone: "", address: "", notes: "" })
      await fetchSuppliers()
    } catch (error) {
      console.error("Error creating supplier:", error)
    } finally {
      setSubmitting(false)
    }
  }

  const openEdit = (supplier: Supplier) => {
    setEditSupplier(supplier)
    setEditForm({
      name: supplier.name,
      contact_name: supplier.contact_name || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      address: supplier.address || "",
      lead_time: String(supplier.lead_time ?? 0),
      notes: supplier.notes || "",
    })
  }

  const handleUpdateSupplier = async () => {
    if (!editSupplier || !editForm.name.trim()) return
    setSubmitting(true)
    try {
      await updateSupplier(editSupplier.id, {
        name: editForm.name.trim(),
        contact_name: editForm.contact_name || null,
        email: editForm.email || null,
        phone: editForm.phone || null,
        address: editForm.address || null,
        lead_time: parseInt(editForm.lead_time, 10) || 0,
        notes: editForm.notes || null,
      })
      setEditSupplier(null)
      await fetchSuppliers()
    } catch (error) {
      console.error("Error updating supplier:", error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteSupplier = async (id: string) => {
    setDeletingId(id)
    try {
      await deleteSupplier(id)
      await fetchSuppliers()
    } catch (error) {
      console.error("Error deleting supplier:", error)
    } finally {
      setDeletingId(null)
    }
  }

  const filteredSuppliers = suppliers.filter(
    (supplier) =>
      supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (supplier.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
      (supplier.email?.toLowerCase().includes(searchQuery.toLowerCase()) || false),
  )

  const totalPages = Math.ceil(filteredSuppliers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedSuppliers = filteredSuppliers.slice(startIndex, startIndex + itemsPerPage)

  const getPerformanceColor = (score: number) => {
    if (score >= 90) return "text-green-600"
    if (score >= 80) return "text-yellow-600"
    return "text-red-600"
  }

  if (!isSupabaseConfigured) {
    return <InventoryNotConfigured title="Supabase Not Configured" />
  }

  return (
    <InventoryShell>
      <InventoryContent>
        <InventorySubpageHeader
          icon={Truck}
          title="Suppliers"
          description="Manage supplier relationships and performance"
          actions={
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button type="button">
                <Plus className="w-4 h-4 mr-2" />
                Add Supplier
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Supplier</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Supplier Name *</Label>
                  <Input
                    placeholder="Company name"
                    value={newSupplier.name}
                    onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Contact Name</Label>
                    <Input
                      placeholder="Contact person"
                      value={newSupplier.contact_name}
                      onChange={(e) => setNewSupplier({ ...newSupplier, contact_name: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      placeholder="email@company.com"
                      value={newSupplier.email}
                      onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Phone</Label>
                    <Input
                      placeholder="Phone number"
                      value={newSupplier.phone}
                      onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Address</Label>
                    <Input
                      placeholder="Business address"
                      value={newSupplier.address}
                      onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Notes</Label>
                  <Textarea
                    placeholder="Additional notes..."
                    value={newSupplier.notes}
                    onChange={(e) => setNewSupplier({ ...newSupplier, notes: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleAddSupplier}
                  disabled={submitting || !newSupplier.name.trim()}
                >
                  {submitting ? "Creating..." : "Add Supplier"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          }
        />

        <InventorySearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search suppliers, contact, email…"
          className="mb-6 max-w-md"
        />
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : paginatedSuppliers.length === 0 ? (
          <InventoryEmptyState
            icon={Truck}
            title={searchQuery ? 'No suppliers match your search' : 'No suppliers yet'}
            description={searchQuery ? 'Try a different search term.' : 'Add your first supplier to link items and POs.'}
            action={
              !searchQuery ? (
                <Button size="sm" onClick={() => setIsAddOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Supplier
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {/* Suppliers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedSuppliers.map((supplier) => (
                <Card key={supplier.id} className="p-6 border-border/60 bg-card/80 hover:shadow-lg hover:border-border transition-all duration-200">
                  <div className="space-y-4">
                    {/* Supplier Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">{supplier.name}</h3>
                        <p className="text-sm text-muted-foreground">{supplier.contact_name || 'No contact'}</p>
                      </div>
                      <Badge className={`${getPerformanceColor(supplier.performance_score)} bg-transparent border`}>
                        {supplier.performance_score}%
                      </Badge>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{supplier.email || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{supplier.phone || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{supplier.address || 'N/A'}</span>
                      </div>
                    </div>

                    {/* Performance Metrics */}
                    <div className="grid grid-cols-3 gap-2 pt-4 border-t">
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Package className="w-3 h-3 text-muted-foreground" />
                        </div>
                        <p className="text-lg font-bold">{supplier.total_orders}</p>
                        <p className="text-xs text-muted-foreground">Orders</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                        </div>
                        <p className="text-lg font-bold">{supplier.lead_time}d</p>
                        <p className="text-xs text-muted-foreground">Lead Time</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <TrendingUp className="w-3 h-3 text-muted-foreground" />
                        </div>
                        <p className="text-lg font-bold">{supplier.on_time_delivery}%</p>
                        <p className="text-xs text-muted-foreground">On Time</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-transparent"
                        onClick={() => setViewSupplier(supplier)}
                      >
                        View Details
                      </Button>
                      <Button variant="ghost" size="sm" className="flex-1" onClick={() => openEdit(supplier)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => handleDeleteSupplier(supplier.id)}
                        disabled={deletingId === supplier.id}
                      >
                        {deletingId === supplier.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredSuppliers.length)} of{" "}
                {filteredSuppliers.length} suppliers
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {totalPages || 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}

        <Dialog open={!!viewSupplier} onOpenChange={(open) => !open && setViewSupplier(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{viewSupplier?.name}</DialogTitle>
            </DialogHeader>
            {viewSupplier && (
              <div className="space-y-3 text-sm">
                <p><span className="text-muted-foreground">Contact:</span> {viewSupplier.contact_name || "—"}</p>
                <p><span className="text-muted-foreground">Email:</span> {viewSupplier.email || "—"}</p>
                <p><span className="text-muted-foreground">Phone:</span> {viewSupplier.phone || "—"}</p>
                <p><span className="text-muted-foreground">Address:</span> {viewSupplier.address || "—"}</p>
                <p><span className="text-muted-foreground">Lead time:</span> {viewSupplier.lead_time} days</p>
                <p><span className="text-muted-foreground">Notes:</span> {viewSupplier.notes || "—"}</p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!editSupplier} onOpenChange={(open) => !open && setEditSupplier(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Supplier</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>Name *</Label>
                <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Contact</Label>
                  <Input value={editForm.contact_name} onChange={(e) => setEditForm({ ...editForm, contact_name: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Phone</Label>
                  <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label>Lead Time (days)</Label>
                  <Input type="number" value={editForm.lead_time} onChange={(e) => setEditForm({ ...editForm, lead_time: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Address</Label>
                <Input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Notes</Label>
                <Textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditSupplier(null)}>Cancel</Button>
              <Button onClick={handleUpdateSupplier} disabled={submitting || !editForm.name.trim()}>
                {submitting ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </InventoryContent>
    </InventoryShell>
  )
}
