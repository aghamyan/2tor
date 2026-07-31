import { NextResponse, type NextRequest } from "next/server";
import { addPortfolioItemSchema } from "../../../../../../../packages/domain/projects/schemas";
import { addPortfolioItem } from "../../../../../../../packages/domain/projects/services";
import { apiProjectContext } from "../../_context";
import { projectApiError, projectRequestId } from "../../_response";

export async function POST(request: NextRequest) {
  const requestId = projectRequestId(request);
  try {
    const context = await apiProjectContext(request);
    const item = await addPortfolioItem(
      context.database,
      context.actor,
      addPortfolioItemSchema.parse(await request.json()),
    );
    return NextResponse.json({ data: item, requestId }, { status: 201 });
  } catch (error) {
    return projectApiError(error, requestId);
  }
}
