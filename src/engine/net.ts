/**
 * A small fully-connected network where every number is addressable.
 *
 * Parameters live in one flat array. For each layer, for each neuron: one weight per
 * input, then the bias. `paramLayout` says what each slot means, so the UI can draw a
 * dial for it and the player can read or change it.
 */

export type Activation = 'linear' | 'tanh' | 'sigmoid' | 'relu';
export type LossKind = 'mse' | 'bce';

export interface LayerSpec {
  size: number;
  act: Activation;
}

export interface NetSpec {
  inputs: number;
  layers: LayerSpec[];
}

export interface Sample {
  x: number[];
  y: number[];
}

export interface ParamInfo {
  index: number;
  kind: 'weight' | 'bias';
  /** Index into spec.layers of the neuron this parameter belongs to. */
  layer: number;
  neuron: number;
  /** Which input of that neuron a weight multiplies. -1 for a bias. */
  from: number;
}

export interface Trace {
  /** a[0] is the input; a[l + 1] is the output of layer l. */
  a: number[][];
  /** z[l] is the weighted sum inside each neuron of layer l, before its activation. */
  z: number[][];
}

export interface Evaluation {
  loss: number;
  /** d(loss)/d(param), same order as the parameter array. */
  grad: number[];
}

const EPS = 1e-7;

export function activate(act: Activation, z: number): number {
  switch (act) {
    case 'linear':
      return z;
    case 'tanh':
      return Math.tanh(z);
    case 'sigmoid':
      return 1 / (1 + Math.exp(-z));
    case 'relu':
      return z > 0 ? z : 0;
  }
}

/** Derivative of the activation, given both the sum z and the output a it produced. */
function slope(act: Activation, z: number, a: number): number {
  switch (act) {
    case 'linear':
      return 1;
    case 'tanh':
      return 1 - a * a;
    case 'sigmoid':
      return a * (1 - a);
    case 'relu':
      return z > 0 ? 1 : 0;
  }
}

export function paramCount(spec: NetSpec): number {
  let n = 0;
  let fanIn = spec.inputs;
  for (const layer of spec.layers) {
    n += layer.size * (fanIn + 1);
    fanIn = layer.size;
  }
  return n;
}

export function paramLayout(spec: NetSpec): ParamInfo[] {
  const out: ParamInfo[] = [];
  let fanIn = spec.inputs;
  spec.layers.forEach((layer, l) => {
    for (let j = 0; j < layer.size; j++) {
      for (let i = 0; i < fanIn; i++) {
        out.push({ index: out.length, kind: 'weight', layer: l, neuron: j, from: i });
      }
      out.push({ index: out.length, kind: 'bias', layer: l, neuron: j, from: -1 });
    }
    fanIn = layer.size;
  });
  return out;
}

/** Run one input through the network, keeping every intermediate value. */
export function trace(spec: NetSpec, params: ArrayLike<number>, x: number[]): Trace {
  const a: number[][] = [x.slice()];
  const z: number[][] = [];
  let k = 0;
  for (const layer of spec.layers) {
    const prev = a[a.length - 1];
    const zl = new Array<number>(layer.size);
    const al = new Array<number>(layer.size);
    for (let j = 0; j < layer.size; j++) {
      let sum = 0;
      for (let i = 0; i < prev.length; i++) sum += params[k++] * prev[i];
      sum += params[k++];
      zl[j] = sum;
      al[j] = activate(layer.act, sum);
    }
    z.push(zl);
    a.push(al);
  }
  return { a, z };
}

export function predict(spec: NetSpec, params: ArrayLike<number>, x: number[]): number[] {
  const t = trace(spec, params, x);
  return t.a[t.a.length - 1];
}

/**
 * Average loss over the data and its gradient with respect to every parameter.
 * 'mse' is squared error. 'bce' is cross-entropy and expects outputs in (0, 1),
 * so use it with a sigmoid output layer.
 */
export function evaluate(
  spec: NetSpec,
  params: ArrayLike<number>,
  data: Sample[],
  kind: LossKind,
): Evaluation {
  const n = paramCount(spec);
  const grad = new Array<number>(n).fill(0);
  let loss = 0;

  // Where each layer's parameters start in the flat array.
  const offsets: number[] = [];
  let off = 0;
  let fanIn = spec.inputs;
  for (const layer of spec.layers) {
    offsets.push(off);
    off += layer.size * (fanIn + 1);
    fanIn = layer.size;
  }

  for (const sample of data) {
    const t = trace(spec, params, sample.x);
    const out = t.a[t.a.length - 1];

    // d(loss)/d(output)
    let da = new Array<number>(out.length);
    for (let j = 0; j < out.length; j++) {
      const y = sample.y[j];
      if (kind === 'mse') {
        const d = out[j] - y;
        loss += d * d;
        da[j] = 2 * d;
      } else {
        const o = Math.min(1 - EPS, Math.max(EPS, out[j]));
        loss += -(y * Math.log(o) + (1 - y) * Math.log(1 - o));
        da[j] = (o - y) / (o * (1 - o));
      }
    }

    // Walk backwards, handing each neuron its share of the blame.
    for (let l = spec.layers.length - 1; l >= 0; l--) {
      const layer = spec.layers[l];
      const prev = t.a[l];
      const daPrev = new Array<number>(prev.length).fill(0);
      const width = prev.length + 1;
      for (let j = 0; j < layer.size; j++) {
        const dz = da[j] * slope(layer.act, t.z[l][j], t.a[l + 1][j]);
        const base = offsets[l] + j * width;
        for (let i = 0; i < prev.length; i++) {
          grad[base + i] += dz * prev[i];
          daPrev[i] += dz * params[base + i];
        }
        grad[base + prev.length] += dz;
      }
      da = daPrev;
    }
  }

  const scale = 1 / Math.max(1, data.length);
  for (let i = 0; i < n; i++) grad[i] *= scale;
  return { loss: loss * scale, grad };
}

/** How many samples land on the right side of 0.5. Only meaningful for 0/1 targets. */
export function countCorrect(spec: NetSpec, params: ArrayLike<number>, data: Sample[]): number {
  let right = 0;
  for (const s of data) {
    const out = predict(spec, params, s.x)[0];
    if (out > 0.5 === s.y[0] > 0.5) right++;
  }
  return right;
}
