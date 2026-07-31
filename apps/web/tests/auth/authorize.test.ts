import { describe, expect, it } from "vitest";

import { authorize, type Action, type Actor, type Resource } from "@app/auth";

function actor(overrides: Partial<Actor> = {}): Actor {
  return { userId: "actor_1", roles: [], mfaVerifiedAt: null, ...overrides };
}

describe("deny by default", () => {
  it("denies an action string the engine doesn't recognize", () => {
    const result = authorize(
      actor({ roles: ["super_administrator"], mfaVerifiedAt: new Date() }),
      "totally_unknown_action" as Action,
      {
        kind: "financial_record",
      },
    );
    expect(result.allowed).toBe(false);
  });

  it("denies when the resource kind doesn't match what the action expects", () => {
    const result = authorize(actor({ roles: ["administrator"] }), "finance.view_transactions", {
      kind: "audit_event",
    } as Resource);
    expect(result).toEqual({ allowed: false, reason: "resource_kind_mismatch" });
  });

  it("denies an actor with no roles at all", () => {
    const result = authorize(actor(), "finance.view_transactions", { kind: "financial_record" });
    expect(result.allowed).toBe(false);
  });
});

describe("tutor <-> student relationship (spec §12.2: tutor may access a student only while assigned)", () => {
  it("denies a tutor with no assignment row at all", () => {
    const result = authorize(actor({ roles: ["tutor"] }), "student.view_profile", {
      kind: "student",
      studentProfileId: "student_1",
      tutorAssignment: null,
    });
    expect(result).toEqual({ allowed: false, reason: "no_relationship" });
  });

  it("denies a tutor whose assignment status is 'ended'", () => {
    const result = authorize(actor({ roles: ["tutor"] }), "student.view_profile", {
      kind: "student",
      studentProfileId: "student_1",
      tutorAssignment: { status: "ended", endAt: new Date("2025-01-01") },
    });
    expect(result).toEqual({ allowed: false, reason: "no_relationship" });
  });

  it("denies a tutor whose assignment is 'active' but endAt has already passed", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    const result = authorize(
      actor({ roles: ["tutor"] }),
      "student.view_profile",
      {
        kind: "student",
        studentProfileId: "student_1",
        tutorAssignment: { status: "active", endAt: new Date("2026-05-01T00:00:00Z") },
      },
      now,
    );
    expect(result).toEqual({ allowed: false, reason: "no_relationship" });
  });

  it("denies a tutor whose assignment is only 'proposed'", () => {
    const result = authorize(actor({ roles: ["tutor"] }), "student.view_profile", {
      kind: "student",
      studentProfileId: "student_1",
      tutorAssignment: { status: "proposed", endAt: null },
    });
    expect(result.allowed).toBe(false);
  });

  it("allows a tutor whose assignment is active with no end date", () => {
    const result = authorize(actor({ roles: ["tutor"] }), "student.view_profile", {
      kind: "student",
      studentProfileId: "student_1",
      tutorAssignment: { status: "active", endAt: null },
    });
    expect(result).toEqual({ allowed: true });
  });

  it("allows a tutor whose assignment is active with a future end date", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    const result = authorize(
      actor({ roles: ["tutor"] }),
      "academic.edit_learning_plan",
      {
        kind: "student",
        studentProfileId: "student_1",
        tutorAssignment: { status: "active", endAt: new Date("2026-07-01T00:00:00Z") },
      },
      now,
    );
    expect(result).toEqual({ allowed: true });
  });

  it("denies a tutor from editing a learning plan for an unassigned student", () => {
    const result = authorize(actor({ roles: ["tutor"] }), "academic.edit_learning_plan", {
      kind: "student",
      studentProfileId: "student_1",
      tutorAssignment: null,
    });
    expect(result.allowed).toBe(false);
  });
});

describe("parent <-> student relationship", () => {
  it("denies a parent who is not linked to the student", () => {
    const result = authorize(actor({ roles: ["parent"] }), "student.view_profile", {
      kind: "student",
      studentProfileId: "student_1",
      parentLinked: false,
    });
    expect(result).toEqual({ allowed: false, reason: "no_relationship" });
  });

  it("allows a parent linked to the student", () => {
    const result = authorize(actor({ roles: ["parent"] }), "student.view_profile", {
      kind: "student",
      studentProfileId: "student_1",
      parentLinked: true,
    });
    expect(result).toEqual({ allowed: true });
  });

  it("denies a parent from managing a student they aren't linked to", () => {
    const result = authorize(actor({ roles: ["parent"] }), "student.manage_profile", {
      kind: "student",
      studentProfileId: "student_1",
      parentLinked: false,
    });
    expect(result.allowed).toBe(false);
  });
});

describe("finance cannot read academic messages", () => {
  it("denies a pure-finance actor reading an academic message", () => {
    const result = authorize(actor({ roles: ["finance"] }), "message.read", {
      kind: "message",
      isAcademic: true,
      isMember: false,
    });
    expect(result).toEqual({ allowed: false, reason: "finance_cannot_read_academic_messages" });
  });

  it("denies a pure-finance actor even when listed as a conversation member", () => {
    const result = authorize(actor({ roles: ["finance"] }), "message.read", {
      kind: "message",
      isAcademic: true,
      isMember: true,
    });
    expect(result).toEqual({ allowed: false, reason: "finance_cannot_read_academic_messages" });
  });

  it("allows finance to read a non-academic message it's a member of", () => {
    const result = authorize(actor({ roles: ["finance"] }), "message.read", {
      kind: "message",
      isAcademic: false,
      isMember: true,
    });
    expect(result).toEqual({ allowed: true });
  });

  it("allows a finance+parent actor to read an academic message via the parent grant", () => {
    const result = authorize(actor({ roles: ["finance", "parent"] }), "message.read", {
      kind: "message",
      isAcademic: true,
      isMember: true,
    });
    expect(result).toEqual({ allowed: true });
  });
});

describe("no private adult<->child messaging", () => {
  it("denies sending into a private adult-child channel regardless of membership or role", () => {
    const result = authorize(actor({ roles: ["tutor"] }), "message.send", {
      kind: "message",
      isAcademic: false,
      isMember: true,
      isPrivateAdultChildChannel: true,
    });
    expect(result).toEqual({ allowed: false, reason: "no_private_adult_child_messaging" });
  });

  it("denies even an administrator from sending into a private adult-child channel", () => {
    const result = authorize(actor({ roles: ["administrator"] }), "message.send", {
      kind: "message",
      isAcademic: false,
      isMember: true,
      isPrivateAdultChildChannel: true,
    });
    expect(result.allowed).toBe(false);
  });

  it("allows sending into an ordinary parent-inclusive conversation the actor is a member of", () => {
    const result = authorize(actor({ roles: ["tutor"] }), "message.send", {
      kind: "message",
      isAcademic: false,
      isMember: true,
    });
    expect(result).toEqual({ allowed: true });
  });
});

describe("admin message access requires a logged reason", () => {
  it("denies an administrator accessing a message with no reason recorded", () => {
    const result = authorize(actor({ roles: ["administrator"] }), "message.access_as_staff", {
      kind: "message",
      isAcademic: true,
      isMember: false,
      reasonProvided: false,
    });
    expect(result).toEqual({ allowed: false, reason: "reason_required" });
  });

  it("allows an administrator accessing a message once a reason is recorded", () => {
    const result = authorize(actor({ roles: ["administrator"] }), "message.access_as_staff", {
      kind: "message",
      isAcademic: true,
      isMember: false,
      reasonProvided: true,
    });
    expect(result).toEqual({ allowed: true });
  });

  it("denies a non-staff role regardless of whether a reason is provided", () => {
    const result = authorize(actor({ roles: ["tutor"] }), "message.access_as_staff", {
      kind: "message",
      isAcademic: true,
      isMember: false,
      reasonProvided: true,
    });
    expect(result.allowed).toBe(false);
  });
});

describe("super-administrator cannot erase audit trails", () => {
  it("denies audit.erase for super_administrator", () => {
    const result = authorize(
      actor({ roles: ["super_administrator"], mfaVerifiedAt: new Date() }),
      "audit.erase",
      {
        kind: "audit_event",
      },
    );
    expect(result).toEqual({ allowed: false, reason: "audit_trail_is_immutable" });
  });

  it("denies audit.erase for every role, unconditionally", () => {
    for (const role of [
      "parent",
      "student",
      "tutor",
      "finance",
      "administrator",
      "super_administrator",
    ] as const) {
      const result = authorize(actor({ roles: [role], mfaVerifiedAt: new Date() }), "audit.erase", {
        kind: "audit_event",
      });
      expect(result.allowed).toBe(false);
    }
  });
});

describe("students cannot create accounts", () => {
  it("denies a student attempting to create any account", () => {
    const result = authorize(actor({ roles: ["student"] }), "account.create", {
      kind: "user_account",
      targetRole: "student",
    });
    expect(result).toEqual({ allowed: false, reason: "students_cannot_create_accounts" });
  });

  it("denies a student even when combined with another role", () => {
    const result = authorize(actor({ roles: ["student", "tutor"] }), "account.create", {
      kind: "user_account",
      targetRole: "student",
    });
    expect(result.allowed).toBe(false);
  });

  it("allows a parent to create a student account for their own family", () => {
    const result = authorize(actor({ roles: ["parent"] }), "account.create", {
      kind: "user_account",
      targetRole: "student",
    });
    expect(result).toEqual({ allowed: true });
  });

  it("denies a parent from creating a non-student account", () => {
    const result = authorize(actor({ roles: ["parent"] }), "account.create", {
      kind: "user_account",
      targetRole: "tutor",
    });
    expect(result.allowed).toBe(false);
  });

  it("allows an administrator to create any account", () => {
    const result = authorize(actor({ roles: ["administrator"] }), "account.create", {
      kind: "user_account",
      targetRole: "tutor",
    });
    expect(result).toEqual({ allowed: true });
  });
});

describe("self-approval is denied even for an otherwise-authorized role", () => {
  it("denies a super-administrator approving their own role change", () => {
    const result = authorize(
      actor({ userId: "u1", roles: ["super_administrator"], mfaVerifiedAt: new Date() }),
      "admin.manage_roles",
      {
        kind: "admin_action",
        targetUserId: "u1",
      },
    );
    expect(result).toEqual({ allowed: false, reason: "cannot_self_approve" });
  });

  it("allows a super-administrator to approve someone else's role change", () => {
    const result = authorize(
      actor({ userId: "u1", roles: ["super_administrator"], mfaVerifiedAt: new Date() }),
      "admin.manage_roles",
      {
        kind: "admin_action",
        targetUserId: "u2",
      },
    );
    expect(result).toEqual({ allowed: true });
  });

  it("denies an administrator approving their own user approval", () => {
    const result = authorize(
      actor({ userId: "u1", roles: ["administrator"] }),
      "admin.approve_user",
      {
        kind: "admin_action",
        targetUserId: "u1",
      },
    );
    expect(result).toEqual({ allowed: false, reason: "cannot_self_approve" });
  });
});

describe("role gating for admin/finance actions", () => {
  it("denies a plain administrator from managing roles (super-admin only)", () => {
    const result = authorize(
      actor({ roles: ["administrator"], mfaVerifiedAt: new Date() }),
      "admin.manage_roles",
      {
        kind: "admin_action",
        targetUserId: "someone_else",
      },
    );
    expect(result.allowed).toBe(false);
  });

  it("denies a tutor from viewing financial records", () => {
    const result = authorize(actor({ roles: ["tutor"] }), "finance.view_transactions", {
      kind: "financial_record",
    });
    expect(result.allowed).toBe(false);
  });

  it("allows finance to view financial records", () => {
    const result = authorize(actor({ roles: ["finance"] }), "finance.view_transactions", {
      kind: "financial_record",
    });
    expect(result).toEqual({ allowed: true });
  });
});

describe("step-up authentication for high-risk actions", () => {
  it("denies audit.view for an administrator who has not stepped up", () => {
    const result = authorize(
      actor({ roles: ["administrator"], mfaVerifiedAt: null }),
      "audit.view",
      {
        kind: "audit_event",
      },
    );
    expect(result).toEqual({ allowed: false, reason: "step_up_required" });
  });

  it("allows audit.view once stepped up", () => {
    const result = authorize(
      actor({ roles: ["administrator"], mfaVerifiedAt: new Date() }),
      "audit.view",
      {
        kind: "audit_event",
      },
    );
    expect(result).toEqual({ allowed: true });
  });

  it("denies export.bulk without step-up", () => {
    const result = authorize(
      actor({ roles: ["administrator"], mfaVerifiedAt: null }),
      "export.bulk",
      {
        kind: "export_job",
      },
    );
    expect(result.allowed).toBe(false);
  });

  it("denies deletion.execute without step-up", () => {
    const result = authorize(
      actor({ roles: ["administrator"], mfaVerifiedAt: null }),
      "deletion.execute",
      {
        kind: "deletion_job",
      },
    );
    expect(result.allowed).toBe(false);
  });

  it("denies security.configure for a non-super-administrator even with step-up", () => {
    const result = authorize(
      actor({ roles: ["administrator"], mfaVerifiedAt: new Date() }),
      "security.configure",
      {
        kind: "security_setting",
      },
    );
    expect(result.allowed).toBe(false);
  });

  it("allows security.configure for a stepped-up super-administrator", () => {
    const result = authorize(
      actor({ roles: ["super_administrator"], mfaVerifiedAt: new Date() }),
      "security.configure",
      {
        kind: "security_setting",
      },
    );
    expect(result).toEqual({ allowed: true });
  });
});

describe("large refunds require step-up", () => {
  it("denies a large refund without step-up", () => {
    const result = authorize(actor({ roles: ["finance"], mfaVerifiedAt: null }), "finance.refund", {
      kind: "refund",
      amountMinor: 50_000,
    });
    expect(result).toEqual({ allowed: false, reason: "step_up_required" });
  });

  it("allows a large refund once stepped up", () => {
    const result = authorize(
      actor({ roles: ["finance"], mfaVerifiedAt: new Date() }),
      "finance.refund",
      {
        kind: "refund",
        amountMinor: 50_000,
      },
    );
    expect(result).toEqual({ allowed: true });
  });

  it("allows a small refund without step-up", () => {
    const result = authorize(actor({ roles: ["finance"], mfaVerifiedAt: null }), "finance.refund", {
      kind: "refund",
      amountMinor: 1_500,
    });
    expect(result).toEqual({ allowed: true });
  });

  it("denies a refund for a role with no finance/staff access at all", () => {
    const result = authorize(
      actor({ roles: ["tutor"], mfaVerifiedAt: new Date() }),
      "finance.refund",
      {
        kind: "refund",
        amountMinor: 1_000,
      },
    );
    expect(result.allowed).toBe(false);
  });
});

describe("step-up freshness (login MFA does not count forever)", () => {
  // Regression coverage for a real gap: `Actor.mfaVerifiedAt` must not be populated once at login
  // and then treated as permanently satisfying step-up. An admin session created hours ago with
  // MFA verified at login must require a fresh re-challenge before a high-risk action, not silently
  // authorize it off stale state.
  const loginTime = new Date("2026-01-01T00:00:00Z");

  it("allows a step-up action shortly after the login-time MFA verification", () => {
    const now = new Date(loginTime.getTime() + 5 * 60_000); // +5 minutes
    const result = authorize(
      actor({ roles: ["administrator"], mfaVerifiedAt: loginTime }),
      "audit.view",
      { kind: "audit_event" },
      now,
    );
    expect(result).toEqual({ allowed: true });
  });

  it("denies a step-up action once the login-time MFA verification has gone stale", () => {
    const now = new Date(loginTime.getTime() + 20 * 60_000); // +20 minutes, past the freshness window
    const result = authorize(
      actor({ roles: ["administrator"], mfaVerifiedAt: loginTime }),
      "audit.view",
      { kind: "audit_event" },
      now,
    );
    expect(result).toEqual({ allowed: false, reason: "step_up_required" });
  });

  it("allows the same stale-session actor again once mfaVerifiedAt is refreshed by a step-up challenge", () => {
    const staleTime = new Date(loginTime.getTime() + 20 * 60_000);
    const freshVerification = staleTime; // a step-up TOTP challenge succeeded right now
    const result = authorize(
      actor({ roles: ["administrator"], mfaVerifiedAt: freshVerification }),
      "audit.view",
      { kind: "audit_event" },
      staleTime,
    );
    expect(result).toEqual({ allowed: true });
  });
});
