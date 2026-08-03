# QA checklist (copy per release / PR)

_Use this template for significant UI or data-flow changes. Copy the section below into the PR description or a ticket comment and check items before merge._

## Environment

- [ ] Local / preview URL: ____________________
- [ ] Browser(s): Chrome · Edge · Safari (as applicable)
- [ ] Auth role(s): admin · employee · manager (as applicable)

## Smoke

- [ ] App loads without console errors (F12)
- [ ] Navigation: primary routes reachable from sidebar
- [ ] Sign-out / sign-in still works after changes

## Feature area (edit title)

**Area:** ____________________

- [ ] Happy path matches acceptance criteria
- [ ] Empty states / loading / error states behave sensibly
- [ ] Forms: validation messages; disabled submit while saving
- [ ] Mobile width (~390px): no horizontal overflow on touched pages

## Data & security

- [ ] No secrets or PII pasted in UI copy or logs
- [ ] RLS-sensitive flows: tested with a non-admin user when relevant

## Regression (pick based on touched modules)

- [ ] HR: employees list, one edit dialog
- [ ] PM: projects list, one project detail / task action
- [ ] KYI: companies list, one company detail
- [ ] Employee portal: dashboard loads

## Sign-off

- [ ] Checked by: ____________________ · Date: __________
