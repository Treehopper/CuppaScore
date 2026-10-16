import { z } from 'zod';
import { BREW_METHODS, BrewMethod, OutlierMethod, RatingLevel } from './enums';
import { IsoDateTime } from './record';
import { DEFAULT_TIME_ZONE } from './time';

export const ConfidenceWeights = z.object({
  swipe: z.number().min(0).max(5),
  stars: z.number().min(0).max(5),
  advanced: z.number().min(0).max(5),
});
export type ConfidenceWeights = z.infer<typeof ConfidenceWeights>;

export const DEFAULT_CONFIDENCE: ConfidenceWeights = { swipe: 0.5, stars: 1.0, advanced: 1.2 };

/** Domain settings (README §4.6). Reminders are added in M1b. */
export const DomainSettings = z.object({
  halfLifeDays: z.number().min(1).max(3650).default(60),
  outlierMethod: OutlierMethod.default('mad'),
  ownedMethods: z.array(BrewMethod).default([...BREW_METHODS]),
  defaultLevel: RatingLevel.default('stars'),
  confidence: ConfidenceWeights.default(DEFAULT_CONFIDENCE),
  timeZone: z.string().min(1).max(64).default(DEFAULT_TIME_ZONE),
  wishlist: z.array(z.string().max(200)).default([]),
  dismissed: z.array(z.string().max(200)).default([]),
  /** preset keys pinned to the top of the quick log */
  pinnedPresets: z.array(z.string().max(200)).default([]),
  onboardingCompletedAt: IsoDateTime.nullable().default(null),
  updatedAt: IsoDateTime.nullable().default(null),
  rev: z.number().int().nonnegative().default(0),
});
export type DomainSettings = z.infer<typeof DomainSettings>;

export const defaultSettings = (): DomainSettings => DomainSettings.parse({});
