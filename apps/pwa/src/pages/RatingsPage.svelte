<script lang="ts">
  import type { RatingDto } from '@cuplog/api';
  import PageHeader from '../components/PageHeader.svelte';
  import RatingRow from '../components/RatingRow.svelte';
  import { fmtDate } from '../i18n/format';
  import { t } from '../i18n/i18n.svelte';
  import { api } from '../lib/api';
  import { bagTitle } from '../lib/labels';
  import { query } from '../lib/query.svelte';

  /** All cups, newest first, grouped by day (README §3 B10). */
  const ratings = query(() => api().listRatings(), ['ratings']);
  const bags = query(() => api().listBags(), ['bags', 'products']);
  const venues = query(() => api().listVenues(), ['venues']);

  const days = $derived.by(() => {
    const out: { day: string; items: RatingDto[] }[] = [];
    for (const r of ratings.data ?? []) {
      const day = r.ratedAt.slice(0, 10);
      if (out.at(-1)?.day !== day) out.push({ day, items: [] });
      out.at(-1)!.items.push(r);
    }
    return out;
  });

  function context(r: RatingDto): string {
    if (r.bagId) {
      const b = bags.data?.find((x) => x.bag.id === r.bagId);
      return b ? bagTitle(b) : '';
    }
    return venues.data?.find((v) => v.venue.id === r.venueId)?.venue.name ?? '';
  }
</script>

<PageHeader title={t('ratings.title')} back="/log" />

{#if ratings.data && ratings.data.length === 0}
  <p class="muted">{t('ratings.empty')}</p>
{/if}

{#each days as d (d.day)}
  <section>
    <h2 class="small muted day">{fmtDate(`${d.day}T12:00:00`, { dateStyle: 'full' })}</h2>
    <ul class="list">
      {#each d.items as r (r.id)}<li><RatingRow rating={r} context={context(r)} timeOnly /></li>{/each}
    </ul>
  </section>
{/each}

<style>
  .day {
    margin: 1rem 0 0.25rem;
    font-weight: 600;
  }
</style>
