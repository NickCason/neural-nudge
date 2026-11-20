<script lang="ts">
  import { onMount } from 'svelte';
  import { predict, trace } from '../engine/net';
  import { game } from '../game.svelte';
  import { answerInk, contour } from './format';

  // The dot plot lifted into a surface: across and deep are the two inputs, and height is the
  // answer. One hidden neuron alone is a ramp. The whole network is those ramps added up, which
  // is what bending the line looks like from the side.
  const N = 37;
  const R = 1.1;
  const RISE = 0.5;

  const params = $derived([...game.params]);
  const focus = $derived(game.focus);

  /** The shown neuron's answer across the plane, from 0 for no to 1 for yes. Row 0 is the lowest x2. */
  const field = $derived.by(() => {
    const out = new Float32Array(N * N);
    const signed = focus ? game.spec.layers[focus.layer].act !== 'sigmoid' : false;
    for (let r = 0; r < N; r++) {
      const y = -R + (2 * R * r) / (N - 1);
      for (let c = 0; c < N; c++) {
        const x = -R + (2 * R * c) / (N - 1);
        let v: number;
        if (focus) {
          v = trace(game.spec, params, [x, y]).a[focus.layer + 1][focus.neuron];
          if (signed) v = (Math.max(-1, Math.min(1, v)) + 1) / 2;
        } else {
          v = predict(game.spec, params, [x, y])[0];
        }
        out[r * N + c] = v;
      }
    }
    return out;
  });

  /** Where the surface passes through the middle, which is where the answer flips. */
  const edge = $derived(contour(field, N, 0.5));

  const dots = $derived(
    game.level.data.map((s) => {
      let v: number;
      if (focus) {
        v = trace(game.spec, params, s.x).a[focus.layer + 1][focus.neuron];
        if (game.spec.layers[focus.layer].act !== 'sigmoid') v = (Math.max(-1, Math.min(1, v)) + 1) / 2;
      } else {
        v = predict(game.spec, params, s.x)[0];
      }
      const guess = predict(game.spec, params, s.x)[0];
      return { x: s.x[0] / R, z: s.x[1] / R, v, yellow: s.y[0] > 0.5, wrong: guess > 0.5 !== s.y[0] > 0.5 };
    }),
  );

  let canvas: HTMLCanvasElement;
  let yaw = $state(-0.5);
  let pitch = $state(0.62);
  let drag: { x: number; y: number; yaw: number; pitch: number } | null = null;
  let lastTouch = -Infinity;

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
      canvas.height = size;
    };
    const watcher = new ResizeObserver(fit);
    watcher.observe(canvas);
    fit();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - before) / 1000);
      before = now;
      if (!still.matches && !drag && now - lastTouch > 3500) yaw += dt * 0.1;

      const cy = Math.cos(yaw);
      const sy = Math.sin(yaw);
      const cp = Math.cos(pitch);
      const sp = Math.sin(pitch);
      const w = canvas.width;
      const S = size * 0.37;
      const at = (x: number, y: number, z: number): [number, number, number] => {
        const x1 = x * cy + z * sy;
        const z1 = -x * sy + z * cy;
        const y1 = y * cp - z1 * sp;
        const z2 = y * sp + z1 * cp;
        const k = 1 / (1 + z2 * 0.08);
        return [w / 2 + x1 * S * k, w * 0.5 - y1 * S * k, z2];
      };
      const high = (v: number) => (v - 0.5) * 2 * RISE;
      const values = field;
      const vertex = (c: number, r: number) =>
        at((c / (N - 1)) * 2 - 1, high(values[r * N + c]), (r / (N - 1)) * 2 - 1);

      ctx.clearRect(0, 0, w, w);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      // the level where the answer is undecided: a frame the surface rises above and dips below
      ctx.strokeStyle = 'rgba(154,179,168,0.32)';
      ctx.lineWidth = Math.max(1, size / 420);
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      ctx.beginPath();
      corners.forEach(([x, z], i) => {
        const p = at(x, 0, z);
        if (i === 0) ctx.moveTo(p[0], p[1]);
        else ctx.lineTo(p[0], p[1]);
      });
      ctx.closePath();
      ctx.stroke();

      // everything that has to be drawn back to front: the tiles of the surface, and the dots on it
      type Item = { depth: number; draw: () => void };
      const items: Item[] = [];
      for (let r = 0; r < N - 1; r++) {
        for (let c = 0; c < N - 1; c++) {
          const a = vertex(c, r);
          const b = vertex(c + 1, r);
          const d = vertex(c + 1, r + 1);
          const e = vertex(c, r + 1);
          const v = (values[r * N + c] + values[r * N + c + 1] + values[(r + 1) * N + c + 1] + values[(r + 1) * N + c]) / 4;
          // tiles that face the light are a little brighter, so the folds read as folds
          const slope = (values[r * N + c] - values[r * N + c + 1]) * 0.9 + (values[(r + 1) * N + c] - values[r * N + c]) * 0.6;
          const light = Math.max(-1, Math.min(1, slope * (N - 1) * 0.22));
          const ink = answerInk((v - 0.5) * 2, 0.78);
          const k = 1 + light * 0.3;
          const fill = `rgb(${Math.min(255, ink[0] * k) | 0},${Math.min(255, ink[1] * k) | 0},${Math.min(255, ink[2] * k) | 0})`;
          items.push({
            depth: (a[2] + b[2] + d[2] + e[2]) / 4,
            draw: () => {
              ctx.fillStyle = fill;
              ctx.strokeStyle = fill;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(a[0], a[1]);
              ctx.lineTo(b[0], b[1]);
              ctx.lineTo(d[0], d[1]);
              ctx.lineTo(e[0], e[1]);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
            },
          });
        }
      }
      // the line where the answer flips, laid on the surface
      const cell = 2 / (N - 1);
      for (const seg of edge) {
        const p = at(seg[0] * cell - 1, 0.012, seg[1] * cell - 1);
        const q = at(seg[2] * cell - 1, 0.012, seg[3] * cell - 1);
        items.push({
          depth: (p[2] + q[2]) / 2 - 0.03,
          draw: () => {
            ctx.strokeStyle = 'rgba(243,246,236,0.95)';
            ctx.lineWidth = size / 130;
            ctx.beginPath();
            ctx.moveTo(p[0], p[1]);
            ctx.lineTo(q[0], q[1]);
            ctx.stroke();
          },
        });
      }
      for (const dot of dots) {
        const p = at(dot.x, high(dot.v) + 0.035, dot.z);
        items.push({
          depth: p[2] - 0.06,
          draw: () => {
            const r = size * 0.014;
            ctx.lineWidth = size / 300;
            ctx.strokeStyle = dot.wrong ? '#f3f6ec' : '#081714';
            ctx.fillStyle = dot.yellow ? '#ffd447' : '#ff7eb3';
            ctx.beginPath();
            if (dot.yellow) ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
            else ctx.rect(p[0] - r * 0.9, p[1] - r * 0.9, r * 1.8, r * 1.8);
            ctx.fill();
            ctx.stroke();
          },
        });
      }
      items.sort((m, n) => n.depth - m.depth);
      for (const item of items) item.draw();

      // names: the two inputs along the near edges, and what up and down mean
      ctx.fillStyle = 'rgba(154,179,168,0.95)';
      ctx.font = `${Math.round(size / 28)}px "Recursive Variable", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      const nearest = (candidates: number[][]) =>
        candidates.map((c) => at(c[0], c[1], c[2])).sort((m, n) => m[2] - n[2])[0];
      const pad = size / 20;
      const ex = nearest([[0, 0, -1], [0, 0, 1]]);
      ctx.fillText('x1', ex[0], ex[1] + pad);
      const ez = nearest([[-1, 0, 0], [1, 0, 0]]);
      ctx.fillText('x2', ez[0], ez[1] + pad);
      const post = nearest([[-1, 0, -1], [1, 0, -1], [-1, 0, 1], [1, 0, 1]].map((c) => [c[0] * 1.08, 0, c[2] * 1.08]));
      const top = at(0, RISE, 0);
      const bottom = at(0, -RISE, 0);
      const side = post[0] < w / 2 ? -1 : 1;
      ctx.textAlign = side < 0 ? 'right' : 'left';
      ctx.fillStyle = '#ffd447';
      ctx.fillText('yes', post[0] + side * pad * 0.2, post[1] + (top[1] - at(0, 0, 0)[1]));
      ctx.fillStyle = '#ff7eb3';
      ctx.fillText('no', post[0] + side * pad * 0.2, post[1] + (bottom[1] - at(0, 0, 0)[1]));

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
    pitch = Math.max(0.1, Math.min(1.35, drag.pitch + (e.clientY - drag.y) * 0.008));
  }

  function up() {
    if (drag) lastTouch = performance.now();
    drag = null;
  }
</script>

<figure class="surface">
  <canvas
    bind:this={canvas}
    aria-label="The dot plot lifted into a surface whose height is the network's answer"
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={up}
  ></canvas>
  <figcaption>
    Height is the answer: up for yes, down for no. The white line is where it crosses over. Click a hidden neuron to
    see its ramp alone, and the output neuron to see them added up. Drag to turn it.
  </figcaption>
</figure>

<style>
  .surface {
    margin: 0;
    display: grid;
    gap: 0.5rem;
  }

  canvas {
    display: block;
    width: 100%;
    aspect-ratio: 1;
    border-radius: 10px;
    cursor: grab;
    touch-action: none;
    background:
      radial-gradient(90% 80% at 50% 50%, rgba(40, 96, 84, 0.3), transparent 75%),
      var(--board-deep);
  }

  canvas:active {
    cursor: grabbing;
  }

  figcaption {
    color: var(--dust);
    font-size: var(--step--1);
    max-width: 48ch;
  }
</style>
