-- ============================================================================
-- Agent Office Phase 2 — PM action kernel (ai_act_pm_*)
-- The security kernel for agent writes: a small allowlist of narrow,
-- org-stamping SECURITY INVOKER functions. Each one performs exactly one
-- well-defined mutation as the SIGNED-IN USER (their JWT → RLS applies),
-- re-checks organization_id explicitly, and writes an append-only audit row
-- via agent_action_audit_log(). There is NO generic "agent runs SQL" write
-- path — these functions are the only doors.
--
-- Also hardens ai_query(): a SELECT can smuggle a volatile function call
-- (e.g. `select ai_act_pm_create_task(...)`), so ai_query now marks its
-- transaction with a local GUC (ai.readonly) and every ai_act_* function
-- refuses to run when that flag is set. Writes must arrive as direct RPC
-- calls (POST /rest/v1/rpc/ai_act_...), which the engine only issues through
-- the approval-gated action tool.
--
-- Run in the Supabase SQL editor or via MCP apply_migration. Idempotent.
-- Order: apply AFTER supabase-agent-action-audits-migration.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Harden ai_query: flag the transaction read-only for the action kernel.
--    Body is byte-identical to the live phase-1 function plus the set_config
--    line — behavior for normal SELECTs is unchanged.
-- ----------------------------------------------------------------------------
create or replace function public.ai_query(q text)
 returns jsonb
 language plpgsql
as $function$
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
  -- Phase 2 hardening: transaction-local flag. ai_act_* functions refuse to
  -- execute while it is set, so the read tool can never be a write path.
  perform set_config('ai.readonly', 'true', true);
  execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from (%s) t', cleaned) into result;
  return result;
end;
$function$;

-- ----------------------------------------------------------------------------
-- 2. Shared guard: refuse read-only context, require a signed-in caller with
--    an organization. Returns the caller's org id.
-- ----------------------------------------------------------------------------
create or replace function public.ai_act_guard()
 returns uuid
 language plpgsql
 stable
 set search_path to 'public'
as $$
declare
  v_org uuid;
begin
  if coalesce(current_setting('ai.readonly', true), '') = 'true' then
    raise exception 'read_only_context: write actions cannot run through the read-only query tool';
  end if;
  if auth.uid() is null then
    raise exception 'not_signed_in';
  end if;
  v_org := public.get_user_organization_id();
  if v_org is null then
    raise exception 'no_organization';
  end if;
  return v_org;
end;
$$;

revoke all on function public.ai_act_guard() from public, anon;
grant execute on function public.ai_act_guard() to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. Assignee resolution: employee id OR exact email OR exact name (case-
--    insensitive), always inside the caller's org. Ambiguity is an error, not
--    a guess.
-- ----------------------------------------------------------------------------
create or replace function public.ai_act_pm_resolve_employee(
  p_org uuid,
  p_employee_id uuid default null,
  p_email text default null,
  p_name text default null
) returns table (employee_id uuid, employee_name text)
 language plpgsql
 stable
 set search_path to 'public'
as $$
declare
  v_matches integer;
begin
  if p_employee_id is not null then
    return query
      select e.id, e.name from hr_employees e
      where e.id = p_employee_id and e.organization_id = p_org;
    if not found then raise exception 'employee_not_found'; end if;
    return;
  end if;

  if nullif(btrim(coalesce(p_email, '')), '') is not null then
    select count(*) into v_matches from hr_employees e
      where e.organization_id = p_org and lower(e.email) = lower(btrim(p_email));
    if v_matches = 0 then raise exception 'employee_not_found'; end if;
    if v_matches > 1 then raise exception 'employee_ambiguous: multiple employees share that email'; end if;
    return query
      select e.id, e.name from hr_employees e
      where e.organization_id = p_org and lower(e.email) = lower(btrim(p_email))
      limit 1;
    return;
  end if;

  if nullif(btrim(coalesce(p_name, '')), '') is not null then
    select count(*) into v_matches from hr_employees e
      where e.organization_id = p_org and lower(e.name) = lower(btrim(p_name));
    if v_matches = 0 then raise exception 'employee_not_found: no employee named "%"', btrim(p_name);
    end if;
    if v_matches > 1 then
      raise exception 'employee_ambiguous: multiple employees named "%" — use employee id or email', btrim(p_name);
    end if;
    return query
      select e.id, e.name from hr_employees e
      where e.organization_id = p_org and lower(e.name) = lower(btrim(p_name))
      limit 1;
    return;
  end if;

  raise exception 'assignee_required: provide employee id, email, or exact name';
end;
$$;

revoke all on function public.ai_act_pm_resolve_employee(uuid, uuid, text, text) from public, anon;
grant execute on function public.ai_act_pm_resolve_employee(uuid, uuid, text, text) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. pm.create_task — insert one task into a project in the caller's org.
--    Note: projects.total_tasks / completed_tasks / progress are recomputed by
--    the app at read time (getProjectWithProgress), so no counter writes here.
-- ----------------------------------------------------------------------------
create or replace function public.ai_act_pm_create_task(
  p_project_id uuid,
  p_title text,
  p_deadline date,
  p_description text default null,
  p_status text default 'todo',
  p_priority text default 'medium',
  p_assignee_employee_id uuid default null,
  p_assignee_email text default null,
  p_assignee_name text default null,
  p_agent_id text default null,
  p_agent_name text default null,
  p_session_id text default null,
  p_request_id text default null,
  p_approval_id text default null,
  p_autonomy_level smallint default 1
) returns jsonb
 language plpgsql
 set search_path to 'public'
as $$
declare
  v_org uuid;
  v_payload jsonb;
  v_emp record;
  v_assignee_id uuid;
  v_assignee_name text := '';
  v_assignees jsonb := '[]'::jsonb;
  v_order integer;
  v_row tasks;
begin
  v_payload := jsonb_build_object(
    'project_id', p_project_id, 'title', p_title, 'description', p_description,
    'status', p_status, 'priority', p_priority, 'deadline', p_deadline,
    'assignee_employee_id', p_assignee_employee_id,
    'assignee_email', p_assignee_email, 'assignee_name', p_assignee_name
  );
  v_org := public.ai_act_guard();

  if p_title is null or btrim(p_title) = '' then raise exception 'title_required'; end if;
  if p_deadline is null then raise exception 'deadline_required'; end if;
  if p_status not in ('backlog', 'todo', 'in-progress', 'review', 'blocked', 'done') then
    raise exception 'invalid_status: "%" (use backlog|todo|in-progress|review|blocked|done)', p_status;
  end if;
  if p_priority not in ('low', 'medium', 'high') then
    raise exception 'invalid_priority: "%" (use low|medium|high)', p_priority;
  end if;
  if not exists (
    select 1 from projects pr where pr.id = p_project_id and pr.organization_id = v_org
  ) then
    raise exception 'project_not_found';
  end if;

  if p_assignee_employee_id is not null
     or nullif(btrim(coalesce(p_assignee_email, '')), '') is not null
     or nullif(btrim(coalesce(p_assignee_name, '')), '') is not null then
    select * into v_emp
      from public.ai_act_pm_resolve_employee(v_org, p_assignee_employee_id, p_assignee_email, p_assignee_name);
    v_assignee_id := v_emp.employee_id;
    v_assignee_name := v_emp.employee_name;
    v_assignees := jsonb_build_array(jsonb_build_object(
      'employeeId', v_emp.employee_id, 'name', v_emp.employee_name, 'avatar', ''
    ));
  end if;

  select coalesce(max(t.order_index) + 1, 0) into v_order
    from tasks t
    where t.project_id = p_project_id and t.status = p_status and t.organization_id = v_org;

  insert into tasks (
    project_id, title, status, priority, assignee_name, assignee_avatar,
    deadline, progress, description, order_index, user_id, organization_id,
    assignee_employee_id, assignees
  ) values (
    p_project_id, btrim(p_title), p_status, p_priority, coalesce(v_assignee_name, ''), '',
    p_deadline, 0, p_description, coalesce(v_order, 0), auth.uid(), v_org,
    v_assignee_id, v_assignees
  ) returning * into v_row;

  perform public.agent_action_audit_log(
    'pm.create_task', 'executed', v_payload, null, to_jsonb(v_row),
    p_agent_id, p_agent_name, p_session_id, p_request_id, p_approval_id, p_autonomy_level, null
  );

  return jsonb_build_object('ok', true, 'action', 'pm.create_task', 'task', to_jsonb(v_row));
exception when others then
  perform public.agent_action_audit_log(
    'pm.create_task', 'failed', coalesce(v_payload, '{}'::jsonb), null, null,
    p_agent_id, p_agent_name, p_session_id, p_request_id, p_approval_id, p_autonomy_level, sqlerrm
  );
  return jsonb_build_object('ok', false, 'action', 'pm.create_task', 'error', sqlerrm);
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. pm.set_task_status — move one task to a new kanban status.
-- ----------------------------------------------------------------------------
create or replace function public.ai_act_pm_set_task_status(
  p_task_id uuid,
  p_status text,
  p_agent_id text default null,
  p_agent_name text default null,
  p_session_id text default null,
  p_request_id text default null,
  p_approval_id text default null,
  p_autonomy_level smallint default 1
) returns jsonb
 language plpgsql
 set search_path to 'public'
as $$
declare
  v_org uuid;
  v_payload jsonb;
  v_before tasks;
  v_row tasks;
begin
  v_payload := jsonb_build_object('task_id', p_task_id, 'status', p_status);
  v_org := public.ai_act_guard();

  if p_status not in ('backlog', 'todo', 'in-progress', 'review', 'blocked', 'done') then
    raise exception 'invalid_status: "%" (use backlog|todo|in-progress|review|blocked|done)', p_status;
  end if;

  select * into v_before from tasks t
    where t.id = p_task_id and t.organization_id = v_org;
  if not found then raise exception 'task_not_found'; end if;

  if v_before.status = p_status then
    return jsonb_build_object(
      'ok', true, 'action', 'pm.set_task_status', 'changed', false,
      'task', to_jsonb(v_before), 'note', 'task already has that status'
    );
  end if;

  update tasks t
    set status = p_status, updated_at = now()
    where t.id = p_task_id and t.organization_id = v_org
    returning t.* into v_row;

  perform public.agent_action_audit_log(
    'pm.set_task_status', 'executed', v_payload, to_jsonb(v_before), to_jsonb(v_row),
    p_agent_id, p_agent_name, p_session_id, p_request_id, p_approval_id, p_autonomy_level, null
  );

  return jsonb_build_object(
    'ok', true, 'action', 'pm.set_task_status', 'changed', true,
    'before', to_jsonb(v_before), 'task', to_jsonb(v_row)
  );
exception when others then
  perform public.agent_action_audit_log(
    'pm.set_task_status', 'failed', coalesce(v_payload, '{}'::jsonb),
    case when v_before.id is null then null else to_jsonb(v_before) end, null,
    p_agent_id, p_agent_name, p_session_id, p_request_id, p_approval_id, p_autonomy_level, sqlerrm
  );
  return jsonb_build_object('ok', false, 'action', 'pm.set_task_status', 'error', sqlerrm);
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. pm.assign_task — set the task's assignee (replaces current assignees;
--    the before snapshot preserves what was there).
-- ----------------------------------------------------------------------------
create or replace function public.ai_act_pm_assign_task(
  p_task_id uuid,
  p_employee_id uuid default null,
  p_employee_email text default null,
  p_employee_name text default null,
  p_agent_id text default null,
  p_agent_name text default null,
  p_session_id text default null,
  p_request_id text default null,
  p_approval_id text default null,
  p_autonomy_level smallint default 1
) returns jsonb
 language plpgsql
 set search_path to 'public'
as $$
declare
  v_org uuid;
  v_payload jsonb;
  v_before tasks;
  v_emp record;
  v_row tasks;
begin
  v_payload := jsonb_build_object(
    'task_id', p_task_id, 'employee_id', p_employee_id,
    'employee_email', p_employee_email, 'employee_name', p_employee_name
  );
  v_org := public.ai_act_guard();

  select * into v_before from tasks t
    where t.id = p_task_id and t.organization_id = v_org;
  if not found then raise exception 'task_not_found'; end if;

  select * into v_emp
    from public.ai_act_pm_resolve_employee(v_org, p_employee_id, p_employee_email, p_employee_name);

  update tasks t
    set assignee_employee_id = v_emp.employee_id,
        assignee_name = v_emp.employee_name,
        assignees = jsonb_build_array(jsonb_build_object(
          'employeeId', v_emp.employee_id, 'name', v_emp.employee_name, 'avatar', ''
        )),
        updated_at = now()
    where t.id = p_task_id and t.organization_id = v_org
    returning t.* into v_row;

  perform public.agent_action_audit_log(
    'pm.assign_task', 'executed', v_payload, to_jsonb(v_before), to_jsonb(v_row),
    p_agent_id, p_agent_name, p_session_id, p_request_id, p_approval_id, p_autonomy_level, null
  );

  return jsonb_build_object(
    'ok', true, 'action', 'pm.assign_task',
    'before', to_jsonb(v_before), 'task', to_jsonb(v_row)
  );
exception when others then
  perform public.agent_action_audit_log(
    'pm.assign_task', 'failed', coalesce(v_payload, '{}'::jsonb),
    case when v_before.id is null then null else to_jsonb(v_before) end, null,
    p_agent_id, p_agent_name, p_session_id, p_request_id, p_approval_id, p_autonomy_level, sqlerrm
  );
  return jsonb_build_object('ok', false, 'action', 'pm.assign_task', 'error', sqlerrm);
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. pm.add_subtask — append one subtask to a task's checklist. The UI's
--    Subtask shape is { id, title, completed, completedBy?, completedAt? }
--    (src/lib/project-data.ts).
-- ----------------------------------------------------------------------------
create or replace function public.ai_act_pm_add_subtask(
  p_task_id uuid,
  p_title text,
  p_agent_id text default null,
  p_agent_name text default null,
  p_session_id text default null,
  p_request_id text default null,
  p_approval_id text default null,
  p_autonomy_level smallint default 1
) returns jsonb
 language plpgsql
 set search_path to 'public'
as $$
declare
  v_org uuid;
  v_payload jsonb;
  v_before tasks;
  v_subtask jsonb;
  v_row tasks;
begin
  v_payload := jsonb_build_object('task_id', p_task_id, 'title', p_title);
  v_org := public.ai_act_guard();

  if p_title is null or btrim(p_title) = '' then raise exception 'title_required'; end if;

  select * into v_before from tasks t
    where t.id = p_task_id and t.organization_id = v_org;
  if not found then raise exception 'task_not_found'; end if;

  v_subtask := jsonb_build_object(
    'id', uuid_generate_v4()::text,
    'title', btrim(p_title),
    'completed', false
  );

  update tasks t
    set subtasks = (
          case when jsonb_typeof(t.subtasks) = 'array' then t.subtasks else '[]'::jsonb end
        ) || jsonb_build_array(v_subtask),
        updated_at = now()
    where t.id = p_task_id and t.organization_id = v_org
    returning t.* into v_row;

  perform public.agent_action_audit_log(
    'pm.add_subtask', 'executed', v_payload, to_jsonb(v_before), to_jsonb(v_row),
    p_agent_id, p_agent_name, p_session_id, p_request_id, p_approval_id, p_autonomy_level, null
  );

  return jsonb_build_object(
    'ok', true, 'action', 'pm.add_subtask',
    'subtask', v_subtask, 'task', to_jsonb(v_row)
  );
exception when others then
  perform public.agent_action_audit_log(
    'pm.add_subtask', 'failed', coalesce(v_payload, '{}'::jsonb),
    case when v_before.id is null then null else to_jsonb(v_before) end, null,
    p_agent_id, p_agent_name, p_session_id, p_request_id, p_approval_id, p_autonomy_level, sqlerrm
  );
  return jsonb_build_object('ok', false, 'action', 'pm.add_subtask', 'error', sqlerrm);
end;
$$;

-- ----------------------------------------------------------------------------
-- 8. Grants: authenticated users only (RLS still applies inside — invoker).
--    anon must never call actions.
-- ----------------------------------------------------------------------------
revoke all on function public.ai_act_pm_create_task(uuid, text, date, text, text, text, uuid, text, text, text, text, text, text, text, smallint) from public, anon;
grant execute on function public.ai_act_pm_create_task(uuid, text, date, text, text, text, uuid, text, text, text, text, text, text, text, smallint) to authenticated, service_role;

revoke all on function public.ai_act_pm_set_task_status(uuid, text, text, text, text, text, text, smallint) from public, anon;
grant execute on function public.ai_act_pm_set_task_status(uuid, text, text, text, text, text, text, smallint) to authenticated, service_role;

revoke all on function public.ai_act_pm_assign_task(uuid, uuid, text, text, text, text, text, text, text, smallint) from public, anon;
grant execute on function public.ai_act_pm_assign_task(uuid, uuid, text, text, text, text, text, text, text, smallint) to authenticated, service_role;

revoke all on function public.ai_act_pm_add_subtask(uuid, text, text, text, text, text, text, smallint) from public, anon;
grant execute on function public.ai_act_pm_add_subtask(uuid, text, text, text, text, text, text, smallint) to authenticated, service_role;

comment on function public.ai_act_pm_create_task is
  'Agent action kernel: create one task in the caller''s org (security invoker + RLS + explicit org re-check + audit row). Refuses to run inside ai_query.';
comment on function public.ai_act_pm_set_task_status is
  'Agent action kernel: move one task to a new status, with before/after audit. Refuses to run inside ai_query.';
comment on function public.ai_act_pm_assign_task is
  'Agent action kernel: set one task''s assignee (resolved within the caller''s org), with before/after audit. Refuses to run inside ai_query.';
comment on function public.ai_act_pm_add_subtask is
  'Agent action kernel: append one subtask to a task''s checklist, with before/after audit. Refuses to run inside ai_query.';
