# Katana — User Training Guide

Training materials for everyday users of the Katana platform. Work through Part 1, then
the sections for the modules you'll use. Each module section ends with practice exercises
you can do in a few minutes.

*Developers: see [ONBOARDING.md](ONBOARDING.md) instead — this guide is for end users.*

---

## Part 1 — Getting started (everyone)

### 1.1 Your account

- **Invited by email/code:** open the invite link (or the Accept Invite page), enter your
  invite code, and set a password — or sign in with your **Microsoft work account** if your
  org uses it.
- **Signing in later:** use the same method you signed up with. Sessions refresh
  automatically; you'll only be asked to log in again after signing out or after a long
  period of inactivity.

### 1.2 Roles — what you can see and do

| Role | Meaning |
|------|---------|
| **Owner / Admin** | Full access to every module and organization settings |
| **Member** | Access to the modules HR has assigned to you |
| **Viewer** | Read-mostly access to assigned modules |

Non-admin module access is controlled by HR. If a module you need is missing from your
sidebar, ask your HR admin to add it to your employee record — it takes effect without
re-logging in.

### 1.3 Finding your way around

- The **sidebar** lists only the modules you have access to. Everyone has the
  **Employee Portal**.
- The **Hub** (`/hub`) is the landing dashboard after login.
- **Notifications** (bell) alert you to mentions, assignments, and system events.
- If a link takes you somewhere you don't have access to, you'll be redirected to your
  Employee Portal — that's expected, not an error.

> **Practice:** log in, check which modules appear in your sidebar, open the Hub, and open
> your notifications.

---

## Part 2 — Employee Portal (everyone)

Your self-service home: `/employee`.

| Page | What you do there |
|------|-------------------|
| **Dashboard** | Overview of your goals, reviews, and announcements |
| **My Profile** | Edit phone, location, timezone (use the map-pin button to auto-detect timezone from your location), and bio |
| **Company Directory** | Browse colleagues, see departments and titles |
| **Performance** | View your performance reviews |
| **Goals** | Track personal goals and progress |
| **Learning & Development** | Learning paths and training courses assigned to you |
| **Internal Jobs** | Browse and apply to internal job postings |

> **Practice:** open My Profile, fill in your location, click the map-pin to detect your
> timezone, add a one-line bio, and save. Then find a colleague in the Directory.

---

## Part 3 — Module guides

### 3.1 Katana PM (Projects)

For anyone managing or executing project work.

- **Projects list** (`/projects`): create projects, see status and progress.
- **Project detail**: the **Kanban board** — drag task cards between columns
  (Backlog → To Do → In Progress → Review → Blocked → Done). Dropping a card updates its
  status automatically.
- Tasks carry priority, assignee, deadline, and progress. Projects also support
  milestones, sprints, team members, files, and an activity feed.

> **Practice:** open a project, drag one of your tasks to the next column, then check the
> activity feed recorded the change.

### 3.2 Katana Inventory

- **Items** (`/inventory`): the catalog — stock levels, item details.
- **Scan In / Check Out**: receive stock in, issue stock out.
- **Transactions**: full movement history.
- **Purchase Orders**: create and track POs (auto-numbered) against **Suppliers**.

> **Practice:** look up an item, open its detail page, and review its recent transactions.

### 3.3 Katana Customers (Customer Success)

- **Clients**: account list with **health scores** and history.
- **Interactions**: log calls/emails/meetings against a client.
- **CS Tasks & Milestones**: follow-ups and lifecycle stages per client.

> **Practice:** open a client, review their health history, and log a test interaction.

### 3.4 WFM (Workforce Management)

For field-service coordinators and technicians.

- **Technicians**: the field roster and their skills/availability.
- **Jobs**: work orders (auto-numbered) — assign technicians, track status, add job notes.
- **Schedules & Timesheets**: who works when, and hours logged.

> **Practice:** open today's schedule, then open one job and read its notes.

### 3.5 Katana HR

For HR staff and managers.

- **Employees**: records with department, title, manager — and the **module access**
  checkboxes that control what each person sees in Katana.
- **Performance**: reviews, 360 feedback, recognitions.
- **Goals**: company and individual goals with comments.
- **Recruitment** : job postings, applicant pipeline, interview notes, and the
  **talent pool** (interviewed candidates saved for future roles).
- **Time off**: request and approval workflow.
- **Training**: courses and learning paths.
- **Notices**: company announcements.

> **Practice (HR admins):** open an employee record and review their module access list —
> this is also how you grant a new module to someone who asks.

### 3.6 Careers (public + internal)

The public careers page lists open roles; applicants apply without an account (resume
upload supported). Applications land in HR → Recruitment, and HR is notified automatically.

### 3.7 Know Your Investor (KYI)

Investor-lead intelligence for fundraising teams.

- **Leads**: the main lead database, refreshed daily at ~6:00 UTC from 36 public sources
  (SEC EDGAR, FEC, FINRA, Companies House, news, and more), deduplicated by name.
- **Companies / Investors**: profile pages with geo targeting settings.
- **Cross-Reference**: match leads against your target criteria.
- **Lead notes**: keep outreach notes on a lead.
- Leads include geo-coordinates for map views; newly imported leads may take a pass of the
  geocoding backfill before they appear on maps.

> **Practice:** filter leads by your target geography, open one lead, and add a note.

### 3.8 Katana Comms

- **Channels**: public (anyone in the org can join) or private (membership required).
- **DMs / group conversations**: start from the new-conversation dialog; group chats are
  named after the members you pick.
- Reactions, mutes, and per-channel notification preferences are available.

> **Practice:** join a public channel, post a message, and react to someone else's.

### 3.9 Agent Office — the AI assistants

Agent Office is Katana's AI chat. Ask specialists in plain language — e.g.
*"How many employees do we have?"*, *"Show me Jane Doe's recent reviews"*, or
*"Which jobs are scheduled this week?"*. The floating helper opens the right agent
for the module you are in. Agents look up live data using **your** permissions:
they can only see what you can see.

### 3.10 Facilities, Automation

- **Katana Facilities** (`/manufacturing`) and **Automation** (`/automation`): operations
  and knowledge/tools for agents — ask your admin whether your org uses them.
  Automation holds documents and browser tools; conversation stays in Agent Office.

---

## Part 4 — For organization admins

- **Organization Settings** (`/settings/organization`): org profile and membership.
- **Inviting people:** create an invite (email + role); the invitee redeems the code on the
  Accept Invite page. Then create/link their HR employee record and set module access.
- **Access reviews:** module access lives on the HR employee record — review it when people
  change roles, and remove access promptly for leavers (disable their auth user too).
- **Storage** (`/storage`): uploaded files. Note that employee photos and project files are
  stored in shared buckets — don't upload anything that shouldn't be org-visible.

---

## Part 5 — FAQ & troubleshooting

| Problem | Likely cause / fix |
|---------|--------------------|
| A module is missing from my sidebar | You don't have access — ask HR to add it to your employee record |
| I was redirected to the Employee Portal | You followed a link to a module you don't have access to |
| I see empty lists where I expect data | Usually a permissions boundary — you can only see your organization's rows. If it persists, report it |
| My profile edits didn't save | Check required fields; if the error mentions "permission", contact an admin |
| I can't log in with Microsoft | Use the same account type you were invited with; ask an admin to confirm your invite email matches your Microsoft email |
| Something looks broken | Use the in-app support/feedback form so it's tracked, and hard-refresh (`Ctrl+Shift+R`) first |

**Getting help:** submit an issue through the in-app support form (tracked in the system),
or contact your org admin.

---

## Suggested training session plan (for trainers)

| Session | Audience | Content | Time |
|---------|----------|---------|------|
| 1. Katana basics | Everyone | Part 1 + Part 2 (login, navigation, Employee Portal) | 30 min |
| 2. Your modules | Per team | The 1–3 module sections that team uses, with the practice exercises | 45 min |
| 3. Comms + Agents | Everyone | §3.8–3.9, posting, channels, asking agents | 20 min |
| 4. Admin track | Admins/HR | Part 4 + HR module access management | 45 min |

Run sessions hands-on in the live app with each attendee logged in as themselves — the
practice exercises in each section are designed to be done live.
