import { describe, expect, it } from 'vitest';
import { normaliseGtin, sameGtin } from './barcode';

describe('GTIN barcodes', () => {
  it('accepts valid EAN-13, EAN-8, UPC-A and GTIN-14, with spaces or dashes', () => {
    expect(normaliseGtin('4006381333931')).toBe('4006381333931');
    expect(normaliseGtin('4006 3813 3393-1')).toBe('4006381333931');
    expect(normaliseGtin('96385074')).toBe('96385074');
    expect(normaliseGtin('036000291452')).toBe('036000291452');
    expect(normaliseGtin('14006381333938')).toBe('14006381333938');
  });

  it('rejects wrong check digits, lengths and non-digits', () => {
    expect(normaliseGtin('4006381333932')).toBeNull();
    expect(normaliseGtin('400638133393')).toBeNull();
    expect(normaliseGtin('abc')).toBeNull();
    expect(normaliseGtin('')).toBeNull();
  });

  it('treats zero-padded forms as the same product', () => {
    expect(sameGtin('036000291452', '0036000291452')).toBe(true);
    expect(sameGtin('4006381333931', '4006381333948')).toBe(false);
  });
});
