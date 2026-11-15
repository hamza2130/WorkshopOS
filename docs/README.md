# WorkshopOS documentation

Specs for every feature as built, plus diagrams of the architecture and the main flows.
Docs are updated in the same change as the code they describe.

## Start here

- [Architecture](architecture.md) — stack, request lifecycle, multi-tenancy, access control, data model, CI.

## Feature specs

| # | Feature | Phase | Status |
| --- | --- | --- | --- |
| 01 | [Authentication](features/01-authentication.md) | 1 | Built |
| 02 | [Workshop onboarding and settings](features/02-workshop-onboarding-and-settings.md) | 1 | Built |
| 03 | [Roles and permissions](features/03-roles-and-permissions.md) | 1–2 | Built |
| 04 | [Employees and invitations](features/04-employees-and-invitations.md) | 1 | Built |
| 05 | [Activity log](features/05-activity-log.md) | 1–3 | Built |
| 06 | [Customers](features/06-customers.md) | 2 | Built |
| 07 | [Vehicles and mileage history](features/07-vehicles-and-mileage.md) | 2 | Built |
| 08 | [Job cards](features/08-job-cards.md) | 3 | Built |
| 09 | [Dashboard](features/09-dashboard.md) | 1–3 | Built (job board); finance tiles later |
| 10 | [Vehicle inspections](features/10-inspections.md) | 4 | Built |
| 11 | [Labour and parts catalogue](features/11-labour-and-parts-catalogue.md) | 4 | Built (stock in Phase 7) |
| 12 | [Estimates and customer approval](features/12-estimates-and-customer-approval.md) | 4 | Built |
| 13 | [In-app notifications](features/13-notifications.md) | 4–5 | Built |
| 14 | [Tasks and mechanic assignment](features/14-tasks-and-assignment.md) | 5 | Built |
| 15 | [Mechanic "My jobs" (phone view)](features/15-mechanic-my-jobs.md) | 5 | Built |
| 16 | [Parts used](features/16-parts-used.md) | 5 | Built (stock in Phase 7) |

Every spec uses the same sections: **What it does · Who can use it · Screens · How it works · Rules ·
Data · Security · Code · Tests · Not yet built.**

## Diagrams

Sources are Mermaid files in [`diagrams/`](diagrams); each has a rendered PNG next to it.

| Diagram | Shows |
| --- | --- |
| [System architecture](diagrams/system-architecture.png) | Browser, Next.js, Supabase, CI and how requests flow |
| [Access control](diagrams/access-control.png) | The three layers that keep workshops apart |
| [Data model](diagrams/data-model.png) | All tables and relationships (Phases 1–3) |
| [Sign-up and onboarding](diagrams/signup-onboarding.png) | Owner registration, email confirmation, workshop creation |
| [Invitation flow](diagrams/invitation-flow.png) | Inviting an employee by one-time link |
| [Duplicate phone check](diagrams/duplicate-phone-check.png) | The three checks that stop duplicate customers |
| [Registration check](diagrams/vehicle-registration-check.png) | Duplicate plates: open, transfer, or owner override |
| [Check-in flow](diagrams/check-in-flow.png) | From a car arriving to an open job card |
| [Job status workflow](diagrams/job-status-machine.png) | All 12 statuses, the allowed moves, and which are system-driven |
| [Attachment upload](diagrams/job-attachment-upload.png) | How photos reach private storage |
| [Estimate approval flow](diagrams/estimate-approval-flow.png) | Inspection → estimate → link → customer decision |
| [Estimate versions](diagrams/estimate-versions.png) | Why a revision always needs fresh approval |
| [Phase 4 data](diagrams/data-model-estimates.png) | Inspections, catalogue, estimates, decisions, notifications |
| [Task status workflow](diagrams/task-status-machine.png) | Task moves, who makes them, and the three checks on a blocked reason |
| [Mechanic work flow](diagrams/mechanic-work-flow.png) | Approved work → tasks → mechanic's phone → blocked → quality check |
| [Phase 5 data](diagrams/data-model-tasks.png) | Tasks, task history, parts used |

### Regenerating the PNGs

```bash
npm run docs:diagrams                       # all diagrams
npm run docs:diagrams -- job-status-machine # just one
```

Uses Mermaid CLI with your installed Chrome or Edge (set `PUPPETEER_EXECUTABLE_PATH` to use another).
