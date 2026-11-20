import { countCorrect, evaluate, paramLayout } from './engine/net';
import type { ParamInfo } from './engine/net';
import { levels } from './levels';
import type { Level, Tools } from './levels/types';
import { descend, freshParams, goalMet, seedFor, specFor } from './play';
import { DT, trips } from './sim/cart';
import type { Frame, Trip } from './sim/cart';

const STORE_KEY = 'nudge.done.v1';
const NO_TOOLS: Tools = {
  drag: false,
  hints: false,
  nudge: false,
  step: false,
  run: false,
  rate: false,
  shuffle: false,
  grow: false,
  lines: false,
  go: false,
};

/** How far a dial can be turned by hand. Training may take values past this. */
export const DIAL_LIMIT = 6;

function loadDone(): string[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

class Game {
  index = $state(0);
  params = $state<number[]>([]);
  hiddenSize = $state(0);
  rate = $state(0.1);
  steps = $state(0);
  /** Hand edits and steps together: how much the player has tried. */
  effort = $state(0);
  /** Loss after each step, for the sparkline. */
  history = $state<number[]>([]);
  /** Where the machine has been on the hill. */
  trail = $state<[number, number][]>([]);
  running = $state(false);
  diverged = $state(false);
  solved = $state(false);
  /** Parameter the inspector is showing. */
  selected = $state<number | null>(null);
  /** Sample being sent through the network for inspection. */
  probe = $state<number | null>(null);
  /** Neuron whose answer the plane is showing; null means the output. */
  focus = $state<{ layer: number; neuron: number } | null>(null);
  /** Dots to pick out on the plot, as when a row of the groups table is pointed at. */
  spotlight = $state<number[] | null>(null);
  /** Hidden neuron being pointed at, so its line and its circle can light up together. */
  hover = $state<number | null>(null);
  /** The cart is being driven along the trips worked out for it. */
  driving = $state(false);
  /** How far through the trip the cart is, in frames. */
  clock = $state(0);
  /** The last run finished without meeting the goal. */
  fellShort = $state(false);
  done = $state<string[]>(loadDone());
  unlockAll = $state(false);

  #shuffles = 0;
  #startLoss = 0;
  #frame = 0;
  #driveFrame = 0;
  #last = 0;
  #owed = 0;

  readonly levels = levels;
  level: Level = $derived(levels[this.index]);
  tools: Tools = $derived({ ...NO_TOOLS, ...this.level.tools });
  spec = $derived(specFor(this.level, this.hiddenSize));
  layout: ParamInfo[] = $derived(paramLayout(this.spec));
  /** Parameters that exist but are fixed and not drawn. Only applies before the network grows. */
  frozen: number[] = $derived(this.level.grow ? (this.hiddenSize === 0 ? (this.level.hidden ?? []) : []) : (this.level.hidden ?? []));
  /** Parameters that are drawn but can't be changed, by hand or by training. */
  locked: number[] = $derived(this.level.grow ? [] : (this.level.locked ?? []));
  /** Everything training has to leave alone. */
  fixed: number[] = $derived([...this.frozen, ...this.locked]);
  evaluation = $derived(evaluate(this.spec, this.params, this.level.data, this.level.loss));
  loss = $derived(this.evaluation.loss);
  correct = $derived(countCorrect(this.spec, this.params, this.level.data));
  /** Where the cart will go from each starting place, with the dials as they are. */
  trips: Trip[] = $derived.by(() => {
    const level = this.level;
    if (!level.drive) return [];
    return trips(this.spec, this.params, level.drive, level.goal.kind === 'park' ? 'park' : 'arrive');
  });
  driveMet = $derived(this.trips.length > 0 && this.trips.every((t) => t.met));
  /** What the cart's eyes and wheels are doing at this moment of the first trip. */
  live: Frame | null = $derived.by(() => {
    const first = this.trips[0];
    return first ? first.frames[Math.min(this.clock, first.frames.length - 1)] : null;
  });
  outOfSteps = $derived(
    !this.solved && this.level.stepBudget !== undefined && this.steps >= this.level.stepBudget,
  );
  /** Solving a level doesn't lock it: you can keep training and watch the loss keep falling. */
  canStep = $derived(!this.outOfSteps && !this.diverged);
  /** The step budget ran out with the loss higher than it started: the steps were too big. */
  overshot = $derived(this.diverged || (this.outOfSteps && this.loss > this.#startLoss));
  isLast = $derived(this.index === levels.length - 1);

  constructor() {
    this.load(0);
  }

  isUnlocked(i: number): boolean {
    if (this.unlockAll || i === 0) return true;
    return this.done.includes(levels[i - 1].id);
  }

  go(i: number) {
    if (i < 0 || i >= levels.length || !this.isUnlocked(i)) return;
    this.load(i);
  }

  next() {
    this.go(this.index + 1);
  }

  /** Put the current level back to how it started. */
  reset() {
    this.load(this.index);
  }

  private load(i: number) {
    this.stop();
    const level = levels[i];
    this.index = i;
    this.hiddenSize = level.grow?.start ?? 0;
    this.params =
      this.hiddenSize > 0
        ? freshParams(specFor(level, this.hiddenSize), seedFor(level, this.hiddenSize, 0))
        : level.start.slice();
    this.rate = level.rate?.value ?? 0.1;
    this.steps = 0;
    this.effort = 0;
    this.history = [];
    this.diverged = false;
    this.solved = false;
    this.selected = null;
    this.probe = null;
    this.focus = null;
    this.hover = null;
    this.spotlight = null;
    this.park();
    this.#shuffles = 0;
    this.trail = level.hill ? [[level.start[level.hill.x], level.start[level.hill.y]]] : [];
    this.#startLoss = evaluate(specFor(level, this.hiddenSize), this.params, level.data, level.loss).loss;
  }

  /** Turn one dial by hand. */
  setParam(i: number, value: number) {
    if (!this.tools.drag || this.fixed.includes(i) || !Number.isFinite(value)) return;
    const clamped = Math.max(-DIAL_LIMIT, Math.min(DIAL_LIMIT, value));
    if (clamped === this.params[i]) return;
    this.params[i] = clamped;
    this.diverged = false;
    this.effort++;
    this.changed();
  }

  /** Nudge one dial by a small amount, as the arrows on a dial do. */
  turn(i: number, delta: number) {
    this.setParam(i, Math.round((this.params[i] + delta) * 100) / 100);
  }

  /** Set several dials together, as when a line is dragged and its weights and bias all change. */
  setParams(changes: [number, number][]) {
    if (!this.tools.lines && !this.tools.drag) return;
    let moved = false;
    for (const [i, value] of changes) {
      if (this.fixed.includes(i) || !Number.isFinite(value)) continue;
      const clamped = Math.max(-DIAL_LIMIT, Math.min(DIAL_LIMIT, value));
      if (clamped !== this.params[i]) {
        this.params[i] = clamped;
        moved = true;
      }
    }
    if (!moved) return;
    this.diverged = false;
    this.effort++;
    this.changed();
  }

  /** Move one dial a single step downhill. */
  nudge(i: number) {
    if (!this.tools.nudge || this.fixed.includes(i)) return;
    this.params[i] -= (this.level.nudgeRate ?? 0.3) * this.evaluation.grad[i];
    this.steps++;
    this.effort++;
    this.history.push(this.loss);
    this.changed();
  }

  /** Move every dial one step downhill. */
  step() {
    if (!this.tools.step || !this.canStep) return;
    this.params = descend(this.params, this.evaluation.grad, this.rate, this.fixed);
    this.steps++;
    this.effort++;
    const loss = this.loss;
    if (!Number.isFinite(loss) || loss > 1e6 || this.params.some((p) => !Number.isFinite(p))) {
      this.diverged = true;
      this.stop();
    }
    this.history.push(Number.isFinite(loss) ? loss : 1e6);
    if (this.history.length > 600) this.history.splice(0, this.history.length - 600);
    this.changed();
  }

  /** Set the cart off along its trips, or stop it and put it back. */
  setOff() {
    if (!this.tools.go) return;
    if (this.driving) {
      this.park();
      return;
    }
    const frames = Math.max(...this.trips.map((t) => t.frames.length));
    this.clock = 0;
    this.fellShort = false;
    this.driving = true;
    this.effort++;
    const began = performance.now();
    const tick = (now: number) => {
      if (!this.driving) return;
      // The first frame can be stamped a hair before the press, so never count backwards.
      this.clock = Math.max(0, Math.min(frames - 1, Math.floor((now - began) / 1000 / DT)));
      if (this.clock >= frames - 1) {
        this.driving = false;
        if (this.driveMet) this.win();
        else this.fellShort = true;
        return;
      }
      this.#driveFrame = requestAnimationFrame(tick);
    };
    this.#driveFrame = requestAnimationFrame(tick);
  }

  /** Put the cart back at its starting place. */
  private park() {
    cancelAnimationFrame(this.#driveFrame);
    this.driving = false;
    this.clock = 0;
    this.fellShort = false;
  }

  toggleRun() {
    if (this.running) this.stop();
    else this.start();
  }

  private start() {
    if (!this.tools.run || !this.canStep) return;
    this.running = true;
    this.#last = performance.now();
    this.#owed = 1; // take the first step right away
    const tick = (now: number) => {
      if (!this.running) return;
      const speed = this.level.runSpeed ?? 10;
      this.#owed += ((now - this.#last) / 1000) * speed;
      this.#last = now;
      let burst = Math.min(Math.floor(this.#owed), 8);
      this.#owed -= burst;
      if (this.#owed > 8) this.#owed = 0;
      while (burst-- > 0 && this.running) {
        this.step();
        if (!this.canStep) this.stop();
      }
      if (this.running) this.#frame = requestAnimationFrame(tick);
    };
    this.#frame = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.#frame);
  }

  /** Give every dial a fresh random value. */
  shuffle() {
    if (!this.tools.shuffle) return;
    this.stop();
    this.#shuffles++;
    this.reseed();
  }

  setHidden(count: number) {
    const grow = this.level.grow;
    if (!this.tools.grow || !grow) return;
    const next = Math.max(0, Math.min(grow.max, count));
    if (next === this.hiddenSize) return;
    this.stop();
    this.hiddenSize = next;
    this.reseed();
  }

  private reseed() {
    this.params =
      this.hiddenSize === 0 && this.#shuffles === 0
        ? this.level.start.slice()
        : freshParams(this.spec, seedFor(this.level, this.hiddenSize, this.#shuffles));
    this.steps = 0;
    this.history = [];
    this.diverged = false;
    this.selected = null;
    this.focus = null;
    this.hover = null;
    this.effort++;
    this.changed();
  }

  /** The player's answer to a level whose goal can't be met. */
  callImpossible() {
    if (this.level.goal.kind !== 'impossible' || this.solved) return;
    this.win();
  }

  private changed() {
    // A cart mid-run goes back to the start: the path it was following no longer exists.
    if (this.level.drive && (this.driving || this.clock > 0)) this.park();
    const hill = this.level.hill;
    if (hill && this.hiddenSize === 0) {
      const point: [number, number] = [this.params[hill.x], this.params[hill.y]];
      const last = this.trail[this.trail.length - 1];
      if (!last || Math.hypot(point[0] - last[0], point[1] - last[1]) > 0.02) {
        this.trail.push(point);
        if (this.trail.length > 400) this.trail.splice(0, this.trail.length - 400);
      }
    }
    if (!this.solved && goalMet(this.level, this.loss, this.correct)) this.win();
  }

  private win() {
    this.solved = true;
    this.stop();
    if (!this.done.includes(this.level.id)) {
      this.done.push(this.level.id);
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(this.done));
      } catch {
        // Private browsing: progress just won't persist.
      }
    }
  }
}

export const game = new Game();
