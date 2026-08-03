# -*- coding: utf-8 -*-
"""Step 7 - Rebuild every specialist's system prompt around the curated ai_* views.

This replaces the old, inconsistent prompts (which mixed real and hallucinated
column names) with one clean, accurate template per specialist:
  - what the module does (concise, correct)
  - the curated `ai_*` views to query (stable columns, verified enums)
  - strict data-access discipline (always query first; never invent columns;
    self-inspect information_schema before touching raw tables; no web search)
  - handoff/routing guidance so specialists consult the right peer
  - honesty rules

Run AFTER the ai_agent_views migration is applied (supabase-ai-agent-views-migration.sql)
and AFTER 02/03 (which set model, delegation, and the Supabase MCP). Idempotent:
re-running rewrites the prompt to the same deterministic text.

ASCII-only punctuation so the prompt can never be mojibroken.
"""
import sys
import io
import os
import re

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import _common as c

# The in-app training tour, exported to markdown, is the canonical feature guide.
# We inject each agent's module section so the LLM can answer ANY how-to / "what
# is X" question about its module, not just data lookups.
MANUAL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "docs", "KATANA_TRAINING_MANUAL.md")

# agent name -> training-manual part prefix (and optional appendix)
PART_BY_AGENT = {
    "Employee Agent": ["Part 1"],
    "HR Agent": ["Part 3"],
    "WFM Agent": ["Part 4"],
    "Inventory Agent": ["Part 5"],
    "Customer Agent": ["Part 6"],
    "KYI Agent": ["Part 7", "Appendix"],
    "PM Agent": ["Part 8"],
    "Automation Agent": ["Part 9"],
    "Support Agent": ["Part 10"],
}

# Feature knowledge that is NOT in the training manual: newer code-only features,
# and the three modules the manual does not cover (Careers, Comms, Facilities).
EXTRA_KNOWLEDGE = {
    "Inventory Agent": """### Virtual Stockroom (3D warehouse view)
The Inventory module includes an immersive **Virtual Stockroom** - a 3D isometric visualization of the warehouse (the "Stockroom" view on the Inventory page). Items are grouped into bins on a warehouse floor, color-coded by stock status: in-stock, low-stock, out-of-stock, and mixed. Users can zoom, rotate, and reset the camera, search for a SKU, and click a bin to see the items inside.
It has three view modes:
- **Status** - color each bin by stock status (spot low/out-of-stock zones instantly).
- **Heatmap** - color by total bin value (find your highest-value zones).
- **X-ray** - see-through status view.
Animated drone markers, radar pulses, and laser-scan beams give it a "mission control" feel. It is a fast, visual complement to the standard inventory list for spotting problem areas at a glance.""",
    "Careers Agent": """### Careers / Recruitment features
Manages the full hiring pipeline:
- **Job Postings** - create and publish openings (title, department, location, type [full-time/part-time], level, salary, description, responsibilities, qualifications, benefits). Toggle is_active to open/close a role.
- **Applications** - candidates apply (resume, cover letter, LinkedIn, portfolio). Track status: new -> interview-scheduled -> interviewed -> rejected; add a rating and interview date. Applications can stay anonymized until "revealed" to reduce hiring bias.
- **Talent Pool** - keep promising past candidates on file for future roles, with pool status, rating, and recruiter notes.
- A public careers page lets external candidates apply directly.""",
    "Comms Agent": """### Comms features
The org's built-in internal communication hub (think Slack):
- **Channels** - public or private team spaces, with membership and per-user notification preferences/mutes.
- **Conversations** - direct 1:1 and group messages.
- **Messages** - threaded replies, reactions, and @mentions.
- **Context links** - attach a message/thread to a record in another module (a project, client, job, etc.) so discussion stays connected to the work.""",
    "Facilities Agent": """### Facilities / Manufacturing
Katana Facilities covers manufacturing and facilities operations - production, equipment, and maintenance. This module does not yet have dedicated data tables, so you cannot pull live facilities metrics. Answer conceptual / how-it-works questions about the module, and for anything involving physical stock, parts, or equipment counts, hand off to the Inventory Agent. Never invent facilities numbers.""",
}


def load_manual_sections():
    """Parse the training manual into {header: body}, stripping UI-element noise."""
    try:
        with open(MANUAL_PATH, encoding="utf-8") as f:
            text = f.read()
    except OSError as e:
        print(f"  WARNING: could not read training manual ({e}); feature guides limited to EXTRA_KNOWLEDGE")
        return {}
    sections = {}
    headers = list(re.finditer(r"^## (Part \d+:[^\n]+|Appendix:[^\n]+)$", text, re.M))
    for i, m in enumerate(headers):
        title = m.group(1).strip()
        start = m.end()
        end = headers[i + 1].start() if i + 1 < len(headers) else len(text)
        body = text[start:end].strip()
        body = "\n".join(ln for ln in body.splitlines() if not ln.strip().startswith("*UI element"))
        sections[title] = re.sub(r"\n{3,}", "\n\n", body).strip()
    return sections


def module_guide_for(name, manual_sections):
    """Build the feature/how-to guide for an agent from the manual + extras."""
    chunks = []
    for prefix in PART_BY_AGENT.get(name, []):
        for title, body in manual_sections.items():
            if title.startswith(prefix):
                chunks.append(f"### {title}\n{body}")
    extra = EXTRA_KNOWLEDGE.get(name)
    if extra:
        chunks.append(extra)
    return "\n\n".join(chunks).strip()

# Routing directory: module topic -> specialist agent name. Each agent gets this
# list minus itself so it knows who to hand off to.
ROUTING = [
    ("PM Agent", "projects, tasks, milestones, sprints, deadlines, assignees"),
    ("Inventory Agent", "stock, items, SKUs, purchase orders, suppliers, reorder levels"),
    ("Customer Agent", "clients, contacts, deals, invoices, leads, health, churn, ARR, renewals"),
    ("WFM Agent", "field jobs, technicians, dispatch, schedules, timesheets"),
    ("HR Agent", "employees, performance reviews, goals, time-off, training, departments"),
    ("Employee Agent", "employee self-service: my profile, my goals, my time-off, my reviews"),
    ("Careers Agent", "job postings, applications, candidates, talent pool, hiring"),
    ("Facilities Agent", "manufacturing, facilities, production, equipment, maintenance"),
    ("Automation Agent", "workflows, automation, Katana Sync, RAG documents, files, knowledge base"),
    ("KYI Agent", "investors, investor leads, Know Your Investor, firms, fundraising"),
    ("Comms Agent", "channels, messages, conversations, internal communications"),
    ("Support Agent", "support submissions, issues, feedback, bug reports, triage"),
]

# Per-agent module config: overview + the curated views (with key columns) it owns.
# Views come from supabase-ai-agent-views-migration.sql.
MODULES = {
    "PM Agent": {
        "module": "Project Management",
        "overview": "Katana PM tracks projects, their tasks, milestones, and sprints. Teams plan work, assign tasks to people, and track progress to completion.",
        "views": [
            ("ai_pm_summary", "one-row rollup: total/active/completed projects, total/done/in_progress/open tasks"),
            ("ai_projects", "id, name, status (active|completed), progress, deadline, total_tasks, completed_tasks, owner_name"),
            ("ai_tasks", "id, project_id, title, status (backlog|todo|in-progress|review|done), priority (low|medium|high), assignee_name, deadline, progress, milestone_id"),
            ("ai_milestones", "id, project_id, name, date, status, description"),
            ("ai_sprints", "id, project_id, name, goal, start_date, end_date, status"),
        ],
        "examples": [
            ("Portfolio overview", "SELECT * FROM ai_pm_summary;"),
            ("Open tasks by project", "SELECT p.name, count(*) FROM ai_tasks t JOIN ai_projects p ON p.id=t.project_id WHERE t.status IN ('todo','backlog','in-progress') GROUP BY p.name;"),
        ],
    },
    "Inventory Agent": {
        "module": "Inventory",
        "overview": "Katana Inventory tracks physical stock: items (by SKU), stock movements, purchase orders to suppliers, and reorder levels so teams avoid stockouts.",
        "views": [
            ("ai_inventory_summary", "one-row rollup: total_active_items, in_stock, low_stock, out_of_stock, at_or_below_min, total_inventory_value"),
            ("ai_inventory_items", "id, sku, product_name, category, location, on_hand_qty, min_qty, reorder_qty, allocated, unit_cost, total_value, supplier_name, status (in-stock|low-stock|out-of-stock), is_active"),
            ("ai_inventory_low_stock", "items already at/below min: sku, product_name, on_hand_qty, min_qty, reorder_qty, supplier_name"),
            ("ai_purchase_orders", "id, po_number, supplier_name, status (draft|open|pending|received|cancelled), total, created_date, expected_date, line_count, total_ordered_qty"),
            ("ai_suppliers", "id, name, contact_name, email, phone, performance_score, lead_time, total_orders, on_time_delivery, is_active"),
            ("ai_inventory_movements", "id, item_id, product_name, sku, change_qty, reason, reference, movement_date, user_name"),
        ],
        "examples": [
            ("Stock overview", "SELECT * FROM ai_inventory_summary;"),
            ("Items needing reorder", "SELECT product_name, sku, on_hand_qty, min_qty FROM ai_inventory_low_stock ORDER BY on_hand_qty;"),
            ("Open purchase orders", "SELECT po_number, supplier_name, status, total, expected_date FROM ai_purchase_orders WHERE status IN ('draft','open','pending') ORDER BY expected_date;"),
        ],
    },
    "Customer Agent": {
        "module": "Customer Success / CRM",
        "overview": "Katana Customers manages client accounts, contacts, deals, invoices, and inbound leads, with health scores, churn risk, NPS, and ARR for account management.",
        "views": [
            ("ai_cs_summary", "one-row rollup: total_clients, avg_health_score, total_arr, open_support_tickets, total_deals, total_leads, total_contacts"),
            ("ai_clients", "id, name, industry, status (healthy|moderate), lifecycle_stage, account_type, health_score, churn_risk, nps_score, arr, renewal_date, engagement_score, support_tickets, outreach_status"),
            ("ai_contacts", "id, client_id, first_name, last_name, email, job_title, is_primary, is_decision_maker, contact_role, sentiment"),
            ("ai_deals", "id, title, client_id, stage_id, amount, currency, probability, expected_close_date, status, assigned_to"),
            ("ai_invoices", "id, invoice_number, client_id, status, subtotal, tax, total, due_date, paid_date"),
            ("ai_leads", "id, first_name, last_name, email, company_name, source, status, score, industry, outreach_status, converted_client_id"),
        ],
        "examples": [
            ("Customer health overview", "SELECT * FROM ai_cs_summary;"),
            ("At-risk clients", "SELECT name, health_score, churn_risk, arr FROM ai_clients ORDER BY health_score ASC LIMIT 10;"),
        ],
    },
    "WFM Agent": {
        "module": "Workforce Management (field service)",
        "overview": "Katana WFM manages field service: jobs/work orders, technicians, dispatch schedules, and timesheets.",
        "views": [
            ("ai_wfm_summary", "one-row rollup: total_jobs, in_progress_jobs, assigned_jobs, completed_jobs, active_technicians, pending_timesheets"),
            ("ai_wfm_jobs", "id, job_number, title, customer_name, location, status (assigned|in-progress|completed), priority (low|medium|high|urgent), technician_id, start_date, end_date, estimated_hours, actual_hours"),
            ("ai_wfm_technicians", "id, name, email, phone, role, status, skills, hourly_rate, is_active"),
            ("ai_wfm_schedules", "id, technician_id, job_id, schedule_date, start_time, end_time, status"),
            ("ai_wfm_timesheets", "id, technician_id, job_id, clock_in, clock_out, total_hours, status (pending|approved), approved_by"),
        ],
        "examples": [
            ("Field overview", "SELECT * FROM ai_wfm_summary;"),
            ("Jobs in progress", "SELECT job_number, title, customer_name, priority FROM ai_wfm_jobs WHERE status='in-progress';"),
        ],
    },
    "HR Agent": {
        "module": "Human Resources",
        "overview": "Katana HR manages employees, performance reviews, goals, time-off requests, and training across departments.",
        "views": [
            ("ai_hr_summary", "one-row rollup: total_employees, active_employees, completed_goals, behind_goals, approved_time_off, departments"),
            ("ai_hr_employees", "id, name, position, department, status (Active), email, manager_id, hire_date, next_review_date, performance_score, location"),
            ("ai_hr_goals", "id, employee_id, goal, category, progress, status (Behind|Complete), due_date"),
            ("ai_hr_reviews", "id, employee_id, review_period, review_type, review_date, status, trend, reviewer_id"),
            ("ai_hr_time_off", "id, employee_id, type (Vacation|Sick|Personal), start_date, end_date, status (Approved|Denied), decided_by"),
            ("ai_hr_training_courses", "id, title, category, level, duration_hours, is_active"),
        ],
        "examples": [
            ("HR overview", "SELECT * FROM ai_hr_summary;"),
            ("Headcount by department", "SELECT department, count(*) FROM ai_hr_employees GROUP BY department;"),
        ],
    },
    "Employee Agent": {
        "module": "Employee Portal (self-service)",
        "overview": "The Employee Portal is the self-service view of HR data: an employee's own profile, goals, time-off, and performance reviews. Always scope answers to the specific employee asked about (filter by employee name or id).",
        "views": [
            ("ai_hr_employees", "id, name, position, department, status, manager_id, hire_date, next_review_date, performance_score"),
            ("ai_hr_goals", "id, employee_id, goal, category, progress, status (Behind|Complete), due_date"),
            ("ai_hr_time_off", "id, employee_id, type (Vacation|Sick|Personal), start_date, end_date, status (Approved|Denied)"),
            ("ai_hr_reviews", "id, employee_id, review_period, review_type, review_date, status, trend"),
        ],
        "examples": [
            ("Find the employee first", "SELECT id, name, department FROM ai_hr_employees WHERE name ILIKE '%<name>%';"),
            ("That employee's open goals", "SELECT goal, progress, status, due_date FROM ai_hr_goals WHERE employee_id='<id>' AND status='Behind';"),
        ],
    },
    "Careers Agent": {
        "module": "Careers / Recruitment",
        "overview": "Katana Careers manages job postings, applications, and the talent pool across the hiring pipeline.",
        "views": [
            ("ai_careers_summary", "one-row rollup: active_postings, total_applications, new_applications, interviews_scheduled, talent_pool_size"),
            ("ai_job_postings", "id, title, department, location, type (full-time|part-time), level, salary, posted_date, is_active"),
            ("ai_job_applications", "id, job_id, status (new|interview-scheduled|interviewed|rejected), applied_date, first_name, last_name, email, location, rating, interview_date"),
            ("ai_talent_pool", "id, first_name, last_name, email, location, source_job_title, source_department, rating, pool_status"),
        ],
        "examples": [
            ("Hiring overview", "SELECT * FROM ai_careers_summary;"),
            ("New applications", "SELECT first_name, last_name, job_id, applied_date FROM ai_job_applications WHERE status='new' ORDER BY applied_date DESC;"),
        ],
    },
    "Facilities Agent": {
        "module": "Manufacturing / Facilities",
        "overview": "Katana Facilities covers manufacturing and facilities operations (production, equipment, maintenance). This module does not yet have its own dedicated data tables in the database.",
        "views": [],
        "examples": [],
        "no_data_note": (
            "You currently have NO dedicated facilities data tables. Do not invent facilities "
            "numbers. Answer conceptual/how-it-works questions about the module from your knowledge, "
            "and for anything involving physical stock, parts, or equipment counts, hand off to the "
            "Inventory Agent. If asked for facilities data that does not exist, say so plainly."
        ),
    },
    "Automation Agent": {
        "module": "Automation / Knowledge Base",
        "overview": "Katana Automation stores org documents (policies, specs, SOPs), extracts searchable text, logs web-tool jobs, and hands conversation to this agent. Use search_automation_documents for Q&A over uploads; use ai_automation_documents for previews; use ai_automation_jobs for recent tool runs. System rag_documents is shared product knowledge — prefer org automation_documents for tenant files.",
        "views": [
            ("ai_automation_summary", "one-row rollup: indexed_documents, total_documents, total_files, total_jobs, completed_jobs, failed_jobs, system_rag_chunks"),
            ("ai_automation_documents", "id, storage_file_id, file_name, mime_type, extract_status, char_count, content_preview, created_at"),
            ("ai_automation_jobs", "id, job_type, status, title, error_message, created_at, completed_at"),
            ("ai_storage_files", "id, module, bucket, file_name, file_size, mime_type, created_at (filter module='automation')"),
            ("ai_rag_documents", "system knowledge chunks only: id, source_path, source_type, chunk_index, created_at"),
        ],
        "examples": [
            ("Knowledge overview", "SELECT * FROM ai_automation_summary;"),
            ("Search org docs", "SELECT * FROM search_automation_documents('refund policy', 10);"),
            ("List indexed files", "SELECT file_name, extract_status, char_count FROM ai_automation_documents ORDER BY created_at DESC LIMIT 20;"),
            ("Recent tool runs", "SELECT job_type, status, title, created_at FROM ai_automation_jobs ORDER BY created_at DESC LIMIT 15;"),
        ],
    },
    "KYI Agent": {
        "module": "Know Your Investor",
        "overview": "Katana KYI (Know Your Investor) tracks investors, investor leads, and companies for fundraising and outreach.",
        "views": [
            ("ai_kyi_summary", "one-row rollup: total_investors, total_companies, total_leads"),
            ("ai_kyi_investors", "id, company_id, full_name, email, location, industry, firm, title, investor_type, outreach_status, segment_type"),
            ("ai_kyi_companies", "id, name, location, industry, website, raise_stage, raise_target_amount"),
            ("ai_kyi_leads", "id, display_name, entity_type, city, state, country, raw_score, investor_type_id"),
        ],
        "examples": [
            ("KYI overview", "SELECT * FROM ai_kyi_summary;"),
            ("Top investor leads by score", "SELECT display_name, city, state, raw_score FROM ai_kyi_leads ORDER BY raw_score DESC NULLS LAST LIMIT 20;"),
        ],
    },
    "Comms Agent": {
        "module": "Internal Communications",
        "overview": "Katana Comms manages internal communication: channels, conversations, and messages.",
        "views": [
            ("ai_comms_summary", "one-row rollup: total_channels, total_messages, total_conversations"),
            ("ai_comms_channels", "id, name, description, channel_type, is_private, created_by, created_at"),
            ("ai_comms_messages", "id, channel_id, channel_name, conversation_id, sender_id, content, created_at"),
        ],
        "examples": [
            ("Comms overview", "SELECT * FROM ai_comms_summary;"),
            ("Busiest channels", "SELECT channel_name, count(*) FROM ai_comms_messages GROUP BY channel_name ORDER BY count(*) DESC;"),
        ],
    },
    "Support Agent": {
        "module": "Support",
        "overview": "Katana Support is the in-app channel where users report issues and submit feedback. Submissions are triaged by status and priority, with a full activity audit trail.",
        "views": [
            ("ai_support_summary", "one-row rollup: total_submissions, open_submissions, closed_submissions, issues, feedback"),
            ("ai_support_submissions", "id, submission_type (issue|feedback), category, subject, status (open|closed), priority, module_context, assigned_to_name, organization_name, submitter_name, created_at"),
            ("ai_support_activity", "id, submission_id, actor_name, action_type, from_status, to_status, from_priority, to_priority, created_at"),
        ],
        "examples": [
            ("Support overview", "SELECT * FROM ai_support_summary;"),
            ("Open issues by module", "SELECT module_context, count(*) FROM ai_support_submissions WHERE status='open' GROUP BY module_context ORDER BY count(*) DESC;"),
        ],
    },
}


def routing_table(self_name, by_name):
    rows = ["| Topic | Hand off to | Agent ID |", "|-------|-------------|----------|"]
    for name, topics in ROUTING:
        if name == self_name:
            continue
        agent = by_name.get(name)
        if not agent:
            continue
        rows.append(f"| {topics} | {name} | `{agent['id']}` |")
    return "\n".join(rows)


def build_prompt(name, cfg, by_name, manual_sections):
    module = cfg["module"]
    lines = []
    lines.append(f"You are the {name} for Katana - the specialist for the {module} module. You know this module thoroughly and answer any question about it intelligently: what it is, how it works, how to do things in it, and what its live data shows.")
    lines.append("")
    lines.append("## What this module does")
    lines.append(cfg["overview"])
    lines.append("")
    lines.append("## How to answer (two kinds of questions)")
    lines.append(
        "1. FEATURE / how-to / 'what is X' questions -> answer from the Module Guide below using your "
        "own reasoning. You do NOT need to run SQL for these.\n"
        "2. DATA questions (counts, lists, status, totals, specific records) -> query the live views with "
        "`execute_sql` and report the real result. Never make up numbers.\n"
        "Many questions combine both - explain the feature AND back it with live data when useful."
    )

    guide = module_guide_for(name, manual_sections)
    if guide:
        lines.append("")
        lines.append("## Module Guide (features, screens, and how-to)")
        lines.append(
            "This is the same walkthrough users see in the in-app training tour. Treat it as your "
            "authoritative knowledge of how this module works. Answer feature and how-to questions from it, "
            "rephrasing naturally - do not just dump it verbatim."
        )
        lines.append("")
        lines.append(guide)

    lines.append("")
    lines.append("## Live data - your source of truth for numbers")
    lines.append(
        "You have a READ-ONLY Supabase connection via the `execute_sql` tool. For data questions "
        "(counts, lists, status, totals, names), query the views below and report the real result. "
        "Never say you lack access, and never make up numbers."
    )

    if cfg["views"]:
        lines.append("")
        lines.append(
            "Query these curated `ai_*` views first. Their columns are stable and correct - "
            "use exactly these names, do not guess:"
        )
        lines.append("")
        for view, desc in cfg["views"]:
            lines.append(f"- `{view}` - {desc}")
        if cfg.get("examples"):
            lines.append("")
            lines.append("Quick-start queries:")
            for label, sql in cfg["examples"]:
                lines.append(f"- {label}: `{sql}`")

    if cfg.get("no_data_note"):
        lines.append("")
        lines.append(cfg["no_data_note"])

    lines.append("")
    lines.append("## Data rules (read carefully)")
    lines.append(
        "- Always run `execute_sql` before answering a data question, then report the real result.\n"
        "- Use ONLY column and view names listed above. Never invent columns or status values.\n"
        "- If you must go beyond the `ai_*` views, first confirm a table's real columns with:\n"
        "  `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='<table>' ORDER BY ordinal_position;`\n"
        "  and confirm enum/status values with a `SELECT DISTINCT <col> ...` before filtering on them.\n"
        "- If a query returns no rows, say so plainly - do not guess.\n"
        "- NEVER use web_search or any external tool. Katana is an internal platform."
    )
    lines.append("")
    lines.append("## Answering style")
    lines.append(
        "- Lead with the direct answer and bold the key number or status.\n"
        "- Use a short table or bullet list when there are several items.\n"
        "- Be concise; add a one-line recommendation only when it genuinely helps."
    )
    lines.append("")
    lines.append("## Output hygiene (critical)")
    lines.append(
        "Your reply is ONLY the user-facing answer in clean markdown. NEVER output raw JSON objects, "
        "empty code fences (```), or internal fields such as `workflowKey`, `objectiveSummary`, "
        "`invariants`, `derived`, or `failures`. These are internal system artifacts and must never "
        "appear in your message. Stop writing once the answer is complete - do not append any metadata."
    )
    lines.append("")
    lines.append("## Working with the team (handoffs)")
    lines.append(
        f"You only cover {module}. When a question needs another module's data, consult that "
        "specialist with the `spawn_subagent` tool: action \"start\", selectionMode \"explicit\", "
        "`agentId` set to the Agent ID from the table below, and the sub-question copied verbatim as "
        "`message`. Wait for the reply, then fold it into your answer. Only delegate the part you "
        "cannot answer yourself. Never delegate back to the Hub Agent."
    )
    lines.append("")
    lines.append(routing_table(name, by_name))
    lines.append("")
    lines.append("## Honesty")
    lines.append(
        "Only state data you actually retrieved through a tool call in THIS conversation. Never "
        "fabricate tool output. If a tool call fails, report the real error - do not pretend it worked."
    )
    return "\n".join(lines)


def main():
    by_name = c.agents_by_name()
    manual_sections = load_manual_sections()
    updated = 0
    for name, cfg in MODULES.items():
        if name not in by_name:
            print(f"  SKIP: {name} not found")
            continue
        full = dict(c.get_agent(by_name[name]["id"]))
        full["systemPrompt"] = build_prompt(name, cfg, by_name, manual_sections)
        # Keep data plumbing correct even if run standalone.
        full["delegationEnabled"] = True
        full["delegationTargetMode"] = "all"
        if not isinstance(full.get("delegationTargetAgentIds"), list):
            full["delegationTargetAgentIds"] = []
        full["model"] = c.TARGET_MODEL
        mcp = full.get("mcpServerIds") or []
        if c.SUPABASE_MCP_ID not in mcp:
            mcp = mcp + [c.SUPABASE_MCP_ID]
        full["mcpServerIds"] = mcp
        # Grant the delegation tool so specialists can actually consult peers.
        # delegationEnabled alone is not enough - spawn_subagent must be in `tools`.
        tools = full.get("tools") or []
        if "spawn_subagent" not in tools:
            tools = tools + ["spawn_subagent"]
        if "memory" not in tools:
            tools = tools + ["memory"]
        full["tools"] = tools
        c.put_agent(full["id"], full)
        updated += 1
        nviews = len(cfg["views"])
        guide_lines = len(module_guide_for(name, manual_sections).splitlines())
        print(f"  {name:18} rebuilt ({nviews} views, {guide_lines}-line module guide, handoffs wired)")
    print(f"\nDone. {updated} specialist prompt(s) rebuilt with feature guides + ai_* views.")


if __name__ == "__main__":
    main()
