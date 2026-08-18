/**
 * Pure math for turning a face landmarker's 3D rotation into head-turn/nod/tilt angles. No DOM,
 * no MediaPipe types here — the browser-side FaceTrackingService (components/assessments/proctoring)
 * feeds this the rotation submatrix and thresholds the result to decide "looking away."
 */

export interface HeadPoseAngles {
  /** Turning left/right (rotation about the vertical axis), degrees. */
  yawDeg: number;
  /** Nodding up/down (rotation about the horizontal axis), degrees. */
  pitchDeg: number;
  /** Tilting ear-to-shoulder, degrees. */
  rollDeg: number;
}

const RADIANS_TO_DEGREES = 180 / Math.PI;

/**
 * Decomposes a row-major 3x3 rotation matrix into Tait-Bryan angles (R = Rz(roll) * Ry(yaw) *
 * Rx(pitch)), matching MediaPipe's camera-facing convention: +X right, +Y up, +Z toward the
 * viewer.
 */
export function eulerAnglesFromRotationMatrix3x3(rows: readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
]): HeadPoseAngles {
  const [, , [r20, r21, r22]] = rows;
  const [[r00], [r10]] = rows;
  const sy = Math.sqrt(r00 * r00 + r10 * r10);
  const singular = sy < 1e-6;

  const pitch = singular ? Math.atan2(-rows[1][2], rows[1][1]) : Math.atan2(r21, r22);
  const yaw = Math.atan2(-r20, sy);
  const roll = singular ? 0 : Math.atan2(r10, r00);

  return {
    yawDeg: yaw * RADIANS_TO_DEGREES,
    pitchDeg: pitch * RADIANS_TO_DEGREES,
    rollDeg: roll * RADIANS_TO_DEGREES,
  };
}

/**
 * Accepts MediaPipe's column-major 4x4 `facialTransformationMatrix` (a flat 16-number array) and
 * extracts the upper-left 3x3 rotation submatrix in row-major order for
 * `eulerAnglesFromRotationMatrix3x3`.
 */
export function headPoseFromColumnMajor4x4(matrix: readonly number[]): HeadPoseAngles {
  if (matrix.length !== 16) {
    throw new RangeError("Expected a flat 16-number column-major 4x4 matrix.");
  }
  const at = (col: number, row: number) => matrix[col * 4 + row] ?? 0;
  return eulerAnglesFromRotationMatrix3x3([
    [at(0, 0), at(1, 0), at(2, 0)],
    [at(0, 1), at(1, 1), at(2, 1)],
    [at(0, 2), at(1, 2), at(2, 2)],
  ]);
}

export type HeadDirection = "center" | "left" | "right" | "up" | "down";

const HEAD_DIRECTION_YAW_THRESHOLD_DEG = 12;
const HEAD_DIRECTION_PITCH_THRESHOLD_DEG = 10;

/**
 * A coarse, human-readable label for the live monitoring console — not a detection threshold in
 * its own right. `gaze_away`/`external_device_suspected` in face-tracking-service.ts use their own
 * (stricter, grace-period-gated) thresholds; this only labels what the console currently shows.
 * Yaw sign convention matches face-tracking-service.ts's existing `gaze_away` direction mapping:
 * positive yaw is "left".
 */
export function classifyHeadDirection(yawDeg: number, pitchDeg: number): HeadDirection {
  if (Math.abs(yawDeg) >= HEAD_DIRECTION_YAW_THRESHOLD_DEG) return yawDeg > 0 ? "left" : "right";
  if (Math.abs(pitchDeg) >= HEAD_DIRECTION_PITCH_THRESHOLD_DEG) return pitchDeg > 0 ? "up" : "down";
  return "center";
}
