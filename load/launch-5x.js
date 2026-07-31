import { check, fail, sleep } from "k6";
import http from "k6/http";
import { Rate, Trend } from "k6/metrics";

const baseURL = (__ENV.BASE_URL || "").replace(/\/$/, "");
const profile = __ENV.LOAD_PROFILE || "launch";
const steadyDuration = __ENV.STEADY_DURATION || (profile === "smoke" ? "20s" : "5m");
const rampDuration = __ENV.RAMP_DURATION || (profile === "smoke" ? "1s" : "1m");

const launchVus = {
  marketing: profile === "smoke" ? 1 : 50,
  dashboard: profile === "smoke" ? 1 : 100,
  api: profile === "smoke" ? 1 : 75,
  messaging: profile === "smoke" ? 1 : 25,
};

const marketingHtml = new Trend("marketing_html_duration", true);
const dashboardShell = new Trend("dashboard_shell_duration", true);
const commonApi = new Trend("common_api_duration", true);
const messageAcknowledgment = new Trend("message_ack_duration", true);
const functionalFailures = new Rate("functional_failures");

function scenario(exec, vus, startTime = "0s") {
  return {
    executor: "ramping-vus",
    exec,
    startVUs: 0,
    startTime,
    stages: [
      { duration: rampDuration, target: vus },
      { duration: steadyDuration, target: vus },
      { duration: rampDuration, target: 0 },
    ],
    gracefulRampDown: "15s",
  };
}

export const options = {
  scenarios: {
    public_marketing: scenario("publicMarketing", launchVus.marketing),
    parent_dashboard: scenario("parentDashboard", launchVus.dashboard),
    common_api: scenario("commonApiRead", launchVus.api),
    message_acknowledgment: scenario("messageSend", launchVus.messaging),
  },
  thresholds: {
    checks: ["rate>0.99"],
    functional_failures: ["rate<0.01"],
    http_req_failed: ["rate<0.01"],
    marketing_html_duration: ["p(95)<800"],
    dashboard_shell_duration: ["p(95)<2000"],
    common_api_duration: ["p(95)<500"],
    message_ack_duration: ["p(95)<500"],
  },
  discardResponseBodies: false,
  userAgent: "2tor-launch-gate-k6/1.0",
};

const parentCookie = __ENV.PARENT_SESSION_COOKIE || "";
const tutorCookie = __ENV.TUTOR_SESSION_COOKIE || "";
const parentUserId = __ENV.PARENT_USER_ID || "usr_demo_parent";
const studentUserId = __ENV.STUDENT_USER_ID || "usr_demo_student";
const tutorUserId = __ENV.TUTOR_USER_ID || "usr_demo_tutor";
const publicPaths = ["/en/home", "/en/safety", "/en/pricing", "/en/consultation"];

function headers(cookie, contentType = undefined) {
  const result = {};
  if (cookie) result.Cookie = cookie;
  if (contentType) result["Content-Type"] = contentType;
  return result;
}

function record(response, metric, assertions) {
  metric.add(response.timings.duration);
  const ok = check(response, assertions);
  functionalFailures.add(!ok);
  return ok;
}

export function setup() {
  if (!baseURL) fail("BASE_URL is required.");
  if (!parentCookie) fail("PARENT_SESSION_COOKIE is required.");
  if (!tutorCookie) fail("TUTOR_SESSION_COOKIE is required.");

  if (__ENV.MESSAGE_CONVERSATION_ID) {
    return { conversationId: __ENV.MESSAGE_CONVERSATION_ID };
  }
  if (__ENV.ALLOW_FIXTURE_WRITE !== "true") {
    fail("Set MESSAGE_CONVERSATION_ID or ALLOW_FIXTURE_WRITE=true for an isolated test target.");
  }

  const response = http.post(
    `${baseURL}/api/communication/conversations`,
    JSON.stringify({
      type: "parent_tutor",
      title: `Launch load fixture ${new Date().toISOString()}`,
      members: [
        { userId: parentUserId, role: "parent" },
        { userId: studentUserId, role: "student" },
        { userId: tutorUserId, role: "tutor" },
      ],
    }),
    {
      headers: headers(parentCookie, "application/json"),
      redirects: 0,
      tags: { kind: "fixture", name: "POST /api/communication/conversations [fixture]" },
    },
  );
  if (response.status !== 201) {
    fail(`Unable to create isolated load fixture: HTTP ${response.status} ${response.body}`);
  }
  const payload = response.json();
  const conversationId = payload && payload.data && payload.data.id;
  if (!conversationId) fail("Fixture response did not contain data.id.");
  return { conversationId };
}

export function publicMarketing() {
  const path = publicPaths[(__VU + __ITER) % publicPaths.length];
  const response = http.get(`${baseURL}${path}`, {
    redirects: 0,
    tags: { kind: "marketing", name: `GET ${path}` },
  });
  record(response, marketingHtml, {
    "public HTML is HTTP 200": (value) => value.status === 200,
    "public HTML is not a login redirect": (value) =>
      !String(value.headers.Location || "").includes("/login"),
    "public HTML has a document body": (value) => String(value.body || "").includes("<body"),
  });
  sleep(1);
}

export function parentDashboard() {
  const response = http.get(`${baseURL}/en/dashboard/parent`, {
    headers: headers(parentCookie),
    redirects: 0,
    tags: { kind: "dashboard", name: "GET /en/dashboard/parent" },
  });
  record(response, dashboardShell, {
    "dashboard shell is HTTP 200": (value) => value.status === 200,
    "dashboard response has HTML": (value) => String(value.body || "").includes("<body"),
  });
  sleep(1);
}

export function commonApiRead() {
  const response = http.get(`${baseURL}/api/communication/conversations?limit=20`, {
    headers: headers(parentCookie),
    redirects: 0,
    tags: { kind: "api", name: "GET /api/communication/conversations" },
  });
  record(response, commonApi, {
    "common API is HTTP 200": (value) => value.status === 200,
    "common API returns data": (value) => {
      try {
        return Array.isArray(value.json("data.items")) || Array.isArray(value.json("data"));
      } catch {
        return false;
      }
    },
  });
  sleep(1);
}

export function messageSend(data) {
  const response = http.post(
    `${baseURL}/api/communication/conversations/${data.conversationId}/messages`,
    JSON.stringify({
      body: `Load-gate acknowledgment probe vu=${__VU} iteration=${__ITER}`,
    }),
    {
      headers: headers(tutorCookie, "application/json"),
      redirects: 0,
      tags: {
        kind: "message",
        name: "POST /api/communication/conversations/:id/messages",
      },
    },
  );
  record(response, messageAcknowledgment, {
    "message acknowledgment is HTTP 201": (value) => value.status === 201,
    "message acknowledgment returns an id": (value) => {
      try {
        return typeof value.json("data.id") === "string";
      } catch {
        return false;
      }
    },
  });
  sleep(1);
}
