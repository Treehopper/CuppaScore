import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { detectOutliers } from './outliers';

const items = (xs: number[]) => xs.map((x, i) => ({ id: `r${i}`, x }));

describe('detectOutliers', () => {
  it('excludes a clear outlier with its robust z', () => {
    const res = detectOutliers(items([0.5, 0.4, 0.5, 0.6, 0.45, 0.55, -1]));
    expect(res.method).toBe('mad');
    expect(res.excluded).toEqual([{ id: 'r6', reason: { kind: 'auto', z: -20.2 } }]);
  });

  it('skips automatic exclusion below 5 ratings or with MAD = 0', () => {
    expect(detectOutliers(items([0.5, 0.5, 0.5, -1])).method).toBe('trimmed');
    const flat = detectOutliers(items([0.5, 0.5, 0.5, 0.5, 0.5, -1]));
    expect(flat.method).toBe('trimmed');
    expect(flat.excluded).toEqual([]);
  });

  it('manual exclusions are always reported and never used for the median', () => {
    const res = detectOutliers([{ id: 'm', x: 0, excluded: true }, ...items([1, 1, 1])]);
    expect(res.excluded).toEqual([{ id: 'm', reason: { kind: 'manual' } }]);
    expect(res.keptIds).toEqual(['r0', 'r1', 'r2']);
  });

  it('partitions the input', () => {
    fc.assert(
      fc.property(fc.array(fc.double({ min: -1, max: 1, noNaN: true }), { maxLength: 40 }), (xs) => {
        const res = detectOutliers(items(xs));
        expect(res.keptIds.length + res.excluded.length).toBe(xs.length);
      }),
    );
  });

  it('is invariant under shifting and positive scaling', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -100, max: 100 }), { minLength: 5, maxLength: 40 }),
        fc.integer({ min: -50, max: 50 }),
        fc.integer({ min: 1, max: 9 }),
        (xs, shift, scale) => {
          const a = detectOutliers(items(xs)).excluded.map((e) => e.id);
          const b = detectOutliers(items(xs.map((x) => x * scale + shift))).excluded.map((e) => e.id);
          expect(b).toEqual(a);
        },
      ),
    );
  });

  it('never excludes the majority', () => {
    fc.assert(
      fc.property(fc.array(fc.double({ min: -1, max: 1, noNaN: true }), { minLength: 5, maxLength: 40 }), (xs) => {
        expect(detectOutliers(items(xs)).excluded.length).toBeLessThanOrEqual(xs.length / 2);
      }),
    );
  });

  it('method off excludes only manual ones', () => {
    expect(detectOutliers(items([0, 0, 0, 0, 0.01, 0, 9]), 'off').excluded).toEqual([]);
  });
});
