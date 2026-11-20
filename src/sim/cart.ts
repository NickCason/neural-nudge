/**
 * A two-wheeled cart with two light-sensing eyes, driven by a network.
 * The network's two inputs are the eyes (left, right) and its two outputs are the wheel
 * speeds (left, right). Everything here is plain arithmetic so a whole trip can be worked
 * out in advance and drawn as a path before the cart moves.
 */
import { predict } from '../engine/net';
import type { NetSpec } from '../engine/net';

export interface Pose {
  x: number;
  y: number;
  /** Heading in radians: 0 points right, a quarter turn points up. */
  a: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface DriveSpec {
  lamp: Point;
  starts: Pose[];
  seconds: number;
}

export type DriveGoal = 'arrive' | 'park';

export interface Frame {
  pose: Pose;
  eyes: [number, number];
  wheels: [number, number];
}

export interface Trip {
  frames: Frame[];
  /** The frame it reached the lamp on, or -1. Only set when the goal is to arrive. */
  arrived: number;
  crashed: 'wall' | 'lamp' | null;
  /** The nearest it ever got to the lamp. */
  closest: number;
  endDistance: number;
  /** How fast the faster wheel is still turning at the end. */
  endSpeed: number;
  met: boolean;
}

export const DT = 1 / 30;
/** Half the width of the floor. */
export const ARENA = 1.05;
/** Close enough to count as reaching the lamp. */
export const REACH = 0.12;
/** The parking ring round the lamp, and the lamp itself. */
export const RING = 0.34;
export const LAMP = 0.07;
/** A wheel turning slower than this counts as stopped. */
export const STILL = 0.05;

/** Each eye looks this far to its own side of straight ahead. */
export const EYE_ANGLE = 0.7;
const TRACK = 0.16; // distance between the wheels
const SPEED = 0.55; // floor covered per second at wheel speed 1
const FALLOFF = 0.5; // distance at which a lamp looks half as bright

/**
 * What each eye reports: brighter when the lamp is nearer and more directly in front of it.
 * Both eyes are treated as sitting at the middle of the cart, each looking off to its own side,
 * so brightness always rises on the way in. That is what lets a cart learn to stop by it.
 */
export function sense(pose: Pose, lamp: Point): [number, number] {
  const dx = lamp.x - pose.x;
  const dy = lamp.y - pose.y;
  const d = Math.hypot(dx, dy) || 1e-9;
  const near = 1 / (1 + (d / FALLOFF) ** 2);
  const out: [number, number] = [0, 0];
  [1, -1].forEach((side, k) => {
    const dir = pose.a + side * EYE_ANGLE;
    const facing = (dx * Math.cos(dir) + dy * Math.sin(dir)) / d;
    out[k] = Math.max(0, facing) * near;
  });
  return out;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Drive from one starting pose for the whole time allowed, and report how it went. */
export function trip(spec: NetSpec, params: ArrayLike<number>, drive: DriveSpec, start: Pose, goal: DriveGoal): Trip {
  const frames: Frame[] = [];
  const steps = Math.round(drive.seconds / DT);
  let pose = { ...start };
  let arrived = -1;
  let crashed: Trip['crashed'] = null;
  let closest = Infinity;

  for (let i = 0; i <= steps; i++) {
    const eyes = sense(pose, drive.lamp);
    const raw = predict(spec, params, eyes);
    const wheels: [number, number] = [clamp(raw[0], -1, 1.5), clamp(raw[1], -1, 1.5)];
    frames.push({ pose, eyes, wheels });

    const distance = Math.hypot(pose.x - drive.lamp.x, pose.y - drive.lamp.y);
    closest = Math.min(closest, distance);
    if (goal === 'arrive' && distance < REACH) {
      arrived = i;
      break;
    }
    if (goal === 'park' && distance < LAMP) {
      crashed = 'lamp';
      break;
    }
    if (Math.abs(pose.x) > ARENA || Math.abs(pose.y) > ARENA) {
      crashed = 'wall';
      break;
    }

    const forward = ((wheels[0] + wheels[1]) / 2) * SPEED;
    const turn = ((wheels[1] - wheels[0]) / TRACK) * SPEED;
    const a = pose.a + turn * DT;
    pose = { x: pose.x + Math.cos(a) * forward * DT, y: pose.y + Math.sin(a) * forward * DT, a };
  }

  const last = frames[frames.length - 1];
  const endDistance = Math.hypot(last.pose.x - drive.lamp.x, last.pose.y - drive.lamp.y);
  const endSpeed = Math.max(Math.abs(last.wheels[0]), Math.abs(last.wheels[1]));
  const met =
    goal === 'arrive' ? arrived >= 0 : crashed === null && endDistance < RING && endSpeed < STILL;
  return { frames, arrived, crashed, closest, endDistance, endSpeed, met };
}

/** One trip per starting pose. */
export function trips(spec: NetSpec, params: ArrayLike<number>, drive: DriveSpec, goal: DriveGoal): Trip[] {
  return drive.starts.map((start) => trip(spec, params, drive, start, goal));
}
