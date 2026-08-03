export type EsignDocumentStatus =
  | 'draft'
  | 'pending'
  | 'partially_signed'
  | 'signed'
  | 'cancelled'
  | 'expired'

export type EsignFieldType = 'signature' | 'name' | 'date'

export interface EsignFieldBlueprint {
  field_type: EsignFieldType
  page_index: number
  x_pct: number
  y_pct: number
  width_pct: number
  height_pct: number
  signer_order?: number
}

export interface EsignDocument {
  id: string
  organization_id: string
  title: string
  description: string | null
  status: EsignDocumentStatus
  file_path: string
  file_name: string
  mime_type: string
  signed_file_path: string | null
  expires_at: string | null
  client_id: string | null
  project_id: string | null
  template_id: string | null
  last_reminded_at: string | null
  reminder_every_days: number | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface EsignSigner {
  id: string
  organization_id: string
  document_id: string
  name: string
  email: string | null
  signing_token: string
  signing_order: number
  signed_at: string | null
  signature_text: string | null
  signature_image_path: string | null
  ip_address: string | null
  user_agent: string | null
  token_expires_at: string | null
  created_at: string
}

export interface EsignField {
  id: string
  organization_id: string
  document_id: string
  signer_id: string | null
  field_type: EsignFieldType
  page_index: number
  x_pct: number
  y_pct: number
  width_pct: number
  height_pct: number
  created_at: string
}

export interface EsignTemplate {
  id: string
  organization_id: string
  name: string
  description: string | null
  default_title: string | null
  field_blueprint: EsignFieldBlueprint[]
  default_signer_count: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface EsignDocumentWithRelations extends EsignDocument {
  signers: EsignSigner[]
  fields: EsignField[]
}

export interface EsignDashboardStats {
  total: number
  pending: number
  partiallySigned: number
  signed: number
  draft: number
}

export interface CreateEsignDocumentInput {
  title: string
  description?: string
  expiresInDays?: number | null
  reminderEveryDays?: number | null
  file: File
  signers: Array<{ name: string; email?: string }>
  clientId?: string | null
  projectId?: string | null
  templateId?: string | null
}

export interface EsignSigningOrgBrand {
  name: string
  logoUrl: string | null
}

export interface EsignSigningPacket {
  signer: Pick<EsignSigner, 'id' | 'name' | 'email' | 'signing_order' | 'signed_at'>
  document: Pick<
    EsignDocument,
    'id' | 'title' | 'description' | 'status' | 'file_name' | 'mime_type' | 'expires_at' | 'signed_file_path'
  >
  fields: EsignField[]
  organization: EsignSigningOrgBrand
  alreadySigned: boolean
  cancelled: boolean
  expired: boolean
}

export const ESIGN_STATUS_LABELS: Record<EsignDocumentStatus, string> = {
  draft: 'Draft',
  pending: 'Awaiting signatures',
  partially_signed: 'Partially signed',
  signed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Expired',
}

export const ESIGN_FIELD_DEFAULTS: Record<
  EsignFieldType,
  { width_pct: number; height_pct: number; label: string }
> = {
  signature: { width_pct: 28, height_pct: 9, label: 'Signature' },
  name: { width_pct: 24, height_pct: 5, label: 'Printed name' },
  date: { width_pct: 16, height_pct: 5, label: 'Date' },
}
