<script lang="ts">
  import { onMount } from 'svelte';
  import { countCorrect, lossOnly } from '../engine/net';
  import { game } from '../game.svelte';

  // Three dials drawn as a point in a box. Loss can't be height any more, because all three
  // directions are taken, so it's drawn as dotted shells joining settings of equal loss.
  const G = 21; // settings sampled along each edge
  /** Where the shells sit, as a share of the box ordered from lowest loss to highest. */
  const SHELLS = [0.1, 0.3, 0.58];

  const box = $derived(game.level.box!);
  const R = $derived(box.range);

  interface Dot {
    x: number;
    y: number;
    z: number;
    /** 0..2 for a shell, -1 for the region where the goal is met. */
    shell: number;
  }

  /** Dials that aren't on an edge of the box are held where they are; the dots depend on them. */
  const held = $derived(game.params.filter((_, i) => !box.axes.includes(i)).join(','));

  const dots = $derived.by((): Dot[] => {
    void held;
    const level = game.level;
    const spec = game.spec;
    const p = [...game.params];
    const total = level.data.length;
    const cells: { x: number; y: number; z: number; loss: number; won: boolean }[] = [];
    for (let i = 0; i < G; i++) {
      p[box.axes[0]] = -R + (2 * R * i) / (G - 1);
      for (let j = 0; j < G; j++) {
        p[box.axes[1]] = -R + (2 * R * j) / (G - 1);
        for (let k = 0; k < G; k++) {
          p[box.axes[2]] = -R + (2 * R * k) / (G - 1);
          cells.push({
            x: (i / (G - 1)) * 2 - 1,
            z: (j / (G - 1)) * 2 - 1,
            y: (k / (G - 1)) * 2 - 1,
            loss: lossOnly(spec, p, level.data, level.loss),
            won: level.goal.kind === 'loss' ? false : countCorrect(spec, p, level.data) === total,
          });
        }
      }
    }
    // rank every setting by loss, then keep the thin slices of that ranking that make the shells
    const order = cells.map((_, i) => i).sort((a, b) => cells[a].loss - cells[b].loss);
    const rank = new Float32Array(cells.length);
    order.forEach((index, r) => (rank[index] = r / cells.length));
    const out: Dot[] = [];
    cells.forEach((c, i) => {
      if (c.won) {
        out.push({ x: c.x, y: c.y, z: c.z, shell: -1 });
        return;
      }
      const shell = SHELLS.findIndex((s) => Math.abs(rank[i] - s) < 0.011);
      if (shell >= 0) out.push({ x: c.x, y: c.y, z: c.z, shell });
    });
    return out;
  });

  let canvas: HTMLCanvasElement;
  let yaw = $state(0.65);
  let pitch = $state(0.42);
  let drag: { x: number; y: number; yaw: number; pitch: number } | null = null;
  let lastTouch = -Infinity;

  /** Where the machine has been, in box units. Starts again whenever the level does. */
  let trail: [number, number, number][] = [];
  const unit = (v: number) => Math.max(-1, Math.min(1, v / R));
  const here = $derived<[number, number, number]>([
    unit(game.params[box.axes[0]]),
    unit(game.params[box.axes[2]]),
    unit(game.params[box.axes[1]]),
  ]);

  $effect(() => {
    const p = here;
    if (game.effort === 0) trail = [];
    const last = trail[trail.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1], p[2] - last[2]) > 0.01) {
      trail.push([...p]);
      if (trail.length > 500) trail.shift();
    }
  });

  onMount(() => {
    const ctx = canvas.getContext('2d')!;
    const still = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let size = 300;
    let before = performance.now();

    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      size = Math.max(100, Math.round(canvas.clientWidth * dpr));
      canvas.width = size;
      canvas.height = Math.round(size * 0.86);
    };
    const watcher = new ResizeObserver(fit);
    watcher.observe(canvas);
    fit();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - before) / 1000);
      before = now;
      // turn slowly so depth can be read, unless someone has just turned it themselves
      if (!still.matches && !drag && now - lastTouch > 3500) yaw += dt * 0.14;

      const cy = Math.cos(yaw);
      const sy = Math.sin(yaw);
      const cp = Math.cos(pitch);
      const sp = Math.sin(pitch);
      const w = canvas.width;
      const h = canvas.height;
      const S = size * 0.31;
      /** Box units to pixels, with nearer things a little larger. Returns [x, y, depth, scale]. */
      const at = (x: number, y: number, z: number): [number, number, number, number] => {
        const x1 = x * cy + z * sy;
        const z1 = -x * sy + z * cy;
        const y1 = y * cp - z1 * sp;
        const z2 = y * sp + z1 * cp;
        const k = 1 / (1 + z2 * 0.09);
        return [w / 2 + x1 * S * k, h * 0.5 - y1 * S * k, z2, k];
      };
      const line = (a: number[], b: number[]) => {
        const p = at(a[0], a[1], a[2]);
        const q = at(b[0], b[1], b[2]);
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]);
        ctx.lineTo(q[0], q[1]);
        ctx.stroke();
      };

      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = 'round';

      // the box
      ctx.strokeStyle = 'rgba(154,179,168,0.28)';
      ctx.lineWidth = Math.max(1, size / 420);
      for (const a of [-1, 1]) {
        for (const b of [-1, 1]) {
          line([-1, a, b], [1, a, b]);
          line([a, -1, b], [a, 1, b]);
          line([a, b, -1], [a, b, 1]);
        }
      }

      // shells of equal loss, and the glow where the goal is met
      ctx.globalCompositeOperation = 'lighter';
      const inks = ['243,246,236', '154,200,186', '110,150,140'];
      for (const d of dots) {
        const p = at(d.x, d.y, d.z);
        const near = 0.55 + 0.45 * (1 - (p[2] + 1.7) / 3.4);
        if (d.shell < 0) {
          ctx.fillStyle = `rgba(255,212,71,${0.2 * near})`;
          const r = size * 0.011 * p[3];
          ctx.fillRect(p[0] - r, p[1] - r, r * 2, r * 2);
        } else {
          ctx.fillStyle = `rgba(${inks[d.shell]},${(0.75 - d.shell * 0.2) * near})`;
          const r = size * (0.0042 - d.shell * 0.0006) * p[3];
          ctx.fillRect(p[0] - r, p[1] - r, r * 2, r * 2);
        }
      }
      ctx.globalCompositeOperation = 'source-over';

      // the machine: where it has been, its shadows on the floor and back walls, and the point itself
      const b = here;
      if (trail.length > 1) {
        for (const [width, alpha] of [[size / 70, 0.2], [size / 190, 0.95]] as [number, number][]) {
          ctx.strokeStyle = `rgba(104,220,255,${alpha})`;
          ctx.lineWidth = width;
          ctx.lineJoin = 'round';
          ctx.beginPath();
          trail.forEach((t, i) => {
            const p = at(t[0], t[1], t[2]);
            if (i === 0) ctx.moveTo(p[0], p[1]);
            else ctx.lineTo(p[0], p[1]);
          });
          const p = at(b[0], b[1], b[2]);
          ctx.lineTo(p[0], p[1]);
          ctx.stroke();
        }
      }
      // whichever side walls are further from the eye
      const wallX = at(1, 0, 0)[2] > at(-1, 0, 0)[2] ? 1 : -1;
      const wallZ = at(0, 0, 1)[2] > at(0, 0, -1)[2] ? 1 : -1;
      const feet: [number, number, number][] = [
        [b[0], -1, b[2]],
        [wallX, b[1], b[2]],
        [b[0], b[1], wallZ],
      ];
      ctx.setLineDash([size / 130, size / 90]);
      ctx.strokeStyle = 'rgba(243,246,236,0.3)';
      ctx.lineWidth = Math.max(1, size / 420);
      for (const f of feet) line(b, f);
      ctx.setLineDash([]);
      for (const f of feet) {
        const p = at(f[0], f[1], f[2]);
        ctx.fillStyle = 'rgba(243,246,236,0.5)';
        ctx.beginPath();
        ctx.arc(p[0], p[1], size * 0.008 * p[3], 0, Math.PI * 2);
        ctx.fill();
      }

      // which way is downhill from here
      if (game.tools.hints) {
        const g = game.evaluation.grad;
        const v = [-g[box.axes[0]], -g[box.axes[2]], -g[box.axes[1]]];
        const steep = Math.hypot(v[0], v[1], v[2]);
        if (Number.isFinite(steep) && steep > 0.01) {
          const reach = 0.22 + 0.4 * Math.min(1, Math.sqrt(steep / 2));
          const tip = [b[0] + (v[0] / steep) * reach, b[1] + (v[1] / steep) * reach, b[2] + (v[2] / steep) * reach];
          for (const [width, alpha] of [[size / 55, 0.22], [size / 130, 1]] as [number, number][]) {
            ctx.strokeStyle = `rgba(104,220,255,${alpha})`;
            ctx.lineWidth = width;
            line(b, tip);
          }
          const p = at(tip[0], tip[1], tip[2]);
          ctx.fillStyle = 'rgb(104,220,255)';
          ctx.beginPath();
          ctx.arc(p[0], p[1], size * 0.011, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const p = at(b[0], b[1], b[2]);
      const r = size * 0.022 * p[3];
      const glow = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r * 3.4);
      glow.addColorStop(0, 'rgba(243,246,236,0.4)');
      glow.addColorStop(1, 'rgba(243,246,236,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p[0], p[1], r * 3.4, 0, Math.PI * 2);
      ctx.fill();
      const shade = ctx.createRadialGradient(p[0] - r * 0.35, p[1] - r * 0.4, r * 0.1, p[0], p[1], r);
      shade.addColorStop(0, '#ffffff');
      shade.addColorStop(0.55, '#f3f6ec');
      shade.addColorStop(1, '#93aaa0');
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
      ctx.fill();

      // name the three edges, on whichever copy of each edge is nearest the eye
      ctx.fillStyle = 'rgba(154,179,168,0.95)';
      ctx.font = `${Math.round(size / 27)}px "Recursive Variable", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      const nearest = (candidates: number[][]) =>
        candidates.map((c) => at(c[0], c[1], c[2])).sort((m, n) => m[2] - n[2])[0];
      const pad = size / 22;
      const ex = nearest([[0, -1, -1], [0, -1, 1]]);
      ctx.fillText(box.names[0], ex[0], ex[1] + pad);
      const ez = nearest([[-1, -1, 0], [1, -1, 0]]);
      ctx.fillText(box.names[1], ez[0], ez[1] + pad);
      const ey = nearest([[-1, 0, -1], [1, 0, -1], [-1, 0, 1], [1, 0, 1]]);
      ctx.fillText(box.names[2], ey[0] + (ey[0] < w / 2 ? -pad : pad), ey[1]);

      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      watcher.disconnect();
    };
  });

  function down(e: PointerEvent) {
    canvas.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, yaw, pitch };
  }

  function move(e: PointerEvent) {
    if (!drag) return;
    yaw = drag.yaw + (e.clientX - drag.x) * 0.01;
    pitch = Math.max(-0.2, Math.min(1.2, drag.pitch + (e.clientY - drag.y) * 0.008));
  }

  function up() {
    if (drag) lastTouch = performance.now();
    drag = null;
  }
</script>

<figure class="box-plot">
  <canvas
    bind:this={canvas}
    aria-label="The three dials drawn as a point in a box, with shells of equal loss around it"
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={up}
  ></canvas>
  <figcaption>The machine is the white point. Drag to turn the box.</figcaption>
</figure>

<style>
  .box-plot {
    margin: 0;
    display: grid;
    gap: 0.4rem;
  }

  canvas {
    display: block;
    width: 100%;
    aspect-ratio: 1 / 0.86;
    border-radius: 14px;
    cursor: grab;
    touch-action: none;
    background:
      radial-gradient(90% 80% at 50% 50%, rgba(40, 96, 84, 0.35), transparent 75%),
      var(--board-deep);
    box-shadow:
      0 0 0 1.5px var(--rule),
      0 18px 50px -24px rgba(0, 0, 0, 0.8);
  }

  canvas:active {
    cursor: grabbing;
  }

  figcaption {
    color: var(--dust);
    font-size: var(--step--1);
  }
</style>
