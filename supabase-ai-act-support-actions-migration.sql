-- ============================================================================
-- Agent Office Phase 2.2 — Support action kernel (ai_act_support_*)
-- Same security contract as the PM kernel: a small allowlist of narrow,
-- org-stamping SECURITY INVOKER functions. Each runs as the SIGNED-IN USER
-- (their JWT → RLS applies), re-checks organization_id explicitly, performs
-- exactly one mutation, and writes an append-only audit row via
-- agent_action_audit_log(). No generic "agent runs SQL" write path.
--
-- Target: public.support_submissions (issue reports + feedback).
--   status   ∈ open | in_progress | resolved | closed
--   priority ∈ low | medium | high | critical
-- RLS nuance vs PM: UPDATE on support_submissions is restricted to org
-- OWNERS/ADMINS (or platform operators). A security-invoker RPC therefore
-- can read a row (submitter can view own) yet have the UPDATE affect 0 rows
-- when the caller lacks write permission — so every action checks FOUND after
-- the UPDATE and returns not_permitted rather than a silent success.
--
-- Depends on: ai_act_guard(), agent_action_audit_log() (shipped with the PM
-- kernel). Idempotent. Apply via apply_migration or the SQL editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. support.set_status — move a submission to a new status.
-- ----------------------------------------------------------------------------
create or replace function public.ai_act_support_set_status(
  p_submission_id uuid,
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
  v_before support_submissions;
  v_row support_submissions;
begin
  v_payload := jsonb_build_object('submission_id', p_submission_id, 'status', p_status);
  v_org := public.ai_act_guard();

  if p_status not in ('open', 'in_progress', 'resolved', 'closed') then
    raise exception 'invalid_status: "%" (use open|in_progress|resolved|closed)', p_status;
  end if;

  select * into v_before from support_submissions s
    where s.id = p_submission_id and s.organization_id = v_org;
  if not found then raise exception 'submission_not_found'; end if;

  if v_before.status = p_status then
    return jsonb_build_object(
      'ok', true, 'action', 'support.set_status', 'changed', false,
      'submission', to_jsonb(v_before), 'note', 'submission already has that status'
    );
  end if;

  update support_submissions s
    set status = p_status, updated_at = now()
    where s.id = p_submission_id and s.organization_id = v_org
    returning s.* into v_row;
  if not found then
    raise exception 'not_permitted: you do not have permission to update this submission';
  end if;

  perform public.agent_action_audit_log(
    'support.set_status', 'executed', v_payload, to_jsonb(v_before), to_jsonb(v_row),
    p_agent_id, p_agent_name, p_session_id, p_request_id, p_approval_id, p_autonomy_level, null
  );

  return jsonb_build_object(
    'ok', true, 'action', 'support.set_status', 'changed', true,
    'before', to_jsonb(v_before), 'submission', to_jsonb(v_row)
  );
exception when others then
  perform public.agent_action_audit_log(
    'support.set_status', 'failed', coalesce(v_payload, '{}'::jsonb),
    case when v_before.id is null then null else to_jsonb(v_before) end, null,
    p_agent_id, p_agent_name, p_session_id, p_request_id, p_approval_id, p_autonomy_level, sqlerrm
  );
  return jsonb_build_object('ok', false, 'action', 'support.set_status', 'error', sqlerrm);
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. support.set_priority — change a submission's priority.
-- ----------------------------------------------------------------------------
create or replace function public.ai_act_support_set_priority(
  p_submission_id uuid,
  p_priority text,
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
  v_before support_submissions;
  v_row support_submissions;
begin
  v_payload := jsonb_build_object('submission_id', p_submission_id, 'priority', p_priority);
  v_org := public.ai_act_guard();

  if p_priority not in ('low', 'medium', 'high', 'critical') then
    raise exception 'invalid_priority: "%" (use low|medium|high|critical)', p_priority;
  end if;

  select * into v_before from support_submissions s
    where s.id = p_submission_id and s.organization_id = v_org;
  if not found then raise exception 'submission_not_found'; end if;

  if v_before.priority = p_priority then
    return jsonb_build_object(
      'ok', true, 'action', 'support.set_priority', 'changed', false,
      'submission', to_jsonb(v_before), 'note', 'submission already has that priority'
    );
  end if;

  update support_submissions s
    set priority = p_priority, updated_at = now()
    where s.id = p_submission_id and s.organization_id = v_org
    returning s.* into v_row;
  if not found then
    raise exception 'not_permitted: you do not have permission to update this submission';
  end if;

  perform public.agent_action_audit_log(
    'support.set_priority', 'executed', v_payload, to_jsonb(v_before), to_jsonb(v_row),
    p_agent_id, p_agent_name, p_session_id, p_request_id, p_approval_id, p_autonomy_level, null
  );

  return jsonb_build_object(
    'ok', true, 'action', 'support.set_priority', 'changed', true,
    'before', to_jsonb(v_before), 'submission', to_jsonb(v_row)
  );
exception when others then
  perform public.agent_action_audit_log(
    'support.set_priority', 'failed', coalesce(v_payload, '{}'::jsonb),
    case when v_before.id is null then null else to_jsonb(v_before) end, null,
    p_agent_id, p_agent_name, p_session_id, p_request_id, p_approval_id, p_autonomy_level, sqlerrm
  );
  return jsonb_build_object('ok', false, 'action', 'support.set_priority', 'error', sqlerrm);
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. support.add_note — append a line to admin_notes (never overwrites).
-- ----------------------------------------------------------------------------
create or replace function public.ai_act_support_add_note(
  p_submission_id uuid,
  p_note text,
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
  v_before support_submissions;
  v_row support_submissions;
begin
  v_payload := jsonb_build_object('submission_id', p_submission_id, 'note', p_note);
  v_org := public.ai_act_guard();

  if p_note is null or btrim(p_note) = '' then raise exception 'note_required'; end if;

  select * into v_before from support_submissions s
    where s.id = p_submission_id and s.organization_id = v_org;
  if not found then raise exception 'submission_not_found'; end if;

  update support_submissions s
    set admin_notes = case
          when coalesce(btrim(s.admin_notes), '') = '' then btrim(p_note)
          else s.admin_notes || E'\n' || btrim(p_note)
        end,
        updated_at = now()
    where s.id = p_submission_id and s.organization_id = v_org
    returning s.* into v_row;
  if not found then
    raise exception 'not_permitted: you do not have permission to update this submission';
  end if;

  perform public.agent_action_audit_log(
    'support.add_note', 'executed', v_payload, to_jsonb(v_before), to_jsonb(v_row),
    p_agent_id, p_agent_name, p_session_id, p_request_id, p_approval_id, p_autonomy_level, null
  );

  return jsonb_build_object(
    'ok', true, 'action', 'support.add_note',
    'before', to_jsonb(v_before), 'submission', to_jsonb(v_row)
  );
exception when others then
  perform public.agent_action_audit_log(
    'support.add_note', 'failed', coalesce(v_payload, '{}'::jsonb),
    case when v_before.id is null then null else to_jsonb(v_before) end, null,
    p_agent_id, p_agent_name, p_session_id, p_request_id, p_approval_id, p_autonomy_level, sqlerrm
  );
  return jsonb_build_object('ok', false, 'action', 'support.add_note', 'error', sqlerrm);
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Grants: authenticated + service_role only (RLS still applies inside).
-- ----------------------------------------------------------------------------
revoke all on function public.ai_act_support_set_status(uuid, text, text, text, text, text, text, smallint) from public, anon;
grant execute on function public.ai_act_support_set_status(uuid, text, text, text, text, text, text, smallint) to authenticated, service_role;

revoke all on function public.ai_act_support_set_priority(uuid, text, text, text, text, text, text, smallint) from public, anon;
grant execute on function public.ai_act_support_set_priority(uuid, text, text, text, text, text, text, smallint) to authenticated, service_role;

revoke all on function public.ai_act_support_add_note(uuid, text, text, text, text, text, text, smallint) from public, anon;
grant execute on function public.ai_act_support_add_note(uuid, text, text, text, text, text, text, smallint) to authenticated, service_role;

comment on function public.ai_act_support_set_status is
  'Agent action kernel: move a support submission to a new status (org re-check + owner/admin RLS + audit). Refuses read-only context.';
comment on function public.ai_act_support_set_priority is
  'Agent action kernel: change a support submission''s priority, with before/after audit.';
comment on function public.ai_act_support_add_note is
  'Agent action kernel: append a line to a support submission''s admin_notes (never overwrites), with audit.';
