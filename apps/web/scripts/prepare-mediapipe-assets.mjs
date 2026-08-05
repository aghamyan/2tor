#!/usr/bin/env node
// Self-hosts the face-tracking assets that components/assessments/proctoring/face-tracking-service.ts
// loads from same-origin `/mediapipe/*` instead of a third-party CDN — see that file's comment on
// WASM_BASE/MODEL_URL for why. Safe to re-run; skips work that's already done. Not committed to
// git (public/mediapipe/ is gitignored) — this script is the reproducible source of truth instead.
import { existsSync, mkdirSync, readdirSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "..");
const wasmSource = path.join(webRoot, "node_modules/@mediapipe/tasks-vision/wasm");
const publicMediapipe = path.join(webRoot, "public/mediapipe");
const wasmDest = path.join(publicMediapipe, "wasm");
const modelDest = path.join(publicMediapipe, "face_landmarker.task");
const modelUrl =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

function copyWasm() {
  if (!existsSync(wasmSource)) {
    console.warn(
      `[prepare-mediapipe-assets] ${wasmSource} not found — is @mediapipe/tasks-vision installed? Skipping WASM copy.`,
    );
    return;
  }
  mkdirSync(wasmDest, { recursive: true });
  for (const entry of readdirSync(wasmSource)) {
    copyFileSync(path.join(wasmSource, entry), path.join(wasmDest, entry));
  }
  console.log(`[prepare-mediapipe-assets] Copied WASM runtime to ${path.relative(webRoot, wasmDest)}`);
}

async function downloadModel() {
  if (existsSync(modelDest)) {
    console.log(`[prepare-mediapipe-assets] Model already present at ${path.relative(webRoot, modelDest)}`);
    return;
  }
  mkdirSync(publicMediapipe, { recursive: true });
  try {
    const response = await fetch(modelUrl);
    if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    await import("node:fs/promises").then(({ writeFile }) => writeFile(modelDest, buffer));
    console.log(`[prepare-mediapipe-assets] Downloaded face landmarker model to ${path.relative(webRoot, modelDest)}`);
  } catch (error) {
    // Non-fatal: face-tracking-service.ts already degrades gracefully to camera-presence-only
    // when the model can't be loaded. Don't break `dev`/`build` for people who never touch
    // camera-required, head-tracking-enabled assessments.
    console.warn(
      `[prepare-mediapipe-assets] Could not download the face landmarker model (${error instanceof Error ? error.message : String(error)}). ` +
        "On-device face tracking will be unavailable until this succeeds — re-run `node scripts/prepare-mediapipe-assets.mjs` once you have network access to storage.googleapis.com.",
    );
  }
}

copyWasm();
await downloadModel();
