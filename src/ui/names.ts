import type { NetSpec, ParamInfo } from '../engine/net';
import { sub } from './format';

/** What a level calls its inputs and outputs when they are parts of a machine. */
export interface Parts {
  inputs: string[];
  outputs: string[];
}

export function inputName(spec: NetSpec, i: number, parts?: Parts): string {
  if (parts) return `the ${parts.inputs[i]}`;
  return spec.inputs === 1 ? 'x' : `x${sub(i + 1)}`;
}

/** What to call a neuron in a sentence. */
export function neuronName(spec: NetSpec, layer: number, neuron: number, parts?: Parts): string {
  if (parts && layer === spec.layers.length - 1) return `the ${parts.outputs[neuron]} neuron`;
  if (layer === spec.layers.length - 1) return spec.layers.length === 1 ? 'the neuron' : 'the output neuron';
  return `hidden neuron ${neuron + 1}`;
}

/** What feeds input `from` of a neuron in `layer`. */
export function sourceName(spec: NetSpec, layer: number, from: number, parts?: Parts): string {
  return layer === 0 ? inputName(spec, from, parts) : neuronName(spec, layer - 1, from);
}

/** Short label drawn next to a dial. */
export function paramLabel(spec: NetSpec, p: ParamInfo): string {
  if (p.kind === 'bias') return 'b';
  const fanIn = p.layer === 0 ? spec.inputs : spec.layers[p.layer - 1].size;
  return fanIn === 1 ? 'w' : `w${sub(p.from + 1)}`;
}

export function paramTitle(spec: NetSpec, p: ParamInfo, parts?: Parts): string {
  if (p.kind === 'bias') return `Bias of ${neuronName(spec, p.layer, p.neuron, parts)}`;
  return `Weight from ${sourceName(spec, p.layer, p.from, parts)} into ${neuronName(spec, p.layer, p.neuron, parts)}`;
}

export function paramExplain(spec: NetSpec, p: ParamInfo, parts?: Parts): string {
  if (p.kind === 'bias') {
    return `Added to the sum inside ${neuronName(spec, p.layer, p.neuron, parts)}, whatever the inputs are.`;
  }
  const source = sourceName(spec, p.layer, p.from, parts);
  const target = neuronName(spec, p.layer, p.neuron, parts);
  return parts
    ? `Multiplies what ${source} reports on its way into ${target}.`
    : `Multiplies ${source} on its way into ${target}.`;
}
