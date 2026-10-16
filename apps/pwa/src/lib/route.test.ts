import { describe, expect, it } from 'vitest';
import { parseHash } from './route';

describe('parseHash', () => {
  it('defaults to root', () => {
    expect(parseHash('').path).toBe('/');
    expect(parseHash('#').segments).toEqual([]);
  });
  it('splits segments and query', () => {
    const r = parseHash('#/bags/bag%201?tab=stats');
    expect(r.segments).toEqual(['bags', 'bag 1']);
    expect(r.query.tab).toBe('stats');
  });
});
