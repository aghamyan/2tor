import { expect, expectJson, test } from "./fixtures/actors";
import { databaseRows, pgLiteral } from "./helpers/database";

interface Envelope<T> {
  data: T;
  requestId: string;
}

test("private adult-child channels are rejected and staff reads require an audited reason", async ({
  actors,
}) => {
  const unsafeResponse = await actors.tutor.post("/api/communication/conversations", {
    data: {
      type: "support",
      title: "Unsafe private channel attempt",
      members: [
        { userId: "usr_demo_tutor", role: "tutor" },
        { userId: "usr_demo_student", role: "student" },
      ],
    },
  });
  const unsafe = await expectJson<{ error: { code: string } }>(unsafeResponse, 409);
  expect(unsafe.error.code).toBe("PARENT_REQUIRED");

  const safeResponse = await actors.parent.post("/api/communication/conversations", {
    data: {
      type: "parent_tutor",
      title: "Parent-visible mathematics check-in",
      members: [
        { userId: "usr_demo_parent", role: "parent" },
        { userId: "usr_demo_student", role: "student" },
        { userId: "usr_demo_tutor", role: "tutor" },
      ],
    },
  });
  const safe = await expectJson<
    Envelope<{ id: string; isMonitored: boolean; members: Array<{ role: string }> }>
  >(safeResponse, 201);
  expect(safe.data.isMonitored).toBe(true);
  expect(safe.data.members.map(({ role }) => role).sort()).toEqual(["parent", "student", "tutor"]);

  const messageResponse = await actors.tutor.post(
    `/api/communication/conversations/${safe.data.id}/messages`,
    { data: { body: "Nare was engaged today; the practice set is visible to the parent." } },
  );
  const message = await expectJson<Envelope<{ id: string; body: string }>>(messageResponse, 201);

  const noReasonResponse = await actors.admin.get(
    `/api/communication/conversations/${safe.data.id}`,
  );
  const noReason = await expectJson<{ error: { code: string } }>(noReasonResponse, 403);
  expect(noReason.error.code).toBe("STAFF_REASON_REQUIRED");

  const reason = "Safeguarding spot-check requested by the incident response lead.";
  const reasonResponse = await actors.admin.get(
    `/api/communication/conversations/${safe.data.id}`,
    { params: { staffReason: reason } },
  );
  const detail = await expectJson<Envelope<{ messages: Array<{ id: string }> }>>(
    reasonResponse,
    200,
  );
  expect(detail.data.messages.map(({ id }) => id)).toContain(message.data.id);

  const accessRows = databaseRows<{ reason: string }>(
    `SELECT reason FROM admin_access_reasons ` +
      `WHERE admin_user_id = 'usr_demo_admin' AND target_entity_id = ${pgLiteral(safe.data.id)}`,
  );
  expect(accessRows).toEqual([{ reason }]);
  const auditRows = databaseRows<{ reason: string }>(
    `SELECT reason FROM audit_events ` +
      `WHERE actor_user_id = 'usr_demo_admin' ` +
      `AND action = 'communication.message.access_as_staff' ` +
      `AND resource_id = ${pgLiteral(safe.data.id)}`,
  );
  expect(auditRows).toEqual([{ reason }]);
});
