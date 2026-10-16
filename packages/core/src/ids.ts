import type { Clock, IdGenerator, Rng } from './ports';

const hex = (n: number, width: number): string => n.toString(16).padStart(width, '0');

/** RFC 9562 UUIDv7: 48-bit ms timestamp, version 7, 74 random bits. Sortable by creation time. */
export function uuidv7(ms: number, rng: Rng): string {
  const rand = (bits: number): number => Math.floor(rng() * 2 ** bits);
  const tsHi = Math.floor(ms / 2 ** 16);
  const tsLo = ms % 2 ** 16;
  const randA = rand(12);
  const randB1 = (rand(14) | 0x8000) & 0xbfff; // variant 10xx
  const randB2 = rand(24);
  const randB3 = rand(24);
  return [
    hex(tsHi, 8),
    hex(tsLo, 4),
    hex(0x7000 | randA, 4),
    hex(randB1, 4),
    hex(randB2, 6) + hex(randB3, 6),
  ].join('-');
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * UUIDv7 generator that stays monotonic within the same millisecond
 * (bumps the timestamp by 1 ms if needed), so ids sort by creation order.
 */
export function uuidv7Generator(clock: Clock, rng: Rng): IdGenerator {
  let last = -1;
  return {
    next() {
      const now = clock.now();
      last = now > last ? now : last + 1;
      return uuidv7(last, rng);
    },
  };
}
