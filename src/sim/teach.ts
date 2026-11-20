/**
 * Driving the cart by hand, and keeping what was done as examples to train on.
 * An example is one moment of a drive: what the eyes saw, and what the driver did with the wheels.
 */
import type { Sample } from '../engine/net';
import { ARENA, REACH, advance, sense } from './cart';
import type { Frame, Point, Pose } from './cart';

/** 1 steers left, -1 steers right, 0 goes straight. */
export type Steer = -1 | 0 | 1;

/** Wheel speeds under a driver's hands: both wheels cruise, and the inside wheel slows to turn. */
export const CRUISE = 0.7;
export const SLOW = 0.2;
/** One frame in this many is kept as an example. */
export const EVERY = 3;
/** A drive that takes longer than this is abandoned. */
export const PATIENCE = 20;

export function wheelsFor(steer: Steer): [number, number] {
  if (steer > 0) return [SLOW, CRUISE];
  if (steer < 0) return [CRUISE, SLOW];
  return [CRUISE, CRUISE];
}

/** A finished drive that reached the lamp. */
export interface Drive {
  /** Which starting place it was driven from. */
  start: number;
  path: Point[];
  samples: Sample[];
}

export type DriveEnd = 'lamp' | 'wall' | null;

/** The frame for this moment of a drive by hand. */
export function handFrame(pose: Pose, lamp: Point, steer: Steer): Frame {
  return { pose, eyes: sense(pose, lamp), wheels: wheelsFor(steer) };
}

/** Whether a drive is over at this pose, and how. */
export function ended(pose: Pose, lamp: Point): DriveEnd {
  if (Math.hypot(pose.x - lamp.x, pose.y - lamp.y) < REACH) return 'lamp';
  if (Math.abs(pose.x) > ARENA || Math.abs(pose.y) > ARENA) return 'wall';
  return null;
}

/** Turn the frames of a drive into the record kept of it. */
export function keep(start: number, frames: Frame[]): Drive {
  return {
    start,
    path: frames.map((f) => ({ x: f.pose.x, y: f.pose.y })),
    samples: frames.filter((_, i) => i % EVERY === 0).map((f) => ({ x: [...f.eyes], y: [...f.wheels] })),
  };
}

/**
 * Drive a whole trip with a rule for steering, as a stand-in for a person in tests.
 * Returns null if it never reaches the lamp.
 */
export function driveWith(start: number, from: Pose, lamp: Point, steer: (pose: Pose, frame: number) => Steer): Drive | null {
  const frames: Frame[] = [];
  let pose = { ...from };
  for (let i = 0; i < PATIENCE * 30; i++) {
    const end = ended(pose, lamp);
    if (end === 'lamp') return keep(start, frames);
    if (end === 'wall') return null;
    const frame = handFrame(pose, lamp, steer(pose, i));
    frames.push(frame);
    pose = advance(pose, frame.wheels);
  }
  return null;
}
