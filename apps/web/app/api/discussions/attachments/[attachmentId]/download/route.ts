import { NextResponse, type NextRequest } from "next/server";

import { DiscussionError, isDiscussionError } from "../../../../../../../../packages/domain/discussions/errors";
import { createS3DiscussionStorage } from "../../../../../../../../packages/domain/discussions/s3-storage";
import { verifyDiscussionAttachmentSignedUrl } from "../../../../../../../../packages/domain/discussions/signed-url";
import { currentDiscussionContext } from "../../../../../(app)/discussions/context";
import { loadDownloadableAttachment } from "../../../../../(app)/discussions/queries";

/** Rechecks session, signed token, question access, and scan status before streaming from private
 *  storage — same defense-in-depth shape as the communication/assignment attachment routes. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> },
) {
  try {
    const { attachmentId } = await params;
    const context = await currentDiscussionContext();
    const token = request.nextUrl.searchParams.get("token");
    if (!token || !verifyDiscussionAttachmentSignedUrl(token, attachmentId, context.actor.userId)) {
      throw new DiscussionError("FORBIDDEN", "The download URL is invalid or expired.", 403);
    }
    const attachment = await loadDownloadableAttachment(attachmentId);
    const object = await createS3DiscussionStorage().getPrivate(attachment.fileKey);
    return new NextResponse(object.body, {
      headers: {
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
        "Content-Type": object.contentType ?? attachment.mimeType,
      },
    });
  } catch (error) {
    if (isDiscussionError(error)) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    return NextResponse.json({ error: { code: "INTERNAL", message: "Something went wrong." } }, { status: 500 });
  }
}
