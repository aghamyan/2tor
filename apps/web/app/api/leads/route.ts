import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { createMarketingLead } from "../../../../../packages/domain/marketing/services";
import { marketingLeadStore } from "./store";

const WINDOW_MS = 10 * 60 * 1_000;
const MAX_REQUESTS = 5;
const requestLog = new Map<string, number[]>();

function clientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
function isRateLimited(ip: string, now: number) {
  const recent = (requestLog.get(ip) ?? []).filter((time) => now - time < WINDOW_MS);
  recent.push(now);
  requestLog.set(ip, recent);
  return recent.length > MAX_REQUESTS;
}

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  if (isRateLimited(clientIp(request), Date.now()))
    return NextResponse.json(
      { error: "RATE_LIMITED", requestId },
      { status: 429, headers: { "cache-control": "no-store", "retry-after": "600" } },
    );
  try {
    const body: unknown = await request.json();
    // Do not confirm whether a honeypot was triggered; this response is intentionally bland.
    if (
      typeof body === "object" &&
      body !== null &&
      "company" in body &&
      (body as { company?: unknown }).company
    ) {
      return NextResponse.json(
        { data: { received: true }, requestId },
        { status: 202, headers: { "cache-control": "no-store" } },
      );
    }
    await createMarketingLead(marketingLeadStore(), body);
    return NextResponse.json(
      { data: { received: true }, requestId },
      { status: 201, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        { error: "INVALID_LEAD", requestId },
        { status: 422, headers: { "cache-control": "no-store" } },
      );
    return NextResponse.json(
      { error: "LEAD_UNAVAILABLE", requestId },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
