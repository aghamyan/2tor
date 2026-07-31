import { describe, expect, it } from "vitest";
import { ProjectError } from "../../../../packages/domain/projects/errors";
import {
  addPortfolioItem,
  approvePortfolioSharing,
  createProject,
  getDownloadableProjectFile,
  getPublicPortfolioItem,
  recordProjectFileScanResult,
  uploadProjectFile,
} from "../../../../packages/domain/projects/services";
import type { ProjectStorage } from "../../../../packages/domain/projects/storage";
import { InMemoryProjectDatabase } from "./support/in-memory-project-database";

const tutor = { userId: "tutor-assigned", roles: ["tutor"] as const };
const student = {
  userId: "student-user",
  studentProfileId: "student-1",
  roles: ["student"] as const,
};
const parent = { userId: "parent-user", roles: ["parent"] as const };
const storage: ProjectStorage = {
  putPrivate: async () => {},
  getPrivate: async () => ({ body: new ReadableStream(), contentType: "application/pdf" }),
};

async function setup() {
  const database = new InMemoryProjectDatabase();
  database.tutorAssignments.add("tutor-assigned:student-1");
  const project = await createProject(database, tutor, {
    courseId: null,
    subjectId: "subject-1",
    title: "Bridge design",
    description: null,
    isGroup: false,
    status: "in_progress",
    startDate: null,
    dueDate: null,
    members: [{ studentProfileId: "student-1", roleLabel: null }],
  });
  return { database, project };
}

describe("projects privacy and upload security", () => {
  it("cannot expose a public portfolio item without a parent consent record", async () => {
    const { database, project } = await setup();
    const item = await addPortfolioItem(database, student, {
      projectId: project.id,
      title: "Bridge prototype",
      description: "A tested scale model.",
      linkUrl: null,
    });
    await database.updatePortfolioVisibility(item.id, "public"); // proves visibility alone is insufficient
    await expect(getPublicPortfolioItem(database, item.id)).rejects.toMatchObject({
      code: "PORTFOLIO_CONSENT_REQUIRED",
    } satisfies Partial<ProjectError>);

    database.parentLinks.add("parent-user:student-1");
    database.parentProfiles.set("parent-user", "parent-profile-1");
    await approvePortfolioSharing(database, parent, item.id);
    await expect(getPublicPortfolioItem(database, item.id)).resolves.toEqual({
      id: item.id,
      title: "Bridge prototype",
      description: "A tested scale model.",
      linkUrl: null,
    });
  });

  it("uses the assignment upload policy and keeps project evidence quarantined until clean", async () => {
    const { database, project } = await setup();
    const pdf = new TextEncoder().encode("%PDF-1.7\ncontent");
    await expect(
      uploadProjectFile(
        database,
        storage,
        student,
        project.id,
        { fileName: "unsafe.exe", mimeType: "application/x-msdownload", sizeBytes: pdf.length },
        pdf,
      ),
    ).rejects.toMatchObject({ code: "UPLOAD_NOT_ALLOWED" } satisfies Partial<ProjectError>);
    const file = await uploadProjectFile(
      database,
      storage,
      student,
      project.id,
      { fileName: "design.pdf", mimeType: "application/pdf", sizeBytes: pdf.length },
      pdf,
    );
    await expect(getDownloadableProjectFile(database, student, file.id)).rejects.toMatchObject({
      code: "FILE_NOT_READY",
    } satisfies Partial<ProjectError>);
    await recordProjectFileScanResult(database, file.id, "clean");
    await expect(getDownloadableProjectFile(database, student, file.id)).resolves.toMatchObject({
      id: file.id,
      virusScanStatus: "clean",
    });
  });
});
