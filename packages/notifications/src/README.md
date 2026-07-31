# Notifications

Domain modules call `notify({ userId, type, channelPolicy, data })`; they never send email, push, or inbox messages directly. Configure the composition root once with `configureNotifications(createNotificationDispatcher(repository, createWorkerNotificationQueue(queue)))`. The repository resolves the recipient and their `notification_preferences`; the queue fans approved deliveries out to `notifications.send-email`, `notifications.send-push`, and `notifications.create-inbox` worker jobs.

Templates are versioned (`v1` today), bilingual (`en`/`hy`), and validate required variables before a job is enqueued. Use `sendTestEmail` with a provider to test a rendered delivery. Subjects are static, generic account/payment/schedule notices; lesson or other sensitive academic details belong only in protected bodies/in-app views.

Mandatory, not configurable: `verification`, `consent_status`, `security_change`, `lesson_scheduled`, `lesson_canceled`, `payment_receipt`, `payment_failure`, `payment_refund`, `privacy_request`, and `safety_notice`. Optional: `lesson_reminder`, `progress_update`, and `promotional`. Preferences are honored for optional types. Child accounts receive age-appropriate critical safety, schedule, and account notices even if disabled; promotional messages are never sent directly to a child account, so a parent controls them through their own preferences.

There is no SMS channel in the MVP. In-app records are retained for 365 days unless attached to an enduring record; use `inboxExpiresAt`/`isInboxNotificationExpired` in the retention sweep.
