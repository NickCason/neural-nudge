<script lang="ts">
  import { game } from '../game.svelte';
  import { shortfall } from '../sim/cart';

  /** What to say after a run that didn't meet the goal: the actual reason, not just "no". */
  const fellShort = $derived.by(() => {
    if (!game.fellShort) return '';
    const goal = game.level.goal.kind === 'park' ? 'park' : 'arrive';
    const reasons = game.trips.map((t) => shortfall(t, goal)).filter((r) => r !== null);
    const why = reasons[0];
    if (why === 'lamp') return 'It ran into the lamp. It has to be stopped before it gets that close: brake harder, or push less.';
    if (why === 'wall') return 'It ran into the wall. Look at which way the dashed line bends, and which wheel is winning.';
    if (why === 'rolling-inside')
      return "It was inside the ring when time ran out, but its wheels were still turning, so it hadn't parked. Being in the ring isn't enough: both wheels have to come down to zero there. The arrowhead on the dashed line means still rolling.";
    if (why === 'rolling-outside') return 'Time ran out with the cart still rolling, outside the ring.';
    if (why === 'stopped-outside') return 'It stopped, but outside the ring. The brakes win too early: brake less, or push more.';
    return "That run didn't get there. Keep nudging: the dashed line shows where it will go.";
  });

  const canCallIt = $derived(game.level.goal.kind === 'impossible' && !game.solved && game.effort >= 12);
</script>

<article class="lesson">
  <header>
    <p class="count">Level {game.index + 1} of {game.levels.length}</p>
    <h1 class="hand">{game.level.title}</h1>
  </header>

  {#each game.level.text as paragraph, i (i)}
    <p>{paragraph}</p>
  {/each}

  <section class="goal" class:solved={game.solved} aria-live="polite">
    {#if game.solved}
      <h2 class="hand">Solved</h2>
      <p>{game.winText}</p>
      {#if game.isLast}
        <p class="after">That's every level so far. Next up: teaching the cart by driving it yourself.</p>
      {:else}
        <button class="next" onclick={() => game.next()}>Next level</button>
      {/if}
    {:else}
      <h2>Goal</h2>
      <p>{game.level.goalText}</p>
      {#if game.overshot}
        <p class="trouble">
          Each step overshot further than the last, and the loss ran away. Start over and try a smaller step size.
        </p>
      {:else if game.outOfSteps}
        <p class="trouble">Out of steps. Start over and try a different step size.</p>
      {/if}
      {#if fellShort}
        <p class="trouble">{fellShort}</p>
      {/if}
      {#if canCallIt}
        <button class="next" onclick={() => game.callImpossible()}>This can't be done</button>
      {/if}
    {/if}
  </section>
</article>

<style>
  .lesson {
    display: grid;
    gap: 0.9rem;
    align-content: start;
    max-width: 38ch;
  }

  .count {
    color: var(--dust);
    font-size: var(--step--1);
  }

  h1 {
    font-size: var(--step-3);
    line-height: 1.1;
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  .goal {
    display: grid;
    gap: 0.5rem;
    margin-top: 0.4rem;
    padding: 0.9rem 1rem 1rem;
    border: 1.5px dashed var(--rule);
    border-radius: 10px;
  }

  .lesson > header {
    order: -2;
  }

  /* Once solved, the card moves up under the title, so it's on screen however long the lesson is. */
  .goal.solved {
    order: -1;
    border-style: solid;
    border-color: var(--sun);
    background: color-mix(in srgb, var(--sun) 7%, transparent);
    box-shadow: 0 0 34px -10px color-mix(in srgb, var(--sun) 65%, transparent);
    animation: land 0.45s cubic-bezier(0.2, 1.4, 0.4, 1);
  }

  @keyframes land {
    from {
      transform: scale(0.94);
      opacity: 0;
    }
  }

  .goal h2 {
    font-size: var(--step--1);
    font-weight: 600;
    color: var(--dust);
  }

  .goal.solved h2 {
    font-size: var(--step-1);
    color: var(--sun);
  }

  .trouble {
    color: var(--rose);
  }

  .after {
    color: var(--dust);
  }

  .next {
    justify-self: start;
    margin-top: 0.3rem;
    min-height: 2.6rem;
    padding: 0.4rem 1.2rem;
    border: none;
    border-radius: 999px;
    background: var(--sun);
    color: var(--board-deep);
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 0 22px -4px color-mix(in srgb, var(--sun) 80%, transparent);
  }

  .next:hover {
    background: #ffe07a;
  }
</style>
