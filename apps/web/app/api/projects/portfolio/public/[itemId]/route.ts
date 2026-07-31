import { NextResponse, type NextRequest } from "next/server";
import { getPublicPortfolioItem } from "../../../../../../../../packages/domain/projects/services";
import { projectApiError, projectRequestId } from "../../../_response";

/** Intentionally unauthenticated but emits only de-identified, consent-gated portfolio metadata. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const requestId = projectRequestId(request);
  try {
    const { itemId } = await params;
    const { createDrizzleProjectsDatabase } =
      await import("../../../../../../../../packages/domain/projects/drizzle-database");
    const { createDb } = await import("@app/db");
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is required for public portfolio access.");
    return NextResponse.json({
      data: await getPublicPortfolioItem(
        createDrizzleProjectsDatabase(createDb(databaseUrl)),
        itemId,
      ),
      requestId,
    });
  } catch (error) {
    return projectApiError(error, requestId);
  }
}
