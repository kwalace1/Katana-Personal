/**
 * Centralized input validation schemas for all Katana modules.
 * Uses Zod for runtime type-checking before any data hits Supabase.
 */

import { z } from 'zod'

const nonEmptyString = z.string().trim().min(1, 'Required')
const optionalString = z.string().trim().optional().or(z.literal(''))
const uuid = z.string().uuid()
const optionalUuid = z.string().uuid().optional().nullable()

// ==================== SHARED ====================

export const sanitizeString = (input: string): string =>
  input.replace(/<[^>]*>/g, '').trim()

export const sanitizeObject = <T extends Record<string, unknown>>(obj: T): T => {
  const result = { ...obj }
  for (const key of Object.keys(result)) {
    const val = result[key]
    if (typeof val === 'string') {
      ;(result as Record<string, unknown>)[key] = sanitizeString(val)
    }
  }
  return result
}

// ==================== PROJECTS ====================

export const projectSchema = z.object({
  name: nonEmptyString.max(200),
  status: z.enum(['active', 'completed', 'on-hold']),
  progress: z.number().int().min(0).max(100),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid date format'),
  totalTasks: z.number().int().min(0).default(0),
  completedTasks: z.number().int().min(0).default(0),
  starred: z.boolean().default(false),
})

export const taskSchema = z.object({
  title: nonEmptyString.max(500),
  status: z.enum(['backlog', 'todo', 'in-progress', 'review', 'blocked', 'done']),
  priority: z.enum(['low', 'medium', 'high']),
  assignee: z.object({
    name: z.string().max(200).default(''),
    avatar: z.string().max(500).default(''),
  }).optional(),
  startDate: optionalString,
  deadline: optionalString,
  progress: z.number().int().min(0).max(100).default(0),
  description: optionalString.nullable(),
  milestoneId: optionalUuid,
})

export const milestoneSchema = z.object({
  name: nonEmptyString.max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid date format'),
  status: z.enum(['completed', 'in-progress', 'upcoming']),
  description: optionalString.nullable(),
  taskIds: z.array(uuid).optional(),
})

// ==================== HR ====================

export const employeeSchema = z.object({
  name: nonEmptyString.max(200),
  position: nonEmptyString.max(200),
  department: nonEmptyString.max(100),
  status: z.enum(['Active', 'Onboarding', 'Inactive', 'On Leave']),
  email: z.string().email().max(254),
  phone: optionalString.nullable(),
  hire_date: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid date format'),
  manager_id: optionalUuid,
})

export const performanceReviewSchema = z.object({
  employee_id: uuid,
  review_period: nonEmptyString.max(100),
  review_type: z.enum(['quarterly', 'annual', 'probation', 'promotion']),
  review_format: z.enum(['standard', 'self_assessment']).optional(),
  review_date: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  collaboration: z.number().min(0).max(5),
  accountability: z.number().min(0).max(5),
  trustworthy: z.number().min(0).max(5),
  leadership: z.number().min(0).max(5),
  strengths: optionalString.nullable(),
  improvements: optionalString.nullable(),
  goals: optionalString.nullable(),
  trend: z.enum(['up', 'down', 'stable']),
  status: z.enum(['on-time', 'overdue', 'upcoming']),
})

export const goalSchema = z.object({
  employee_id: uuid,
  goal: nonEmptyString.max(500),
  category: nonEmptyString.max(100),
  progress: z.number().int().min(0).max(100),
  status: z.enum(['On Track', 'Behind', 'Complete', 'Cancelled']),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  description: optionalString.nullable(),
})

// ==================== KYI ====================

export const kyiCompanySchema = z.object({
  name: nonEmptyString.max(300),
  location: optionalString.nullable(),
  industry: optionalString.nullable(),
  website: optionalString.nullable(),
  description: optionalString.nullable(),
})

export const kyiInvestorSchema = z.object({
  name: nonEmptyString.max(300),
  company_id: z.number().int().positive().or(uuid),
  investor_type: optionalString.nullable(),
  location: optionalString.nullable(),
  email: z.string().email().max(254).optional().nullable().or(z.literal('')),
  phone: optionalString.nullable(),
})

// ==================== COMMS ====================

export const channelSchema = z.object({
  name: nonEmptyString.max(100),
  description: optionalString.nullable(),
  channel_type: z.enum(['department', 'team', 'project', 'general']),
  is_private: z.boolean().default(false),
})

export const messageSchema = z.object({
  content: nonEmptyString.max(10000),
  channel_id: optionalUuid,
  conversation_id: optionalUuid,
  parent_message_id: optionalUuid,
})

// ==================== FILE UPLOAD ====================

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB

const ALLOWED_FILE_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/zip',
  'application/json',
])

const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'txt', 'csv', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg',
  'zip', 'json',
])

export interface FileValidationResult {
  valid: boolean
  error?: string
}

export function validateFile(file: File): FileValidationResult {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit` }
  }

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `File type .${ext || 'unknown'} is not allowed` }
  }

  if (file.type && !ALLOWED_FILE_TYPES.has(file.type)) {
    return { valid: false, error: `MIME type ${file.type} is not allowed` }
  }

  return { valid: true }
}

export function validateFiles(files: File[]): FileValidationResult {
  for (const file of files) {
    const result = validateFile(file)
    if (!result.valid) return result
  }
  return { valid: true }
}
