import type { NetSpec, ParamInfo } from '../engine/net';
import { sub } from './format';

export function inputName(spec: NetSpec, i: number): string {
  return spec.inputs === 1 ? 'x' : `x${sub(i + 1)}`;
}

/** What to call a neuron in a sentence. */
export function neuronName(spec: NetSpec, layer: number, neuron: number): string {
  if (layer === spec.layers.length - 1) return spec.layers.length === 1 ? 'the neuron' : 'the output neuron';
  return `hidden neuron ${neuron + 1}`;
}

/** What feeds input `from` of a neuron in `layer`. */
export function sourceName(spec: NetSpec, layer: number, from: number): string {
  return layer === 0 ? inputName(spec, from) : neuronName(spec, layer - 1, from);
}

/** Short label drawn next to a dial. */
export function paramLabel(spec: NetSpec, p: ParamInfo): string {
  if (p.kind === 'bias') return 'b';
  const fanIn = p.layer === 0 ? spec.inputs : spec.layers[p.layer - 1].size;
  return fanIn === 1 ? 'w' : `w${sub(p.from + 1)}`;
}

export function paramTitle(spec: NetSpec, p: ParamInfo): string {
  if (p.kind === 'bias') return `Bias of ${neuronName(spec, p.layer, p.neuron)}`;
  return `Weight from ${sourceName(spec, p.layer, p.from)} into ${neuronName(spec, p.layer, p.neuron)}`;
}

export function paramExplain(spec: NetSpec, p: ParamInfo): string {
  if (p.kind === 'bias') {
    return `Added to the sum inside ${neuronName(spec, p.layer, p.neuron)}, whatever the inputs are.`;
  }
  return `Multiplies ${sourceName(spec, p.layer, p.from)} on its way into ${neuronName(spec, p.layer, p.neuron)}.`;
}
