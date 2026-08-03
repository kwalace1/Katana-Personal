import type { DriveStep } from 'driver.js'
import type { ModuleTourId } from '@/lib/tour-definitions'

function step(
  selector: string,
  title: string,
  description: string,
  side: 'top' | 'right' | 'bottom' | 'left' = 'bottom',
): DriveStep {
  return {
    element: selector,
    popover: { title, description, side, align: 'start' },
  }
}

/** In-depth training copy — plain language, step-by-step module walkthroughs. */
export const TOUR_STEPS: Record<ModuleTourId, DriveStep[]> = {
  launchpad: [
    step(
      '[data-tour="launchpad-nav"]',
      'What is the Employee Launchpad?',
      'Think of the Launchpad as your personal homepage inside Katana. Every person gets one. These tabs across the top — Feed, My work, People, Goals, and more — are how you move around YOUR world, not the whole company\'s admin tools. My work is where assigned jobs and engagements show up with clock-in and status buttons.',
      'bottom',
    ),
    step(
      '[data-tour="launchpad-welcome"]',
      'Your daily starting point',
      'After you sign in, you land here. The welcome line greets you by name. This page answers one question: "What needs my attention right now?" Assignments, mentions, company news, and HR updates all funnel here so you never have to hunt through five modules every morning.',
      'bottom',
    ),
    step(
      '[data-tour="launchpad-profile"]',
      'Your profile card (left side)',
      'This card is a snapshot of YOU at the company: photo, job title, department, performance score, and goal progress. If anything looks wrong, click Edit profile — keeping this accurate helps coworkers find you in the directory and helps HR assign the right module access.',
      'right',
    ),
    step(
      '[data-tour="launchpad-shortcuts"]',
      'Shortcuts — your fast lane',
      'Shortcuts are one-click links to things you do often: Goals, Learning paths, Performance reviews, Time off, and more. Instead of clicking through tabs every time, use these like speed-dial buttons. New employees: bookmark mentally where Time off and Learning live.',
      'right',
    ),
    step(
      '[data-tour="launchpad-directory-search"]',
      'Find a coworker',
      'Need to message someone or check who is on a team? Click this bar to open the People directory. You can search by name, department, or role. The directory is the company phone book — if HR keeps profiles updated, you will always find the right person.',
      'bottom',
    ),
    step(
      '[data-tour="launchpad-hr-notices"]',
      'HR notices & time off',
      'Company-wide HR announcements show up here — policy updates, holidays, benefits reminders. You will also see your own time-off requests and their status (pending, approved, denied). To request leave, click Request time off, fill in dates and reason, and submit. Your manager and HR see it in their workflows.',
      'top',
    ),
    step(
      '[data-tour="launchpad-feed-filters"]',
      'How to read your feed (filters)',
      'The feed can feel noisy, so filters tame it:\n\n• Active vs History — Active is your inbox (new only). History is everything you already saw.\n• For you vs Company — "For you" is personal; Company is org-wide broadcasts.\n• Type filters — Narrow to tasks, goals, notifications, etc.\n\nDaily habit: open Active + For you first, clear items, then widen if needed.',
      'top',
    ),
    step(
      '[data-tour="launchpad-feed"]',
      'Your activity feed explained',
      'Each row is something that happened that involves you — a task assigned, a goal updated, a project mention, a recognition, etc. When you open an item, it marks as seen. Once you are caught up, items move to History automatically so the same alert never nags you twice. That is intentional: inbox zero is achievable.',
      'top',
    ),
    step(
      '[data-tour="launchpad-achievements"]',
      'Achievements & badges',
      'Complete goals, finish learning paths, or earn recognition and badges appear here. This is morale and progress tracking — not payroll. Managers may reference it in reviews, but think of it as a trophy case for professional growth.',
      'left',
    ),
    step(
      '[data-tour="launchpad-resources"]',
      'Resources links',
      'Handy links to policies, handbooks, or external tools your company configures. If empty, your admin has not added any yet. When populated, this is faster than emailing HR for "where is the handbook?"',
      'left',
    ),
    step(
      '[data-tour="launchpad-hub-link"]',
      'Going to the Hub (company dashboard)',
      'The Hub is the boss/control-room view of the whole business — projects, inventory, HR admin, etc. You click Hub when you manage people or operations, not just your own work. The training tour continues there next. Employees who only use the Launchpad can ignore Hub unless they have module access.',
      'left',
    ),
  ],

  hub: [
    step(
      '[data-tour="hub-header"]',
      'What is the Hub?',
      'The Hub is mission control. While the Launchpad is personal ("my stuff"), the Hub is organizational ("our stuff"). Leaders and admins start here to see health, jump into modules, and spot problems before they escalate. If you only ever use one module, you can skip the Hub — but most operators live here daily.',
      'bottom',
    ),
    step(
      '[data-tour="hub-quick-actions"]',
      'Quick actions bar',
      'Three superpowers in one row:\n\n1. Quick Search — find a person, project, SKU, or record across modules.\n2. Quick Create — start a project, employee, inventory item, etc. without navigating menus.\n3. Customize / Settings — rearrange or configure this dashboard (covered next).\n\nRule of thumb: Search when you know the name; Create when you are starting something net-new.',
    ),
    step(
      '[data-tour="hub-customize"]',
      'Customize your layout',
      'Click Customize to enter edit mode. Drag entire sections (Performance, KPIs, Module grid, Activity feed) up or down. Hide sections you never use so the Hub fits YOUR job. Click Done to save — layout is per-user, not company-wide, so your view can differ from a colleague\'s.',
    ),
    step(
      '[data-tour="hub-profile-setup"]',
      'Profile setup checklist',
      'Katana tracks whether your account and organization profile are complete (photo, org name, settings, etc.). Incomplete setup causes confusing defaults. Work through the checklist here until you hit 100% — especially important for new org owners on day one.',
    ),
    step(
      '[data-tour="hub-performance"]',
      'Performance overview panel',
      'A rolled-up snapshot of work happening NOW: active projects, overdue tasks, completion rates. Expand this during standups. If red numbers grow week over week, drill into Projects or Workforce — this panel is an early warning system, not a detailed report.',
    ),
    step(
      '[data-tour="hub-kpis"]',
      'Key metrics (KPIs)',
      'Deeper numbers than Performance: headcount trends, inventory levels, customer health, etc. KPIs pull from modules you have enabled. Expand to compare periods. Executives screenshot this for board updates; ops managers use it to justify hiring or purchases.',
    ),
    step(
      '[data-tour="hub-launchpad"]',
      'Employee Launchpad shortcut',
      'Jump back to your personal Launchpad without using the portal nav. Useful when you were doing admin work in the Hub and need to check your own inbox. Not everyone sees this tile — only people with Employee Portal access.',
    ),
    step(
      '[data-tour="hub-modules"]',
      'Your Tools — the module grid',
      'Every Katana module you are allowed to open appears as a tile. Click a tile to enter that module. Tiles you do not see = your admin has not granted access (that is normal). This grid is the map of the whole platform for your role.',
    ),
    step(
      '[data-tour="hub-activity-feed"]',
      'Cross-module activity feed',
      'A live stream of actions across the company: new hires, project updates, inventory movements, support tickets, etc. Filter by module or time. When you wonder "what happened while I was out?" — start here before asking in Slack.',
    ),
  ],

  hr: [
    step(
      '[data-tour="hr-header"]',
      'What is Katana HR?',
      'HR is where the company manages people — not where individual employees do their daily work (that is the Launchpad). Admins use HR to hire, maintain records, run performance cycles, and publish jobs. Employees with limited access see a smaller slice focused on their own HR data.',
      'bottom',
    ),
    step(
      '[data-tour="hr-tabs"]',
      'HR navigation tabs',
      'Each tab is a major department of HR work. You will not use all of them every day — learn which ones match your job:\n\n• Dashboard — summary stats\n• Employees — directory & records\n• Recruitment — hiring pipeline\n• Job Listings — open roles\n• Performance / Goals / Learning — talent programs\n\nClick a tab to switch; nothing is hidden, just organized.',
    ),
    step(
      '[data-tour="hr-dashboard-stats"]',
      'Dashboard numbers explained',
      'Four headline metrics:\n\n• Active Employees — headcount right now\n• Retention Risk — overdue performance reviews (people who need a check-in)\n• Avg Performance — company-wide review score\n• Open Positions — roles you are hiring for\n\nIf Retention Risk climbs, schedule reviews before you lose people.',
    ),
    step(
      '[data-tour="hr-quick-links"]',
      'Quick links (common actions)',
      'One-click shortcuts to frequent HR dialogs: schedule an interview, start a 360° review, send recognition, request time off (admin view), assign training. These mirror actions inside other tabs — use whichever path you remember.',
    ),
    step(
      '[data-tour="hr-directory"]',
      'Employee directory',
      'The master list of everyone at the company. Click a person to see profile, department, manager, module access, and status. THIS record controls what modules they see in Katana. When someone joins, changes roles, or leaves, update them here immediately — stale records cause permission bugs.',
    ),
    step(
      '[data-tour="hr-tab-employees"]',
      'Employees tab',
      'Click this tab for the full employee table: search, filter, bulk actions, and Add Employee. Onboarding workflow: Add Employee → fill legal name, email, department, manager → assign module access → save. The new hire gets Launchpad access and an invite email if configured.',
    ),
    step(
      '[data-tour="hr-recruitment"]',
      'Recruitment tab',
      'Your hiring pipeline as a board: Applied → Screening → Interview → Offer → Hired (stages may vary). Drag candidates between columns like sticky notes on a wall. Add interview notes so the next interviewer knows what happened. When someone accepts, convert them to an employee record — do not re-type their info.',
    ),
    step(
      '[data-tour="hr-job-listings"]',
      'Job listings tab',
      'Create and publish open positions. Control whether a job appears on the public careers page and the internal Jobs tab in the Launchpad. Each listing should have title, description, department, and status (draft/open/closed). Closed listings stop new applications but keep history.',
    ),
    step(
      '[data-tour="hr-tab-performance"]',
      'Performance tab',
      'Run review cycles: set periods, assign reviewers, collect scores on collaboration/accountability/trust/leadership, and finalize ratings. Employees see results in Launchpad → Performance. Managers live here during review season; ignore it mid-year unless you do ad-hoc reviews.',
    ),
    step(
      '[data-tour="hr-tab-goals"]',
      'Goals tab',
      'Company and individual OKRs/KPIs live here. Create goals, assign owners, set due dates, track percent complete. Employees update progress from Launchpad → Goals. Tip: fewer meaningful goals beat a laundry list of 20 items nobody reads.',
    ),
    step(
      '[data-tour="hr-tab-learning"]',
      'Learning & development tab',
      'Build learning paths (courses, certifications, onboarding tracks) and assign them to people or teams. Employees see assignments in Launchpad → Learning. Track completion for compliance (e.g., safety training) or growth (e.g., leadership program).',
    ),
  ],

  workforce: [
    step(
      '[data-tour="wfm-header"]',
      'What is Katana Workforce?',
      'Workforce is where your team gets things done — assign work, track progress, schedule the week, and log time. Field-service teams see maps and routes; agencies and startups get simpler labels and a Today view that highlights what needs attention.',
      'bottom',
    ),
    step(
      '[data-tour="wfm-settings"]',
      'Work profile',
      'Choose how Workforce speaks to your business: Field service (technicians & maps), Professional services (engagements & billable time), or General/startup (simple work items). Labels and features adapt — your data stays the same.',
    ),
    step(
      '[data-tour="wfm-portal-toggle"]',
      'Manager console vs My work',
      'Two views of the same system:\n\n• Manager console — plan, assign, and approve time\n• My work — what each person sees on the job (field teams get map when enabled)\n\nTrain managers on the console; train workers on My work.',
    ),
    step(
      '[data-tour="wfm-stats-bar"]',
      'Workforce stats bar',
      'At-a-glance: total work items, active team members, assigned vs in-progress, completed this week, overdue. Glance here every morning — unassigned or overdue items mean someone needs to act before customers notice.',
    ),
    step(
      '[data-tour="wfm-tabs"]',
      'Four main areas',
      '• Today — what needs attention right now\n• Work — full list, schedule calendar, and reports\n• Team — roster and assignments\n• Time — hours logged and approvals',
    ),
    step(
      '[data-tour="wfm-today"]',
      'Today tab',
      'Action-first dashboard: due today, unassigned work, overdue items, and team capacity. Start here each morning instead of digging through tables.',
    ),
    step(
      '[data-tour="wfm-jobs"]',
      'Work tab',
      'All work in one place. Use List for the full table, Schedule for the calendar (drag to reschedule), and Reports for utilization. Create work with the add button — link a customer when relevant.',
    ),
    step(
      '[data-tour="wfm-new-job"]',
      'Creating work',
      'Add a title, optional customer link, dates, assignee, and status. Field-service profiles can add site addresses for map views. Saved work appears on Today, Schedule, and the assignee\'s My work view.',
    ),
    step(
      '[data-tour="wfm-calendar"]',
      'Schedule view',
      'Calendar of start and due dates. Drag work to reschedule. Use this to avoid double-booking people and to cluster nearby visits when you run field service.',
    ),
    step(
      '[data-tour="wfm-technicians-tab"]',
      'Team tab',
      'Your roster: skills, contact info, and workload. You can only assign work to people listed here. Import or add team members as you grow.',
    ),
    step(
      '[data-tour="wfm-timesheet"]',
      'Time tab',
      'Clock in/out, log breaks, and attach hours to specific work. Approvers verify here before payroll or billing. Link time to work for job costing when possible.',
    ),
    step(
      '[data-tour="wfm-reports-tab"]',
      'Reports',
      'Completion rates, hours logged, and per-person performance. Use for weekly ops reviews and capacity planning.',
    ),
    step(
      '[data-tour="wfm-needs-attention"]',
      'Needs attention',
      'Overdue or on-hold work surfaced on Today so nothing slips. Click through to the Work tab to update status or reassign.',
    ),
    step(
      '[data-tour="wfm-quick-stats"]',
      'Team capacity',
      'See active work per person at a glance — spot who is overloaded before you assign more.',
    ),
  ],

  inventory: [
    step(
      '[data-tour="inventory-header"]',
      'What is Katana Inventory?',
      'Inventory tracks physical stuff — parts, products, supplies, equipment. Every item has a SKU, quantity on hand, and location. Warehouse staff and service vans use this daily; finance uses it for asset value; projects link issued parts to job costing.',
      'bottom',
    ),
    step(
      '[data-tour="inventory-stats"]',
      'Inventory health bar',
      'Three numbers:\n\n• Total Items — SKUs in your catalog\n• Low Stock — items at or below reorder point (restock these!)\n• Open POs — purchase orders not fully received\n\nStart every warehouse morning with Low Stock = 0 if possible.',
    ),
    step(
      '[data-tour="inventory-add-item"]',
      'Add Item',
      'Creates a new SKU. Minimum: name, SKU/code, unit of measure, starting quantity (optional). Add reorder point and preferred supplier later for automation. Without an item record, you cannot scan-in or check-out that product.',
    ),
    step(
      '[data-tour="inventory-new-po"]',
      'New Purchase Order',
      'When stock is low, create a PO: pick supplier, add line items and quantities, submit. When goods arrive, receive against the PO in Scan-in so costs attach correctly. PO → Receive → Stock increases is the golden path.',
    ),
    step(
      '[data-tour="inventory-scan-in"]',
      'Scan-in (receiving stock)',
      'Goods ARRIVING to the warehouse. Scan barcode or type SKU, enter quantity received, optionally link to a PO. This increases on-hand count. Use for vendor deliveries, returns-to-stock, and production output.',
    ),
    step(
      '[data-tour="inventory-check-out"]',
      'Check-out (issuing stock)',
      'Goods LEAVING the warehouse — to a job, technician van, or internal request. Always record who took it. Check-out decreases on-hand and creates an audit trail. Mystery shrinkage? Compare check-outs to job records.',
    ),
    step(
      '[data-tour="inventory-suppliers"]',
      'Suppliers',
      'Vendor directory: contact info, lead times, payment terms. Link suppliers to items so POs auto-suggest the right vendor. One-time Amazon purchase? Still make a supplier for clean records.',
    ),
    step(
      '[data-tour="inventory-search-filter"]',
      'Search & filter items',
      'Find SKUs fast by name or code; filter by status (active, discontinued, low stock). Large catalogs die without search discipline — train staff to search before creating duplicate items.',
    ),
    step(
      '[data-tour="inventory-items"]',
      'Items table',
      'Master list of everything you stock. Click a row for full detail: quantity by location, movement history, linked POs, reorder settings. This table is the source of truth — if quantity is wrong, fix transactions, not the number silently.',
    ),
  ],

  'customer-success': [
    step(
      '[data-tour="cs-header"]',
      'What is Customer Success?',
      'Customer Success (CS) helps you keep clients happy and renewing. You log accounts, track health scores, note every interaction, and spot churn risk before it happens. Sales might close deals; CS makes sure they stay closed.',
      'bottom',
    ),
    step(
      '[data-tour="cs-health"]',
      'Portfolio health bar',
      'Splits clients into Healthy, Moderate, and At-Risk buckets based on engagement signals (meetings, support tickets, usage, etc.). Green is fine; yellow needs a check-in; red needs a plan this week. Bring this chart to every QBR.',
    ),
    step(
      '[data-tour="cs-tabs"]',
      'CS module tabs',
      '• Dashboard — summary + client list\n• Customers — full account management\n• Tasks — follow-ups for CSMs\n• Milestones — onboarding/renewal checkpoints\n• Interactions — call/email log\n• Analytics — trends over time',
    ),
    step(
      '[data-tour="cs-clients"]',
      'Client list on dashboard',
      'Every customer account with health badge, ARR or tier, last touch date, and owner. Click a row to open the full account workspace. If last-touch is stale, schedule outreach — silence is how churn starts.',
    ),
    step(
      '[data-tour="cs-client-filters"]',
      'Client health filters',
      'Show only at-risk, only healthy, etc. During weekly standup, filter At-Risk and assign owners to each row. Clear the red list before Friday.',
    ),
    step(
      '[data-tour="cs-tasks-tab"]',
      'Tasks tab',
      'To-dos for CSMs: renewal prep, onboarding checkpoints, escalation follow-ups. Treat it like a shared task list — assign, due-date, complete. Do not track tasks only in email.',
    ),
    step(
      '[data-tour="cs-milestones-tab"]',
      'Milestones tab',
      'Key dates in a customer lifecycle: kickoff, go-live, renewal, expansion. Missing a milestone is a leading indicator of churn. Align milestones with contract language.',
    ),
    step(
      '[data-tour="cs-interactions-tab"]',
      'Interactions tab',
      'Chronological log of calls, emails, meetings, support escalations. LOG EVERY TOUCH. New CSMs inherit context here; without logs, customers repeat themselves and get angry.',
    ),
    step(
      '[data-tour="cs-analytics"]',
      'Analytics tab',
      'Trends: health over time, interaction volume, task completion rates, cohort comparisons. Use to answer "are we getting better at onboarding?" with data, not vibes.',
    ),
    step(
      '[data-tour="cs-quick-stats"]',
      'Dashboard quick stats',
      'Sidebar numbers — accounts needing attention, tasks due this week, upcoming renewals. A speedometer while you work the main client list.',
    ),
  ],

  kyi: [
    step(
      '[data-tour="kyi-header"]',
      'What is KYI (Know Your Investor)?',
      'KYI helps founders and fundraise teams find the right investors for a capital raise. Your workspace is scoped to your organization: target geographies, review investor leads, map warm introductions, and track outreach. If you are not raising money, you will not use this module.',
      'bottom',
    ),
    step(
      '[data-tour="kyi-workflow"]',
      'The 4-step raise workflow',
      'Every raise follows the same path:\n\n1. Geo — where are you fundraising?\n2. Leads — investors in those markets\n3. Access Map — who on your team knows them?\n4. Contacts — who you are emailing and status\n\nSkipping steps = cold emails nobody answers.',
    ),
    step(
      '[data-tour="kyi-search"]',
      'Your company',
      'Shows your organization\'s KYI workspace. Click the row to open Geo, Leads, Access Map, and Contacts for your raise.',
    ),
    step(
      '[data-tour="kyi-network"]',
      'Company workspace',
      'Open your organization\'s fundraising workspace. Status and investor counts show at a glance.',
    ),
  ],

  projects: [
    step(
      '[data-tour="projects-header"]',
      'What is Katana PM (Projects)?',
      'Projects is where teams plan work: tasks, milestones, files, Gantt-style timelines, Kanban boards inside each project. Think Asana/Monday built into Katana. If you assign someone a task here, they see it in their Launchpad feed.',
      'bottom',
    ),
    step(
      '[data-tour="projects-scope"]',
      'My Projects vs Organization',
      'Toggle scope:\n\n• My Projects — only projects you own, belong to, or have tasks on (daily view)\n• Organization — every project in the company (PMO/exec view)\n\nNew users should stay on My Projects until they need cross-team visibility.',
    ),
    step(
      '[data-tour="projects-stats"]',
      'Portfolio stats',
      'Counts of active projects, upcoming deadlines, team members involved. Quick sanity check before weekly planning.',
    ),
    step(
      '[data-tour="projects-add"]',
      'New Project',
      'Creates a project shell: name, dates, description, team. After creation, open the project to add tasks and milestones. A project without tasks is just an empty folder — add work items immediately.',
    ),
    step(
      '[data-tour="projects-tabs"]',
      'Grid, List, Timeline views',
      'Same projects, three lenses:\n\n• Grid — visual cards (good for executives)\n• List — dense table (good for sorting/filtering)\n• Timeline — schedule/Gantt (good for deadline planning)',
    ),
    step(
      '[data-tour="projects-board"]',
      'Grid view',
      'Cards show status color, percent complete, team avatars. Click a card to enter the project workspace where real work happens: tasks, files, discussions, reports.',
    ),
    step(
      '[data-tour="projects-grid"]',
      'Project cards',
      'Each card is a front door. Inside you will find: task board, assignees, due dates, file attachments, and activity log. Status colors should match reality — update them when work stalls or finishes.',
    ),
    step(
      '[data-tour="projects-list-tab"]',
      'List view tab',
      'Spreadsheet-style project list. Sort by due date, owner, or status. Best when managing 20+ projects and you need to find the one due tomorrow.',
    ),
    step(
      '[data-tour="projects-timeline-tab"]',
      'Timeline view tab',
      'Projects and milestones on a horizontal calendar. Reveals overlap and resource conflicts ("everything due Dec 15"). Use in planning meetings.',
    ),
    step(
      '[data-tour="projects-import"]',
      'Import project',
      'Bring in a project from CSV or template (if enabled). Useful for migrations. After import, verify assignees and dates — imports rarely perfect.',
    ),
  ],

  automation: [
    step(
      '[data-tour="automation-sidebar-header"]',
      'Automation sidebar',
      'Left rail for the Automation workspace: documents, web tools, analytics, and a hand-off to Automation Agent. Collapse it with the panel button if you need more screen space.',
    ),
    step(
      '[data-tour="automation-ask-agent"]',
      'Ask Automation Agent',
      'Conversation lives in Agent Office. Use this shortcut to open Automation Agent — the specialist for searching your uploaded knowledge and explaining web tools. Agents are the only AI chat in Katana.',
    ),
    step(
      '[data-tour="automation-documents"]',
      'Documents area',
      'Upload files (policies, specs). Text is extracted so you and Automation Agent can search YOUR documents instead of generic internet noise.',
    ),
    step(
      '[data-tour="automation-tools"]',
      'Web tools',
      'HTTP-based helpers: screenshot public pages, extract text, submit simple HTML forms, follow links, download files. Not a full browser — JS-heavy sites may not work.',
    ),
    step(
      '[data-tour="automation-header"]',
      'Top bar & sidebar toggle',
      'Shows the active section and hides/shows the left sidebar. Use Ask Agent in the header to jump into Agent Office anytime.',
    ),
  ],

  support: [
    step(
      '[data-tour="support-header"]',
      'What is Katana Support?',
      'The help desk for the Katana platform itself — not your customers\' tickets. Report bugs, request features, ask how-to questions. The Katana team responds by email. Every submission gets tracked so nothing falls through cracks.',
      'bottom',
    ),
    step(
      '[data-tour="support-workflow-banner"]',
      'How support works',
      'Hybrid workflow: submit here in Katana AND email may be used for replies. Status updates appear in My Submissions. Include screenshots, URLs, and exact click-path ("Hub → Inventory → Scan-in → error"). Repro steps turn 3-day mysteries into 30-minute fixes.',
    ),
    step(
      '[data-tour="support-tabs"]',
      'Submit vs My Submissions',
      '• Submit — new request form (default tab)\n• My Submissions — everything you have filed with status\n\nAdmins may see extra tabs (org queue, pilot queue) — ignore unless you are on the support team.',
    ),
    step(
      '[data-tour="support-submit"]',
      'Submit a request form',
      'Pick type: Bug/Issue (something broken) or Feedback/Idea (enhancement). Write title + detailed description. Select which module you were using. Attachments help. Submit once — duplicates slow the team down.',
    ),
    step(
      '[data-tour="support-my-submissions-tab"]',
      'My Submissions tab',
      'Click to see all past tickets, statuses (open/in progress/resolved), and replies. Check here before asking "any update?" in email — the answer may already be logged.',
    ),
    step(
      '[data-tour="support-status-footer"]',
      'Status meanings',
      'Open = triaged but not started. In progress = engineer or CS working. Resolved = fix shipped or question answered. Reopen if the fix did not work — include the ticket ID.',
    ),
  ],

  finance: [
    step(
      '[data-tour="finance-header"]',
      'What is Katana Finance?',
      'Your bookkeeping workspace inside Katana. Track bank activity, categorize expenses and income, and work toward month-end close. Katana organizes your books for tax season — it does not file returns or give tax advice.',
      'bottom',
    ),
    step(
      '[data-tour="finance-disclaimer"]',
      'Important disclaimer',
      'Finance helps you stay organized and export-ready for your CPA. Always have a qualified tax professional review before filing. Katana is software, not a CPA firm.',
      'bottom',
    ),
    step(
      '[data-tour="finance-tabs"]',
      'Module tabs',
      'Overview = cash summary and close checklist. Transactions = categorize activity. Bank accounts = your checking and credit cards. Chart of accounts = your ledger structure. Settings = entity type and fiscal year.',
      'bottom',
    ),
    step(
      '[data-tour="finance-overview"]',
      'Dashboard overview',
      'See inflows, outflows, and how many transactions still need a category. Use the monthly close checklist to know what is left before tax season.',
      'bottom',
    ),
    step(
      '[data-tour="finance-workflow"]',
      'Month-end workflow',
      'Typical flow: add bank accounts → import or record transactions → categorize each line → reconcile against your statement → review P&L in Reports. Plaid feeds and CPA export are coming soon.',
      'bottom',
    ),
    step(
      '[data-tour="finance-import"]',
      'Import bank statements',
      'Upload CSV (best) or PDF from your bank. Katana parses rows, skips duplicates, and queues them for categorization.',
      'bottom',
    ),
    step(
      '[data-tour="finance-reconcile"]',
      'Reconciliation',
      'Enter your statement ending balance, check off cleared transactions, and close when the difference is zero.',
      'bottom',
    ),
    step(
      '[data-tour="finance-plaid"]',
      'Plaid bank feeds',
      'Connect your bank securely for automatic transaction sync. Requires PLAID_CLIENT_ID and PLAID_SECRET on the server.',
      'bottom',
    ),
    step(
      '[data-tour="finance-tax"]',
      'Tax readiness',
      'Build a year-end packet (CSV/PDF) for your CPA, track 1099 vendors, and view illustrative estimated tax due dates.',
      'bottom',
    ),
  ],
}

export const KYI_COMPANY_TOUR_STEPS: DriveStep[] = [
  step(
    '[data-tour="kyi-company-nav"]',
    'Company raise workspace',
    'You are inside ONE company\'s fundraise. These tabs are the 4-step workflow in detail: Overview (summary), Geo (markets), Leads (investors), Access Map (warm paths), Contacts (outreach list). Work left-to-right during a raise.',
    'bottom',
  ),
  step(
    '[data-tour="kyi-company-tab-geo"]',
    'Geo targeting — where are you raising?',
    'Set HQ city and radius (miles/km) for local investors. Add roadshow cities under Additional markets. Investors outside your geo still appear in research but are lower priority unless you expand markets.',
    'bottom',
  ),
  step(
    '[data-tour="kyi-company-tab-leads"]',
    'Localized leads — who invests here?',
    'Database of investors filtered by your geo and thesis. Open a lead for firmographics, check size, portfolio, and notes. Add promising leads to your targeted list — that sends them toward Contacts for outreach.',
    'bottom',
  ),
  step(
    '[data-tour="kyi-company-tab-accessmap"]',
    'Access Map — warm introductions',
    'Visual network of who on your team connects to which investors. Warm path = someone can intro you. Prioritize these names before cold email. Empty map = expand team participation or import LinkedIn networks.',
    'bottom',
  ),
  step(
    '[data-tour="kyi-company-tab-contacts"]',
    'Contacts — outreach tracker',
    'Your working list: employees, current investors, targeted prospects. Track status: not contacted → emailed → meeting → passed/committed. This is your CRM for the raise — update after every email.',
    'bottom',
  ),
]
