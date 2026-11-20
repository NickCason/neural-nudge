import { act1 } from './act1';
import { act2, act3 } from './act2';
import type { Level } from './types';

/** Every level, in the order they're played. */
export const levels: Level[] = [...act1, ...act2, ...act3];
