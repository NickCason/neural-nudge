import type { Activation, LossKind, NetSpec, Sample } from '../engine/net';

export interface Tools {
  /** Turn dials directly. */
  drag: boolean;
  /** Show the slope under each dial. */
  hints: boolean;
  /** Click a dial's arrow to move just that dial one step downhill. */
  nudge: boolean;
  /** Move every dial one step downhill at once. */
  step: boolean;
  run: boolean;
  /** Learning-rate slider. */
  rate: boolean;
  /** Give every dial a fresh random value. */
  shuffle: boolean;
  /** Add or remove hidden neurons. */
  grow: boolean;
}

export type ToolName = keyof Tools;

export type Goal =
  | { kind: 'loss'; below: number }
  | { kind: 'allCorrect' }
  /** Can't be met. The player wins by saying so. */
  | { kind: 'impossible' };

export interface Level {
  id: string;
  title: string;
  /** Lesson paragraphs. */
  text: string[];
  goalText: string;
  winText: string;

  spec: NetSpec;
  loss: LossKind;
  /** Starting parameter values, in engine order. */
  start: number[];
  /** Parameters held fixed and not drawn. */
  hidden?: number[];
  data: Sample[];

  /** 'line': one input against one output. 'plane': two inputs, coloured by output. */
  view: 'line' | 'plane';
  /** Draw the loss as a landscape over two parameters. */
  hill?: { x: number; y: number; range: number };

  goal: Goal;
  tools: Partial<Tools>;
  /** Tools appearing for the first time, so the tray can point them out. */
  fresh?: ToolName[];
  rate?: { value: number; min: number; max: number };
  /** Step size used by single-dial nudges. */
  nudgeRate?: number;
  stepBudget?: number;
  /** Steps per second while running. */
  runSpeed?: number;
  /** What this level calls the number being minimised. */
  errorName: 'error' | 'loss';
  grow?: { max: number; act: Activation };
}
