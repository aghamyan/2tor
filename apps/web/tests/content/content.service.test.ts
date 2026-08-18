import { describe, expect, it } from "vitest";
import { ContentError } from "../../../../packages/domain/content/errors";
import {
  bookmarkResource,
  createResource,
  getDownloadableResourceUpload,
  listBookmarkedResourceIds,
  listResources,
  listResourceSubjects,
  removeDeadLinks,
  reportContent,
  reviewTutorUpload,
  uploadTutorMaterial,
} from "../../../../packages/domain/content/services";
import type { ContentStorage } from "../../../../packages/domain/content/storage";
import { InMemoryContentDatabase } from "./support/in-memory-content-database";

const tutor = { userId: "tutor-user", roles: ["tutor"] as const };
const admin = { userId: "admin-user", roles: ["administrator"] as const };
const student = {
  userId: "student-user",
  studentProfileId: "student-1",
  roles: ["student"] as const,
};
const storage: ContentStorage = {
  putPrivate: async () => {},
  getPrivate: async () => ({ body: new ReadableStream(), contentType: "application/pdf" }),
};
async function publishedVideo(database: InMemoryContentDatabase) {
  return createResource(database, tutor, {
    title: "Fractions",
    description: null,
    subjectId: "math",
    type: "video",
    ownership: "third_party_licensed",
    status: "published",
    tags: ["Fractions"],
    links: [{ url: "https://youtu.be/dQw4w9WgXcQ", title: "Fractions video" }],
  });
}

describe("copyright-safe content", () => {
  it("removes an external link and creates a moderation report when reported", async () => {
    const database = new InMemoryContentDatabase();
    const resource = await publishedVideo(database);
    await reportContent(database, student, resource.id, "No longer available");
    expect((await database.getResource(resource.id))?.links).toEqual([]);
    await expect(database.listOpenReports(10)).resolves.toMatchObject([
      { resourceId: resource.id, status: "open" },
    ]);
  });
  it("removes dead links without fetching video bodies", async () => {
    const database = new InMemoryContentDatabase();
    const resource = await publishedVideo(database);
    const checked: string[] = [];
    await expect(
      removeDeadLinks(database, async (url) => {
        checked.push(url);
        return false;
      }),
    ).resolves.toHaveLength(1);
    expect(checked).toEqual(["https://www.youtube.com/embed/dQw4w9WgXcQ"]);
    expect((await database.getResource(resource.id))?.links).toEqual([]);
  });
  it("rejects a tutor upload without an explicit rights confirmation", async () => {
    const database = new InMemoryContentDatabase();
    database.tutorProfiles.set(tutor.userId, "tutor-profile-1");
    const pdf = new TextEncoder().encode("%PDF-1.7\nmaterial");
    await expect(
      uploadTutorMaterial(
        database,
        storage,
        tutor,
        {
          resourceId: null,
          fileName: "worksheet.pdf",
          mimeType: "application/pdf",
          sizeBytes: pdf.length,
          rightsConfirmed: false,
        },
        pdf,
      ),
    ).rejects.toMatchObject({
      code: "RIGHTS_CONFIRMATION_REQUIRED",
    } satisfies Partial<ContentError>);
    expect(database.uploads.size).toBe(0);
  });
  it("accepts only YouTube video links and stores an embed reference", async () => {
    const database = new InMemoryContentDatabase();
    const resource = await publishedVideo(database);
    expect(resource.links[0]?.url).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
    await expect(
      createResource(database, tutor, {
        title: "Other",
        description: null,
        subjectId: null,
        type: "video",
        ownership: "third_party_licensed",
        status: "published",
        tags: [],
        links: [{ url: "https://example.com/video", title: null }],
      }),
    ).rejects.toMatchObject({ code: "INVALID_VIDEO_URL" } satisfies Partial<ContentError>);
  });
  it("lists active subjects for the resource-creation form", async () => {
    const database = new InMemoryContentDatabase();
    database.subjects.push({ id: "math", name: "Mathematics" });
    await expect(listResourceSubjects(database, tutor)).resolves.toEqual([
      { id: "math", name: "Mathematics" },
    ]);
  });
  it("reports a student's bookmarked resources so saved state survives a reload", async () => {
    const database = new InMemoryContentDatabase();
    const resource = await publishedVideo(database);
    await bookmarkResource(database, student, resource.id);
    await expect(listBookmarkedResourceIds(database, student)).resolves.toEqual([resource.id]);
    await expect(listBookmarkedResourceIds(database, tutor)).resolves.toEqual([]);
  });
});

describe("resource visibility targeting", () => {
  async function gradeResource(database: InMemoryContentDatabase) {
    return createResource(database, tutor, {
      title: "Grade 6 worksheet",
      description: null,
      subjectId: null,
      type: "worksheet",
      ownership: "tutor_created",
      status: "published",
      visibility: "grades",
      gradeLevels: ["6"],
      tags: [],
      links: [],
    });
  }
  async function studentResource(database: InMemoryContentDatabase, studentProfileId: string) {
    return createResource(database, tutor, {
      title: "Just for you",
      description: null,
      subjectId: null,
      type: "worksheet",
      ownership: "tutor_created",
      status: "published",
      visibility: "students",
      studentProfileIds: [studentProfileId],
      tags: [],
      links: [],
    });
  }

  it("shows a grade-targeted resource to a student in that grade", async () => {
    const database = new InMemoryContentDatabase();
    const resource = await gradeResource(database);
    const gradeSixStudent = { ...student, gradeLevel: "6" };
    const visible = await listResources(database, gradeSixStudent);
    expect(visible.map((r) => r.id)).toContain(resource.id);
  });

  it("hides a grade-targeted resource from a student in a different grade", async () => {
    const database = new InMemoryContentDatabase();
    const resource = await gradeResource(database);
    const gradeSevenStudent = { ...student, gradeLevel: "7" };
    const visible = await listResources(database, gradeSevenStudent);
    expect(visible.map((r) => r.id)).not.toContain(resource.id);
  });

  it("hides a grade-targeted resource from a student with no grade level on file", async () => {
    const database = new InMemoryContentDatabase();
    const resource = await gradeResource(database);
    const visible = await listResources(database, student);
    expect(visible.map((r) => r.id)).not.toContain(resource.id);
  });

  it("shows a student-targeted resource only to that student", async () => {
    const database = new InMemoryContentDatabase();
    const resource = await studentResource(database, "student-1");
    const otherStudent = { userId: "other", studentProfileId: "student-2", roles: ["student"] as const };
    await expect(listResources(database, student)).resolves.toMatchObject([{ id: resource.id }]);
    await expect(listResources(database, otherStudent)).resolves.toEqual([]);
  });

  it("shows a parent every child's grade- and student-targeted resources", async () => {
    const database = new InMemoryContentDatabase();
    const grade = await gradeResource(database);
    const targeted = await studentResource(database, "student-2");
    const parent = {
      userId: "parent-user",
      roles: ["parent"] as const,
      guardianStudents: [
        { studentProfileId: "student-1", gradeLevel: "6" },
        { studentProfileId: "student-2", gradeLevel: "9" },
      ],
    };
    const visible = await listResources(database, parent);
    expect(visible.map((r) => r.id).sort()).toEqual([grade.id, targeted.id].sort());
  });

  it("lets tutors and admins see every published resource regardless of targeting", async () => {
    const database = new InMemoryContentDatabase();
    const grade = await gradeResource(database);
    const targeted = await studentResource(database, "student-1");
    const visible = await listResources(database, admin);
    expect(visible.map((r) => r.id).sort()).toEqual([grade.id, targeted.id].sort());
  });

  it("lets an author preview their own drafts, but not other tutors' drafts", async () => {
    const database = new InMemoryContentDatabase();
    const draft = await createResource(database, tutor, {
      title: "Draft",
      description: null,
      subjectId: null,
      type: "document",
      ownership: "tutor_created",
      status: "draft",
      tags: [],
      links: [],
    });
    await expect(listResources(database, tutor)).resolves.toMatchObject([{ id: draft.id }]);
    const otherTutor = { userId: "other-tutor", roles: ["tutor"] as const };
    await expect(listResources(database, otherTutor)).resolves.toEqual([]);
  });
});

describe("link resources", () => {
  it("accepts a non-YouTube URL for a link resource without converting it to an embed", async () => {
    const database = new InMemoryContentDatabase();
    const resource = await createResource(database, tutor, {
      title: "Practice site",
      description: null,
      subjectId: null,
      type: "link",
      ownership: "third_party_licensed",
      status: "published",
      tags: [],
      links: [{ url: "https://example.com/practice", title: "Practice" }],
    });
    expect(resource.links).toEqual([
      expect.objectContaining({ url: "https://example.com/practice", provider: "other" }),
    ]);
  });
});

describe("tutor upload review and download", () => {
  async function pendingUpload(database: InMemoryContentDatabase, resourceId: string | null) {
    database.tutorProfiles.set(tutor.userId, "tutor-profile-1");
    const pdf = new TextEncoder().encode("%PDF-1.7\nmaterial");
    return uploadTutorMaterial(
      database,
      storage,
      tutor,
      {
        resourceId,
        fileName: "worksheet.pdf",
        mimeType: "application/pdf",
        sizeBytes: pdf.length,
        rightsConfirmed: true,
      },
      pdf,
    );
  }

  it("blocks downloads until an administrator approves the upload", async () => {
    const database = new InMemoryContentDatabase();
    const resource = await publishedVideo(database);
    const upload = await pendingUpload(database, resource.id);
    await expect(
      getDownloadableResourceUpload(database, student, upload.id),
    ).rejects.toMatchObject({ code: "UPLOAD_NOT_READY" } satisfies Partial<ContentError>);
    await reviewTutorUpload(database, admin, upload.id, "approved");
    await expect(getDownloadableResourceUpload(database, student, upload.id)).resolves.toMatchObject(
      { status: "approved" },
    );
  });

  it("rejects a download when the file's resource isn't visible to the viewer", async () => {
    const database = new InMemoryContentDatabase();
    const resource = await createResource(database, tutor, {
      title: "Grade 9 only",
      description: null,
      subjectId: null,
      type: "worksheet",
      ownership: "tutor_created",
      status: "published",
      visibility: "grades",
      gradeLevels: ["9"],
      tags: [],
      links: [],
    });
    const upload = await pendingUpload(database, resource.id);
    await reviewTutorUpload(database, admin, upload.id, "approved");
    const gradeSixStudent = { ...student, gradeLevel: "6" };
    await expect(
      getDownloadableResourceUpload(database, gradeSixStudent, upload.id),
    ).rejects.toMatchObject({ code: "UPLOAD_NOT_FOUND" } satisfies Partial<ContentError>);
  });

  it("rejects a non-administrator reviewing an upload", async () => {
    const database = new InMemoryContentDatabase();
    const upload = await pendingUpload(database, null);
    await expect(reviewTutorUpload(database, tutor, upload.id, "approved")).rejects.toMatchObject({
      code: "FORBIDDEN",
    } satisfies Partial<ContentError>);
  });
});
