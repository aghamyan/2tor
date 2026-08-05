# WhatsApp domain

Phase 1 of the WhatsApp notification system (see the approved plan for the full design). Owns the
per-student WhatsApp group's configuration (`whatsapp_groups`), its membership roster
(`whatsapp_group_members`), and per-lesson outbound-notification bookkeeping
(`whatsapp_lesson_notifications`).

## Real groups, not a simulated fan-out

This integrates against Meta's WhatsApp Business Platform **Groups API** (2026) — an actual
shared group chat per student, not individual 1:1 messages dressed up as a "group." That API:

- Requires an **Official Business Account (OBA)**, a stricter verification tier than ordinary
  WhatsApp Business verification.
- Does **not** support silently adding a known phone number to a group. A business creates the
  group and gets back an invite link; each person joins by tapping it themselves. There is no way
  to guarantee membership without that voluntary step.
- Caps a group at 8 participants, comfortably above this feature's admin+tutor(s)+parent(s)+child.
- Is new enough that this module's endpoint assumptions (`packages/whatsapp/src/provider.ts`) are
  transcribed from documentation, not verified against a live OBA-approved number. Re-check
  against Meta's current docs/sandbox before the first real send.

"2tor admin" presence in the group is satisfied by the business's own WhatsApp number, which owns
every group it creates — no separate staff phone number is invited in this phase.

## `whatsappGroups.status` vs. member join state

`status` (`"not_provisioned" | "active" | "disabled"`) reflects only whether the group itself has
been created with Meta. It does **not** mean anyone has joined — `whatsapp_group_members.status`
tracks that per person, and nothing in this phase ever sets a member to `"joined"` (that needs the
phase-2 inbound `group_participants_update` webhook, which doesn't exist yet). A group is `active`
and receiving sweep-job messages from the moment `createGroup` succeeds, with zero confirmed
joins — Meta accepts messages into a group before every invitee has tapped their invite link; they
simply won't see history predating their join.

## "Class ended" fires on a timer, not on feedback publish

The original ask ("class ended successfully, click here for feedback/summary") reads as one
event, but `lessons.status` only reaches `"completed"` via a manual tutor/staff action, and
`lesson_feedback` may never get published at all (`apps/worker/src/jobs/academics/missed-feedback-reminder.job.ts`
exists precisely because that happens). Gating the message on feedback publish would mean total
silence whenever a tutor is late — the opposite of "the class has ended successfully." Instead,
`findLessonsNeedingClassEndedNotice` (`reminders.ts`) fires once `scheduledEndAt` passes,
unconditionally, with copy pointing at the lesson's detail/feedback page (which is responsible for
its own "feedback not published yet" display state — that's not this module's concern).

## Module-boundary imports

`packages/domain/package.json` does not declare `@app/whatsapp` (or `@app/auth`, or
`@app/notifications`) — under this workspace's strict pnpm linking, a bare
`import ... from "@app/whatsapp"` placed inside `packages/domain/**` cannot be resolved by Vitest
or plain Node (confirmed for the identical `@app/auth`/`@app/notifications` cases in
`packages/domain/consent/README.md` and `apps/worker/README.md`). So:

- `models.ts`'s `WhatsAppSender` is a structurally-compatible interface declared locally, not
  imported from `@app/whatsapp`. `services.ts` takes it as a parameter; it never imports the real
  package.
- `runtime.ts` **does** import `@app/auth` directly (`getSession`, `Actor`) — same precedent as
  `consent/runtime.ts` and `scheduling/runtime.ts`. This file is a thin composition seam consumed
  only by `apps/web` (whose real Next.js build resolves it fine via Turbopack's whole-graph
  `tsconfig.base.json` path aliases) and is not exercised directly by Vitest. Tests exercise
  `services.ts` with in-memory fakes instead — see "Testing" below.
- `apps/worker`'s job directory and `apps/web`'s `runtime.ts`/action files both declare
  `@app/whatsapp` as a real dependency and build the small adapter satisfying `WhatsAppSender`
  around `@app/whatsapp`'s `createWhatsAppProvider`.

## Known gaps (deliberately out of scope for this phase)

- **No member removal.** A tutor whose assignment ends stays a WhatsApp group member;
  `syncGroupMembership` only ever adds, never removes. Phase 2 should call `@app/whatsapp`'s
  `removeParticipant` from wherever a tutor assignment is ended.
- **No join-status tracking.** `whatsapp_group_members.status` never leaves `"invited"` — needs
  the phase-2 inbound webhook for `group_participants_update`.
- **No inbound message handling / homework-discussion relay.** Also phase 2.
- **Group text messages are sent as plain text, not templates** (`sendGroupTextMessage` in
  `packages/whatsapp`). Meta's own group-messaging example uses `type: "text"`, not a template —
  but whether business-initiated/template rules apply identically inside a group the business
  itself created isn't fully certain from documentation alone. Re-verify before relying on it.

## Testing

Like `consent`, this module's tests live in `apps/web/tests/whatsapp`, not
`packages/domain/whatsapp`, per CONVENTIONS.md's `apps/web/tests/<module>` rule — and because
Vitest can't resolve `packages/domain/**`'s bare `@app/*` imports the way a real Next.js build
can (see above). `services.ts` is exercised with in-memory fakes for `WhatsAppDatabase`,
`FamilyDatabase`, `ConsentDatabase`, and `WhatsAppSender`.
