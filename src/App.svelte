<script lang="ts">
  import { game } from './game.svelte';
  import { neuronName } from './ui/names';
  import HillPlot from './ui/HillPlot.svelte';
  import Inspector from './ui/Inspector.svelte';
  import Lesson from './ui/Lesson.svelte';
  import LevelStrip from './ui/LevelStrip.svelte';
  import LinePlot from './ui/LinePlot.svelte';
  import NetworkView from './ui/NetworkView.svelte';
  import PlanePlot from './ui/PlanePlot.svelte';
  import Readout from './ui/Readout.svelte';
  import ToolTray from './ui/ToolTray.svelte';

  // The level lives in the address, so a level can be linked to and the back button works.
  function fromHash() {
    const params = new URLSearchParams(location.search);
    if (params.has('unlock')) game.unlockAll = true;
    const wanted = Number(location.hash.replace('#', '')) - 1;
    if (Number.isInteger(wanted) && wanted !== game.index) game.go(wanted);
  }

  fromHash();

  $effect(() => {
    const hash = `#${game.index + 1}`;
    if (location.hash !== hash) history.replaceState(null, '', location.pathname + location.search + hash);
  });

  const showHill = $derived(game.level.hill !== undefined && game.hiddenSize === 0);
</script>

<svelte:window onhashchange={fromHash} />

<div class="app">
  <header class="top">
    <span class="mark hand">NeuralNudge</span>
    <LevelStrip />
  </header>

  <main>
    <section class="lesson-pane">
      <Lesson />
    </section>

    <section class="bench" aria-label="The machine">
      <div class="net-wrap">
        <NetworkView />
      </div>
      <ToolTray />
      <div class="under" class:with-hill={showHill}>
        {#if showHill}
          <HillPlot />
        {/if}
        <Inspector />
      </div>
    </section>

    <section class="world" aria-label="How it's doing">
      <Readout />
      <div class="plots">
        {#if game.level.view === 'line'}
          <LinePlot />
        {:else}
          <PlanePlot />
        {/if}
      </div>
      {#if game.focus}
        <p class="note">
          Showing {neuronName(game.spec, game.focus.layer, game.focus.neuron)} on its own. Click the output neuron to
          see the final answer again.
        </p>
      {/if}
    </section>
  </main>
</div>

<style>
  .app {
    min-height: 100%;
    display: grid;
    grid-template-rows: auto 1fr;
    padding: 0 clamp(1rem, 2.5vw, 2rem) 1.5rem;
    padding-left: max(clamp(1rem, 2.5vw, 2rem), env(safe-area-inset-left));
    padding-right: max(clamp(1rem, 2.5vw, 2rem), env(safe-area-inset-right));
  }

  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.9rem 0;
    border-bottom: 1.5px solid var(--rule);
  }

  .mark {
    font-size: var(--step-2);
    font-weight: 800;
    line-height: 1;
    letter-spacing: -0.02em;
  }

  main {
    display: grid;
    grid-template-columns: minmax(16rem, 22rem) minmax(0, 1.2fr) minmax(0, 1fr);
    gap: clamp(1.25rem, 2.5vw, 2.5rem);
    padding-top: 1.5rem;
    align-items: start;
  }

  .bench {
    display: grid;
    gap: 1.1rem;
    min-width: 0;
  }

  .net-wrap {
    border: 1.5px solid var(--rule);
    border-radius: 10px;
    padding: 0.5rem;
  }

  .world {
    display: grid;
    gap: 1rem;
    min-width: 0;
  }

  .plots {
    display: grid;
    gap: 0.9rem;
    max-width: 30rem;
  }

  .note {
    color: var(--dust);
    font-size: var(--step--1);
    max-width: 44ch;
  }

  .under.with-hill {
    display: grid;
    grid-template-columns: minmax(0, 17rem) minmax(0, 1fr);
    gap: 1.25rem;
    align-items: start;
  }

  @media (max-width: 1080px) {
    main {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }

    .lesson-pane {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 720px) {
    main {
      grid-template-columns: minmax(0, 1fr);
    }

    /* On a phone the plot goes above the dials, so both fit on screen while you turn them. */
    .world {
      order: 2;
    }

    .bench {
      order: 3;
    }

    .plots {
      max-width: 26rem;
    }

    .under.with-hill {
      grid-template-columns: minmax(0, 1fr);
      max-width: 26rem;
    }
  }
</style>
