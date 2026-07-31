import { NextResponse, type NextRequest } from "next/server";

import { CommunicationError } from "../../../../../../../../packages/domain/communication/errors";
import { uploadMessageAttachment } from "../../../../../../../../packages/domain/communication/services";
import { createS3CommunicationStorage } from "../../../../../../../../packages/domain/communication/storage";
import { apiCommunicationContext } from "../../../_context";
import { communicationApiError, communicationRequestId } from "../../../_response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const requestId = communicationRequestId(request);
  try {
    const context = await apiCommunicationContext(request);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new CommunicationError("INVALID_INPUT", "An attachment is required.", 400);
    }
    const { messageId } = await params;
    const data = await uploadMessageAttachment(
      context.database,
      createS3CommunicationStorage(),
      context.actor,
      messageId,
      { fileName: file.name, mimeType: file.type, sizeBytes: file.size },
      new Uint8Array(await file.arrayBuffer()),
    );
    return NextResponse.json({ data, requestId }, { status: 201 });
  } catch (error) {
    return communicationApiError(error, requestId);
  }
}
