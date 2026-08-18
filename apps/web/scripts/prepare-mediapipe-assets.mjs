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
const faceModelDest = path.join(publicMediapipe, "face_landmarker.task");
const faceModelUrl =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
// COCO-80 object detector (phone/laptop/book/remote-in-frame checks) — see
// components/assessments/proctoring/object-detection-service.ts.
const objectModelDest = path.join(publicMediapipe, "object_detector.tflite");
const objectModelUrl =
  "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite";

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

async function downloadModel(dest, url, label) {
  if (existsSync(dest)) {
    console.log(`[prepare-mediapipe-assets] ${label} already present at ${path.relative(webRoot, dest)}`);
    return;
  }
  mkdirSync(publicMediapipe, { recursive: true });
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${String(response.status)}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    await import("node:fs/promises").then(({ writeFile }) => writeFile(dest, buffer));
    console.log(`[prepare-mediapipe-assets] Downloaded ${label} to ${path.relative(webRoot, dest)}`);
  } catch (error) {
    // Non-fatal: both face-tracking-service.ts and object-detection-service.ts already degrade
    // gracefully (face tracking falls back to camera-presence-only; object detection just never
    // starts) when their model can't be loaded. Don't break `dev`/`build` for people who never
    // touch camera-required, head-tracking-enabled assessments.
    console.warn(
      `[prepare-mediapipe-assets] Could not download ${label} (${error instanceof Error ? error.message : String(error)}). ` +
        "Re-run `node scripts/prepare-mediapipe-assets.mjs` once you have network access to storage.googleapis.com.",
    );
  }
}

copyWasm();
await downloadModel(faceModelDest, faceModelUrl, "face landmarker model");
await downloadModel(objectModelDest, objectModelUrl, "object detector model");
