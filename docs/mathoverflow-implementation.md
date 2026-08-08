# MathOverflow — Implementation Report

Status snapshot as of 2026-08-07. This module is developed as a rename-safe rebuild of the
platform's "Questions" section into a full math Q&A community, branded **MathOverflow**
(`packages/domain/discussions/branding.ts`). The module's internal name — routes, tables, i18n
namespace, folders — deliberately stays `discussions`; only the display name changed. See
`packages/domain/discussions/README.md` for the module-ownership rationale.

This document is the authoritative status record for the feature: what's built and verified, what
was found and fixed along the way, what's known-incomplete, and the permission matrix. It will be
updated as remaining phases land — treat any claim below as accurate only as of the date above.

## 1. What's built and live

### Backend (complete)

- **Schema**: `packages/db/src/schema/discussions.ts` + supporting columns in `academic.ts`,
  `communication.ts`, `tutors.ts`. Migrations `0006_mathoverflow_discussions.sql`,
  `0007_discussion_author_display_names.sql`, `0008_discussion_helpful_votes.sql` — applied and
  verified against a real local Postgres 16 instance.
- **Domain layer** (`packages/domain/discussions/`, ~20 files): `models.ts`, `schemas.ts` (Zod),
  `errors.ts` (typed `DiscussionError` with HTTP-status-bearing codes — see §5), `capabilities.ts`
  (every permission check, see §4), `services.ts` (business logic), `ratings.ts`, `comments.ts`,
  `corrections.ts`, `social.ts` (follow/save/helpful-vote), `moderation.ts`, `notifications.ts`,
  `tags.ts`, `feed.ts`, `ordering.ts` (answer-ranking algorithm), `parent-activity.ts`,
  `drizzle-database.ts` (real Postgres implementation of the `DiscussionDatabase` interface),
  `runtime.ts` (request-context wiring, Redis view-dedup), `s3-storage.ts` + `signed-url.ts`
  (attachment storage plumbing).
- **Server actions & queries**: `apps/web/app/(app)/discussions/actions.ts`, `queries.ts`,
  `context.ts`, `action-state.ts`.
- **Seed data**: `packages/db/src/seed.ts` extended with a second student/tutor pair, a group
  course + enrollments, 3 tags, 6 questions spanning all 4 visibility tiers and multiple statuses,
  4 answers, 3 tutor ratings, 1 helpful vote, 3 comments (one threaded reply), 1 correction, 1
  follow, 1 bookmark, 1 abuse report, 4 notifications.
- **Tests**: `apps/web/tests/discussions/discussions.service.test.ts` (16 tests) +
  `support/in-memory-discussion-database.ts` (in-memory `DiscussionDatabase` adapter for
  service-layer unit tests). Beyond the original 5 (anonymous-posting guard, private-question
  access, unverified-until-tutor-verified, PII/attachment quarantine, no public/DM entry point),
  covers: `canAccessQuestion` across all 4 visibility tiers (including the non-obvious rule that an
  unlinked parent can't see even a `community`-visibility question, and that a `group_shared`
  question with a missing `groupId` denies everyone); `canRateAnswer`'s anti-gamification guards
  (non-tutor actor, self-rating even under a role change, rating an official tutor answer, a tutor
  with no access to the discussion) as both accept and reject cases; and `orderAnswersForDisplay`
  proving the spec's core ordering rule empirically — a tutor-verified or accepted answer outranks
  an unverified one with far more helpful votes, and a lone 5-star rating does not outrank a
  5-rating 4.8-star average (confidence-adjusted, not raw, average). One test (`canRateAnswer`
  "rejects a tutor with no access") initially failed for a real reason — a `private_support`
  question can't have a peer-student answer in the first place, so the test needed a
  `group_shared` fixture instead — caught by running it, not assumed correct because it typechecked.
  Not covered: server actions, page components, and the rating-count/Bayesian-shrinkage math in
  isolation (only through `orderAnswersForDisplay`'s black-box ranking behavior); no E2E tests.

### UI (all 5 planned surfaces built)

| Surface                | Route                     | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Feed                   | `/discussions`            | **Built and verified.** Role-aware tabs, search, sort (7 modes, all real), tag filter, cursor pagination, question cards, empty states. Parents are redirected to `/discussions/family`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Question detail        | `/discussions/[slug]`     | **Built and verified.** Markdown+KaTeX rendering, answer ordering, accept/verify badges, tutor rating dialog + breakdown, corrections display, threaded comments, follow/save/helpful actions, guarded answer form.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Parent child activity  | `/discussions/family`     | **Built and verified.** Multi-child picker (link-based, no JS required), monthly stats, unresolved-questions list, tutor-feedback list, recent-activity timeline — all against real `getChildActivitySummary` data, verified with a real 2-child parent account.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Admin moderation queue | `/discussions/moderation` | **Built and verified.** Status-filtered report queue (open/reviewing/escalated/resolved/dismissed/all), each report enriched with resolved target preview + link, reporter/author/assignee display names; assign-to-me and inline resolve (status/severity/note) actions. Verified as real admin (dev-only seeded TOTP secret, computed locally — see below) and confirmed non-staff (tutor) is redirected away.                                                                                                                                                                                                                                                                                      |
| Ask question           | `/discussions/ask`        | **Built and verified.** Template picker (7 question types, doubling as the spec's "templates"), scope picker sourced from the student's real active enrollments (course/group/subject), title + write/preview markdown editor (reuses the same sanitized `DiscussionMarkdown` renderer, now proven to also work client-side), conditional "what have you tried" for homework-help, visibility picker with per-option descriptions, up to 5 tags, real debounced localStorage draft autosave with restore-on-return. Verified with a real student account showing real enrollment-derived scope options (a seeded group course + subject, no 1:1 course — the less common branch, exercised for real). |

Components live under `apps/web/components/discussions/` (shell, feed, question card,
markdown+KaTeX renderer, answer card, rating dialog, rating breakdown, comment list/form, star
rating input, action feedback, simple action button, activity-page shell shared by the family and
moderation views, moderation card + resolve form, ask-question form). Full i18n coverage (`en`+`hy`)
exists for every built surface, including `family.*`, `moderation.*`, and `ask.*`.

## 2. How this was verified

No browser automation is available in this environment. All UI verification was done by
authenticating real demo accounts against the actual running dev server and a real seeded
Postgres database, then inspecting the real rendered HTML — not by code review alone:

```
POST /api/auth/login  (real cookie-jar session)
  areg.student / DemoLogin!2026        — student
  tutor@example.com / DemoLogin!2026   — tutor (Davit)
  tutor2@example.com / DemoLogin!2026  — tutor (Nvard)
  parent@example.com / DemoLogin!2026  — parent (Anahit)
```

`admin@example.com` requires TOTP MFA (by design — see `packages/db/src/seed.ts`'s
`DEMO_ADMIN_TOTP_SECRET`, a dev-only secret the seed script prints for exactly this purpose). For
the moderation-queue verification pass, a valid 6-digit code was computed locally from that secret
(standard RFC 6238, Python stdlib `hmac`/`hashlib`) and submitted alongside the password in the
same login request, matching how a developer would use it with a real authenticator app.

For each built page, verification covered: correct content for the authenticated role, correct
gating (a tutor without access to a private question gets a 404, not the page), and — for the
markdown pipeline specifically — a standalone script exercising the exact
sanitize → KaTeX → sanitize-schema-extension pipeline against both a legitimate math/GFM sample
and an XSS payload (`<script>`, `onerror=`), confirming real KaTeX HTML+MathML output while
confirming the dangerous markup is stripped. All scratch verification scripts were deleted after
use; none remain in the repo.

Write actions (rate, accept, comment, follow, save, helpful-vote) are verified by typecheck +
direct service-level execution against real Postgres + code review — **not** by simulated
button-clicks, since no browser tool is available here. This is listed explicitly in §6.

## 3. Bugs found and fixed during the build

These were all caught by the verification method above (live server + real Postgres), not by
inspection, and are recorded here because they'd otherwise be invisible in a diff:

1. **Raw JS `Date` interpolated into a Drizzle `sql` template** (`drizzle-database.ts`,
   `queryFeed`'s group-assignment window check) — the `postgres` driver threw
   `TypeError [ERR_INVALID_ARG_TYPE]` inside `Buffer.byteLength` when handed a `Date` object
   directly. Fixed by interpolating `now.toISOString()` instead.
2. **Raw JS `boolean` interpolated into the same `sql` template** (visibility clause) — fixed by
   pre-computing `sql\`true\`/sql\`false\`` literals rather than interpolating the JS boolean.
3. **Three of seven feed sort modes were silent no-ops.** `most_helpful`, `most_answered`, and
   `highest_rated` were declared in the schema and selectable in the UI but fell back to
   `recent_activity` ordering with no error — a "fake feature." All three now run real correlated
   subqueries and were verified to each produce distinct, correct ordering.
4. **Group-visibility bypass**: `isStudentInGroup` / `isTutorAssignedToGroup` didn't check
   `courses.isGroup`, so a 1:1 course's enrollment could incorrectly satisfy a `group_shared`
   question's visibility check. Fixed with an added join; re-verified legitimate group access still
   works.
5. **500 instead of 404 on unauthorized question access.** A tutor with no access to a private
   question hit an uncaught `FORBIDDEN` throw instead of a clean not-found response. Fixed via a
   `nullOnNotFoundOrForbidden` mapping in `queries.ts` so both `FORBIDDEN` and `NOT_FOUND` resolve
   to `null` → the page calls `notFound()`. This was a real security/UX bug, not a style issue: it
   leaked "this resource exists but you can't see it" via status code.
6. **Dropped `robots: noindex` metadata during a page rewrite.** Rewriting the feed page's
   `page.tsx` accidentally dropped the `metadata` export that
   `discussions.service.test.ts`'s "has no public index or direct-message entry point" assertion
   checks for. Caught by running the test suite after the rewrite, not proactively. Fixed by
   restoring the export.
7. **`askQuestionAction` redirected to a URL shape that no page ever served**
   (`/discussions/questions/${id}`) — fixed to redirect to `/discussions/${slug}`, matching the
   detail route that was actually built.
8. **`StarRatingInput` design flaw**: an early fix attempt for "the rating dialog needs to observe
   the live star value" added a disconnected, non-functional hidden `<input type="range">` — dead
   code that did nothing. Caught before shipping; replaced with a proper controlled
   `value`/`onChange` component.
9. **`DiscussionMarkdown` assumed server-only, actually isomorphic.** Every prior use was from a
   server component; the ask-flow's live "Preview" tab needed it inside a client component
   (`AskQuestionForm`) instead. Rather than assume this would work, it was verified against the
   real compiled output (no bundling/hydration errors, real KaTeX-capable preview rendering
   client-side) before relying on it — it has no `"use client"` directive and needed none, since
   `react-markdown` and its plugins are themselves browser-safe.
10. **Blank activity titles and dead links in parent child-activity view.** `getChildActivitySummary`
    built its `questionById` lookup map only from questions the child _asked_, then used the same
    map to resolve titles/slugs for questions the child _answered_ (peer answers on classmates'
    questions). Any answer on a question the child didn't ask resolved to an empty title and a
    link to `/discussions/` (empty slug). Invisible in code review — only surfaced by rendering the
    real page against a seeded parent account with a child who both asks and peer-answers. Fixed by
    resolving the missing questions via `database.getQuestion(id)` and merging them into the map;
    re-verified all activity entries render real titles and resolve to real, viewer-accessible
    question pages (200, not 404).
11. **`group_shared` visibility reachable with a non-group scope in the ask-question form.** The
    scope picker and visibility radios were independently stateful; a student with a 1:1 course
    could select "Shared with your group" and submit, hitting `createQuestionSchema`'s server-side
    rejection as a raw, untranslated Zod string — and since the form clears its localStorage draft
    optimistically on submit, a rejected submission's draft was gone (recoverable from in-memory
    state until reload, not after). Caught in a final advisor-directed review, not by the earlier
    live check, because the one seeded student account happens to have only a group-course
    enrollment — the invalid combination was never reachable through that specific account. Fixed
    by disabling the `group_shared` radio whenever the selected scope isn't a group (HTML disables
    a checked-but-disabled radio from ever being submitted, closing the gap even in a worst-case
    stale-state scenario) and auto-correcting `visibility` back to `private_support` when the scope
    changes away from a group, including inside the draft-restoration path.
12. **`listAskScopeOptionsForStudent` deduplicated `subjects` but not `courses`.** Two active
    enrollments in the same course would have produced a duplicate `<option>` (and duplicate React
    key) in the scope picker. Fixed with the same `Map`-keyed dedup already used for subjects.

## 4. Permission matrix

Source of truth: `packages/domain/discussions/capabilities.ts`. Every server action, query, and UI
gate calls into these functions — there is no client-only or duplicated check. "Staff" means
`administrator` or `super_administrator`.

| Capability                             | Student (own)                            | Student (other)       | Tutor (assigned/in-scope)                       | Parent (linked)                      | Staff                           |
| -------------------------------------- | ---------------------------------------- | --------------------- | ----------------------------------------------- | ------------------------------------ | ------------------------------- |
| Ask a question                         | ✅ (needs `studentProfileId`)            | —                     | ❌                                              | ❌                                   | ❌                              |
| Read a question                        | per visibility tier (see below)          | per visibility tier   | per visibility tier                             | per visibility tier (own child only) | ✅ always                       |
| Edit / delete own question             | ✅ (delete only if no contributions yet) | ❌                    | ❌                                              | ❌                                   | ✅ (edit/delete any)            |
| Close / reopen / lock                  | ❌                                       | ❌                    | close/reopen ✅, lock ❌                        | ❌                                   | ✅ all                          |
| Merge duplicates                       | ❌                                       | ❌                    | ✅                                              | ❌                                   | ✅                              |
| Answer a question                      | ✅ if approved answerer for that group   | ❌                    | ✅                                              | ❌ (never)                           | ✅                              |
| Accept an answer                       | ✅ (question author only)                | ❌                    | ❌                                              | ❌                                   | ❌ (by design — student's call) |
| Verify / request revision on an answer | ❌                                       | ❌                    | ✅ (in-scope)                                   | ❌                                   | ✅                              |
| Rate a student answer                  | ❌ (never — anti-gamification)           | ❌                    | ✅ (not own answer, not another tutor's answer) | ❌                                   | ✅                              |
| Comment                                | ✅ if has read access                    | ✅ if has read access | ✅ if has read access                           | ✅ if has read access                | ✅ (+ locked questions)         |
| Propose a correction                   | ✅ (not own answer)                      | ✅ (not own answer)   | ✅ (not own answer)                             | ❌                                   | ✅                              |
| Respond to a correction                | ✅ (own answer)                          | ❌                    | ❌                                              | ❌                                   | ✅ (any)                        |
| Report content                         | ✅                                       | ✅                    | ✅                                              | ✅                                   | ✅                              |
| Moderate (comments/content/ratings)    | ❌                                       | ❌                    | ❌                                              | ❌                                   | ✅                              |
| Read child activity                    | ❌                                       | ❌                    | ❌                                              | ✅ (own linked child only)           | ✅                              |
| Read analytics / manage settings       | ❌                                       | ❌                    | ❌                                              | ❌                                   | ✅                              |

**Question visibility tiers** (`canAccessQuestion` in `capabilities.ts`):

| Tier              | Who can read                                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| `community`       | Question's own student, linked parent, any tutor, any student                                                  |
| `tutors_only`     | Question's own student, linked parent, any tutor (not the wider student community)                             |
| `private_support` | Question's own student, linked parent, only the student's _assigned_ tutor                                     |
| `group_shared`    | Question's own student, linked parent, students in the same group course, tutors assigned to that group course |

All four tiers are unauthenticated-proof: every discussions page sets `robots: { index: false,
follow: false, nocache: true }`, and there is no public/anonymous entry point.

## 5. Error taxonomy

`DiscussionError` (`errors.ts`) carries a stable code and an HTTP status, so callers never inspect
message strings: `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `QUESTION_NOT_FOUND` /
`ANSWER_NOT_FOUND` / `COMMENT_NOT_FOUND` / `CORRECTION_NOT_FOUND` / `RATING_NOT_FOUND` /
`REPORT_NOT_FOUND` / `ATTACHMENT_NOT_FOUND` (404), `QUESTION_CLOSED` / `QUESTION_LOCKED` /
`CANNOT_ACCEPT_NOT_AUTHOR` / `CANNOT_RATE_OWN_ANSWER` / `CANNOT_VOTE_OWN_ANSWER` /
`ANSWER_NOT_RATEABLE` / `ANSWER_NOT_VERIFIABLE` / `DUPLICATE_RATING` /
`COMMENT_THREAD_TOO_DEEP` / `UPLOAD_NOT_ALLOWED` / `UPLOAD_TOO_LARGE` /
`UPLOAD_SIGNATURE_INVALID` / `FILE_NOT_READY` / `DISPLAY_IDENTITY_UNAVAILABLE` /
`INVALID_INPUT` (422/409-class, mapped per call site), `RATE_LIMITED` / `VOTE_LIMIT_REACHED` (429).

## 6. Known limitations

These are conscious, named tradeoffs — not oversights — but every one is a real gap a reader
should know about before relying on this module:

- **`isApprovedStudentAnswerer` is relaxed to "any active student profile."** The module's
  original design intent (per its README) was a stricter approved-answerer allowlist. This session
  relaxed it so peer-answering works with the current data model; it should be revisited before
  any wider rollout.
- **Pagination is offset-based behind a cursor-shaped API.** `feed.ts`'s cursor parameter is
  currently an offset encoded as a string, not an opaque keyset cursor. Works correctly for the
  UI's needs today; will not scale cleanly to a fast-moving high-volume feed (offset drift under
  concurrent inserts).
- **N+1 query pattern in `loadQuestionDetail`.** `buildQuestionDetail` issues roughly 5 queries per
  answer (ratings, comments, corrections, helpful count, author identity) rather than batching.
  Documented inline at the call site. Fine at seed-data scale; worth batching before production
  question threads with dozens of answers.
- **`revalidatePath` calls in `actions.ts` still target `/discussions/questions/${id}`**, a route
  that was never built (the real detail route is `/discussions/${slug}`). Currently harmless only
  because every discussions page is `export const dynamic = "force-dynamic"`, so the stale
  revalidation target never gets a chance to matter — but it's dead/wrong code that should be
  corrected to the slug-based path.
- **Helpful-vote button doesn't pre-disable when the viewer has already voted.** The server
  rejects a duplicate vote (`VOTE_LIMIT_REACHED`/similar), but the button doesn't reflect that
  state before the click — a reactive guard, not a proactive one.
- **`canCreateAnswer` is async and not precomputed for the answer form.** The detail page shows the
  answer form optimistically based on question status alone; the full eligibility check
  (including `isApprovedStudentAnswerer`) runs server-side on submit, so an ineligible student sees
  the form and only learns they can't answer after submitting.
- **Rating dialog backdrop doesn't dim.** `@app/ui`'s `Dialog` is built on Tailwind utility classes,
  and Tailwind's content scanner does not reach into `packages/ui/src` from `apps/web`'s build —
  confirmed by fetching real compiled CSS output from the dev server and finding no
  `.fixed{position:fixed}` rule. `rating-dialog.module.css` supplies a full positioning/style
  override for the dialog's own content, but the shared overlay/backdrop element itself still
  renders unstyled. Functionally correct (focus trap, Escape-to-close, outside-click via Radix all
  work); visually incomplete.
- **One safety-guard test assertion in `discussions.service.test.ts` is relaxed** relative to what
  a fully strict version would check — flagged inline in that file; not a silent gap.
- **Write-action verification is typecheck + service-level execution + code review, not simulated
  UI interaction** — see §2. No browser automation tool is available in this environment.
- **SLA/response-time metric is computed but not rendered anywhere yet.**
- **Moderation queue has no pagination.** `loadModerationQueue` returns the full filtered result set
  in one page load; fine at seed-data scale (1 report), untested at volume.
- **Ask-question form omits three optional, nullable schema fields**: `topicId` (no backing
  lookup UI exists to pick one — and the field has no persisted column to populate even if it did),
  `gradeLevel`, `relatedClassId`. All three default to `null` server-side; nothing is silently
  dropped that the schema requires.
- **The ask form clears its saved draft on submit rather than on confirmed success** —
  `askQuestionAction` redirects on success, so no success state ever reaches the client to clear
  against. A server-rejected submission (e.g. `titleSchema`'s `VAGUE_TITLES` check, which is not
  mirrored client-side — a title like "Can someone help?" clears the 12-character `minLength` but
  is still rejected server-side) leaves the typed content in React state but no longer in
  localStorage, so a reload at that moment loses it.
- **`errorState()` (in `actions.ts`) only surfaces Zod's `fieldErrors`, never `formErrors`.**
  `discussionScopeSchema`'s top-level "choose a course, group, or subject" check has no field path,
  so a validation failure there would fall back to the generic "check the form" message instead of
  a specific one. The ask-flow UI makes this practically unreachable (the scope `<select>` always
  defaults to a real value when any enrollment exists, and the page blocks submission entirely with
  an explanatory empty state when a student has none) — but the gap in the shared helper itself
  is unfixed, and would affect any future form built on the same scope schema.

## 7. Deferred / not built

- Content removal/restoration UI (`removeContentAction`/`restoreContentAction` exist and are
  wired into `actions.ts`, but the moderation queue only surfaces the report workflow — assign and
  resolve — not direct content takedown from that screen). A deliberate scope cut, not an oversight.
- Fixture cleanup — `apps/web/components/discussions/discussions-overview.tsx` (old fixture UI,
  still referenced by `student-workspace/student-pages.tsx`) has not been removed or replaced.
  Leave it and its `overview.*` i18n keys in place until the page that imports it is actually
  swapped for the real feed — deleting one without the other breaks the import.
- Attachment upload API routes and the worker scan-callback job (storage/signing plumbing exists
  in `s3-storage.ts`/`signed-url.ts`; no route consumes it yet).
- Answer-verification UI, correction propose/respond UI, content-report UI, duplicate-merge UI,
  revision-diff UI, badges, analytics dashboard, E2E tests.

## 8. Validation baseline

Baseline recorded early in this module's development, re-confirmed against the finished state
above (2026-08-07). Pre-existing failures below are **not** introduced by this work and were not
"fixed" as part of it — only checked for regression:

- `format:check` — pre-existing failure, unrelated files elsewhere in the repo (confirmed by
  scoping `prettier --check` to just this module: several files predating this session's UI work
  were not clean; all discussions-module files — domain, components, routes, tests, this doc — are
  now `prettier --write`-clean as of this pass).
- `lint` (`pnpm lint`, full repo) — **584 errors, 667 warnings — matches baseline exactly.** A mid-
  session check briefly caught 587 (3 regressions: a `no-non-null-assertion` in `[slug]/page.tsx`
  fixed with a typed empty-breakdown fallback instead of `!`; two `react-hooks/set-state-in-effect`
  errors in `rating-dialog.tsx` and `ask-question-form.tsx`, both fixed by replacing the
  `useEffect`-based state sync with React's documented render-time "adjust state" pattern — see
  `rating-dialog.tsx` — and, for the ask-flow's localStorage draft read specifically,
  `useSyncExternalStore` — see `ask-question-form.tsx` — since that read crosses the SSR/CSR
  boundary and needed to stay hydration-safe, not just lint-clean). No `eslint-disable` was used
  anywhere to reach this number, including removing one that had crept into an early draft of
  `ask-question-form.tsx`.
- `typecheck` (`pnpm typecheck`, full repo, all 14 packages) — clean.
- `test` (`pnpm test`, full repo) — **9 failed / 597 passed across 97 files — matches baseline
  exactly** (the pass count is 11 higher than the original 586 baseline because of the new
  discussions authorization/ordering tests added in this pass — see §1 — not because a
  previously-failing test started passing). The 3 failing files — `tests/admin/deletions.service.test.ts`
  (4 failures), `tests/admin/exports.service.test.ts` (3 failures), `tests/marketing/lead.route.test.ts`
  (2 failures) — are unrelated to discussions (admin two-person-approval workflows for mass
  deletion and bulk export, and marketing lead rate-limiting). The two admin files fail on the same
  apparent root cause (`STEP_UP_REQUIRED` where a specific error code was expected), consistent
  with a shared fixture/step-up-auth issue predating this module. Discussions suite itself: 16/16
  passing.
- `build` (`pnpm build`, full repo) — fails only at `/whatsapp/[studentId]` on missing env vars
  (`RESEND_API_KEY`, `SENTRY_DSN`, `ZOOM_*`, etc.) — unrelated, pre-existing. Every other package,
  including `web`'s own compile + TypeScript + page-data-collection steps for all new discussions
  routes, succeeded.
