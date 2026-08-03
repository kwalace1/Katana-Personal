/**
 * Canonical entity schema for Switch → Katana record ingest.
 * Switch sends records using these entity_type values and payload shapes.
 */

export type SwitchEntityType =
  | 'project'
  | 'task'
  | 'milestone'
  | 'customer'
  | 'employee'
  | 'inventory_item'

export interface CanonicalEntityField {
  name: string
  type: 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'enum' | 'json'
  required?: boolean
  enum_values?: string[]
  description?: string
}

export interface CanonicalEntityDefinition {
  entity_type: SwitchEntityType
  katana_table: string
  description: string
  fields: CanonicalEntityField[]
  relationships?: Record<string, { entity_type: SwitchEntityType; external_id_field: string }>
}

export const CANONICAL_ENTITIES: CanonicalEntityDefinition[] = [
  {
    entity_type: 'project',
    katana_table: 'projects',
    description: 'Katana PM project',
    fields: [
      { name: 'name', type: 'string', required: true },
      { name: 'status', type: 'enum', enum_values: ['active', 'completed', 'on-hold'], required: true },
      { name: 'progress', type: 'number' },
      { name: 'deadline', type: 'date', required: true },
      { name: 'starred', type: 'boolean' },
      { name: 'owner_name', type: 'string' },
      { name: 'created_by_name', type: 'string' },
    ],
  },
  {
    entity_type: 'task',
    katana_table: 'tasks',
    description: 'Task within a project',
    fields: [
      { name: 'title', type: 'string', required: true },
      { name: 'status', type: 'enum', enum_values: ['backlog', 'todo', 'in-progress', 'review', 'blocked', 'done'], required: true },
      { name: 'priority', type: 'enum', enum_values: ['low', 'medium', 'high'], required: true },
      { name: 'assignee_name', type: 'string' },
      { name: 'deadline', type: 'date', required: true },
      { name: 'progress', type: 'number' },
      { name: 'description', type: 'string' },
      { name: 'start_date', type: 'date' },
      { name: 'order_index', type: 'number' },
    ],
    relationships: {
      project: { entity_type: 'project', external_id_field: 'project_external_id' },
    },
  },
  {
    entity_type: 'milestone',
    katana_table: 'milestones',
    description: 'Project milestone',
    fields: [
      { name: 'name', type: 'string', required: true },
      { name: 'date', type: 'date', required: true },
      { name: 'status', type: 'enum', enum_values: ['completed', 'in-progress', 'upcoming'], required: true },
      { name: 'description', type: 'string' },
    ],
    relationships: {
      project: { entity_type: 'project', external_id_field: 'project_external_id' },
    },
  },
  {
    entity_type: 'customer',
    katana_table: 'cs_clients',
    description: 'Customer Success client account',
    fields: [
      { name: 'name', type: 'string', required: true },
      { name: 'industry', type: 'string' },
      { name: 'status', type: 'enum', enum_values: ['healthy', 'moderate', 'at-risk'] },
      { name: 'health_score', type: 'number' },
      { name: 'arr', type: 'number' },
      { name: 'renewal_date', type: 'date' },
      { name: 'nps_score', type: 'number' },
      { name: 'engagement_score', type: 'number' },
      { name: 'churn_risk', type: 'number' },
      { name: 'churn_trend', type: 'enum', enum_values: ['up', 'down', 'stable'] },
    ],
  },
  {
    entity_type: 'employee',
    katana_table: 'hr_employees',
    description: 'HR employee record',
    fields: [
      { name: 'name', type: 'string', required: true },
      { name: 'email', type: 'string', required: true },
      { name: 'position', type: 'string', required: true },
      { name: 'department', type: 'string', required: true },
      { name: 'status', type: 'enum', enum_values: ['Active', 'Onboarding', 'Inactive', 'On Leave'] },
      { name: 'phone', type: 'string' },
      { name: 'hire_date', type: 'date', required: true },
      { name: 'performance_score', type: 'number' },
    ],
  },
  {
    entity_type: 'inventory_item',
    katana_table: 'inventory_items',
    description: 'Inventory stock item',
    fields: [
      { name: 'product_name', type: 'string', required: true },
      { name: 'sku', type: 'string' },
      { name: 'on_hand_qty', type: 'number' },
      { name: 'min_qty', type: 'number' },
      { name: 'location', type: 'string' },
      { name: 'category', type: 'string' },
      { name: 'status', type: 'string' },
      { name: 'is_active', type: 'boolean' },
    ],
  },
]

export function getCanonicalEntity(type: string): CanonicalEntityDefinition | undefined {
  return CANONICAL_ENTITIES.find((e) => e.entity_type === type)
}

export function exportCanonicalSchema() {
  return {
    version: '1.0',
    entities: CANONICAL_ENTITIES,
    mapping_notes: [
      'Each ingest record must include entity_type, external_id, operation (upsert|delete), payload, and optional relationships.',
      'Relationships reference other records by external_id (e.g. task → project_external_id).',
      'Katana resolves parent IDs via switch_entity_mappings before insert.',
    ],
  }
}
