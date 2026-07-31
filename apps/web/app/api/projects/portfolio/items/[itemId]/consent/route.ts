import { NextResponse, type NextRequest } from "next/server";
import { approvePortfolioSharing } from "../../../../../../../../../packages/domain/projects/services";
import { apiProjectContext } from "../../../../_context";
import { projectApiError, projectRequestId } from "../../../../_response";

/** The parent action writes `portfolio_sharing_consents` before changing visibility to public. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const requestId = projectRequestId(request);
  try {
    const context = await apiProjectContext(request);
    const { itemId } = await params;
    const consent = await approvePortfolioSharing(context.database, context.actor, itemId);
    return NextResponse.json({ data: consent, requestId }, { status: 201 });
  } catch (error) {
    return projectApiError(error, requestId);
  }
}
