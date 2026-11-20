<script lang="ts">
  import { game } from './game.svelte';
  import { neuronName } from './ui/names';
  import BoxPlot from './ui/BoxPlot.svelte';
  import Burst from './ui/Burst.svelte';
  import DrivePlot from './ui/DrivePlot.svelte';
  import HillPlot from './ui/HillPlot.svelte';
  import Inspector from './ui/Inspector.svelte';
  import Lesson from './ui/Lesson.svelte';
  import LevelStrip from './ui/LevelStrip.svelte';
  import LinePlot from './ui/LinePlot.svelte';
  import NetworkView from './ui/NetworkView.svelte';
  import PlanePlot from './ui/PlanePlot.svelte';
  import Readout from './ui/Readout.svelte';
  import Tally from './ui/Tally.svelte';
  import SurfacePlot from './ui/SurfacePlot.svelte';
  import Switch from './ui/Switch.svelte';
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
  /** The table of groups only makes sense with exactly two hidden neurons. */
  const showTally = $derived(
    !!game.level.show?.tally && game.spec.layers.length === 2 && game.spec.layers[0].size === 2,
  );
  /** Hidden neurons all have the same three dials, so they can share one box. */
  const showNeurons = $derived(!!game.level.show?.neurons && game.spec.layers.length === 2);
  const showSurface = $derived(!!game.level.show?.surface && game.spec.layers.length === 2);
  let lift = $state<'flat' | 'lifted'>(game.lifted ? 'lifted' : 'flat');
  $effect(() => {
    game.lifted = lift === 'lifted';
  });
</script>

<svelte:window onhashchange={fromHash} />

<div class="app">
  <header class="top">
    <span class="mark hand">NeuralNudge</span>
    <LevelStrip />
  </header>

  {#key game.index}
  <main>
    <section class="lesson-pane">
      <Lesson />
      <Inspector />
    </section>

    <section class="bench" aria-label="The machine">
      <div class="net-wrap">
        <NetworkView />
      </div>
      <ToolTray />
      {#if showHill}
        <div class="hill-wrap"><HillPlot /></div>
      {/if}
      {#if game.level.box && game.hiddenSize === 0}
        <div class="box-wrap"><BoxPlot /></div>
      {/if}
      {#if showTally && showNeurons}
        <Switch
          bind:value={game.under}
          label="What to show under the network"
          options={[
            { id: 'table', text: 'Table' },
            { id: 'box', text: 'Neurons as points' },
          ]}
        />
      {/if}
      {#if showTally && !(showNeurons && game.under === 'box')}
        <Tally />
      {:else if showNeurons}
        <div class="box-wrap"><BoxPlot /></div>
      {/if}
    </section>

    <section class="world" aria-label="How it's doing">
      <Readout />
      {#if showSurface}
        <Switch
          bind:value={lift}
          label="How to draw the dot plot"
          options={[
            { id: 'flat', text: 'Flat' },
            { id: 'lifted', text: 'Lifted' },
          ]}
        />
      {/if}
      <div class="plots" class:bare={showSurface && game.lifted}>
        {#if showSurface && game.lifted}
          <SurfacePlot />
        {:else if game.level.view === 'line'}
          <LinePlot />
        {:else if game.level.view === 'drive'}
          <DrivePlot />
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
  {/key}
</div>

<Burst />

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
    text-shadow: 0 0 18px color-mix(in srgb, var(--chalk) 35%, transparent);
  }

  main {
    display: grid;
    grid-template-columns: minmax(16rem, 22rem) minmax(0, 1.25fr) minmax(0, 1fr);
    gap: clamp(1.25rem, 2.5vw, 2.5rem);
    padding-top: 1.5rem;
    align-items: start;
    animation: arrive 0.35s ease-out;
  }

  /* The one page-level motion: a new level settles into place. */
  @keyframes arrive {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
  }

  .bench {
    display: grid;
    gap: 1.1rem;
    min-width: 0;
  }

  /* The machine sits in a lit well: the one place on the page that glows. */
  .net-wrap {
    border: 1.5px solid var(--rule);
    border-radius: 14px;
    padding: 0.5rem;
    background:
      radial-gradient(120% 90% at 50% 45%, rgba(40, 96, 84, 0.42), transparent 70%),
      var(--board-deep);
    box-shadow:
      inset 0 0 60px rgba(0, 0, 0, 0.45),
      0 18px 50px -24px rgba(0, 0, 0, 0.8);
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
    border-radius: 10px;
    box-shadow:
      0 0 0 1.5px var(--rule),
      0 18px 50px -24px rgba(0, 0, 0, 0.8);
  }

  .plots.bare {
    box-shadow: none;
  }

  .note {
    color: var(--dust);
    font-size: var(--step--1);
    max-width: 44ch;
  }

  .lesson-pane {
    display: grid;
    gap: 1.25rem;
    align-content: start;
  }

  .box-wrap {
    max-width: 20rem;
    justify-self: center;
    width: 100%;
  }

  .hill-wrap {
    max-width: 26rem;
    justify-self: center;
    width: 100%;
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
  }
</style>
