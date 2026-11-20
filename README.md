# NeuralNudge

Learn how neural networks work by being the optimizer first.

You start with one neuron and one dial, and tune it by hand. Each level takes something you were
doing manually and hands it to the machine: first you see the loss as a landscape, then you get
the slope under your feet, then a button that steps downhill for you. By the end of the first act
you have hit the wall a single neuron can't get past, and built the hidden layer that gets past it.

The network is always on screen. Every weight and bias is a dial you can read, drag, or type into,
and hovering a data point sends it through the network so you can watch the numbers.

## Run it

```sh
npm install
npm run dev        # http://127.0.0.1:8097
```

## Check it

```sh
npm test           # gradients against finite differences; every level proven solvable; terrain visibility
npm run build      # type-check and build to dist/
npm run preview    # serve dist/ on :8097
npm run e2e        # play every level through the real UI (needs preview running)
npm run shots      # screenshot every level into shots/
```

## How it's put together

- `src/engine/` is a small fully-connected network with every parameter addressable by index.
  `evaluate` returns the loss and its gradient; `trace` returns every intermediate value.
  It is a layered implementation, not a general autograd graph.
- `src/levels/` holds the levels as plain data: network shape, starting values, examples,
  which tools are unlocked, and the goal.
- `src/play.ts` holds the rules (stepping, goals, growing the network) with no UI in it.
- `src/game.svelte.ts` is the single piece of live state the interface reads.
- `src/ui/` is the interface: the network view, the three plots, lesson, tools, inspector.
  The network is two layers: `netPaint.ts` paints the glowing wires, the signal flowing along them,
  and a live picture inside each neuron of what it computes; SVG on top carries the dials and labels.
  `terrain.ts` is the geometry of the 3D loss landscape, tested so the goal can never be hidden.

Append `?unlock` to the address to open every level without solving the earlier ones.

## Deploying

```sh
npm run deploy     # test, build, and publish dist/ to the gh-pages branch
```

GitHub Pages serves the `gh-pages` branch. The build uses relative paths, so it works both at
`user.github.io/repo/` and on a custom domain.
