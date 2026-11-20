<script lang="ts">
  import { onMount } from 'svelte';
  import { game } from '../game.svelte';
  import { contour, INK, upsample } from './format';
  import type { RGB } from './format';
  import { depth, N, SHAPE, Terrain } from './terrain';

  // The loss over two dials, drawn as ground you can stand on. Weight runs across,
  // bias runs away from you, and height is how wrong the machine is.
  const BANDS = 14;

  const hill = $derived(game.level.hill!);
  /** Only depends on the level, so the ground is worked out once per level. */
  const terrain = $derived(new Terrain(game.level));
  const R = $derived(terrain.range);
  const field = $derived(terrain.field);

  const heightOf = (loss: number) => terrain.heightOf(loss);
  const project = (w: number, b: number, h: number) => terrain.project(w, b, h);
  const onGround = (w: number, b: number, lift = 0) => terrain.onGround(w, b, lift);

  let canvas: HTMLCanvasElement;
  let ground: HTMLCanvasElement | null = null;
  let size = 300;
  let redraw = () => {};

  const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const LOW: RGB = [9, 30, 27];
  const HIGH: RGB = [150, 214, 196];

  /** Paint the ground once per level: banded like a contour map, lit from the upper left. */
  function paintGround() {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = Math.round(size * SHAPE);
    const ctx = c.getContext('2d')!;
    const at = (col: number, row: number) => {
      const w = -R + (2 * R * col) / (N - 1);
      const b = -R + (2 * R * row) / (N - 1);
      const h = heightOf(field[row * N + col]);
      const [x, y] = project(w, b, h);
      return { x: x * size, y: y * size, h };
    };

    // far tiles first, so near ground covers far ground
    const tiles: { col: number; row: number; depth: number }[] = [];
    for (let row = 0; row < N - 1; row++) {
      for (let col = 0; col < N - 1; col++) {
        const u = (col + 0.5) / (N - 1) * 2 - 1;
        const v = (row + 0.5) / (N - 1) * 2 - 1;
        tiles.push({ col, row, depth: depth(u, v) });
      }
    }
    tiles.sort((a, b) => b.depth - a.depth);

    const goal = game.level.goal.kind === 'loss' ? game.level.goal.below : -1;
    for (const { col, row } of tiles) {
      const a = at(col, row);
      const b = at(col + 1, row);
      const d = at(col + 1, row + 1);
      const e = at(col, row + 1);
      const h = (a.h + b.h + d.h + e.h) / 4;
      const band = Math.min(BANDS - 1, Math.floor(h * BANDS)) / (BANDS - 1);
      // slope toward the light brightens a tile, slope away darkens it
      const light = Math.max(-1, Math.min(1, ((a.h - b.h) * 0.9 + (e.h - a.h) * 0.6) * (N - 1) * 0.16));
      let ink = mix(LOW, HIGH, Math.pow(band, 1.15));
      ink = mix(ink, light > 0 ? [235, 255, 245] : [0, 8, 8], Math.abs(light) * 0.38);
      const loss = (field[row * N + col] + field[row * N + col + 1] + field[(row + 1) * N + col] + field[(row + 1) * N + col + 1]) / 4;
      if (loss < goal * 4) ink = mix(ink, INK.sun, loss < goal ? 0.75 : 0.22);
      const fill = `rgb(${ink[0] | 0},${ink[1] | 0},${ink[2] | 0})`;
      ctx.fillStyle = fill;
      ctx.strokeStyle = fill;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(d.x, d.y);
      ctx.lineTo(e.x, e.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // survey lines every few tiles, so the shape reads even where the shading is flat
    ctx.strokeStyle = 'rgba(243,246,236,0.07)';
    ctx.lineWidth = Math.max(1, size / 500);
    for (let k = 0; k < N; k += 4) {
      ctx.beginPath();
      for (let j = 0; j < N; j++) {
        const p = at(k, j);
        if (j === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      for (let j = 0; j < N; j++) {
        const p = at(j, k);
        if (j === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    // the goal: a ring of light round the valley floor
    if (goal > 0) {
      const fine = upsample(field, N, 4);
      const unit = (2 * R) / (fine.size - 1);
      ctx.lineCap = 'round';
      for (const [width, alpha] of [[size / 40, 0.18], [size / 150, 1]] as [number, number][]) {
        ctx.strokeStyle = `rgba(255,212,71,${alpha})`;
        ctx.lineWidth = width;
        ctx.beginPath();
        for (const seg of contour(fine.values, fine.size, goal)) {
          const p = onGround(-R + seg[0] * unit, -R + seg[1] * unit, 0.004);
          const q = onGround(-R + seg[2] * unit, -R + seg[3] * unit, 0.004);
          ctx.moveTo(p[0] * size, p[1] * size);
          ctx.lineTo(q[0] * size, q[1] * size);
        }
        ctx.stroke();
      }
    }

    // axis names along the two near edges
    ctx.fillStyle = 'rgba(154,179,168,0.95)';
    ctx.font = `${Math.round(size / 30)}px "Recursive Variable", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    const near = onGround(0.1 * R, -R);
    ctx.fillText('weight', near[0] * size, near[1] * size + size / 22);
    const side = onGround(R, -0.15 * R);
    ctx.textAlign = 'left';
    ctx.fillText('bias', side[0] * size + size / 60, side[1] * size + size / 26);
    ground = c;
  }

  // The ball eases toward where the machine really is, so a step looks like a roll.
  let shown: [number, number] | null = null;

  function paintFrame(): boolean {
    const ctx = canvas.getContext('2d');
    if (!ctx || !ground) return false;
    const target: [number, number] = [game.params[hill.x], game.params[hill.y]];
    if (!shown || dragging) shown = target;
    const gapW = target[0] - shown[0];
    const gapB = target[1] - shown[1];
    const moving = Math.hypot(gapW, gapB) > 0.004;
    shown = moving ? [shown[0] + gapW * 0.22, shown[1] + gapB * 0.22] : target;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(ground, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // where it has been
    const trail = game.trail;
    if (trail.length > 1) {
      for (const [width, alpha] of [[size / 55, 0.2], [size / 170, 0.95]] as [number, number][]) {
        ctx.strokeStyle = `rgba(104,220,255,${alpha})`;
        ctx.lineWidth = width;
        ctx.beginPath();
        trail.forEach(([w, b], i) => {
          const last = i === trail.length - 1;
          const p = last ? onGround(shown![0], shown![1], 0.01) : onGround(w, b, 0.01);
          if (i === 0) ctx.moveTo(p[0] * size, p[1] * size);
          else ctx.lineTo(p[0] * size, p[1] * size);
        });
        ctx.stroke();
      }
    }

    // which way is down from here, laid along the ground
    if (game.tools.hints && !moving) {
      const gx = -game.evaluation.grad[hill.x];
      const gy = -game.evaluation.grad[hill.y];
      const steep = Math.hypot(gx, gy);
      if (Number.isFinite(steep) && steep > 0.01) {
        const reach = R * (0.16 + 0.32 * Math.min(1, Math.sqrt(steep / 4)));
        const pts: [number, number][] = [];
        for (let k = 0; k <= 8; k++) {
          const t = (k / 8) * reach;
          pts.push(onGround(shown[0] + (gx / steep) * t, shown[1] + (gy / steep) * t, 0.015));
        }
        const tip = pts[8];
        const back = pts[6];
        const len = Math.hypot(tip[0] - back[0], tip[1] - back[1]) || 1;
        const ux = (tip[0] - back[0]) / len;
        const uy = (tip[1] - back[1]) / len;
        const h = 0.035;
        for (const [width, alpha] of [[size / 45, 0.22], [size / 110, 1]] as [number, number][]) {
          ctx.strokeStyle = `rgba(104,220,255,${alpha})`;
          ctx.lineWidth = width;
          ctx.beginPath();
          pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0] * size, p[1] * size) : ctx.lineTo(p[0] * size, p[1] * size)));
          ctx.moveTo((tip[0] - ux * h - uy * h * 0.6) * size, (tip[1] - uy * h + ux * h * 0.6) * size);
          ctx.lineTo(tip[0] * size, tip[1] * size);
          ctx.lineTo((tip[0] - ux * h + uy * h * 0.6) * size, (tip[1] - uy * h - ux * h * 0.6) * size);
          ctx.stroke();
        }
      }
    }

    // the ball
    const r = size * 0.026;
    const foot = onGround(shown[0], shown[1]);
    const x = foot[0] * size;
    const y = foot[1] * size - r * 0.85;
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath();
    ctx.ellipse(x + r * 0.25, foot[1] * size + r * 0.1, r * 1.05, r * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2);
    glow.addColorStop(0, 'rgba(243,246,236,0.35)');
    glow.addColorStop(1, 'rgba(243,246,236,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, r * 3.2, 0, Math.PI * 2);
    ctx.fill();
    const shade = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    shade.addColorStop(0, '#ffffff');
    shade.addColorStop(0.55, '#f3f6ec');
    shade.addColorStop(1, '#93aaa0');
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    return moving;
  }

  // ---- dragging the ball ---------------------------------------------------------------------

  let dragging = $state(false);

  function place(e: PointerEvent) {
    const box = canvas.getBoundingClientRect();
    const [w, b] = terrain.pick((e.clientX - box.left) / box.width, (e.clientY - box.top) / box.width);
    game.setParam(hill.x, Math.round(w * 100) / 100);
    game.setParam(hill.y, Math.round(b * 100) / 100);
  }

  function down(e: PointerEvent) {
    if (!game.tools.drag) return;
    dragging = true;
    canvas.setPointerCapture(e.pointerId);
    place(e);
  }

  onMount(() => {
    let frame = 0;
    let queued = false;
    const loop = () => {
      queued = false;
      if (paintFrame()) redraw();
    };
    redraw = () => {
      if (queued) return;
      queued = true;
      frame = requestAnimationFrame(loop);
    };
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      size = Math.max(100, Math.round(canvas.clientWidth * dpr));
      canvas.width = size;
      canvas.height = Math.round(size * SHAPE);
      paintGround();
      redraw();
    };
    const watcher = new ResizeObserver(fit);
    watcher.observe(canvas);
    fit();
    document.fonts?.ready.then(fit);
    return () => {
      cancelAnimationFrame(frame);
      watcher.disconnect();
    };
  });

  // New level, new ground.
  $effect(() => {
    void field;
    shown = null;
    if (canvas?.width) {
      paintGround();
      redraw();
    }
  });

  // Anything that moves the ball or its trail.
  $effect(() => {
    void game.params[hill.x];
    void game.params[hill.y];
    void game.trail.length;
    void game.tools.hints;
    redraw();
  });
</script>

<canvas
  bind:this={canvas}
  class="hill"
  class:draggable={game.tools.drag}
  class:dragging
  aria-label="The loss drawn as a landscape over the weight and the bias, with a ball where the machine is now"
  onpointerdown={down}
  onpointermove={(e) => dragging && place(e)}
  onpointerup={() => (dragging = false)}
  onpointercancel={() => (dragging = false)}
></canvas>

<style>
  .hill {
    display: block;
    width: 100%;
    aspect-ratio: 10 / 9;
    border-radius: 14px;
    background:
      radial-gradient(90% 80% at 50% 55%, rgba(40, 96, 84, 0.35), transparent 75%),
      var(--board-deep);
    box-shadow:
      0 0 0 1.5px var(--rule),
      0 18px 50px -24px rgba(0, 0, 0, 0.8);
  }

  .hill.draggable {
    cursor: grab;
    touch-action: none;
  }

  .hill.dragging {
    cursor: grabbing;
  }
</style>
