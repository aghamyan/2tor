import { describe, expect, it } from "vitest";
import {
  classifyHeadDirection,
  eulerAnglesFromRotationMatrix3x3,
  headPoseFromColumnMajor4x4,
} from "../../../../packages/domain/assessments/head-pose";

function rotationY(degrees: number): [
  [number, number, number],
  [number, number, number],
  [number, number, number],
] {
  const radians = (degrees * Math.PI) / 180;
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return [
    [c, 0, s],
    [0, 1, 0],
    [-s, 0, c],
  ];
}

function rotationX(degrees: number): [
  [number, number, number],
  [number, number, number],
  [number, number, number],
] {
  const radians = (degrees * Math.PI) / 180;
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return [
    [1, 0, 0],
    [0, c, -s],
    [0, s, c],
  ];
}

describe("eulerAnglesFromRotationMatrix3x3", () => {
  it("reads the identity matrix as facing forward", () => {
    const angles = eulerAnglesFromRotationMatrix3x3([
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
    expect(angles.yawDeg).toBeCloseTo(0, 5);
    expect(angles.pitchDeg).toBeCloseTo(0, 5);
    expect(angles.rollDeg).toBeCloseTo(0, 5);
  });

  it("recovers a pure yaw (turn left/right) rotation", () => {
    const angles = eulerAnglesFromRotationMatrix3x3(rotationY(35));
    expect(angles.yawDeg).toBeCloseTo(35, 3);
    expect(angles.pitchDeg).toBeCloseTo(0, 3);
  });

  it("recovers a pure pitch (nod up/down) rotation", () => {
    const angles = eulerAnglesFromRotationMatrix3x3(rotationX(-20));
    expect(angles.pitchDeg).toBeCloseTo(-20, 3);
    expect(angles.yawDeg).toBeCloseTo(0, 3);
  });
});

describe("headPoseFromColumnMajor4x4", () => {
  it("extracts the rotation submatrix from a flat column-major 4x4 array", () => {
    // Column-major layout of Ry(90deg) as a 4x4 with no translation.
    const matrix = [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1];
    const angles = headPoseFromColumnMajor4x4(matrix);
    expect(angles.yawDeg).toBeCloseTo(90, 3);
  });

  it("rejects a matrix that isn't 16 numbers", () => {
    expect(() => headPoseFromColumnMajor4x4([1, 2, 3])).toThrow(RangeError);
  });
});

describe("classifyHeadDirection", () => {
  it("reports center for small angles in both axes", () => {
    expect(classifyHeadDirection(2, -3)).toBe("center");
  });

  it("prioritizes yaw over pitch once yaw crosses its threshold", () => {
    expect(classifyHeadDirection(20, 20)).toBe(classifyHeadDirection(20, 0));
  });

  it("matches face-tracking-service.ts's positive-yaw-is-left convention", () => {
    expect(classifyHeadDirection(20, 0)).toBe("left");
    expect(classifyHeadDirection(-20, 0)).toBe("right");
  });

  it("falls back to pitch direction once yaw is centered", () => {
    expect(classifyHeadDirection(0, 15)).toBe("up");
    expect(classifyHeadDirection(0, -15)).toBe("down");
  });
});
