import { spawn, spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../../../..");
const composeFile = path.join(repositoryRoot, "docker-compose.test.yml");
const seedFile = path.join(scriptDirectory, "seed-e2e.sql");
const webPort = process.env.E2E_WEB_PORT ?? "3100";
const healthPort = Number(process.env.E2E_HEALTH_PORT ?? "3199");
const redisUrl = new URL(process.env.REDIS_URL ?? "redis://127.0.0.1:6389");
const redisPort = Number(redisUrl.port || "6389");
const redisHost = redisUrl.hostname;
const databaseUrl =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5433/app_test";
const testDatabaseUser = process.env.POSTGRES_TEST_USER ?? "postgres";
const testDatabaseName = process.env.POSTGRES_TEST_DB ?? "app_test";

let shuttingDown = false;
let nextProcess;
let redisServer;
let healthServer;
let shadowRoot;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: "utf8",
    stdio: options.input ? ["pipe", "inherit", "inherit"] : "inherit",
    input: options.input,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} exited with status ${String(result.status)}.`);
  }
}

function sessionFor(key) {
  const identities = {
    "session:e2e-parent": { id: "e2e-parent", userId: "usr_demo_parent", roles: ["parent"] },
    "session:e2e-student": { id: "e2e-student", userId: "usr_demo_student", roles: ["student"] },
    "session:e2e-tutor": { id: "e2e-tutor", userId: "usr_demo_tutor", roles: ["tutor"] },
    "session:e2e-admin": {
      id: "e2e-admin",
      userId: "usr_demo_admin",
      roles: ["administrator"],
    },
    "session:e2e-super-admin": {
      id: "e2e-super-admin",
      userId: "usr_demo_admin",
      roles: ["super_administrator"],
    },
    "session:e2e-approver": {
      id: "e2e-approver",
      userId: "usr_e2e_approver",
      roles: ["administrator"],
    },
  };
  const identity = identities[key];
  if (!identity) return null;
  const now = new Date();
  return JSON.stringify({
    ...identity,
    mfaVerifiedAt: now.toISOString(),
    createdAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 60 * 60 * 1_000).toISOString(),
    ipAddress: "127.0.0.1",
    userAgent: "Playwright E2E",
    csrfSecret: "e2e-session-secret",
  });
}

function parseCommand(buffer) {
  let cursor = 0;
  const readLine = () => {
    const end = buffer.indexOf("\r\n", cursor);
    if (end === -1) return null;
    const line = buffer.subarray(cursor, end).toString("utf8");
    cursor = end + 2;
    return line;
  };

  const arrayHeader = readLine();
  if (arrayHeader === null) return null;
  if (!arrayHeader.startsWith("*")) {
    const inline = arrayHeader.trim().split(/\s+/);
    return { command: inline, bytes: cursor };
  }
  const count = Number(arrayHeader.slice(1));
  if (!Number.isInteger(count) || count < 0) throw new Error("Malformed RESP array.");

  const command = [];
  for (let index = 0; index < count; index += 1) {
    const bulkHeader = readLine();
    if (bulkHeader === null) return null;
    if (!bulkHeader.startsWith("$")) throw new Error("Malformed RESP bulk string.");
    const length = Number(bulkHeader.slice(1));
    if (!Number.isInteger(length) || length < 0) throw new Error("Malformed RESP length.");
    if (buffer.length < cursor + length + 2) return null;
    command.push(buffer.subarray(cursor, cursor + length).toString("utf8"));
    cursor += length;
    if (buffer.subarray(cursor, cursor + 2).toString("utf8") !== "\r\n") {
      throw new Error("Malformed RESP terminator.");
    }
    cursor += 2;
  }
  return { command, bytes: cursor };
}

function bulk(value) {
  if (value === null) return "$-1\r\n";
  return `$${Buffer.byteLength(value)}\r\n${value}\r\n`;
}

async function startSessionServer() {
  redisServer = net.createServer((socket) => {
    let pending = Buffer.alloc(0);
    socket.on("data", (chunk) => {
      pending = Buffer.concat([pending, chunk]);
      while (pending.length > 0) {
        let parsed;
        try {
          parsed = parseCommand(pending);
        } catch {
          socket.write("-ERR malformed command\r\n");
          pending = Buffer.alloc(0);
          return;
        }
        if (!parsed) return;
        pending = pending.subarray(parsed.bytes);
        const [rawName = "", ...args] = parsed.command;
        const name = rawName.toUpperCase();
        if (name === "GET") socket.write(bulk(sessionFor(args[0] ?? "")));
        else if (name === "INFO") {
          socket.write(bulk("# Server\r\nredis_version:7.2.0\r\nloading:0\r\nrole:master\r\n"));
        } else if (name === "PING") socket.write("+PONG\r\n");
        else if (name === "QUIT") {
          socket.end("+OK\r\n");
        } else socket.write("+OK\r\n");
      }
    });
  });
  await new Promise((resolve, reject) => {
    redisServer.once("error", reject);
    redisServer.listen(redisPort, redisHost, resolve);
  });
}

function stopChild(child) {
  if (!child || child.killed) return;
  child.kill("SIGTERM");
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  stopChild(nextProcess);
  redisServer?.close();
  healthServer?.close();
  spawnSync("docker", ["compose", "-f", composeFile, "down", "--volumes", "--remove-orphans"], {
    cwd: repositoryRoot,
    stdio: "inherit",
  });
  if (shadowRoot?.startsWith(path.join(scriptDirectory, ".runtime-"))) {
    rmSync(shadowRoot, { recursive: true, force: true });
  }
  process.exit(exitCode);
}

async function startHealthServer() {
  healthServer = http.createServer((_request, response) => {
    const probe = http.get(
      {
        host: "127.0.0.1",
        port: Number(webPort),
        path: "/api/communication/conversations?limit=1",
        headers: { cookie: "session_id=e2e-parent" },
        timeout: 2_000,
      },
      (probeResponse) => {
        probeResponse.resume();
        const status = probeResponse.statusCode ?? 503;
        response.writeHead(status < 500 ? 200 : 503, { "content-type": "text/plain" });
        response.end(status < 500 ? "ready" : "starting");
      },
    );
    const unavailable = () => {
      if (!response.headersSent) {
        response.writeHead(503);
        response.end("starting");
      }
    };
    probe.once("error", unavailable);
    probe.once("timeout", () => {
      probe.destroy();
      unavailable();
    });
  });
  await new Promise((resolve, reject) => {
    healthServer.once("error", reject);
    healthServer.listen(healthPort, "127.0.0.1", resolve);
  });
}

function createShadowWorkspace() {
  // Keep the disposable project beneath the configured Turbopack root. Turbopack rejects
  // dependencies symlinked outside that root, while an isolated project still avoids colliding
  // with a developer-owned apps/web/.next lock.
  shadowRoot = mkdtempSync(path.join(scriptDirectory, ".runtime-"));
  const shadowApps = path.join(shadowRoot, "apps");
  const shadowWeb = path.join(shadowApps, "web");
  mkdirSync(shadowWeb, { recursive: true });
  const webSource = path.join(repositoryRoot, "apps/web");
  const ignoredEntries = new Set([".next", ".turbo", "e2e", "node_modules"]);
  for (const entry of readdirSync(webSource)) {
    if (ignoredEntries.has(entry)) continue;
    cpSync(path.join(webSource, entry), path.join(shadowWeb, entry), { recursive: true });
  }
  const consentApiDirectory = path.join(shadowWeb, "app/api/consent");
  cpSync(
    path.join(scriptDirectory, "notification-dispatch.ts"),
    path.join(consentApiDirectory, "_e2e-notifier.ts"),
  );
  for (const operation of ["activate", "consent-records"]) {
    const route = path.join(consentApiDirectory, "students/[studentId]", operation, "route.ts");
    writeFileSync(
      route,
      readFileSync(route, "utf8").replace(
        '"@app/notifications/dispatch"',
        '"../../../_e2e-notifier"',
      ),
    );
  }
  symlinkSync(
    path.join(repositoryRoot, "apps/web/node_modules"),
    path.join(shadowWeb, "node_modules"),
    "junction",
  );
  symlinkSync(
    path.join(repositoryRoot, "node_modules"),
    path.join(shadowRoot, "node_modules"),
    "junction",
  );
  symlinkSync(path.join(repositoryRoot, "packages"), path.join(shadowRoot, "packages"), "junction");
  for (const file of ["package.json", "pnpm-workspace.yaml", "tsconfig.base.json"]) {
    cpSync(path.join(repositoryRoot, file), path.join(shadowRoot, file));
  }
  const shadowNextConfig = path.join(shadowWeb, "next.config.mjs");
  const configuredNext = readFileSync(shadowNextConfig, "utf8").replace(
    'path.join(__dirname, "..", "..")',
    JSON.stringify(repositoryRoot),
  );
  writeFileSync(shadowNextConfig, configuredNext);
  return shadowWeb;
}

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(0));
process.on("uncaughtException", (error) => {
  console.error(error);
  shutdown(1);
});
process.on("unhandledRejection", (error) => {
  console.error(error);
  shutdown(1);
});

// The named 2tor-test Compose project owns this volume, so resetting it cannot touch dev data.
run("docker", ["compose", "-f", composeFile, "down", "--volumes", "--remove-orphans"]);
run("docker", ["compose", "-f", composeFile, "up", "-d", "--wait"]);
run("pnpm", ["--filter", "@app/db", "db:migrate"]);
run("pnpm", ["--filter", "@app/db", "seed"]);
run(
  "docker",
  [
    "compose",
    "-f",
    composeFile,
    "exec",
    "-T",
    "db_test",
    "psql",
    "-v",
    "ON_ERROR_STOP=1",
    "-U",
    testDatabaseUser,
    "-d",
    testDatabaseName,
  ],
  { input: readFileSync(seedFile, "utf8") },
);

await startSessionServer();

const shadowWeb = createShadowWorkspace();
nextProcess = spawn(
  path.join(repositoryRoot, "apps/web/node_modules/.bin/next"),
  ["dev", ".", "--turbopack", "-H", "127.0.0.1", "-p", webPort],
  {
    // next-intl resolves its relative request-config path from process.cwd(). Run from the
    // disposable web project, matching ordinary `pnpm --filter web dev` behavior.
    cwd: shadowWeb,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      REDIS_URL: `redis://${redisHost}:${String(redisPort)}`,
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: "inherit",
  },
);
nextProcess.once("exit", (code, signal) => {
  if (!shuttingDown) {
    console.error(`Next.js exited early (${String(code ?? signal)}).`);
    shutdown(code ?? 1);
  }
});
await startHealthServer();
