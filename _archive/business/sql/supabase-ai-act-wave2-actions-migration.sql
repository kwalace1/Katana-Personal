-- ============================================================================
-- Agent Office Phase 2.2 wave 2 — HR / Customer / Careers / WFM / KYI kernels
-- Org-stamping SECURITY INVOKER status actions, same contract as PM/Support/
-- Inventory: ai_act_guard, explicit org re-check, enum validation, FOUND check
-- after UPDATE (→ not_permitted on RLS-blocked writes), audit on success+fail,
-- {ok} envelope. Row-id params are named per entity (NOT p_request_id — that is
-- reserved for the audit tracing id). Depends on ai_act_guard()/agent_action_audit_log().
-- ============================================================================

-- ---- HR --------------------------------------------------------------------
create or replace function public.ai_act_hr_set_time_off_status(
  p_time_off_id uuid, p_status text,
  p_agent_id text default null, p_agent_name text default null, p_session_id text default null,
  p_request_id text default null, p_approval_id text default null, p_autonomy_level smallint default 1
) returns jsonb language plpgsql set search_path to 'public' as $$
declare v_org uuid; v_payload jsonb; v_before hr_time_off_requests; v_row hr_time_off_requests;
begin
  v_payload := jsonb_build_object('time_off_id', p_time_off_id, 'status', p_status);
  v_org := public.ai_act_guard();
  if p_status not in ('Pending','Approved','Denied','Cancelled') then raise exception 'invalid_status: "%" (use Pending|Approved|Denied|Cancelled)', p_status; end if;
  select * into v_before from hr_time_off_requests t where t.id = p_time_off_id and t.organization_id = v_org;
  if not found then raise exception 'time_off_request_not_found'; end if;
  if v_before.status = p_status then return jsonb_build_object('ok',true,'action','hr.set_time_off_status','changed',false,'time_off',to_jsonb(v_before),'note','already that status'); end if;
  update hr_time_off_requests t set status = p_status, decided_by = auth.uid(), decided_at = now(), updated_at = now()
    where t.id = p_time_off_id and t.organization_id = v_org returning t.* into v_row;
  if not found then raise exception 'not_permitted: you cannot update this time-off request'; end if;
  perform public.agent_action_audit_log('hr.set_time_off_status','executed',v_payload,to_jsonb(v_before),to_jsonb(v_row),p_agent_id,p_agent_name,p_session_id,p_request_id,p_approval_id,p_autonomy_level,null);
  return jsonb_build_object('ok',true,'action','hr.set_time_off_status','changed',true,'before',to_jsonb(v_before),'time_off',to_jsonb(v_row));
exception when others then
  perform public.agent_action_audit_log('hr.set_time_off_status','failed',coalesce(v_payload,'{}'::jsonb),case when v_before.id is null then null else to_jsonb(v_before) end,null,p_agent_id,p_agent_name,p_session_id,p_request_id,p_approval_id,p_autonomy_level,sqlerrm);
  return jsonb_build_object('ok',false,'action','hr.set_time_off_status','error',sqlerrm);
end; $$;

create or replace function public.ai_act_hr_set_goal_status(
  p_goal_id uuid, p_status text,
  p_agent_id text default null, p_agent_name text default null, p_session_id text default null,
  p_request_id text default null, p_approval_id text default null, p_autonomy_level smallint default 1
) returns jsonb language plpgsql set search_path to 'public' as $$
declare v_org uuid; v_payload jsonb; v_before hr_goals; v_row hr_goals;
begin
  v_payload := jsonb_build_object('goal_id', p_goal_id, 'status', p_status);
  v_org := public.ai_act_guard();
  if p_status not in ('On Track','Behind','Complete','Cancelled') then raise exception 'invalid_status: "%" (use On Track|Behind|Complete|Cancelled)', p_status; end if;
  select * into v_before from hr_goals t where t.id = p_goal_id and t.organization_id = v_org;
  if not found then raise exception 'goal_not_found'; end if;
  if v_before.status = p_status then return jsonb_build_object('ok',true,'action','hr.set_goal_status','changed',false,'goal',to_jsonb(v_before),'note','already that status'); end if;
  update hr_goals t set status = p_status, updated_at = now() where t.id = p_goal_id and t.organization_id = v_org returning t.* into v_row;
  if not found then raise exception 'not_permitted: you cannot update this goal'; end if;
  perform public.agent_action_audit_log('hr.set_goal_status','executed',v_payload,to_jsonb(v_before),to_jsonb(v_row),p_agent_id,p_agent_name,p_session_id,p_request_id,p_approval_id,p_autonomy_level,null);
  return jsonb_build_object('ok',true,'action','hr.set_goal_status','changed',true,'before',to_jsonb(v_before),'goal',to_jsonb(v_row));
exception when others then
  perform public.agent_action_audit_log('hr.set_goal_status','failed',coalesce(v_payload,'{}'::jsonb),case when v_before.id is null then null else to_jsonb(v_before) end,null,p_agent_id,p_agent_name,p_session_id,p_request_id,p_approval_id,p_autonomy_level,sqlerrm);
  return jsonb_build_object('ok',false,'action','hr.set_goal_status','error',sqlerrm);
end; $$;

create or replace function public.ai_act_hr_set_employee_status(
  p_employee_id uuid, p_status text,
  p_agent_id text default null, p_agent_name text default null, p_session_id text default null,
  p_request_id text default null, p_approval_id text default null, p_autonomy_level smallint default 1
) returns jsonb language plpgsql set search_path to 'public' as $$
declare v_org uuid; v_payload jsonb; v_before hr_employees; v_row hr_employees;
begin
  v_payload := jsonb_build_object('employee_id', p_employee_id, 'status', p_status);
  v_org := public.ai_act_guard();
  if p_status not in ('Active','Onboarding','Inactive','On Leave') then raise exception 'invalid_status: "%" (use Active|Onboarding|Inactive|On Leave)', p_status; end if;
  select * into v_before from hr_employees t where t.id = p_employee_id and t.organization_id = v_org;
  if not found then raise exception 'employee_not_found'; end if;
  if v_before.status = p_status then return jsonb_build_object('ok',true,'action','hr.set_employee_status','changed',false,'employee',to_jsonb(v_before),'note','already that status'); end if;
  update hr_employees t set status = p_status, updated_at = now() where t.id = p_employee_id and t.organization_id = v_org returning t.* into v_row;
  if not found then raise exception 'not_permitted: you cannot update this employee'; end if;
  perform public.agent_action_audit_log('hr.set_employee_status','executed',v_payload,to_jsonb(v_before),to_jsonb(v_row),p_agent_id,p_agent_name,p_session_id,p_request_id,p_approval_id,p_autonomy_level,null);
  return jsonb_build_object('ok',true,'action','hr.set_employee_status','changed',true,'before',to_jsonb(v_before),'employee',to_jsonb(v_row));
exception when others then
  perform public.agent_action_audit_log('hr.set_employee_status','failed',coalesce(v_payload,'{}'::jsonb),case when v_before.id is null then null else to_jsonb(v_before) end,null,p_agent_id,p_agent_name,p_session_id,p_request_id,p_approval_id,p_autonomy_level,sqlerrm);
  return jsonb_build_object('ok',false,'action','hr.set_employee_status','error',sqlerrm);
end; $$;

-- ---- Customer Success ------------------------------------------------------
create or replace function public.ai_act_customer_set_task_status(
  p_task_id uuid, p_status text,
  p_agent_id text default null, p_agent_name text default null, p_session_id text default null,
  p_request_id text default null, p_approval_id text default null, p_autonomy_level smallint default 1
) returns jsonb language plpgsql set search_path to 'public' as $$
declare v_org uuid; v_payload jsonb; v_before cs_tasks; v_row cs_tasks;
begin
  v_payload := jsonb_build_object('task_id', p_task_id, 'status', p_status);
  v_org := public.ai_act_guard();
  if p_status not in ('active','completed','overdue') then raise exception 'invalid_status: "%" (use active|completed|overdue)', p_status; end if;
  select * into v_before from cs_tasks t where t.id = p_task_id and t.organization_id = v_org;
  if not found then raise exception 'task_not_found'; end if;
  if v_before.status = p_status then return jsonb_build_object('ok',true,'action','customer.set_task_status','changed',false,'task',to_jsonb(v_before),'note','already that status'); end if;
  update cs_tasks t set status = p_status, updated_at = now() where t.id = p_task_id and t.organization_id = v_org returning t.* into v_row;
  if not found then raise exception 'not_permitted: you cannot update this task'; end if;
  perform public.agent_action_audit_log('customer.set_task_status','executed',v_payload,to_jsonb(v_before),to_jsonb(v_row),p_agent_id,p_agent_name,p_session_id,p_request_id,p_approval_id,p_autonomy_level,null);
  return jsonb_build_object('ok',true,'action','customer.set_task_status','changed',true,'before',to_jsonb(v_before),'task',to_jsonb(v_row));
exception when others then
  perform public.agent_action_audit_log('customer.set_task_status','failed',coalesce(v_payload,'{}'::jsonb),case when v_before.id is null then null else to_jsonb(v_before) end,null,p_agent_id,p_agent_name,p_session_id,p_request_id,p_approval_id,p_autonomy_level,sqlerrm);
  return jsonb_build_object('ok',false,'action','customer.set_task_status','error',sqlerrm);
end; $$;

create or replace function public.ai_act_customer_set_milestone_status(
  p_milestone_id uuid, p_status text,
  p_agent_id text default null, p_agent_name text default null, p_session_id text default null,
  p_request_id text default null, p_approval_id text default null, p_autonomy_level smallint default 1
) returns jsonb language plpgsql set search_path to 'public' as $$
declare v_org uuid; v_payload jsonb; v_before cs_milestones; v_row cs_milestones;
begin
  v_payload := jsonb_build_object('milestone_id', p_milestone_id, 'status', p_status);
  v_org := public.ai_act_guard();
  if p_status not in ('completed','in-progress','upcoming') then raise exception 'invalid_status: "%" (use completed|in-progress|upcoming)', p_status; end if;
  select * into v_before from cs_milestones t where t.id = p_milestone_id and t.organization_id = v_org;
  if not found then raise exception 'milestone_not_found'; end if;
  if v_before.status = p_status then return jsonb_build_object('ok',true,'action','customer.set_milestone_status','changed',false,'milestone',to_jsonb(v_before),'note','already that status'); end if;
  update cs_milestones t set status = p_status, completed_date = case when p_status='completed' then now() else completed_date end, updated_at = now() where t.id = p_milestone_id and t.organization_id = v_org returning t.* into v_row;
  if not found then raise exception 'not_permitted: you cannot update this milestone'; end if;
  perform public.agent_action_audit_log('customer.set_milestone_status','executed',v_payload,to_jsonb(v_before),to_jsonb(v_row),p_agent_id,p_agent_name,p_session_id,p_request_id,p_approval_id,p_autonomy_level,null);
  return jsonb_build_object('ok',true,'action','customer.set_milestone_status','changed',true,'before',to_jsonb(v_before),'milestone',to_jsonb(v_row));
exception when others then
  perform public.agent_action_audit_log('customer.set_milestone_status','failed',coalesce(v_payload,'{}'::jsonb),case when v_before.id is null then null else to_jsonb(v_before) end,null,p_agent_id,p_agent_name,p_session_id,p_request_id,p_approval_id,p_autonomy_level,sqlerrm);
  return jsonb_build_object('ok',false,'action','customer.set_milestone_status','error',sqlerrm);
end; $$;

create or replace function public.ai_act_customer_set_client_status(
  p_client_id uuid, p_status text,
  p_agent_id text default null, p_agent_name text default null, p_session_id text default null,
  p_request_id text default null, p_approval_id text default null, p_autonomy_level smallint default 1
) returns jsonb language plpgsql set search_path to 'public' as $$
declare v_org uuid; v_payload jsonb; v_before cs_clients; v_row cs_clients;
begin
  v_payload := jsonb_build_object('client_id', p_client_id, 'status', p_status);
  v_org := public.ai_act_guard();
  if p_status not in ('healthy','moderate','at-risk') then raise exception 'invalid_status: "%" (use healthy|moderate|at-risk)', p_status; end if;
  select * into v_before from cs_clients t where t.id = p_client_id and t.organization_id = v_org;
  if not found then raise exception 'client_not_found'; end if;
  if v_before.status = p_status then return jsonb_build_object('ok',true,'action','customer.set_client_status','changed',false,'client',to_jsonb(v_before),'note','already that status'); end if;
  update cs_clients t set status = p_status, updated_at = now() where t.id = p_client_id and t.organization_id = v_org returning t.* into v_row;
  if not found then raise exception 'not_permitted: you cannot update this client'; end if;
  perform public.agent_action_audit_log('customer.set_client_status','executed',v_payload,to_jsonb(v_before),to_jsonb(v_row),p_agent_id,p_agent_name,p_session_id,p_request_id,p_approval_id,p_autonomy_level,null);
  return jsonb_build_object('ok',true,'action','customer.set_client_status','changed',true,'before',to_jsonb(v_before),'client',to_jsonb(v_row));
exception when others then
  perform public.agent_action_audit_log('customer.set_client_status','failed',coalesce(v_payload,'{}'::jsonb),case when v_before.id is null then null else to_jsonb(v_before) end,null,p_agent_id,p_agent_name,p_session_id,p_request_id,p_approval_id,p_autonomy_level,sqlerrm);
  return jsonb_build_object('ok',false,'action','customer.set_client_status','error',sqlerrm);
end; $$;

-- ---- Careers ---------------------------------------------------------------
create or replace function public.ai_act_careers_set_application_status(
  p_application_id uuid, p_status text,
  p_agent_id text default null, p_agent_name text default null, p_session_id text default null,
  p_request_id text default null, p_approval_id text default null, p_autonomy_level smallint default 1
) returns jsonb language plpgsql set search_path to 'public' as $$
declare v_org uuid; v_payload jsonb; v_before job_applications; v_row job_applications;
begin
  v_payload := jsonb_build_object('application_id', p_application_id, 'status', p_status);
  v_org := public.ai_act_guard();
  if p_status not in ('new','reviewing','interview-scheduled','interviewed','offer','rejected','withdrawn') then raise exception 'invalid_status: "%"', p_status; end if;
  select * into v_before from job_applications t where t.id = p_application_id and t.organization_id = v_org;
  if not found then raise exception 'application_not_found'; end if;
  if v_before.status = p_status then return jsonb_build_object('ok',true,'action','careers.set_application_status','changed',false,'application',to_jsonb(v_before),'note','already that status'); end if;
  update job_applications t set status = p_status, updated_at = now() where t.id = p_application_id and t.organization_id = v_org returning t.* into v_row;
  if not found then raise exception 'not_permitted: you cannot update this application'; end if;
  perform public.agent_action_audit_log('careers.set_application_status','executed',v_payload,to_jsonb(v_before),to_jsonb(v_row),p_agent_id,p_agent_name,p_session_id,p_request_id,p_approval_id,p_autonomy_level,null);
  return jsonb_build_object('ok',true,'action','careers.set_application_status','changed',true,'before',to_jsonb(v_before),'application',to_jsonb(v_row));
exception when others then
  perform public.agent_action_audit_log('careers.set_application_status','failed',coalesce(v_payload,'{}'::jsonb),case when v_before.id is null then null else to_jsonb(v_before) end,null,p_agent_id,p_agent_name,p_session_id,p_request_id,p_approval_id,p_autonomy_level,sqlerrm);
  return jsonb_build_object('ok',false,'action','careers.set_application_status','error',sqlerrm);
end; $$;

-- ---- WFM -------------------------------------------------------------------
create or replace function public.ai_act_wfm_set_job_status(
  p_job_id uuid, p_status text,
  p_agent_id text default null, p_agent_name text default null, p_session_id text default null,
  p_request_id text default null, p_approval_id text default null, p_autonomy_level smallint default 1
) returns jsonb language plpgsql set search_path to 'public' as $$
declare v_org uuid; v_payload jsonb; v_before wfm_jobs; v_row wfm_jobs;
begin
  v_payload := jsonb_build_object('job_id', p_job_id, 'status', p_status);
  v_org := public.ai_act_guard();
  if p_status not in ('assigned','in-progress','completed','on-hold','cancelled') then raise exception 'invalid_status: "%"', p_status; end if;
  select * into v_before from wfm_jobs t where t.id = p_job_id and t.organization_id = v_org;
  if not found then raise exception 'job_not_found'; end if;
  if v_before.status = p_status then return jsonb_build_object('ok',true,'action','wfm.set_job_status','changed',false,'job',to_jsonb(v_before),'note','already that status'); end if;
  update wfm_jobs t set status = p_status, updated_at = now() where t.id = p_job_id and t.organization_id = v_org returning t.* into v_row;
  if not found then raise exception 'not_permitted: you cannot update this job'; end if;
  perform public.agent_action_audit_log('wfm.set_job_status','executed',v_payload,to_jsonb(v_before),to_jsonb(v_row),p_agent_id,p_agent_name,p_session_id,p_request_id,p_approval_id,p_autonomy_level,null);
  return jsonb_build_object('ok',true,'action','wfm.set_job_status','changed',true,'before',to_jsonb(v_before),'job',to_jsonb(v_row));
exception when others then
  perform public.agent_action_audit_log('wfm.set_job_status','failed',coalesce(v_payload,'{}'::jsonb),case when v_before.id is null then null else to_jsonb(v_before) end,null,p_agent_id,p_agent_name,p_session_id,p_request_id,p_approval_id,p_autonomy_level,sqlerrm);
  return jsonb_build_object('ok',false,'action','wfm.set_job_status','error',sqlerrm);
end; $$;

create or replace function public.ai_act_wfm_set_timesheet_status(
  p_timesheet_id uuid, p_status text,
  p_agent_id text default null, p_agent_name text default null, p_session_id text default null,
  p_request_id text default null, p_approval_id text default null, p_autonomy_level smallint default 1
) returns jsonb language plpgsql set search_path to 'public' as $$
declare v_org uuid; v_payload jsonb; v_before wfm_timesheets; v_row wfm_timesheets;
begin
  v_payload := jsonb_build_object('timesheet_id', p_timesheet_id, 'status', p_status);
  v_org := public.ai_act_guard();
  if p_status not in ('pending','approved','rejected') then raise exception 'invalid_status: "%" (use pending|approved|rejected)', p_status; end if;
  select * into v_before from wfm_timesheets t where t.id = p_timesheet_id and t.organization_id = v_org;
  if not found then raise exception 'timesheet_not_found'; end if;
  if v_before.status = p_status then return jsonb_build_object('ok',true,'action','wfm.set_timesheet_status','changed',false,'timesheet',to_jsonb(v_before),'note','already that status'); end if;
  update wfm_timesheets t set status = p_status, approved_by = case when p_status='approved' then auth.uid() else approved_by end, approved_at = case when p_status='approved' then now() else approved_at end, updated_at = now()
    where t.id = p_timesheet_id and t.organization_id = v_org returning t.* into v_row;
  if not found then raise exception 'not_permitted: you cannot update this timesheet'; end if;
  perform public.agent_action_audit_log('wfm.set_timesheet_status','executed',v_payload,to_jsonb(v_before),to_jsonb(v_row),p_agent_id,p_agent_name,p_session_id,p_request_id,p_approval_id,p_autonomy_level,null);
  return jsonb_build_object('ok',true,'action','wfm.set_timesheet_status','changed',true,'before',to_jsonb(v_before),'timesheet',to_jsonb(v_row));
exception when others then
  perform public.agent_action_audit_log('wfm.set_timesheet_status','failed',coalesce(v_payload,'{}'::jsonb),case when v_before.id is null then null else to_jsonb(v_before) end,null,p_agent_id,p_agent_name,p_session_id,p_request_id,p_approval_id,p_autonomy_level,sqlerrm);
  return jsonb_build_object('ok',false,'action','wfm.set_timesheet_status','error',sqlerrm);
end; $$;

create or replace function public.ai_act_wfm_set_technician_status(
  p_technician_id uuid, p_status text,
  p_agent_id text default null, p_agent_name text default null, p_session_id text default null,
  p_request_id text default null, p_approval_id text default null, p_autonomy_level smallint default 1
) returns jsonb language plpgsql set search_path to 'public' as $$
declare v_org uuid; v_payload jsonb; v_before wfm_technicians; v_row wfm_technicians;
begin
  v_payload := jsonb_build_object('technician_id', p_technician_id, 'status', p_status);
  v_org := public.ai_act_guard();
  if p_status not in ('active','inactive','on-leave') then raise exception 'invalid_status: "%" (use active|inactive|on-leave)', p_status; end if;
  select * into v_before from wfm_technicians t where t.id = p_technician_id and t.organization_id = v_org;
  if not found then raise exception 'technician_not_found'; end if;
  if v_before.status = p_status then return jsonb_build_object('ok',true,'action','wfm.set_technician_status','changed',false,'technician',to_jsonb(v_before),'note','already that status'); end if;
  update wfm_technicians t set status = p_status, updated_at = now() where t.id = p_technician_id and t.organization_id = v_org returning t.* into v_row;
  if not found then raise exception 'not_permitted: you cannot update this technician'; end if;
  perform public.agent_action_audit_log('wfm.set_technician_status','executed',v_payload,to_jsonb(v_before),to_jsonb(v_row),p_agent_id,p_agent_name,p_session_id,p_request_id,p_approval_id,p_autonomy_level,null);
  return jsonb_build_object('ok',true,'action','wfm.set_technician_status','changed',true,'before',to_jsonb(v_before),'technician',to_jsonb(v_row));
exception when others then
  perform public.agent_action_audit_log('wfm.set_technician_status','failed',coalesce(v_payload,'{}'::jsonb),case when v_before.id is null then null else to_jsonb(v_before) end,null,p_agent_id,p_agent_name,p_session_id,p_request_id,p_approval_id,p_autonomy_level,sqlerrm);
  return jsonb_build_object('ok',false,'action','wfm.set_technician_status','error',sqlerrm);
end; $$;

-- ---- KYI -------------------------------------------------------------------
-- NOTE: kyi_investors.id is INTEGER (not uuid) — this signature differs.
create or replace function public.ai_act_kyi_set_investor_outreach(
  p_investor_id integer, p_status text,
  p_agent_id text default null, p_agent_name text default null, p_session_id text default null,
  p_request_id text default null, p_approval_id text default null, p_autonomy_level smallint default 1
) returns jsonb language plpgsql set search_path to 'public' as $$
declare v_org uuid; v_payload jsonb; v_before kyi_investors; v_row kyi_investors;
begin
  v_payload := jsonb_build_object('investor_id', p_investor_id, 'outreach_status', p_status);
  v_org := public.ai_act_guard();
  if p_status not in ('new','contacted','meeting','passed') then raise exception 'invalid_status: "%" (use new|contacted|meeting|passed)', p_status; end if;
  select * into v_before from kyi_investors t where t.id = p_investor_id and t.organization_id = v_org;
  if not found then raise exception 'investor_not_found'; end if;
  if v_before.outreach_status = p_status then return jsonb_build_object('ok',true,'action','kyi.set_investor_outreach','changed',false,'investor',to_jsonb(v_before),'note','already that status'); end if;
  update kyi_investors t set outreach_status = p_status, updated_at = now() where t.id = p_investor_id and t.organization_id = v_org returning t.* into v_row;
  if not found then raise exception 'not_permitted: you cannot update this investor'; end if;
  perform public.agent_action_audit_log('kyi.set_investor_outreach','executed',v_payload,to_jsonb(v_before),to_jsonb(v_row),p_agent_id,p_agent_name,p_session_id,p_request_id,p_approval_id,p_autonomy_level,null);
  return jsonb_build_object('ok',true,'action','kyi.set_investor_outreach','changed',true,'before',to_jsonb(v_before),'investor',to_jsonb(v_row));
exception when others then
  perform public.agent_action_audit_log('kyi.set_investor_outreach','failed',coalesce(v_payload,'{}'::jsonb),case when v_before.id is null then null else to_jsonb(v_before) end,null,p_agent_id,p_agent_name,p_session_id,p_request_id,p_approval_id,p_autonomy_level,sqlerrm);
  return jsonb_build_object('ok',false,'action','kyi.set_investor_outreach','error',sqlerrm);
end; $$;

-- ---- Grants (authenticated + service_role only) ----------------------------
do $$
declare fn text;
begin
  for fn in
    select unnest(array[
      'ai_act_hr_set_time_off_status','ai_act_hr_set_goal_status','ai_act_hr_set_employee_status',
      'ai_act_customer_set_task_status','ai_act_customer_set_milestone_status','ai_act_customer_set_client_status',
      'ai_act_careers_set_application_status','ai_act_wfm_set_job_status','ai_act_wfm_set_timesheet_status',
      'ai_act_wfm_set_technician_status'])
  loop
    execute format('revoke all on function public.%I(uuid, text, text, text, text, text, text, smallint) from public, anon', fn);
    execute format('grant execute on function public.%I(uuid, text, text, text, text, text, text, smallint) to authenticated, service_role', fn);
  end loop;
end $$;

-- kyi takes an integer id, grant separately
revoke all on function public.ai_act_kyi_set_investor_outreach(integer, text, text, text, text, text, text, smallint) from public, anon;
grant execute on function public.ai_act_kyi_set_investor_outreach(integer, text, text, text, text, text, text, smallint) to authenticated, service_role;
