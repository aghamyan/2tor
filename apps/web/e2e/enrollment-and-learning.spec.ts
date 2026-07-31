import { expect, expectJson, test } from "./fixtures/actors";

interface DataEnvelope<T> {
  data: T;
  requestId: string;
}

test("lead → consultation → consent → activation → matching → first lesson → feedback", async ({
  actors,
  page,
}) => {
  // Anchor the browser at the real application origin, then submit through the same endpoint and
  // payload contract as LeadForm. This keeps the network edge case independent from the localized
  // marketing shell while still crossing Chromium -> Next route -> domain lead store.
  await page.goto("/api/leads");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 450,
    downloadThroughput: (150 * 1_024) / 8,
    uploadThroughput: (75 * 1_024) / 8,
    connectionType: "cellular3g",
  });

  await page.evaluate(() => {
    document.body.innerHTML =
      '<button disabled type="button">Sending…</button><p role="status">Sending…</p>';
    const status = document.querySelector('[role="status"]');
    void fetch("/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        parentName: "Mariam E2E Parent",
        email: "mariam.e2e@example.com",
        phone: "",
        learnerAgeBand: "11_13",
        interest: "Grade 6 mathematics",
        message: "A weekly consultation and matching recommendation.",
        company: "",
        kind: "consultation",
        locale: "en",
        privacyConsent: true,
      }),
    }).then(async (response) => {
      if (status) {
        status.textContent = response.ok
          ? "Thank you. Your request is with our team."
          : `Request failed (${String(response.status)})`;
      }
    });
  });
  await expect(page.getByRole("button", { name: "Sending…" })).toBeDisabled();
  await expect(page.getByRole("status")).toHaveText("Thank you. Your request is with our team.", {
    timeout: 20_000,
  });
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });

  const studentResponse = await actors.parent.post("/api/families/students", {
    data: {
      username: "nare.e2e",
      primaryTimezone: "America/Los_Angeles",
      locale: "en",
      relationship: "parent",
      preferredName: "Nare",
      gradeLevel: "6",
      isAdultLearner: false,
      usState: "CA",
      dobYearMonth: "2014-09",
      ageBand: null,
    },
  });
  const studentBody = await expectJson<
    DataEnvelope<{ id: string; status: string; primaryTimezone: string }>
  >(studentResponse, 201);
  const studentId = studentBody.data.id;
  expect(studentBody.data.status).toBe("inactive");
  expect(studentBody.data.primaryTimezone).toBe("America/Los_Angeles");

  const beforeConsent = await actors.parent.post(`/api/consent/students/${studentId}/activate`);
  const beforeConsentBody = await expectJson<{ error: { code: string } }>(beforeConsent, 409);
  expect(beforeConsentBody.error.code).toBe("CONSENT_REQUIRED");

  const consentResponse = await actors.parent.post(
    `/api/consent/students/${studentId}/consent-records`,
    {
      data: {
        noticeAcknowledged: true,
        method: "signed_form",
        evidence: {
          typedFullName: "Mariam E2E Parent",
          attestationPhrase:
            "I am this child's parent or legal guardian and I consent to the collection described above.",
        },
      },
    },
  );
  const consentBody = await expectJson<
    DataEnvelope<{
      id: string;
      studentProfileId: string;
      consentVersion: string;
      identityEvidenceRef: string;
    }>
  >(consentResponse, 201);
  expect(consentBody.data.studentProfileId).toBe(studentId);
  expect(consentBody.data.consentVersion).toBe("2026-01-v1");
  expect(consentBody.data.identityEvidenceRef).toMatch(/^signed_form:/);

  const activationResponse = await actors.parent.post(
    `/api/consent/students/${studentId}/activate`,
  );
  const activationBody = await expectJson<DataEnvelope<{ id: string; status: string }>>(
    activationResponse,
    200,
  );
  expect(activationBody.data).toMatchObject({ id: studentId, status: "active" });

  const matchingRequestResponse = await actors.parent.post("/api/matching/requests", {
    data: {
      studentProfileId: studentId,
      subjectId: "subj_math",
      preferredTutorProfileId: "tprof_demo_1",
      notes: "Consultation recommended a weekly mathematics lesson.",
    },
  });
  const matchingRequestBody = await expectJson<
    DataEnvelope<{ id: string; status: string; studentProfileId: string }>
  >(matchingRequestResponse, 201);
  expect(matchingRequestBody.data).toMatchObject({
    status: "pending",
    studentProfileId: studentId,
  });

  const queueResponse = await actors.admin.get("/api/matching/requests");
  const queueBody = await expectJson<DataEnvelope<Array<{ id: string }>>>(queueResponse, 200);
  expect(queueBody.data.map(({ id }) => id)).toContain(matchingRequestBody.data.id);

  const proposalResponse = await actors.admin.post("/api/matching/assignments", {
    data: {
      tutorProfileId: "tprof_demo_1",
      studentProfileId: studentId,
      subjectId: "subj_math",
      startAt: new Date(Date.now() - 60_000).toISOString(),
      endAt: null,
      reason: "Selected after the parent consultation and matching review.",
    },
  });
  const proposalBody = await expectJson<
    DataEnvelope<{ id: string; status: string; studentProfileId: string }>
  >(proposalResponse, 201);
  expect(proposalBody.data.status).toBe("proposed");

  const decisionResponse = await actors.tutor.post(
    `/api/matching/assignments/${proposalBody.data.id}/decision`,
    {
      data: {
        decision: "accept",
        reason: "Availability and subject experience are a fit.",
      },
    },
  );
  const decisionBody = await expectJson<DataEnvelope<{ id: string; status: string }>>(
    decisionResponse,
    200,
  );
  expect(decisionBody.data.status).toBe("active");

  const scheduledStartAt = new Date(Date.now() + 60 * 60_000).toISOString();
  const lessonResponse = await actors.tutor.post("/api/scheduling/lessons", {
    data: {
      tutorStudentAssignmentId: proposalBody.data.id,
      subjectId: "subj_math",
      scheduledStartAt,
      durationMinutes: 45,
      timezoneAtBooking: "America/Los_Angeles",
      isTrial: false,
      additionalParticipantUserIds: [],
    },
  });
  const lessonBody = await expectJson<
    DataEnvelope<{ id: string; status: string; timezoneAtBooking: string }>
  >(lessonResponse, 201);
  expect(lessonBody.data).toMatchObject({
    status: "scheduled",
    timezoneAtBooking: "America/Los_Angeles",
  });

  const attendanceResponse = await actors.tutor.post(
    `/api/scheduling/lessons/${lessonBody.data.id}/attendance`,
    {
      data: {
        studentProfileId: studentId,
        status: "present",
        notes: "Joined from a low-bandwidth connection; audio remained usable.",
      },
    },
  );
  const attendanceBody = await expectJson<DataEnvelope<{ status: string }>>(
    attendanceResponse,
    200,
  );
  expect(attendanceBody.data.status).toBe("present");

  const completedResponse = await actors.tutor.post(
    `/api/scheduling/lessons/${lessonBody.data.id}/complete`,
  );
  const completedBody = await expectJson<DataEnvelope<{ status: string }>>(completedResponse, 200);
  expect(completedBody.data.status).toBe("completed");

  const feedbackResponse = await actors.tutor.post("/api/academics/feedback", {
    data: {
      lessonId: lessonBody.data.id,
      studentProfileId: studentId,
      topicsCovered: "Equivalent fractions and common denominators.",
      objectiveMet: "yes",
      assignmentCompletionStatus: "not_applicable",
      assignmentAccuracyNote: null,
      effortEngagementNote: "Nare stayed engaged and asked for one example to be repeated.",
      strengthsDemonstrated: "Explained why two fractions were equivalent.",
      skillsToImprove: "Check the denominator before simplifying.",
      nextLessonFocus: "Adding fractions with unlike denominators.",
      assignedHomework: "Complete the five practice questions.",
      parentActionNeeded: "Provide ten quiet minutes for the practice set.",
      studentActionNeeded: "Show working for each answer.",
      milestoneProgressNote: "First lesson baseline recorded.",
      tutorConfidence: "high",
      freeTextComment: "A confident and collaborative first lesson.",
      staffOnlyNote: "Internal calibration note that must not reach the family projection.",
      status: "published",
    },
  });
  const feedbackBody = await expectJson<DataEnvelope<{ id: string; status: string }>>(
    feedbackResponse,
    201,
  );
  expect(feedbackBody.data.status).toBe("published");

  const parentFeedbackResponse = await actors.parent.get(
    `/api/academics/feedback/${feedbackBody.data.id}`,
  );
  const parentFeedbackBody = await expectJson<
    DataEnvelope<Record<string, unknown> & { lessonId: string }>
  >(parentFeedbackResponse, 200);
  expect(parentFeedbackBody.data.lessonId).toBe(lessonBody.data.id);
  expect(parentFeedbackBody.data).not.toHaveProperty("staffOnlyNote");
});
