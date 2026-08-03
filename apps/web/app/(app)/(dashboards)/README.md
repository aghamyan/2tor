# Role dashboard composition

The `/dashboard` entry point resolves the authenticated actor and redirects to the highest-trust
dashboard they hold: administrator, finance, tutor, parent, then student. Each role page runs its
panel list through `@app/auth`'s `authorize()`-backed dashboard capability check. Every destination
module re-runs its own record/relationship authorization; a visible panel is never treated as
permission to read a record.

Student presentation is selected from the family module's privacy-minimized profile fields.
Adult learners and learners aged 13+ receive the detailed view; learners under 13 receive the
younger view. Date of birth month, age band, and grade are considered in that order. Unknown age
data defaults to the neutral detailed view instead of guessing that an account belongs to a child.

## Panel export map

Dashboard cards are launchers for the module-owned surface shown below. Compact live signals use
the listed public read query. When a module does not export a compact widget/query, the card links
to its exported full surface rather than copying its logic into the dashboard.

| Dashboard panel IDs                                                                                        | Owning public export consumed                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `*.schedule`, `*.calendar`, `*.next-lesson`                                                                | `ScheduleOverview`; live signal from `loadUpcomingLessons()`, join link + ticking countdown from `loadLessonDetail()` for that one lesson             |
| `parent.family`                                                                                            | `FamilyOverview`; live signal from `loadFamilyOverview()`                                                                                             |
| `parent.consent`, `admin.family-queue`                                                                     | `ConsentOverview`; parent signal from `loadConsentOverview()`                                                                                         |
| `*.assignments`, `*.tasks`, `tutor.action-queue`                                                           | `AssignmentsOverview`                                                                                                                                 |
| `*.progress`, `*.plan`, `*.feedback`, `*.notes`, `*.analytics`, `tutor.students`, `tutor.plans`            | `AcademicsOverview`                                                                                                                                   |
| `parent.assessments`, `student-older.assessments`                                                          | `AssessmentsOverview`                                                                                                                                 |
| `parent.projects`, `student-older.projects`                                                                | `ProjectsOverview`                                                                                                                                    |
| `parent.discussions`, `student-older.discussions`                                                          | `DiscussionsOverview`                                                                                                                                 |
| `student-younger.rewards`                                                                                  | `GamificationOverview`                                                                                                                                |
| `parent.message`, `student-younger.message`, `tutor.messages`                                              | `CommunicationInbox`; link-only, see "Known gaps" below                                                                                               |
| `*.resources`, `student-older.formulas`                                                                    | `ContentOverview`                                                                                                                                     |
| `parent.payments`, `admin.finance-health`, `admin.refunds`, `finance.*` payment panels                     | `PaymentsOverview`; live signals from `loadPaymentDashboard()`                                                                                        |
| `tutor.earnings`, `finance.*` payout panels                                                                | `PayoutOverview`; live signals from `loadPayoutDashboard()`                                                                                           |
| `parent.tutor-change`, `parent.support`                                                                    | `SupportOverview`                                                                                                                                     |
| `tutor.availability`, `tutor.development`                                                                  | `TutorOverview`                                                                                                                                       |
| `admin.matching-queue`                                                                                     | `MatchingQueue`                                                                                                                                       |
| `admin.delivery`, `admin.capacity`                                                                         | `ReportingDashboard`                                                                                                                                  |
| `admin.enrollment`, `admin.tutor-queue`, `admin.learning-safety`, `admin.data-requests`, `admin.high-risk` | Administration public services exported by `packages/domain/administration/index.ts`; live queue signals call the read-only list services in parallel |

The student view resolver consumes only the public `gamificationRequestContext()` and
`familyRequestContext()` composition exports. The first resolves the actor's own student profile
ID; the second reads that exact profile for age-sensitive presentation. No dashboard imports a
module's `models.ts`, `services.ts`, `runtime.ts`, database implementation, or private component.

## Performance boundary

`dashboard/loading.tsx` is the immediate shell shown while actor resolution completes. After the
role shell renders, live signals stream through React `Suspense`; deep module surfaces are not
mounted in the dashboard bundle. Independent module reads use `Promise.all`, so a dashboard signal
request is bounded by the slowest common read rather than their cumulative latency. Actor-specific
records are dynamic and are never placed in a shared cache.

The one exception: on the parent, student, and tutor dashboards, the next-lesson join link needs a
second, per-record read (`loadLessonDetail()`) that depends on the lesson ID the first batch
returns, so it cannot join that `Promise.all` — it is a genuine additional sequential hop, not a
parallel one, and only runs when there is an upcoming lesson.

## Progress language

The parent and student surfaces use **progress trend** and explain the observed evidence:
completed work, structured feedback, plan items, assessments, and milestones. The dashboard never
manufactures a future school outcome from those records.

## Known gaps: cards without a live signal

A dashboard card is only wired to a compact, real-time count/value when the owning module exports
a public read query for it (`apps/web/app/(app)/<module>/queries.ts`, or an equivalent public list
service such as `packages/domain/administration/index.ts`'s read services). As of this pass, only
`consent`, `families`, `payments`, `payouts`, and `scheduling` export one. Every other module panel
below is therefore a launcher to the module's full surface — accurate, but without a badge/count on
the dashboard itself. Building a synthetic count from `services.ts`/`models.ts` internals was
avoided per the "public exports only" constraint; each gap instead links straight to the record.

| Card                                                                                                                               | Wanted signal                            | Why it is link-only                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parent.message` (unread tutor message)                                                                                            | Unread-message count                     | `communication` has no `queries.ts`; `CommunicationInbox` is a client component that fetches its own data. No public count export exists.                                                                                                                                                                                                                            |
| `tutor.action-queue` (missing feedback, plans due, milestone deadlines)                                                            | Combined count across those four signals | `academics` has no `queries.ts`. `academics/missed-feedback.ts` is a private worker job that _writes_ admin notifications — not a read export, and out of scope even if it were public. Only the "submissions to review" half is even reachable, and there is no public assignments count either — the panel links to `AssignmentsOverview` and `AcademicsOverview`. |
| `student-younger`/`student-older`/`tutor` task and plan cards (`*.tasks`, `*.plan`, `*.feedback`, `tutor.students`, `tutor.plans`) | Open-item counts                         | Same as above: `academics` and `assignments` have no compact read export.                                                                                                                                                                                                                                                                                            |
| `admin.*` queue cards other than the four wired below                                                                              | Live counts                              | `administration/index.ts` exports read services for family approvals, tutor verification, disputes, moderation, support tickets, and privacy requests — used by `loadAdminDashboardSummary()`. Matching, reporting/capacity, and high-risk-control counts have no equivalent public read export, so those cards stay link-only.                                      |

The next lesson's join link and countdown (previously a gap — `loadUpcomingLessons()` returns list
rows without a join URL) is now built: the dashboard additionally calls `loadLessonDetail()`, a
second public export from the same module, for the one next-lesson row only, and reads its
`zoom.joinUrl`. This is a single bounded per-record read, not a loop over the list.
