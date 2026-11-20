<script lang="ts">
  import { onMount } from 'svelte';
  import { game } from '../game.svelte';
  import { INK } from './format';

  // One burst of chalk dust when a level is solved.
  let canvas: HTMLCanvasElement;
  let launch: (x: number, y: number) => void = () => {};
  let wasSolved = false;

  $effect(() => {
    const solved = game.solved;
    if (solved && !wasSolved) {
      const origin = document.querySelector('.net-wrap')?.getBoundingClientRect();
      launch(origin ? origin.left + origin.width / 2 : innerWidth / 2, origin ? origin.top + origin.height / 2 : innerHeight / 3);
    }
    wasSolved = solved;
  });

  onMount(() => {
    const ctx = canvas.getContext('2d')!;
    const still = matchMedia('(prefers-reduced-motion: reduce)');
    const inks = [INK.sun, INK.sun, INK.rose, INK.sky, INK.chalk];
    let motes: { x: number; y: number; vx: number; vy: number; life: number; size: number; ink: number[] }[] = [];
    let frame = 0;
    let last = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'lighter';
      for (const m of motes) {
        m.vy += 520 * dt;
        m.vx *= 1 - 1.6 * dt;
        m.vy *= 1 - 1.6 * dt;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.life -= dt;
        const a = Math.max(0, Math.min(1, m.life * 1.6));
        ctx.fillStyle = `rgba(${m.ink[0]},${m.ink[1]},${m.ink[2]},${a * 0.28})`;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.size * 2.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(${m.ink[0]},${m.ink[1]},${m.ink[2]},${a})`;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
        ctx.fill();
      }
      motes = motes.filter((m) => m.life > 0);
      if (motes.length) frame = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    launch = (x, y) => {
      if (still.matches) return;
      canvas.width = innerWidth;
      canvas.height = innerHeight;
      for (let i = 0; i < 110; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 180 + Math.random() * 620;
        motes.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 220,
          life: 0.7 + Math.random() * 0.9,
          size: 1.5 + Math.random() * 3,
          ink: inks[i % inks.length],
        });
      }
      cancelAnimationFrame(frame);
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };

    return () => cancelAnimationFrame(frame);
  });
</script>

<canvas bind:this={canvas} aria-hidden="true"></canvas>

<style>
  canvas {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 10;
  }
</style>
