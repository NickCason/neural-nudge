<script lang="ts">
  import { game } from '../game.svelte';
</script>

<nav class="strip" aria-label="Levels">
  {#each game.levels as level, i (level.id)}
    <button
      class="pip num"
      class:current={i === game.index}
      class:done={game.done.includes(level.id)}
      disabled={!game.isUnlocked(i)}
      aria-current={i === game.index ? 'step' : undefined}
      aria-label="Level {i + 1}: {level.title}{game.done.includes(level.id) ? ', solved' : ''}"
      title={game.isUnlocked(i) ? level.title : 'Solve the level before this one first'}
      onclick={() => game.go(i)}
    >
      {i + 1}
    </button>
  {/each}
</nav>

<style>
  .strip {
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .pip {
    width: 2rem;
    height: 2rem;
    padding: 0;
    border: 1.5px solid var(--rule);
    border-radius: 50%;
    background: transparent;
    color: var(--dust);
    font-size: var(--step--1);
    cursor: pointer;
  }

  .pip.done {
    border-color: var(--sun);
    color: var(--sun);
    box-shadow: 0 0 10px -2px color-mix(in srgb, var(--sun) 70%, transparent);
  }

  .pip.current {
    background: var(--chalk);
    border-color: var(--chalk);
    color: var(--board-deep);
    font-weight: 700;
    box-shadow: 0 0 14px -1px color-mix(in srgb, var(--chalk) 70%, transparent);
  }

  .pip:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .pip:hover:not(:disabled):not(.current) {
    border-color: var(--chalk);
    color: var(--chalk);
  }
</style>
