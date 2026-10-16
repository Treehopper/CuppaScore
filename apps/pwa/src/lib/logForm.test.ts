import { describe, expect, it } from 'vitest';
import {
  brewToForm,
  cafeToForm,
  detailFields,
  detailFromRating,
  emptyDetail,
  formToBrew,
  formToCafe,
  levelPatch,
  parseNum,
} from './logForm';

describe('parseNum', () => {
  it('accepts comma and dot decimals, rejects garbage', () => {
    expect(parseNum('15,5')).toBe(15.5);
    expect(parseNum(' 16 ')).toBe(16);
    expect(parseNum('')).toBeUndefined();
    expect(parseNum('abc')).toBeUndefined();
    expect(parseNum('29.6', true)).toBe(30);
  });
});

describe('brew form', () => {
  it('round-trips an AeroPress brew', () => {
    const brew = {
      method: 'aeropress' as const,
      doseG: 15,
      waterG: 230,
      grind: 'Comandante 18',
      tempC: 90,
      timeS: 120,
      milk: 'none' as const,
      methodParams: { kind: 'aeropress' as const, orientation: 'inverted' as const, filter: 'paper' as const, bypassG: 0 },
    };
    expect(formToBrew('aeropress', brewToForm(brew))).toEqual(brew);
  });

  it('round-trips Flair NEO params incl. preheat false', () => {
    const brew = {
      method: 'flairNeo' as const,
      doseG: 16,
      yieldG: 36,
      timeS: 40,
      methodParams: { kind: 'flairNeo' as const, basket: 'flowControl' as const, preheat: false, preinfusionS: 8, pressure: 'medium' as const },
    };
    expect(formToBrew('flairNeo', brewToForm(brew))).toEqual(brew);
  });

  it('leaves unset fields absent and drops params of another method', () => {
    const f = brewToForm({
      method: 'aeropress',
      doseG: 15,
      methodParams: { kind: 'aeropress', orientation: 'standard' },
    });
    expect(formToBrew('flairNeo', f)).toEqual({ method: 'flairNeo', doseG: 15 });
    expect(formToBrew('v60', brewToForm(null))).toEqual({ method: 'v60' });
  });
});

describe('detailFields', () => {
  const d = {
    ...emptyDetail(),
    stars: 4,
    wouldBuyAgain: false,
    strength: 3,
    profile: { sweetness: 2 },
    wish: { sweetness: 'more' as const },
    tags: ['berry' as const],
  };

  it('keeps only stars fields at the Stars level', () => {
    expect(detailFields('stars', d)).toEqual({ overall: 4, wouldBuyAgain: false });
  });

  it('adds the detail fields at the Detail level', () => {
    expect(detailFields('advanced', d)).toEqual({
      overall: 4,
      wouldBuyAgain: false,
      strength: 3,
      profile: { sweetness: 2 },
      wish: { sweetness: 'more' },
      flavourTags: ['berry'],
    });
  });

  it('omits everything not set', () => {
    expect(detailFields('advanced', { ...emptyDetail(), stars: 3 })).toEqual({ overall: 3 });
  });
});

describe('café form', () => {
  it('defaults for a new venue and round-trips', () => {
    const f = cafeToForm(null, null, 'cappuccino');
    expect(f).toEqual({ drink: 'cappuccino', milk: 'unknown', size: 'regular', bean: 'unknown', price: '' });
    expect(formToCafe(f)).toEqual({ cafe: { drink: 'cappuccino', milk: 'unknown', size: 'regular' }, beanKnown: 'unknown' });
    const cafe = { drink: 'flatWhite' as const, milk: 'plant' as const, size: 'large' as const, priceEur: 4.2 };
    expect(formToCafe(cafeToForm(cafe, 'house', 'espresso'))).toEqual({ cafe, beanKnown: 'house' });
  });

  it('parses a comma price', () => {
    expect(formToCafe({ ...cafeToForm(null, null, 'espresso'), price: '2,8' }).cafe.priceEur).toBe(2.8);
  });
});

describe('editing', () => {
  const base = {
    level: 'advanced' as const,
    overall: 4,
    strength: 2,
    flavourTags: ['citrus' as const],
    profile: { body: 3 },
    meal: { type: 'none' as const },
  };

  it('loads a rating into the edit state', () => {
    expect(detailFromRating(base as never)).toEqual({
      stars: 4,
      wouldBuyAgain: null,
      strength: 2,
      profile: { body: 3 },
      wish: {},
      tags: ['citrus'],
    });
  });

  it('sends null for everything not set at the level', () => {
    const d = { ...detailFromRating(base as never), tags: [] };
    expect(levelPatch('advanced', d, null)).toEqual({
      swipe: null,
      overall: 4,
      wouldBuyAgain: null,
      strength: 2,
      profile: { body: 3 },
      wish: null,
      flavourTags: null,
    });
    expect(levelPatch('swipe', d, 'less')).toEqual({
      swipe: 'less',
      overall: null,
      wouldBuyAgain: null,
      strength: null,
      profile: null,
      wish: null,
      flavourTags: null,
    });
  });
});
