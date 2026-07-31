import type { NextRequest } from "next/server";

import { openConversationEventStream } from "../../../../../../../../packages/domain/communication/services";
import { apiCommunicationContext } from "../../../_context";
import { communicationApiError, communicationRequestId } from "../../../_response";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const requestId = communicationRequestId(request);
  try {
    const context = await apiCommunicationContext(request);
    const { conversationId } = await params;
    await openConversationEventStream(
      context.database,
      context.actor,
      conversationId,
      request.nextUrl.searchParams.get("staffReason"),
    );
    let cursor = request.nextUrl.searchParams.get("after");
    const encoder = new TextEncoder();
    let timer: ReturnType<typeof setInterval> | undefined;
    let polling = false;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(`event: ready\ndata: ${JSON.stringify({ requestId })}\n\n`),
        );
        const poll = async () => {
          if (polling) return;
          polling = true;
          try {
            const messages = await context.database.listMessages(conversationId, cursor, 100);
            for (const message of messages) {
              controller.enqueue(
                encoder.encode(`event: message\ndata: ${JSON.stringify(message)}\n\n`),
              );
              cursor = message.id;
            }
            controller.enqueue(encoder.encode(": keep-alive\n\n"));
          } catch {
            if (timer) clearInterval(timer);
            controller.close();
          } finally {
            polling = false;
          }
        };
        void poll();
        timer = setInterval(() => void poll(), 2_500);
        request.signal.addEventListener(
          "abort",
          () => {
            if (timer) clearInterval(timer);
            try {
              controller.close();
            } catch {
              // The client may already have closed the stream.
            }
          },
          { once: true },
        );
      },
      cancel() {
        if (timer) clearInterval(timer);
      },
    });

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        "Content-Type": "text/event-stream",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return communicationApiError(error, requestId);
  }
}
