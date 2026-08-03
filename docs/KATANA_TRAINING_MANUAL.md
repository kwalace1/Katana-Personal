# Katana Training Manual

> Auto-generated from in-app tour content (`src/lib/tour-training-steps.ts`).
> Last generated: 2026-06-14. Re-run `npx tsx src/scripts/export-training-manual.ts` after tour copy changes.

## About this manual

This document mirrors the Katana **full-system training tour** — the same walkthrough shown on first login and replayable from the Setup Guide. It covers the Employee Launchpad, Hub Dashboard, and every platform module in the standard training order.

- **Modules:** 10
- **Steps:** 96 (including KYI company workspace appendix)
- **Estimated time:** 15–20 minutes in the interactive tour

Module access is role-based. Users only see modules their admin has granted via HR employee records. Skip chapters for modules you do not have access to.

## Table of contents

- [Part 1: Employee Launchpad](#part-1-employee-launchpad) — 11 steps
- [Part 2: Hub Dashboard](#part-2-hub-dashboard) — 9 steps
- [Part 3: Human Resources](#part-3-human-resources) — 11 steps
- [Part 4: Workforce Management](#part-4-workforce-management) — 11 steps
- [Part 5: Inventory](#part-5-inventory) — 9 steps
- [Part 6: Customer Success](#part-6-customer-success) — 10 steps
- [Part 7: KYI](#part-7-kyi) — 6 steps
- [Part 8: Projects](#part-8-projects) — 10 steps
- [Part 9: Automation](#part-9-automation) — 8 steps
- [Part 10: Katana Support](#part-10-katana-support) — 6 steps
- [Appendix: KYI Company Workspace](#appendix-kyi-company-workspace)

---

## Part 1: Employee Launchpad

**Route:** `/employee`

Your personal feed, profile, and shortcuts

### 1. What is the Employee Launchpad?

Think of the Launchpad as your personal homepage inside Katana. Every person gets one. These tabs across the top are how you move around YOUR world — not the whole company's admin tools, but your feed, your goals, your performance, and your profile. You do not need to memorize everything today; just know this bar is always here and always takes you home.

*UI element: `data-tour="launchpad-nav"`*

### 2. Your daily starting point

After you sign in, you land here. The welcome line greets you by name. This page answers one question: "What needs my attention right now?" Assignments, mentions, company news, and HR updates all funnel here so you never have to hunt through five modules every morning.

*UI element: `data-tour="launchpad-welcome"`*

### 3. Your profile card (left side)

This card is a snapshot of YOU at the company: photo, job title, department, performance score, and goal progress. If anything looks wrong, click Edit profile — keeping this accurate helps coworkers find you in the directory and helps HR assign the right module access.

*UI element: `data-tour="launchpad-profile"`*

### 4. Shortcuts — your fast lane

Shortcuts are one-click links to things you do often: Goals, Learning paths, Performance reviews, Time off, and more. Instead of clicking through tabs every time, use these like speed-dial buttons. New employees: bookmark mentally where Time off and Learning live.

*UI element: `data-tour="launchpad-shortcuts"`*

### 5. Find a coworker

Need to message someone or check who is on a team? Click this bar to open the People directory. You can search by name, department, or role. The directory is the company phone book — if HR keeps profiles updated, you will always find the right person.

*UI element: `data-tour="launchpad-directory-search"`*

### 6. HR notices & time off

Company-wide HR announcements show up here — policy updates, holidays, benefits reminders. You will also see your own time-off requests and their status (pending, approved, denied). To request leave, click Request time off, fill in dates and reason, and submit. Your manager and HR see it in their workflows.

*UI element: `data-tour="launchpad-hr-notices"`*

### 7. How to read your feed (filters)

The feed can feel noisy, so filters tame it:

- Active vs History — Active is your inbox (new only). History is everything you already saw.
- For you vs Company — "For you" is personal; Company is org-wide broadcasts.
- Type filters — Narrow to tasks, goals, notifications, etc.

Daily habit: open Active + For you first, clear items, then widen if needed.

*UI element: `data-tour="launchpad-feed-filters"`*

### 8. Your activity feed explained

Each row is something that happened that involves you — a task assigned, a goal updated, a project mention, a recognition, etc. When you open an item, it marks as seen. Once you are caught up, items move to History automatically so the same alert never nags you twice. That is intentional: inbox zero is achievable.

*UI element: `data-tour="launchpad-feed"`*

### 9. Achievements & badges

Complete goals, finish learning paths, or earn recognition and badges appear here. This is morale and progress tracking — not payroll. Managers may reference it in reviews, but think of it as a trophy case for professional growth.

*UI element: `data-tour="launchpad-achievements"`*

### 10. Resources links

Handy links to policies, handbooks, or external tools your company configures. If empty, your admin has not added any yet. When populated, this is faster than emailing HR for "where is the handbook?"

*UI element: `data-tour="launchpad-resources"`*

### 11. Going to the Hub (company dashboard)

The Hub is the boss/control-room view of the whole business — projects, inventory, HR admin, etc. You click Hub when you manage people or operations, not just your own work. The training tour continues there next. Employees who only use the Launchpad can ignore Hub unless they have module access.

*UI element: `data-tour="launchpad-hub-link"`*

---

## Part 2: Hub Dashboard

**Route:** `/hub`

Overview, KPIs, and module shortcuts

### 1. What is the Hub?

The Hub is mission control. While the Launchpad is personal ("my stuff"), the Hub is organizational ("our stuff"). Leaders and admins start here to see health, jump into modules, and spot problems before they escalate. If you only ever use one module, you can skip the Hub — but most operators live here daily.

*UI element: `data-tour="hub-header"`*

### 2. Quick actions bar

Three superpowers in one row:

1. Quick Search — find a person, project, SKU, or record across modules.
2. Quick Create — start a project, employee, inventory item, etc. without navigating menus.
3. Customize / Settings — rearrange or configure this dashboard (covered next).

Rule of thumb: Search when you know the name; Create when you are starting something net-new.

*UI element: `data-tour="hub-quick-actions"`*

### 3. Customize your layout

Click Customize to enter edit mode. Drag entire sections (Performance, KPIs, Module grid, Activity feed) up or down. Hide sections you never use so the Hub fits YOUR job. Click Done to save — layout is per-user, not company-wide, so your view can differ from a colleague's.

*UI element: `data-tour="hub-customize"`*

### 4. Profile setup checklist

Katana tracks whether your account and organization profile are complete (photo, org name, settings, etc.). Incomplete setup causes confusing defaults. Work through the checklist here until you hit 100% — especially important for new org owners on day one.

*UI element: `data-tour="hub-profile-setup"`*

### 5. Performance overview panel

A rolled-up snapshot of work happening NOW: active projects, overdue tasks, completion rates. Expand this during standups. If red numbers grow week over week, drill into Projects or Workforce — this panel is an early warning system, not a detailed report.

*UI element: `data-tour="hub-performance"`*

### 6. Key metrics (KPIs)

Deeper numbers than Performance: headcount trends, inventory levels, customer health, etc. KPIs pull from modules you have enabled. Expand to compare periods. Executives screenshot this for board updates; ops managers use it to justify hiring or purchases.

*UI element: `data-tour="hub-kpis"`*

### 7. Employee Launchpad shortcut

Jump back to your personal Launchpad without using the portal nav. Useful when you were doing admin work in the Hub and need to check your own inbox. Not everyone sees this tile — only people with Employee Portal access.

*UI element: `data-tour="hub-launchpad"`*

### 8. Your Tools — the module grid

Every Katana module you are allowed to open appears as a tile. Click a tile to enter that module. Tiles you do not see = your admin has not granted access (that is normal). This grid is the map of the whole platform for your role.

*UI element: `data-tour="hub-modules"`*

### 9. Cross-module activity feed

A live stream of actions across the company: new hires, project updates, inventory movements, support tickets, etc. Filter by module or time. When you wonder "what happened while I was out?" — start here before asking in Slack.

*UI element: `data-tour="hub-activity-feed"`*

---

## Part 3: Human Resources

**Route:** `/hr`

Employees, recruitment, and performance

### 1. What is Katana HR?

HR is where the company manages people — not where individual employees do their daily work (that is the Launchpad). Admins use HR to hire, maintain records, run performance cycles, and publish jobs. Employees with limited access see a smaller slice focused on their own HR data.

*UI element: `data-tour="hr-header"`*

### 2. HR navigation tabs

Each tab is a major department of HR work. You will not use all of them every day — learn which ones match your job:

- Dashboard — summary stats
- Employees — directory & records
- Recruitment — hiring pipeline
- Job Listings — open roles
- Performance / Goals / Learning — talent programs

Click a tab to switch; nothing is hidden, just organized.

*UI element: `data-tour="hr-tabs"`*

### 3. Dashboard numbers explained

Four headline metrics:

- Active Employees — headcount right now
- Retention Risk — overdue performance reviews (people who need a check-in)
- Avg Performance — company-wide review score
- Open Positions — roles you are hiring for

If Retention Risk climbs, schedule reviews before you lose people.

*UI element: `data-tour="hr-dashboard-stats"`*

### 4. Quick links (common actions)

One-click shortcuts to frequent HR dialogs: schedule an interview, start a 360° review, send recognition, request time off (admin view), assign training. These mirror actions inside other tabs — use whichever path you remember.

*UI element: `data-tour="hr-quick-links"`*

### 5. Employee directory

The master list of everyone at the company. Click a person to see profile, department, manager, module access, and status. THIS record controls what modules they see in Katana. When someone joins, changes roles, or leaves, update them here immediately — stale records cause permission bugs.

*UI element: `data-tour="hr-directory"`*

### 6. Employees tab

Click this tab for the full employee table: search, filter, bulk actions, and Add Employee. Onboarding workflow: Add Employee → fill legal name, email, department, manager → assign module access → save. The new hire gets Launchpad access and an invite email if configured.

*UI element: `data-tour="hr-tab-employees"`*

### 7. Recruitment tab

Your hiring pipeline as a board: Applied → Screening → Interview → Offer → Hired (stages may vary). Drag candidates between columns like sticky notes on a wall. Add interview notes so the next interviewer knows what happened. When someone accepts, convert them to an employee record — do not re-type their info.

*UI element: `data-tour="hr-recruitment"`*

### 8. Job listings tab

Create and publish open positions. Control whether a job appears on the public careers page and the internal Jobs tab in the Launchpad. Each listing should have title, description, department, and status (draft/open/closed). Closed listings stop new applications but keep history.

*UI element: `data-tour="hr-job-listings"`*

### 9. Performance tab

Run review cycles: set periods, assign reviewers, collect scores on collaboration/accountability/trust/leadership, and finalize ratings. Employees see results in Launchpad → Performance. Managers live here during review season; ignore it mid-year unless you do ad-hoc reviews.

*UI element: `data-tour="hr-tab-performance"`*

### 10. Goals tab

Company and individual OKRs/KPIs live here. Create goals, assign owners, set due dates, track percent complete. Employees update progress from Launchpad → Goals. Tip: fewer meaningful goals beat a laundry list of 20 items nobody reads.

*UI element: `data-tour="hr-tab-goals"`*

### 11. Learning & development tab

Build learning paths (courses, certifications, onboarding tracks) and assign them to people or teams. Employees see assignments in Launchpad → Learning. Track completion for compliance (e.g., safety training) or growth (e.g., leadership program).

*UI element: `data-tour="hr-tab-learning"`*

---

## Part 4: Workforce Management

**Route:** `/workforce`

Jobs, scheduling, calendar, and timesheets

### 1. What is Workforce Management (WFM)?

WFM is for companies with technicians in the field — installers, repair techs, inspectors, anyone who drives to job sites. You create jobs, assign people, schedule routes, and capture time. If you only work in an office, you may never open this module.

*UI element: `data-tour="wfm-header"`*

### 2. Admin Console vs Technician Portal

Two views of the same system:

- Admin Console — dispatchers and managers plan work
- Technician Portal — field workers see THEIR jobs and clock time

Train office staff on Admin; train techs on Technician Portal (often on mobile).

*UI element: `data-tour="wfm-portal-toggle"`*

### 3. Workforce stats bar

At-a-glance: total jobs, active technicians, assigned vs unassigned work, overdue items, in-progress count. Glance here every morning — if unassigned jobs > 0, someone needs a technician before customers call angry.

*UI element: `data-tour="wfm-stats-bar"`*

### 4. WFM tabs overview

Six areas:

- Dashboard — jobs table + sidebar stats
- Schedule — calendar/map of who goes where
- Jobs — dedicated jobs list view
- Technicians — roster of field workers
- Timesheets — hours worked
- Reports — utilization and summaries

*UI element: `data-tour="wfm-tabs"`*

### 5. Jobs Management table

Every field job is a row: customer, address, status, priority, due date, assigned technicians. Create jobs with New Job. Assign one or many technicians per job (crews are normal). Status flow is typically: Scheduled → In Progress → Completed. Keep statuses current so the schedule stays honest.

*UI element: `data-tour="wfm-jobs"`*

### 6. Creating a new job

Click New Job, enter customer/location/description, set priority and window, assign technicians, save. The job appears on the Schedule and in assigned techs' portals. Missing address = map features break; always fill location fields.

*UI element: `data-tour="wfm-new-job"`*

### 7. Schedule tab

Calendar and map views of the same jobs. Use this to prevent double-booking a technician and to cluster nearby jobs geographically. Drag-and-drop reschedules when customers move appointments. Think of it as the wall calendar in the dispatch office.

*UI element: `data-tour="wfm-calendar"`*

### 8. Technicians tab

Your roster of field workers: skills, contact info, availability. Link HR employees to technician profiles where possible. You cannot assign a job to someone not in this list.

*UI element: `data-tour="wfm-technicians-tab"`*

### 9. Timesheets tab

Technicians clock in/out, log breaks, and attach time to specific jobs. Payroll reviewers verify hours here before export. Rule: no job selected = overhead time; job selected = billable/job-costed time.

*UI element: `data-tour="wfm-timesheet"`*

### 10. Reports tab

Utilization, jobs completed per tech, average duration, overdue trends. Use for weekly ops meetings and capacity planning ("we need two more techs in Zone B").

*UI element: `data-tour="wfm-reports-tab"`*

### 11. Dashboard sidebar stats

Quick counts while you stare at the jobs table — unassigned jobs, overdue, completed today. Faster than running a full report when you just need a pulse check.

*UI element: `data-tour="wfm-quick-stats"`*

---

## Part 5: Inventory

**Route:** `/inventory`

Stock, scan-in, check-out, and suppliers

### 1. What is Katana Inventory?

Inventory tracks physical stuff — parts, products, supplies, equipment. Every item has a SKU, quantity on hand, and location. Warehouse staff and service vans use this daily; finance uses it for asset value; projects link issued parts to job costing.

*UI element: `data-tour="inventory-header"`*

### 2. Inventory health bar

Three numbers:

- Total Items — SKUs in your catalog
- Low Stock — items at or below reorder point (restock these!)
- Open POs — purchase orders not fully received

Start every warehouse morning with Low Stock = 0 if possible.

*UI element: `data-tour="inventory-stats"`*

### 3. Add Item

Creates a new SKU. Minimum: name, SKU/code, unit of measure, starting quantity (optional). Add reorder point and preferred supplier later for automation. Without an item record, you cannot scan-in or check-out that product.

*UI element: `data-tour="inventory-add-item"`*

### 4. New Purchase Order

When stock is low, create a PO: pick supplier, add line items and quantities, submit. When goods arrive, receive against the PO in Scan-in so costs attach correctly. PO → Receive → Stock increases is the golden path.

*UI element: `data-tour="inventory-new-po"`*

### 5. Scan-in (receiving stock)

Goods ARRIVING to the warehouse. Scan barcode or type SKU, enter quantity received, optionally link to a PO. This increases on-hand count. Use for vendor deliveries, returns-to-stock, and production output.

*UI element: `data-tour="inventory-scan-in"`*

### 6. Check-out (issuing stock)

Goods LEAVING the warehouse — to a job, technician van, or internal request. Always record who took it. Check-out decreases on-hand and creates an audit trail. Mystery shrinkage? Compare check-outs to job records.

*UI element: `data-tour="inventory-check-out"`*

### 7. Suppliers

Vendor directory: contact info, lead times, payment terms. Link suppliers to items so POs auto-suggest the right vendor. One-time Amazon purchase? Still make a supplier for clean records.

*UI element: `data-tour="inventory-suppliers"`*

### 8. Search & filter items

Find SKUs fast by name or code; filter by status (active, discontinued, low stock). Large catalogs die without search discipline — train staff to search before creating duplicate items.

*UI element: `data-tour="inventory-search-filter"`*

### 9. Items table

Master list of everything you stock. Click a row for full detail: quantity by location, movement history, linked POs, reorder settings. This table is the source of truth — if quantity is wrong, fix transactions, not the number silently.

*UI element: `data-tour="inventory-items"`*

---

## Part 6: Customer Success

**Route:** `/customer-success`

Client health scores and analytics

### 1. What is Customer Success?

Customer Success (CS) helps you keep clients happy and renewing. You log accounts, track health scores, note every interaction, and spot churn risk before it happens. Sales might close deals; CS makes sure they stay closed.

*UI element: `data-tour="cs-header"`*

### 2. Portfolio health bar

Splits clients into Healthy, Moderate, and At-Risk buckets based on engagement signals (meetings, support tickets, usage, etc.). Green is fine; yellow needs a check-in; red needs a plan this week. Bring this chart to every QBR.

*UI element: `data-tour="cs-health"`*

### 3. CS module tabs

- Dashboard — summary + client list
- Customers — full account management
- Tasks — follow-ups for CSMs
- Milestones — onboarding/renewal checkpoints
- Interactions — call/email log
- Analytics — trends over time

*UI element: `data-tour="cs-tabs"`*

### 4. Client list on dashboard

Every customer account with health badge, ARR or tier, last touch date, and owner. Click a row to open the full account workspace. If last-touch is stale, schedule outreach — silence is how churn starts.

*UI element: `data-tour="cs-clients"`*

### 5. Client health filters

Show only at-risk, only healthy, etc. During weekly standup, filter At-Risk and assign owners to each row. Clear the red list before Friday.

*UI element: `data-tour="cs-client-filters"`*

### 6. Tasks tab

To-dos for CSMs: renewal prep, onboarding checkpoints, escalation follow-ups. Treat it like a shared task list — assign, due-date, complete. Do not track tasks only in email.

*UI element: `data-tour="cs-tasks-tab"`*

### 7. Milestones tab

Key dates in a customer lifecycle: kickoff, go-live, renewal, expansion. Missing a milestone is a leading indicator of churn. Align milestones with contract language.

*UI element: `data-tour="cs-milestones-tab"`*

### 8. Interactions tab

Chronological log of calls, emails, meetings, support escalations. LOG EVERY TOUCH. New CSMs inherit context here; without logs, customers repeat themselves and get angry.

*UI element: `data-tour="cs-interactions-tab"`*

### 9. Analytics tab

Trends: health over time, interaction volume, task completion rates, cohort comparisons. Use to answer "are we getting better at onboarding?" with data, not vibes.

*UI element: `data-tour="cs-analytics"`*

### 10. Dashboard quick stats

Sidebar numbers — accounts needing attention, tasks due this week, upcoming renewals. A speedometer while you work the main client list.

*UI element: `data-tour="cs-quick-stats"`*

---

## Part 7: KYI

**Route:** `/kyi`

Investor discovery and cap raise outreach

### 1. What is KYI (Know Your Investor)?

KYI helps founders and fundraise teams find the right investors for a capital raise. You organize by company (each raise is separate), target geographies, review investor leads, map warm introductions, and track outreach. If you are not raising money, you will not use this module.

*UI element: `data-tour="kyi-header"`*

### 2. The 4-step raise workflow

Every raise follows the same path:

1. Geo — where are you fundraising?
2. Leads — investors in those markets
3. Access Map — who on your team knows them?
4. Contacts — who you are emailing and status

Repeat per company. Skipping steps = cold emails nobody answers.

*UI element: `data-tour="kyi-workflow"`*

### 3. Add a company

Each legal entity or product line gets its own company workspace. Click Add Company, enter name and basics, then open its workspace. Never mix Investor List A (SaaS product) with List B (holding company) — compliance and messaging differ.

*UI element: `data-tour="kyi-add-company"`*

### 4. Your companies card

Lists all raise workspaces. Filter by name, location, or industry. Click a row to enter that company's full workspace (tabs for Geo, Leads, Access Map, Contacts).

*UI element: `data-tour="kyi-search"`*

### 5. Company list rows

Each row is a fundraising workspace. Status and metadata show at a glance. One row = one raise. Founders with multiple startups maintain multiple rows.

*UI element: `data-tour="kyi-network"`*

### 6. Cross-reference tool

Compare investor overlap across companies and team networks. Answers: "Does our CFO know this VC from a prior board seat?" Warm intros beat cold LinkedIn messages 10-to-1.

*UI element: `data-tour="kyi-cross-ref"`*

---

## Part 8: Projects

**Route:** `/projects`

Kanban, timeline, and project management

### 1. What is Katana PM (Projects)?

Projects is where teams plan work: tasks, milestones, files, Gantt-style timelines, Kanban boards inside each project. Think Asana/Monday built into Katana. If you assign someone a task here, they see it in their Launchpad feed.

*UI element: `data-tour="projects-header"`*

### 2. My Projects vs Organization

Toggle scope:

- My Projects — only projects you own, belong to, or have tasks on (daily view)
- Organization — every project in the company (PMO/exec view)

New users should stay on My Projects until they need cross-team visibility.

*UI element: `data-tour="projects-scope"`*

### 3. Portfolio stats

Counts of active projects, upcoming deadlines, team members involved. Quick sanity check before weekly planning.

*UI element: `data-tour="projects-stats"`*

### 4. New Project

Creates a project shell: name, dates, description, team. After creation, open the project to add tasks and milestones. A project without tasks is just an empty folder — add work items immediately.

*UI element: `data-tour="projects-add"`*

### 5. Grid, List, Timeline views

Same projects, three lenses:

- Grid — visual cards (good for executives)
- List — dense table (good for sorting/filtering)
- Timeline — schedule/Gantt (good for deadline planning)

*UI element: `data-tour="projects-tabs"`*

### 6. Grid view

Cards show status color, percent complete, team avatars. Click a card to enter the project workspace where real work happens: tasks, files, discussions, reports.

*UI element: `data-tour="projects-board"`*

### 7. Project cards

Each card is a front door. Inside you will find: task board, assignees, due dates, file attachments, and activity log. Status colors should match reality — update them when work stalls or finishes.

*UI element: `data-tour="projects-grid"`*

### 8. List view tab

Spreadsheet-style project list. Sort by due date, owner, or status. Best when managing 20+ projects and you need to find the one due tomorrow.

*UI element: `data-tour="projects-list-tab"`*

### 9. Timeline view tab

Projects and milestones on a horizontal calendar. Reveals overlap and resource conflicts ("everything due Dec 15"). Use in planning meetings.

*UI element: `data-tour="projects-timeline-tab"`*

### 10. Import project

Bring in a project from CSV or template (if enabled). Useful for migrations. After import, verify assignees and dates — imports rarely perfect.

*UI element: `data-tour="projects-import"`*

---

## Part 9: Automation

**Route:** `/automation`

Knowledge library and browser tools that support Agent Office (especially Automation Agent)

### 1. Automation sidebar

Left rail for navigating Automation: documents, browser tools, analytics, and a hand-off to Automation Agent. Collapse it with the panel button if you need more screen space.

*UI element: `data-tour="automation-sidebar-header"`*

### 2. Ask Automation Agent

Conversation lives in Agent Office. Use this shortcut to open Automation Agent — the specialist for knowledge, workflows, and browser tools. Agents are the only AI chat in Katana.

*UI element: `data-tour="automation-ask-agent"`*

### 3. Documents area

Upload and index files (policies, specs) that agents can ground on. Keeps answers tied to YOUR documents instead of generic internet noise.

*UI element: `data-tour="automation-documents"`*

### 4. Browser automation tools

Scripted browser actions: open a URL, take screenshots, fill forms, download files. Power-user tools the Automation Agent can use — not needed for everyday employees.

*UI element: `data-tour="automation-tools"`*

### 5. Top bar & sidebar toggle

Shows the active section and hides/shows the left sidebar. Use Ask Agent in the header to jump into Agent Office anytime.

*UI element: `data-tour="automation-header"`*

---

## Part 10: Katana Support

**Route:** `/support`

Issue reporting and product feedback

### 1. What is Katana Support?

The help desk for the Katana platform itself — not your customers' tickets. Report bugs, request features, ask how-to questions. The Katana team responds by email. Every submission gets tracked so nothing falls through cracks.

*UI element: `data-tour="support-header"`*

### 2. How support works

Hybrid workflow: submit here in Katana AND email may be used for replies. Status updates appear in My Submissions. Include screenshots, URLs, and exact click-path ("Hub → Inventory → Scan-in → error"). Repro steps turn 3-day mysteries into 30-minute fixes.

*UI element: `data-tour="support-workflow-banner"`*

### 3. Submit vs My Submissions

- Submit — new request form (default tab)
- My Submissions — everything you have filed with status

Admins may see extra tabs (org queue, pilot queue) — ignore unless you are on the support team.

*UI element: `data-tour="support-tabs"`*

### 4. Submit a request form

Pick type: Bug/Issue (something broken) or Feedback/Idea (enhancement). Write title + detailed description. Select which module you were using. Attachments help. Submit once — duplicates slow the team down.

*UI element: `data-tour="support-submit"`*

### 5. My Submissions tab

Click to see all past tickets, statuses (open/in progress/resolved), and replies. Check here before asking "any update?" in email — the answer may already be logged.

*UI element: `data-tour="support-my-submissions-tab"`*

### 6. Status meanings

Open = triaged but not started. In progress = engineer or CS working. Resolved = fix shipped or question answered. Reopen if the fix did not work — include the ticket ID.

*UI element: `data-tour="support-status-footer"`*

---

## Appendix: KYI Company Workspace

These steps apply when you open a specific company raise workspace (`/kyi/companies/:id`).

### 1. Company raise workspace

You are inside ONE company's fundraise. These tabs are the 4-step workflow in detail: Overview (summary), Geo (markets), Leads (investors), Access Map (warm paths), Contacts (outreach list). Work left-to-right during a raise.

*UI element: `data-tour="kyi-company-nav"`*

### 2. Geo targeting — where are you raising?

Set HQ city and radius (miles/km) for local investors. Add roadshow cities under Additional markets. Investors outside your geo still appear in research but are lower priority unless you expand markets.

*UI element: `data-tour="kyi-company-tab-geo"`*

### 3. Localized leads — who invests here?

Database of investors filtered by your geo and thesis. Open a lead for firmographics, check size, portfolio, and notes. Add promising leads to your targeted list — that sends them toward Contacts for outreach.

*UI element: `data-tour="kyi-company-tab-leads"`*

### 4. Access Map — warm introductions

Visual network of who on your team connects to which investors. Warm path = someone can intro you. Prioritize these names before cold email. Empty map = expand team participation or import LinkedIn networks.

*UI element: `data-tour="kyi-company-tab-accessmap"`*

### 5. Contacts — outreach tracker

Your working list: employees, current investors, targeted prospects. Track status: not contacted → emailed → meeting → passed/committed. This is your CRM for the raise — update after every email.

*UI element: `data-tour="kyi-company-tab-contacts"`*

---

## Replay in the app

1. Open the **Setup Guide** from the Hub or Employee Launchpad.
2. Choose **Start training tour** (full system) or pick an individual module tutorial.
3. Completed tours are tracked in your profile (`training_tour_completed_at`).
