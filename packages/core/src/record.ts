import { z } from 'zod';

/** ISO-8601 timestamp with offset, e.g. 2026-10-16T07:45:00+02:00. */
export const IsoDateTime = z.iso.datetime({ offset: true });
/** Calendar date YYYY-MM-DD. */
export const IsoDate = z.iso.date();
export const Id = z.string().min(1).max(64);

/** Server-ready fields carried by every record (README §8.3). */
export const RecordMeta = z.object({
  id: Id,
  ownerId: z.string().min(1),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  deletedAt: IsoDateTime.nullable(),
  rev: z.number().int().nonnegative(),
});
export type RecordMeta = z.infer<typeof RecordMeta>;

export const LOCAL_OWNER = 'local';
