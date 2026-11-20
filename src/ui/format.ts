/** A fixed two-decimal number with a real minus sign, never "-0.00". */
export function num(v: number, places = 2): string {
  if (!Number.isFinite(v)) return v > 0 ? 'huge' : 'n/a';
  const s = Math.abs(v).toFixed(places);
  return (v < 0 && Number(s) !== 0 ? '−' : '') + s;
}

/** Loss readout: more digits as it gets small, so progress stays visible. */
export function lossText(v: number): string {
  if (!Number.isFinite(v) || v >= 1e4) return 'huge';
  if (v >= 100) return v.toFixed(0);
  if (v >= 10) return v.toFixed(1);
  if (v >= 0.1) return v.toFixed(2);
  if (v >= 0.001) return v.toFixed(3);
  return v.toFixed(4);
}

const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉';

/** Subscript digits, as characters. Render with `splitSubs` so they use the page's own font. */
export function sub(n: number): string {
  return String(n)
    .split('')
    .map((d) => SUBSCRIPTS[Number(d)])
    .join('');
}

/** Break text into runs of ordinary characters and runs of subscript digits (returned as plain digits). */
export function splitSubs(text: string): { text: string; sub: boolean }[] {
  const out: { text: string; sub: boolean }[] = [];
  for (const ch of text) {
    const digit = SUBSCRIPTS.indexOf(ch);
    const isSub = digit >= 0;
    const piece = isSub ? String(digit) : ch;
    const last = out[out.length - 1];
    if (last && last.sub === isSub) last.text += piece;
    else out.push({ text: piece, sub: isSub });
  }
  return out;
}

/** Hex colour to [r, g, b]. */
export function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const COLORS = {
  board: '#23403a',
  boardDeep: '#1a302c',
  chalk: '#eef1e6',
  dust: '#a3b8ad',
  sun: '#f4cf5c',
  rose: '#f28db2',
  sky: '#8fd0e6',
};

/**
 * Line segments where a grid of values crosses `level` (marching squares).
 * `values` is rows of `size` samples; the result is in grid units, 0..size-1.
 */
export function contour(values: Float32Array | number[], size: number, level: number): number[][] {
  const out: number[][] = [];
  const at = (c: number, r: number) => values[r * size + c];
  const cross = (a: number, b: number) => (level - a) / (b - a);
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const tl = at(c, r);
      const tr = at(c + 1, r);
      const br = at(c + 1, r + 1);
      const bl = at(c, r + 1);
      const pts: number[][] = [];
      if (tl > level !== tr > level) pts.push([c + cross(tl, tr), r]);
      if (tr > level !== br > level) pts.push([c + 1, r + cross(tr, br)]);
      if (bl > level !== br > level) pts.push([c + cross(bl, br), r + 1]);
      if (tl > level !== bl > level) pts.push([c, r + cross(tl, bl)]);
      if (pts.length >= 2) out.push([pts[0][0], pts[0][1], pts[1][0], pts[1][1]]);
      if (pts.length === 4) out.push([pts[2][0], pts[2][1], pts[3][0], pts[3][1]]);
    }
  }
  return out;
}
