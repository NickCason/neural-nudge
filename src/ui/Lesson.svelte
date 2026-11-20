<script lang="ts">
  import { game } from '../game.svelte';

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
      {#if game.fellShort}
        <p class="trouble">That run didn't get there. Keep nudging: the dashed line shows where it will go.</p>
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
