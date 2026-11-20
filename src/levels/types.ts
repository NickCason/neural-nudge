import type { Activation, LossKind, NetSpec, Sample } from '../engine/net';
import type { DriveSpec } from '../sim/cart';

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
  /** Drag the hidden neurons' lines around on the plot. */
  lines: boolean;
  /** Set the cart driving. */
  go: boolean;
}

export type ToolName = keyof Tools;

export type Goal =
  | { kind: 'loss'; below: number }
  | { kind: 'allCorrect' }
  /** Can't be met. The player wins by saying so. */
  | { kind: 'impossible' }
  /** The cart reaches the lamp from every starting place. */
  | { kind: 'arrive' }
  /** The cart comes to rest inside the ring round the lamp. */
  | { kind: 'park' };

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
  /** Parameters drawn but held fixed: you can read them, not change them, and training skips them. */
  locked?: number[];
  data: Sample[];

  /** 'line': one input against one output. 'plane': two inputs, coloured by output. 'drive': a cart on a floor. */
  view: 'line' | 'plane' | 'drive';
  /** The floor, the lamp and the starting places, for levels where the network drives a cart. */
  drive?: DriveSpec;
  /** What to call the inputs and outputs when they are parts of a machine rather than numbers. */
  names?: { inputs: string[]; outputs: string[] };
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
  /** Let the player add hidden neurons. `start` is how many there are to begin with. */
  grow?: { max: number; act: Activation; start?: number };
  /** Base for the random starting dials, chosen so the first run of a level behaves. */
  seed?: number;
  /** Extra views of what the hidden neurons are doing. */
  show?: {
    /** Draw each hidden neuron's line on the plot. */
    lines?: boolean;
    /** List the groups the hidden lines cut the dots into, and what the output neuron makes of each. */
    tally?: boolean;
  };
}
