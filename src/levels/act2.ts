import type { NetSpec } from '../engine/net';
import type { Level } from './types';

/**
 * Two eyes in, two wheels out, nothing in between.
 * Dials, in order: left eye to left wheel, right eye to left wheel, left wheel's bias,
 * then left eye to right wheel, right eye to right wheel, right wheel's bias.
 */
const cart: NetSpec = { inputs: 2, layers: [{ size: 2, act: 'linear' }] };
const names = { inputs: ['left eye', 'right eye'], outputs: ['left wheel', 'right wheel'] };
const deg = (d: number) => (d * Math.PI) / 180;

/** Act 2: networks that steer things. */
export const act2: Level[] = [
  {
    id: 'two-eyes-two-wheels',
    title: 'Two eyes, two wheels',
    text: [
      'This machine has a body. Two eyes at the front each report how bright the lamp looks, from 0 to 1. Two neurons each set the speed of one wheel.',
      'Right now each eye feeds the wheel on its own side. The eye nearer the lamp sees more, its wheel spins faster, and the cart swings away.',
      'The dashed line is where the cart will go with the dials as they are. Nudge the four weights until it reaches the lamp, then press Go.',
    ],
    goalText: 'Drive to the lamp.',
    winText:
      'Crossed wires: the left eye drives the right wheel, so the cart turns toward whatever it sees. Nothing in there knows what a lamp is. Four numbers are enough to look like wanting.',
    explain: 'cart-steer',
    spec: cart,
    loss: 'mse',
    start: [1, 0, 0.25, 0, 1, 0.25],
    locked: [2, 5],
    data: [],
    view: 'drive',
    drive: { lamp: { x: -0.55, y: 0.55 }, starts: [{ x: 0.1, y: -0.8, a: deg(90) }], seconds: 12 },
    names,
    goal: { kind: 'arrive' },
    tools: { drag: true, go: true },
    fresh: ['go'],
    errorName: 'loss',
  },
  {
    id: 'in-the-dark',
    title: 'In the dark',
    text: [
      'Same cart, three starting places. One of them faces the wrong way, and eyes only see forwards.',
      "When both eyes report nothing, all that's left is the two biases. They are the wheel speeds in the dark.",
      'Give it something useful to do when it sees nothing.',
    ],
    goalText: 'Reach the lamp from all three starts.',
    winText:
      'With unequal biases the cart circles until an eye catches the light, then the weights take over. The biases are what it does by default. The weights are how it reacts.',
    explain: 'cart-dark',
    spec: cart,
    loss: 'mse',
    start: [0, 1, 0.25, 1, 0, 0.25],
    data: [],
    view: 'drive',
    drive: {
      lamp: { x: 0.5, y: 0.5 },
      starts: [
        { x: -0.7, y: -0.6, a: deg(30) },
        { x: 0.65, y: -0.7, a: deg(120) },
        { x: -0.25, y: 0.15, a: deg(215) },
      ],
      seconds: 14,
    },
    names,
    goal: { kind: 'arrive' },
    tools: { drag: true, go: true },
    errorName: 'loss',
  },
  {
    id: 'stop-at-the-lamp',
    title: 'Stop at the lamp',
    text: [
      "Arriving at full speed isn't arriving. This time the cart has to come to rest inside the ring, without hitting the lamp.",
      'A wheel slows down when its wire carries a negative weight: the brighter the eye, the slower the wheel. But a slowing wheel also swings the cart toward its own side.',
      'So which eye should slow which wheel?',
    ],
    goalText: 'Come to rest inside the ring.',
    winText:
      'Each eye now brakes the wheel on its own side harder than the other one, so the cart both turns toward the lamp and slows as it nears. Far away, the biases push the cart forward. Up close, brightness cancels them out, and it settles where the two balance. A thermostat holds a room at a temperature the same way.',
    spec: cart,
    loss: 'mse',
    start: [0, 1, 0.25, 1, 0, 0.25],
    data: [],
    view: 'drive',
    drive: { lamp: { x: 0.45, y: 0.4 }, starts: [{ x: -0.7, y: -0.7, a: deg(60) }], seconds: 24 },
    names,
    goal: { kind: 'park' },
    tools: { drag: true, go: true },
    errorName: 'loss',
  },
];

const untaught = [0, 0, 0, 0, 0, 0];

/** Act 3: the examples come from you. */
export const act3: Level[] = [
  {
    id: 'show-it-how',
    title: 'Show it how',
    text: [
      "You set the cart's dials yourself in the last three levels. Here they all start at zero and you can't turn them, so the cart just sits there.",
      'Drive it instead. Press Drive it yourself, then hold ◀ or ▶ to steer. The arrow keys work too, and the cart waits until you first touch one. Ten times a second the cart writes down what its eyes saw and what you did with the wheels.',
      "Each of those is an example, exactly like a dot in the earlier levels: an input, and the right answer for it. Run does what it has always done, and turns the dials downhill until the network's answers are close to yours. Watch the dashed line while it runs, then press Go.",
    ],
    goalText: 'Teach the cart to reach the lamp.',
    winText:
      "Training never knew about the lamp or the floor. It only turned the dials until the wheels did roughly what yours had, and reaching the lamp came along with that. It's the same loop as the dots: examples, a loss, downhill.",
    explain: 'taught',
    spec: cart,
    loss: 'mse',
    start: untaught,
    data: [],
    teach: true,
    view: 'drive',
    drive: { lamp: { x: 0, y: 0.3 }, starts: [{ x: -0.7, y: -0.7, a: deg(120) }], seconds: 14 },
    names,
    goal: { kind: 'arrive' },
    tools: { teach: true, step: true, run: true, go: true },
    fresh: ['teach'],
    rate: { value: 0.3, min: 0.05, max: 0.5 },
    runSpeed: 120,
    errorName: 'loss',
  },
  {
    id: 'off-the-path',
    title: 'Off the path',
    text: [
      'Two starting places now, one on each side of the lamp. Click a start on the floor, or its number below the network, to choose where you drive from.',
      'Drive from one side only, train, and press Go. Watch what the cart does from the side you never showed it.',
      "Then fix it. You still can't touch the dials. All you can give it is more examples.",
    ],
    goalText: 'Reach the lamp from both starts.',
    winText:
      'The cart copies what it was shown, and nothing else. With drives from both sides, one set of dials had to fit both. What it was missing was examples.',
    explain: 'taught-both-sides',
    spec: cart,
    loss: 'mse',
    start: untaught,
    data: [],
    teach: true,
    view: 'drive',
    drive: {
      lamp: { x: 0, y: 0.3 },
      starts: [
        { x: -0.7, y: -0.7, a: deg(120) },
        { x: 0.7, y: -0.7, a: deg(60) },
      ],
      seconds: 14,
    },
    names,
    goal: { kind: 'arrive' },
    tools: { teach: true, step: true, run: true, go: true },
    rate: { value: 0.3, min: 0.05, max: 0.5 },
    runSpeed: 120,
    errorName: 'loss',
  },
];
