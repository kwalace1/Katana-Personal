import { createClient } from '@supabase/supabase-js'

// Environment variables for Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key'

const PLACEHOLDER_SUPABASE_URLS = new Set([
  'https://placeholder.supabase.co',
  'https://your-project-ref.supabase.co',
])

/** True when URL/key are real project values (not template placeholders). */
export function isSupabaseEnvValid(): boolean {
  if (!supabaseUrl || !supabaseAnonKey) return false
  if (PLACEHOLDER_SUPABASE_URLS.has(supabaseUrl)) return false
  if (supabaseAnonKey === 'placeholder-key' || supabaseAnonKey === 'your_anon_key_here') return false
  return supabaseUrl.includes('.supabase.co')
}

export function getSupabaseProjectUrl(): string {
  return supabaseUrl
}

// Check if Supabase is properly configured
export const isSupabaseConfigured = isSupabaseEnvValid()

// Log environment check (will be removed in production builds)
if (import.meta.env.DEV) {
  console.log('Supabase URL configured:', isSupabaseConfigured)
  console.log('Supabase project URL:', supabaseUrl)
  console.log('Supabase Key configured:', supabaseAnonKey !== 'placeholder-key')
  if (!isSupabaseConfigured) {
    console.warn('⚠️ Supabase is not configured - auth will be disabled')
  }
}

// Create Supabase client with timeout settings
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: {
      'X-Client-Info': 'katana-saas',
    },
  },
  db: {
    schema: 'public',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

// Database types
export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          name: string
          status: 'active' | 'completed' | 'on-hold'
          progress: number
          deadline: string
          total_tasks: number
          completed_tasks: number
          starred: boolean
          created_by_name: string | null
          created_by_avatar: string | null
          owner_name: string | null
          owner_avatar: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['projects']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['projects']['Insert']>
      }
      tasks: {
        Row: {
          id: string
          project_id: string
          title: string
          status: 'backlog' | 'todo' | 'in-progress' | 'review' | 'blocked' | 'done'
          priority: 'low' | 'medium' | 'high'
          assignee_name: string
          assignee_avatar: string
          start_date: string | null
          deadline: string
          progress: number
          description: string | null
          milestone_id: string | null
          order_index: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['tasks']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>
      }
      milestones: {
        Row: {
          id: string
          project_id: string
          name: string
          date: string
          status: 'completed' | 'in-progress' | 'upcoming'
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['milestones']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['milestones']['Insert']>
      }
      team_members: {
        Row: {
          id: string
          project_id: string
          name: string
          role: string
          avatar: string
          capacity: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['team_members']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['team_members']['Insert']>
      }
      project_files: {
        Row: {
          id: string
          project_id: string
          name: string
          type: string
          uploaded_by: string
          uploaded_at: string
          size: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['project_files']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['project_files']['Insert']>
      }
      activities: {
        Row: {
          id: string
          project_id: string
          type: string
          description: string
          user: string
          timestamp: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['activities']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['activities']['Insert']>
      }
      milestone_tasks: {
        Row: {
          milestone_id: string
          task_id: string
          created_at: string
        }
        Insert: Database['public']['Tables']['milestone_tasks']['Row']
        Update: Partial<Database['public']['Tables']['milestone_tasks']['Insert']>
      }
      csm_users: {
        Row: {
          id: string
          name: string
          email: string
          avatar: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['csm_users']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['csm_users']['Insert']>
      }
      cs_clients: {
        Row: {
          id: string
          name: string
          industry: string
          health_score: number
          status: 'healthy' | 'moderate' | 'at-risk'
          last_contact_date: string
          churn_risk: number
          churn_trend: 'up' | 'down' | 'stable'
          nps_score: number
          arr: number
          renewal_date: string
          csm_id: string | null
          engagement_score: number
          portal_logins: number
          feature_usage: string
          support_tickets: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['cs_clients']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['cs_clients']['Insert']>
      }
      cs_health_history: {
        Row: {
          id: string
          client_id: string
          health_score: number
          recorded_at: string
        }
        Insert: Omit<Database['public']['Tables']['cs_health_history']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['cs_health_history']['Insert']>
      }
      cs_tasks: {
        Row: {
          id: string
          client_id: string
          title: string
          status: 'active' | 'completed' | 'overdue'
          due_date: string
          priority: 'low' | 'medium' | 'high'
          assigned_to: string | null
          kyc_action_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['cs_tasks']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['cs_tasks']['Insert']>
      }
      cs_milestones: {
        Row: {
          id: string
          client_id: string
          title: string
          description: string | null
          status: 'completed' | 'in-progress' | 'upcoming'
          target_date: string
          completed_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['cs_milestones']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['cs_milestones']['Insert']>
      }
      cs_interactions: {
        Row: {
          id: string
          client_id: string
          type: 'email' | 'call' | 'meeting'
          subject: string
          description: string
          csm_id: string | null
          interaction_date: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['cs_interactions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['cs_interactions']['Insert']>
      }
      job_postings: {
        Row: {
          id: string
          title: string
          department: string
          location: string
          type: 'full-time' | 'part-time' | 'contract' | 'internship'
          level: 'entry' | 'mid' | 'senior' | 'lead'
          salary: string
          posted_date: string
          description: string
          responsibilities: string[]
          qualifications: string[]
          benefits: string[]
          is_active: boolean
          application_count: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['job_postings']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['job_postings']['Insert']>
      }
      job_applications: {
        Row: {
          id: string
          anonymous_id: string
          job_id: string
          status: 'new' | 'reviewing' | 'interview-scheduled' | 'interviewed' | 'offer' | 'rejected' | 'withdrawn'
          applied_date: string
          first_name: string
          last_name: string
          email: string
          phone: string
          location: string
          resume_file_name: string | null
          resume_url: string | null
          cover_letter: string
          linkedin: string | null
          portfolio: string | null
          is_revealed: boolean
          revealed_at: string | null
          revealed_by: string | null
          notes: string | null
          rating: number | null
          interview_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['job_applications']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['job_applications']['Insert']>
      }
    }
  }
}





