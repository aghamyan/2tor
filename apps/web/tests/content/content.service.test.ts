import { describe, expect, it } from "vitest";
import { ContentError } from "../../../../packages/domain/content/errors";
import {
  createResource,
  removeDeadLinks,
  reportContent,
  uploadTutorMaterial,
} from "../../../../packages/domain/content/services";
import type { ContentStorage } from "../../../../packages/domain/content/storage";
import { InMemoryContentDatabase } from "./support/in-memory-content-database";

const tutor = { userId: "tutor-user", roles: ["tutor"] as const };
const student = {
  userId: "student-user",
  studentProfileId: "student-1",
  roles: ["student"] as const,
};
const storage: ContentStorage = { putPrivate: async () => {} };
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
});
