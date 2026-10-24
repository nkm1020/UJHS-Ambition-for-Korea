import type { PoseName } from "@/lib/types";

// Motion engine. Knows nothing about bodies: it turns a pose name plus a few
// live inputs (time, talk level, where to look) into joint angles. A body
// renderer (the stick figure today, the real avatar later) reads the joints
// every frame and applies them to its own bones.
//
// Conventions (radians, character faces +z, y up):
//   lean     > 0 bends the spine forward
//   headYaw  > 0 turns the head to its left; headPitch > 0 nods down
//   armX     < 0 raises the arm forward/up; armOut > 0 swings it outward
//   elbow    < 0 bends the forearm forward
//   hipX     < 0 swings the thigh forward; knee > 0 folds the shin back

export const SKELETON = {
  hipHeight: 0.9,
  spine: 0.56,
  head: 0.2,
  shoulderWidth: 0.17,
  upperArm: 0.3,
  forearm: 0.28,
  hipWidth: 0.1,
  thigh: 0.43,
  shin: 0.43,
  seatHeight: 0.46,
} as const;

export interface Joints {
  rootY: number;
  lean: number;
  headYaw: number;
  headPitch: number;
  armLX: number;
  armLOut: number;
  elbowL: number;
  armRX: number;
  armROut: number;
  elbowR: number;
  hipLX: number;
  hipRX: number;
  kneeL: number;
  kneeR: number;
}

export const REST: Joints = {
  rootY: 0,
  lean: 0,
  headYaw: 0,
  headPitch: 0,
  armLX: 0,
  armLOut: 0.12,
  elbowL: -0.08,
  armRX: 0,
  armROut: 0.12,
  elbowR: -0.08,
  hipLX: 0,
  hipRX: 0,
  kneeL: 0,
  kneeR: 0,
};

const SIT: Partial<Joints> = {
  rootY: SKELETON.seatHeight - SKELETON.hipHeight,
  hipLX: -1.52,
  hipRX: -1.52,
  kneeL: 1.52,
  kneeR: 1.52,
  armLX: -0.35,
  armRX: -0.35,
  elbowL: -0.55,
  elbowR: -0.55,
};

/** Pose presets. Add a line here and every body gets the new gesture. */
export const POSES: Record<PoseName, Partial<Joints>> = {
  idle: {},
  walk: {}, // limbs swing procedurally
  walkAway: {}, // same gait; the stage turns the body around and moves it out
  sit: SIT,
  sitTalk: { ...SIT, lean: 0.14, armLX: -0.75, armRX: -0.6, elbowL: -0.9, elbowR: -0.7, armLOut: 0.3, armROut: 0.3 },
  slump: { ...SIT, lean: 1.05, headPitch: 0.45, armLX: -1.45, armRX: -1.45, elbowL: -1.35, elbowR: -1.35, armLOut: 0.35, armROut: 0.35 },
  stare: { ...SIT, lean: 0.05 },
  startle: { ...SIT, rootY: SIT.rootY! + 0.08, lean: -0.32, headPitch: -0.2, armLX: -2.7, armRX: -2.7, armLOut: 0.55, armROut: 0.55, elbowL: -0.2, elbowR: -0.2 },
  coverMouth: { ...SIT, lean: 0.12, armRX: -2.15, armROut: -0.25, elbowR: -2.3, armLX: -0.3, elbowL: -0.5 },
  heart: { ...SIT, armLX: -2.85, armRX: -2.85, armLOut: -0.15, armROut: -0.15, elbowL: -1.2, elbowR: -1.2 },
  laugh: { ...SIT, lean: -0.38, headPitch: -0.35, armLX: -0.5, armRX: -0.5, armLOut: 0.5, armROut: 0.5, elbowL: -1.2, elbowR: -1.2 },
};

export interface MotionInput {
  pose: PoseName;
  time: number; // seconds, already offset per character
  dt: number;
  talk: number; // 0..1 mouth level
  lookYaw: number; // where the head should turn, radians
}

/** Advances `cur` toward the pose in place: damped joints plus procedural life. */
export function stepJoints(cur: Joints, input: MotionInput): Joints {
  const { pose, time: t, talk, lookYaw } = input;
  const dt = Math.min(input.dt, 0.05);
  const target: Joints = { ...REST, ...POSES[pose] };

  if (pose === "walk" || pose === "walkAway") {
    const s = Math.sin(t * 7);
    target.hipLX = s * 0.6;
    target.hipRX = -s * 0.6;
    target.kneeL = Math.max(0, s) * 0.8;
    target.kneeR = Math.max(0, -s) * 0.8;
    target.armLX = -s * 0.5;
    target.armRX = s * 0.5;
    target.rootY = Math.abs(Math.cos(t * 7)) * 0.03;
  }

  // breathing, and a talking bob that follows the voice
  target.lean += Math.sin(t * 1.7) * 0.012 + talk * 0.06 * Math.sin(t * 9);
  target.headPitch += talk * 0.08 * Math.sin(t * 11);
  if (pose !== "slump") target.headYaw = lookYaw;

  const k = 1 - Math.exp(-dt * 9); // ~300 ms crossfade between poses
  for (const key of Object.keys(target) as (keyof Joints)[]) {
    cur[key] += (target[key] - cur[key]) * k;
  }
  return cur;
}
