import { NextResponse, type NextRequest } from "next/server";

import { matchingNoteInputSchema } from "../../../../../../packages/domain/matching/schemas";
import { addMatchingNote } from "../../../../../../packages/domain/matching/services";
import { apiMatchingContext } from "../_context";
import { matchingApiError, requestId } from "../_response";

/** Internal notes are intentionally staff-only. */
export async function POST(request: NextRequest) {
  const id = requestId(request);
  try {
    const context = await apiMatchingContext(request);
    const input = matchingNoteInputSchema.parse(await request.json());
    const note = await addMatchingNote(context.database, context.actor, input);
    return NextResponse.json({ data: note, requestId: id }, { status: 201 });
  } catch (error: unknown) {
    return matchingApiError(error, id);
  }
}
