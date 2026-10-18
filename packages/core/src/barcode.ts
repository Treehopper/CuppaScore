/**
 * Retail barcodes (GTIN: EAN-8, UPC-A, EAN-13, GTIN-14) for A2 "scan the bag". Pure: no camera
 * here, the UI hands over the decoded digits.
 */

/** Digits only, or null when the input can't be a GTIN (wrong length / check digit). */
export function normaliseGtin(input: string): string | null {
  const digits = input.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(digits) || ![8, 12, 13, 14].includes(digits.length)) return null;
  return gtinCheckDigitOk(digits) ? digits : null;
}

/** GS1 mod-10: weights 3,1,3,… from the right, excluding the check digit. */
export function gtinCheckDigitOk(digits: string): boolean {
  let sum = 0;
  for (let i = digits.length - 2, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += Number(digits[i]) * w;
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1]);
}

/** Same product regardless of zero padding (UPC-A "0…" read as EAN-13, GTIN-14 with leading 0). */
export function sameGtin(a: string, b: string): boolean {
  return a.padStart(14, '0') === b.padStart(14, '0');
}
