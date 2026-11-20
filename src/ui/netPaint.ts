/**
 * Paints the luminous layer of the network: glowing wires, signal flowing forward along them,
 * blame flowing backward while training, and a live picture inside each neuron of what it computes.
 * The dials, labels and hit targets sit on top of this in SVG.
 */
import { INK, signInk } from './format';
import type { RGB } from './format';

export interface WirePaint {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  value: number;
  kind: 'weight' | 'bias';
  /** This parameter's share of the gradient, 0..1. */
  blame: number;
  /** How much signal the wire carries for the inspected sample, or null when nothing is inspected. */
  carried: number | null;
  seed: number;
}

export interface NeuronPaint {
  x: number;
  y: number;
  r: number;
  /** A small image of the neuron's answer across the input plane. */
  thumb: CanvasImageSource | null;
  /** The neuron's output across a range of single inputs, each -1..1 of the circle's height. */
  curve: number[] | null;
  /** Output for the inspected sample, -1..1, or null. */
  value: number | null;
}

export interface Scene {
  /** Pixels per drawing unit. */
  scale: number;
  width: number;
  height: number;
  time: number;
  motion: boolean;
  compact: boolean;
  wires: WirePaint[];
  inputs: { x: number; y: number; r: number }[];
  neurons: NeuronPaint[];
  /** One for each thing leaving the network. */
  outs: { x: number; y: number; length: number }[];
  /** 0..1: how hard the network is being trained right now. */
  training: number;
}

const rgba = (c: RGB, a: number) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const frac = (v: number) => v - Math.floor(v);

function glowLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, ink: RGB, width: number, alpha: number) {
  ctx.lineCap = 'round';
  const passes: [number, number][] = [
    [width * 3.2 + 12, 0.045],
    [width * 2 + 6, 0.09],
    [width + 2.5, 0.2],
    [width, 0.95],
  ];
  for (const [w, a] of passes) {
    ctx.strokeStyle = rgba(ink, a * alpha);
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}

function spark(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, ink: RGB, alpha: number) {
  const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 3.4);
  halo.addColorStop(0, rgba(ink, 0.55 * alpha));
  halo.addColorStop(1, rgba(ink, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, r * 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255,255,255,${0.9 * alpha})`;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.62, 0, Math.PI * 2);
  ctx.fill();
}

export function paint(ctx: CanvasRenderingContext2D, scene: Scene) {
  const { scale, time } = scene;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, scene.width, scene.height);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.globalCompositeOperation = 'lighter';

  // wires
  for (const w of scene.wires) {
    const ink = signInk(w.value);
    const m = Math.min(Math.abs(w.value), 3) / 3;
    if (w.kind === 'bias') {
      glowLine(ctx, w.x1, w.y1, w.x2, w.y2, ink, scene.compact ? 1.2 : 1.8, 0.75);
      continue;
    }
    const width = scene.compact ? 1 + m * 3.6 : 1.4 + m * 6;
    glowLine(ctx, w.x1, w.y1, w.x2, w.y2, ink, width, 0.3 + 0.7 * Math.min(1, Math.abs(w.value)));
  }

  // what leaves the network
  for (const o of scene.outs) {
    glowLine(ctx, o.x, o.y, o.x + o.length, o.y, INK.chalk, 1.6, 0.55);
    glowLine(ctx, o.x + o.length - 8, o.y - 6, o.x + o.length, o.y, INK.chalk, 1.6, 0.55);
    glowLine(ctx, o.x + o.length - 8, o.y + 6, o.x + o.length, o.y, INK.chalk, 1.6, 0.55);
  }

  if (scene.motion) {
    // signal flowing forward: more of it, and faster, down the heavier wires
    for (const w of scene.wires) {
      if (w.kind === 'bias' || Math.abs(w.value) < 0.02) continue;
      const m = Math.min(Math.abs(w.value), 3) / 3;
      const count = 2 + Math.round(m * 4);
      const speed = 0.16 + 0.34 * m;
      const ink = signInk(w.value);
      const size = (scene.compact ? 1.5 : 2.1) + m * (scene.compact ? 1.3 : 2);
      const presence = w.carried === null ? 1 : Math.min(1, 0.2 + Math.abs(w.carried));
      for (let k = 0; k < count; k++) {
        const t = frac(time * speed + k / count + w.seed);
        const fade = Math.sin(Math.PI * t);
        spark(ctx, w.x1 + (w.x2 - w.x1) * t, w.y1 + (w.y2 - w.y1) * t, size, ink, fade * presence);
      }
    }
    for (const o of scene.outs) {
      for (let k = 0; k < 2; k++) {
        const t = frac(time * 0.5 + k / 2);
        spark(ctx, o.x + o.length * t, o.y, 1.8, INK.chalk, Math.sin(Math.PI * t) * 0.8);
      }
    }

    // blame flowing backward while training: brightest on the dials that matter most
    if (scene.training > 0.01) {
      for (const w of scene.wires) {
        if (w.kind === 'bias') continue;
        const strength = scene.training * (0.2 + 0.8 * w.blame);
        for (let k = 0; k < 3; k++) {
          const t = 1 - frac(time * 0.95 + k / 3 + w.seed * 1.7);
          const fade = Math.sin(Math.PI * t);
          spark(ctx, w.x1 + (w.x2 - w.x1) * t, w.y1 + (w.y2 - w.y1) * t, scene.compact ? 1.8 : 2.6, INK.sky, fade * strength);
        }
      }
      for (const o of scene.outs) {
        for (let k = 0; k < 2; k++) {
          const t = 1 - frac(time * 0.95 + k / 2);
          spark(ctx, o.x + o.length * t, o.y, 2.2, INK.sky, Math.sin(Math.PI * t) * scene.training);
        }
      }
    }
  }

  ctx.globalCompositeOperation = 'source-over';

  // inputs: dark wells the signal comes out of
  for (const n of scene.inputs) {
    ctx.fillStyle = rgba(INK.deep, 1);
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // neurons
  for (const n of scene.neurons) {
    // soft halo
    const lit = n.value === null ? INK.chalk : n.value >= 0 ? INK.sun : INK.rose;
    const reach = n.value === null ? 0.16 : 0.18 + 0.4 * Math.min(1, Math.abs(n.value));
    const halo = ctx.createRadialGradient(n.x, n.y, n.r * 0.8, n.x, n.y, n.r * 2.1);
    halo.addColorStop(0, rgba(lit, reach));
    halo.addColorStop(1, rgba(lit, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r * 2.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = rgba(INK.deep, 1);
    ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
    if (n.thumb) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(n.thumb, n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
    } else if (n.curve) {
      // faint cross-hairs, then the curve
      ctx.strokeStyle = rgba(INK.dust, 0.25);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(n.x - n.r, n.y);
      ctx.lineTo(n.x + n.r, n.y);
      ctx.moveTo(n.x, n.y - n.r);
      ctx.lineTo(n.x, n.y + n.r);
      ctx.stroke();
      const last = n.curve.length - 1;
      for (const [w, a] of [[5, 0.18], [2.2, 1]] as [number, number][]) {
        ctx.strokeStyle = rgba(INK.chalk, a);
        ctx.lineWidth = w;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        n.curve.forEach((v, i) => {
          const x = n.x - n.r + (2 * n.r * i) / last;
          const y = n.y - Math.max(-1.4, Math.min(1.4, v)) * n.r * 0.8;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }
    }
    if (n.value !== null) {
      // dim the picture so the number reads cleanly over it
      ctx.fillStyle = rgba(INK.deep, 0.62);
      ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
    }
    ctx.restore();

    ctx.strokeStyle = rgba(INK.chalk, 0.95);
    ctx.lineWidth = scene.compact ? 1.6 : 2.2;
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    ctx.stroke();
  }
}
