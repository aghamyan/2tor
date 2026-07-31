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
| `*.schedule`, `*.calendar`, `*.next-lesson`                                                                | `ScheduleOverview`; live signal from `loadUpcomingLessons()`                                                                                          |
| `parent.family`                                                                                            | `FamilyOverview`; live signal from `loadFamilyOverview()`                                                                                             |
| `parent.consent`, `admin.family-queue`                                                                     | `ConsentOverview`; parent signal from `loadConsentOverview()`                                                                                         |
| `*.assignments`, `*.tasks`, `tutor.action-queue`                                                           | `AssignmentsOverview`                                                                                                                                 |
| `*.progress`, `*.plan`, `*.feedback`, `*.notes`, `*.analytics`, `tutor.students`, `tutor.plans`            | `AcademicsOverview`                                                                                                                                   |
| `parent.assessments`, `student-older.assessments`                                                          | `AssessmentsOverview`                                                                                                                                 |
| `parent.projects`, `student-older.projects`                                                                | `ProjectsOverview`                                                                                                                                    |
| `parent.discussions`, `student-older.discussions`                                                          | `DiscussionsOverview`                                                                                                                                 |
| `student-younger.rewards`                                                                                  | `GamificationOverview`                                                                                                                                |
| `student-younger.message`, `tutor.messages`                                                                | `CommunicationInbox`                                                                                                                                  |
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

## Progress language

The parent and student surfaces use **progress trend** and explain the observed evidence:
completed work, structured feedback, plan items, assessments, and milestones. The dashboard never
manufactures a future school outcome from those records.
