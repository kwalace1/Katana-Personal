-- =============================================================================
-- Katana AI Agent Views  (ai_* read-only views)
-- =============================================================================
-- Purpose: give the Katana Agent Office a STABLE, ACCURATE, well-named data
-- surface so specialists never have to guess raw column names or enum values.
-- Each agent queries these views instead of raw tables.
--
-- Safe & additive: only CREATE OR REPLACE VIEW in public, prefixed `ai_`.
-- No base tables are modified. Re-runnable.
--
-- Every base-row view carries organization_id so tenant scoping can be added
-- later once org context is passed into the agent session.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- INVENTORY
-- ---------------------------------------------------------------------------
create or replace view public.ai_inventory_items as
select id, sku, product_name, category, location,
       on_hand_qty, min_qty, reorder_qty, allocated,
       unit_cost, total_value, supplier_name, status, is_active, organization_id
from public.inventory_items;

create or replace view public.ai_inventory_low_stock as
select id, sku, product_name, category, location,
       on_hand_qty, min_qty, reorder_qty, supplier_name, status, organization_id
from public.inventory_items
where is_active = true and on_hand_qty <= min_qty;

create or replace view public.ai_inventory_summary as
select count(*)                                                   as total_active_items,
       count(*) filter (where status = 'in-stock')               as in_stock,
       count(*) filter (where status = 'low-stock')              as low_stock,
       count(*) filter (where status = 'out-of-stock')           as out_of_stock,
       count(*) filter (where on_hand_qty <= min_qty)            as at_or_below_min,
       coalesce(sum(total_value), 0)                             as total_inventory_value
from public.inventory_items
where is_active = true;

create or replace view public.ai_purchase_orders as
select po.id, po.po_number, po.supplier_name, po.status, po.total,
       po.created_date, po.expected_date, po.received_date, po.created_by,
       count(li.id)                  as line_count,
       coalesce(sum(li.quantity), 0) as total_ordered_qty,
       po.organization_id
from public.purchase_orders po
left join public.po_line_items li on li.po_id = po.id
group by po.id;

create or replace view public.ai_suppliers as
select id, name, contact_name, email, phone, performance_score,
       lead_time, total_orders, on_time_delivery, is_active, organization_id
from public.suppliers;

create or replace view public.ai_inventory_movements as
select m.id, m.item_id, i.product_name, i.sku, m.change_qty, m.reason,
       m.reference, m.movement_date, m.user_name, m.organization_id
from public.inventory_movements m
left join public.inventory_items i on i.id = m.item_id;

-- ---------------------------------------------------------------------------
-- PROJECT MANAGEMENT (PM)
-- ---------------------------------------------------------------------------
create or replace view public.ai_projects as
select id, name, status, progress, deadline, total_tasks, completed_tasks,
       starred, owner_name, description, organization_id
from public.projects;

create or replace view public.ai_tasks as
select id, project_id, title, status, priority, assignee_name,
       assignee_employee_id, start_date, deadline, progress, milestone_id, organization_id
from public.tasks;

create or replace view public.ai_milestones as
select id, project_id, name, date, status, description, organization_id
from public.milestones;

create or replace view public.ai_sprints as
select id, project_id, name, goal, start_date, end_date, status, organization_id
from public.sprints;

create or replace view public.ai_pm_summary as
select (select count(*) from public.projects)                                  as total_projects,
       (select count(*) from public.projects where status = 'active')          as active_projects,
       (select count(*) from public.projects where status = 'completed')       as completed_projects,
       (select count(*) from public.tasks)                                     as total_tasks,
       (select count(*) from public.tasks where status = 'done')               as done_tasks,
       (select count(*) from public.tasks where status = 'in-progress')        as in_progress_tasks,
       (select count(*) from public.tasks where status in ('todo','backlog'))  as open_tasks;

-- ---------------------------------------------------------------------------
-- CUSTOMER SUCCESS / CRM (Customer Agent)
-- ---------------------------------------------------------------------------
create or replace view public.ai_clients as
select id, name, industry, status, lifecycle_stage, account_type, health_score,
       churn_risk, churn_trend, nps_score, arr, renewal_date, engagement_score,
       support_tickets, email, phone, website, outreach_status, organization_id
from public.cs_clients;

create or replace view public.ai_contacts as
select id, client_id, first_name, last_name, email, phone, job_title,
       is_primary, is_decision_maker, contact_role, sentiment, organization_id
from public.cs_contacts;

create or replace view public.ai_deals as
select id, title, client_id, contact_id, lead_id, stage_id, amount, currency,
       probability, expected_close_date, status, assigned_to, organization_id
from public.cs_deals;

create or replace view public.ai_invoices as
select id, invoice_number, client_id, status, subtotal, tax, total,
       due_date, paid_date, organization_id
from public.cs_invoices;

create or replace view public.ai_leads as
select id, first_name, last_name, email, company_name, account_type, source,
       status, score, industry, state, country, outreach_status,
       converted_client_id, organization_id
from public.cs_leads;

create or replace view public.ai_cs_summary as
select count(*)                          as total_clients,
       round(avg(health_score), 1)       as avg_health_score,
       coalesce(sum(arr), 0)             as total_arr,
       coalesce(sum(support_tickets), 0) as open_support_tickets,
       (select count(*) from public.cs_deals)  as total_deals,
       (select count(*) from public.cs_leads)  as total_leads,
       (select count(*) from public.cs_contacts) as total_contacts
from public.cs_clients;

-- ---------------------------------------------------------------------------
-- WORKFORCE MANAGEMENT (WFM)
-- ---------------------------------------------------------------------------
create or replace view public.ai_wfm_jobs as
select id, job_number, title, customer_name, location, status, priority,
       technician_id, start_date, end_date, estimated_hours, actual_hours,
       is_active, organization_id
from public.wfm_jobs;

create or replace view public.ai_wfm_technicians as
select id, name, email, phone, role, status, skills, hourly_rate,
       is_active, organization_id
from public.wfm_technicians;

create or replace view public.ai_wfm_schedules as
select id, technician_id, job_id, schedule_date, start_time, end_time,
       status, organization_id
from public.wfm_schedules;

create or replace view public.ai_wfm_timesheets as
select id, technician_id, job_id, clock_in, clock_out, total_hours,
       status, approved_by, organization_id
from public.wfm_timesheets;

create or replace view public.ai_wfm_summary as
select (select count(*) from public.wfm_jobs)                                   as total_jobs,
       (select count(*) from public.wfm_jobs where status = 'in-progress')      as in_progress_jobs,
       (select count(*) from public.wfm_jobs where status = 'assigned')         as assigned_jobs,
       (select count(*) from public.wfm_jobs where status = 'completed')        as completed_jobs,
       (select count(*) from public.wfm_technicians where is_active)            as active_technicians,
       (select count(*) from public.wfm_timesheets where status = 'pending')    as pending_timesheets;

-- ---------------------------------------------------------------------------
-- HR (shared by HR Agent and Employee Agent)
-- ---------------------------------------------------------------------------
create or replace view public.ai_hr_employees as
select id, name, position, department, status, email, phone, manager_id,
       hire_date, next_review_date, last_review_date, performance_score,
       location, organization_id
from public.hr_employees;

create or replace view public.ai_hr_goals as
select id, employee_id, goal, category, progress, status, due_date, organization_id
from public.hr_goals;

create or replace view public.ai_hr_reviews as
select id, employee_id, review_period, review_type, review_date, status,
       trend, reviewer_id, organization_id
from public.hr_performance_reviews;

create or replace view public.ai_hr_time_off as
select id, employee_id, type, start_date, end_date, reason, status,
       decided_by, organization_id
from public.hr_time_off_requests;

create or replace view public.ai_hr_training_courses as
select id, title, category, level, duration_hours, is_active, organization_id
from public.hr_training_courses;

create or replace view public.ai_hr_summary as
select (select count(*) from public.hr_employees)                                 as total_employees,
       (select count(*) from public.hr_employees where status = 'Active')         as active_employees,
       (select count(*) from public.hr_goals where status = 'Complete')           as completed_goals,
       (select count(*) from public.hr_goals where status = 'Behind')             as behind_goals,
       (select count(*) from public.hr_time_off_requests where status = 'Approved') as approved_time_off,
       (select count(distinct department) from public.hr_employees)               as departments;

-- ---------------------------------------------------------------------------
-- CAREERS / RECRUITMENT (Careers Agent)
-- ---------------------------------------------------------------------------
create or replace view public.ai_job_postings as
select id, title, department, location, type, level, salary, posted_date,
       is_active, organization_id
from public.job_postings;

create or replace view public.ai_job_applications as
select id, job_id, status, applied_date, first_name, last_name, email,
       location, rating, interview_date, organization_id
from public.job_applications;

create or replace view public.ai_talent_pool as
select id, first_name, last_name, email, location, source_job_title,
       source_department, rating, pool_status, organization_id
from public.recruitment_talent_pool;

create or replace view public.ai_careers_summary as
select (select count(*) from public.job_postings where is_active)                       as active_postings,
       (select count(*) from public.job_applications)                                   as total_applications,
       (select count(*) from public.job_applications where status = 'new')              as new_applications,
       (select count(*) from public.job_applications where status = 'interview-scheduled') as interviews_scheduled,
       (select count(*) from public.recruitment_talent_pool)                            as talent_pool_size;

-- ---------------------------------------------------------------------------
-- KNOW YOUR INVESTOR (KYI Agent)
-- ---------------------------------------------------------------------------
create or replace view public.ai_kyi_investors as
select id, company_id, full_name, email, phone, location, industry, firm,
       title, investor_type, outreach_status, segment_type, organization_id
from public.kyi_investors;

create or replace view public.ai_kyi_companies as
select id, name, location, industry, website, raise_stage,
       raise_target_amount, organization_id
from public.kyi_companies;

create or replace view public.ai_kyi_leads as
select id, display_name, entity_type, city, state, country, raw_score,
       investor_type_id, created_at
from public.kyi_investor_leads;

create or replace view public.ai_kyi_summary as
select (select count(*) from public.kyi_investors)      as total_investors,
       (select count(*) from public.kyi_companies)      as total_companies,
       (select count(*) from public.kyi_investor_leads) as total_leads;

-- ---------------------------------------------------------------------------
-- COMMS (Comms Agent)
-- ---------------------------------------------------------------------------
create or replace view public.ai_comms_channels as
select id, name, description, channel_type, is_private, created_by,
       created_at, organization_id
from public.comms_channels;

create or replace view public.ai_comms_messages as
select m.id, m.channel_id, c.name as channel_name, m.conversation_id,
       m.sender_id, m.content, m.created_at
from public.comms_messages m
left join public.comms_channels c on c.id = m.channel_id;

create or replace view public.ai_comms_summary as
select (select count(*) from public.comms_channels)      as total_channels,
       (select count(*) from public.comms_messages)      as total_messages,
       (select count(*) from public.comms_conversations) as total_conversations;

-- ---------------------------------------------------------------------------
-- AUTOMATION (Automation Agent) - RAG / documents / files
-- ---------------------------------------------------------------------------
create or replace view public.ai_rag_documents as
select id, source_path, source_type, chunk_index, created_at
from public.rag_documents;

create or replace view public.ai_storage_files as
select id, module, bucket, file_name, file_size, mime_type, created_at, organization_id
from public.storage_files;

create or replace view public.ai_automation_summary as
select (select count(*) from public.rag_documents)                       as total_rag_chunks,
       (select count(distinct source_path) from public.rag_documents)    as total_documents,
       (select count(*) from public.storage_files)                       as total_files;

-- ---------------------------------------------------------------------------
-- SUPPORT (Support Agent)
-- ---------------------------------------------------------------------------
create or replace view public.ai_support_submissions as
select id, submission_type, category, subject, status, priority,
       module_context, assigned_to_name, organization_name, submitter_name,
       created_at, updated_at, organization_id
from public.support_submissions;

create or replace view public.ai_support_activity as
select id, submission_id, actor_name, action_type, from_status, to_status,
       from_priority, to_priority, created_at
from public.support_submission_activity;

create or replace view public.ai_support_summary as
select count(*)                                                  as total_submissions,
       count(*) filter (where status = 'open')                  as open_submissions,
       count(*) filter (where status = 'closed')                as closed_submissions,
       count(*) filter (where submission_type = 'issue')        as issues,
       count(*) filter (where submission_type = 'feedback')     as feedback
from public.support_submissions;

-- ---------------------------------------------------------------------------
-- TENANT ISOLATION (RLS)
-- ---------------------------------------------------------------------------
-- Make every ai_* view run with the QUERYING USER's privileges (security_invoker)
-- so the base-table RLS policies (organization_id = get_user_organization_id())
-- apply. Then grant SELECT to the authenticated role. Result: when an agent
-- queries as the signed-in user (anon key + that user's JWT), it can ONLY ever
-- see that user's organization - enforced by Postgres, not by the model.
do $$
declare v record;
begin
  for v in
    select table_name from information_schema.views
    where table_schema = 'public' and table_name like 'ai\_%' escape '\'
  loop
    execute format('alter view public.%I set (security_invoker = true)', v.table_name);
    execute format('grant select on public.%I to authenticated', v.table_name);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- ai_query: read-only SQL gateway for the Agent Office (RLS-enforced)
-- ---------------------------------------------------------------------------
-- Agents call this RPC (as the signed-in user, via anon key + their JWT) with a
-- single SELECT. SECURITY INVOKER means it runs with the caller's privileges, so
-- RLS confines every result to the user's organization - the model cannot reach
-- another org's data no matter what SQL it writes. Only read-only SELECT/WITH is
-- allowed; writes and multi-statement input are rejected.
create or replace function public.ai_query(q text)
returns jsonb
language plpgsql
security invoker
as $$
declare
  result jsonb;
  cleaned text;
  lowered text;
begin
  cleaned := rtrim(btrim(q), ';');
  lowered := lower(ltrim(cleaned));
  if position(';' in cleaned) > 0 then
    raise exception 'Only a single read-only statement is allowed';
  end if;
  if not (lowered like 'select%' or lowered like 'with%') then
    raise exception 'Only read-only SELECT queries are allowed';
  end if;
  execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from (%s) t', cleaned) into result;
  return result;
end;
$$;
revoke all on function public.ai_query(text) from public;
grant execute on function public.ai_query(text) to authenticated;
