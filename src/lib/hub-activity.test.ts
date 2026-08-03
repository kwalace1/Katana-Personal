import { describe, it, expect } from 'vitest'
import { buildHubActivityFeed } from './hub-activity'

const emptyInput = {
  hrActivities: [],
  projectActivities: [],
  employees: [],
  reviews: [],
  goals: [],
  applications: [],
  recognitions: [],
  learningPaths: [],
  mentorships: [],
  csClients: [],
  csInteractions: [],
  csTasks: [],
  wfmJobs: [],
  wfmTechnicians: [],
  wfmTimesheets: [],
  inventoryMovements: [],
  inventoryTransactions: [],
  purchaseOrders: [],
  supportSubmissions: [],
  supportActivity: [],
  kyiCompanies: [],
}

describe('buildHubActivityFeed', () => {
  it('includes PM, HR, and customer success activity', () => {
    const feed = buildHubActivityFeed({
      ...emptyInput,
      projectActivities: [
        {
          id: 'pm1',
          project_id: 'p1',
          type: 'task_created',
          description: 'Task added to Website Redesign',
          user: 'Alex',
          created_at: '2026-06-09T10:00:00Z',
        },
      ],
      applications: [
        {
          id: 'a1',
          jobId: 'j1',
          anonymousId: 'CAND-1',
          jobTitle: 'Advisor',
          appliedDate: '2026-06-08T09:00:00Z',
          firstName: 'A',
          lastName: 'B',
          email: 'a@example.com',
          phone: '',
          location: '',
          coverLetter: '',
        },
      ],
      csInteractions: [
        {
          id: 'i1',
          client_id: 'c1',
          type: 'call',
          subject: 'Quarterly review',
          description: 'Discussed renewal',
          csm_id: null,
          interaction_date: '2026-06-10T14:00:00Z',
          created_at: '2026-06-10T14:00:00Z',
          client: {
            id: 'c1',
            name: 'Acme Corp',
            industry: 'Tech',
            health_score: 80,
            status: 'healthy',
            last_contact_date: '2026-06-10',
            churn_risk: 10,
            churn_trend: 'stable',
            nps_score: 50,
            arr: 100000,
            renewal_date: '2027-01-01',
            csm_id: null,
            engagement_score: 70,
            portal_logins: 5,
            feature_usage: 'high',
            support_tickets: 0,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-06-10T14:00:00Z',
          },
        },
      ],
    })

    expect(feed.some((item) => item.module === 'PM')).toBe(true)
    expect(feed.some((item) => item.module === 'Recruitment')).toBe(true)
    expect(feed.some((item) => item.module === 'Customers' && item.message.includes('Acme Corp'))).toBe(true)
    expect(feed[0]?.module).toBe('Customers')
  })

  it('includes workforce and inventory activity', () => {
    const feed = buildHubActivityFeed({
      ...emptyInput,
      wfmJobs: [
        {
          id: 'j1',
          job_number: 'JOB-100',
          title: 'HVAC repair',
          description: null,
          customer_name: 'Acme',
          customer_phone: null,
          customer_email: null,
          location: null,
          location_address: null,
          status: 'completed',
          priority: 'medium',
          technician_id: 't1',
          start_date: null,
          end_date: null,
          start_time: null,
          end_time: null,
          estimated_hours: null,
          actual_hours: null,
          notes: null,
          completion_notes: null,
          is_active: true,
          created_at: '2026-06-01T10:00:00Z',
          updated_at: '2026-06-10T16:00:00Z',
          technician: { id: 't1', name: 'Sam Tech', email: null, phone: null, role: 'technician', status: 'active', skills: null, hourly_rate: null, avatar_url: null, notes: null, is_active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
        },
      ],
      inventoryTransactions: [
        {
          id: 'tx1',
          type: 'scan-in',
          item_id: 'item1',
          sku: 'SKU-1',
          product_name: 'Filter',
          quantity: 5,
          transaction_date: '2026-06-10T12:00:00Z',
          user_name: 'Alex',
          reference: null,
          notes: null,
          location: 'A1',
          quantity_delta: 5,
          created_at: '2026-06-10T12:00:00Z',
        },
      ],
    })

    expect(feed.some((item) => item.module === 'WFM' && item.message.includes('JOB-100'))).toBe(true)
    expect(feed.some((item) => item.module === 'Inventory' && item.message.includes('Filter'))).toBe(true)
  })

  it('dedupes identical entries', () => {
    const feed = buildHubActivityFeed({
      ...emptyInput,
      hrActivities: [
        {
          id: '1',
          type: 'employee_added',
          description: 'Alex Kim added to Engineering as Engineer',
          created_at: '2026-06-09T12:00:00Z',
        },
      ],
      employees: [
        {
          id: 'e1',
          name: 'Alex Kim',
          position: 'Engineer',
          department: 'Engineering',
          status: 'Active',
          email: 'alex@example.com',
          hire_date: '2026-06-09',
          created_at: '2026-06-09T12:00:00Z',
          updated_at: '2026-06-09T12:00:00Z',
        },
      ],
    })

    expect(feed.filter((item) => item.message.includes('Alex Kim'))).toHaveLength(1)
  })
})
