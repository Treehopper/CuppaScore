import { describe, expect, it } from 'vitest';
import { bagCostPerCup } from './bag';

describe('bagCostPerCup', () => {
  const bag = { priceEur: 15, weightG: 250, openedAt: '2026-10-01', finishedAt: null };
  it('finished bag: price over cups logged', () => {
    expect(bagCostPerCup({ ...bag, finishedAt: '2026-10-15' }, 12)).toBe(1.25);
  });
  it('open bag: estimated from weight and dose', () => {
    expect(bagCostPerCup(bag, 3, 16)).toBeCloseTo(15 / (250 / 16), 9);
    expect(bagCostPerCup(bag, 3)).toBeCloseTo(0.9, 9);
  });
  it('null without a price or a way to count cups', () => {
    expect(bagCostPerCup({ ...bag, priceEur: null }, 5)).toBeNull();
    expect(bagCostPerCup({ ...bag, weightG: null }, 5)).toBeNull();
    expect(bagCostPerCup({ ...bag, weightG: null, finishedAt: '2026-10-15' }, 0)).toBeNull();
  });
});
