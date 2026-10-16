<script lang="ts">
  import type { PresetView } from '@cuplog/api';
  import { untrack } from 'svelte';
  import CafeDetails from '../../components/CafeDetails.svelte';
  import PresetChips from '../../components/PresetChips.svelte';
  import RatingPanel from '../../components/RatingPanel.svelte';
  import { fmtTime } from '../../i18n/format';
  import { t } from '../../i18n/i18n.svelte';
  import { api } from '../../lib/api';
  import { DRINKS, type RatingLevel } from '../../lib/domain';
  import { showError } from '../../lib/errors';
  import { logCup, type LogCmd } from '../../lib/logCup';
  import { cafeToForm, formToCafe, type CafeForm, type Drink } from '../../lib/logForm';
  import { query } from '../../lib/query.svelte';
  import { router } from '../../lib/router.svelte';

  /** Quick Log for café-made cups (README §3 B2b/B2c, §9.2 café mode). */
  let { defaultLevel }: { defaultLevel: RatingLevel } = $props();

  const NEW_VENUE = '__new__';
  const MAX_CHIPS = 4;
  const DEFAULT_DRINK: Drink = 'cappuccino';

  const presets = query(() => api().listPresets({ source: 'cafe' }), ['ratings', 'venues', 'settings']);
  const venues = query(() => api().listVenues(), ['venues', 'ratings']);

  // explicit picks; `?venue=` comes from "Same as last time" on the venue list
  let picked = $state<{ venueId: string | null; drink: Drink | null; level: RatingLevel | null }>({
    venueId: untrack(() => router.current.query.venue ?? null),
    drink: null,
    level: null,
  });
  let newVenueName = $state('');

  const top = $derived<PresetView | undefined>(presets.data?.[0]);
  const venueId = $derived(
    picked.venueId ?? top?.preset.venueId ?? venues.data?.[0]?.venue.id ?? (venues.data ? NEW_VENUE : null),
  );
  const isNew = $derived(venueId === NEW_VENUE);
  const venue = $derived(venues.data?.find((v) => v.venue.id === venueId)?.venue);

  /** Café presets at a venue, latest first. */
  const atVenue = (id: string | null): PresetView[] =>
    (presets.data ?? [])
      .filter((p) => p.preset.venueId === id)
      .sort((a, b) => Date.parse(b.preset.lastUsedAt) - Date.parse(a.preset.lastUsedAt));
  // the venue remembers the last drink (timestamps have second precision, so it beats sorting alone)
  const lastHere = $derived.by(() => {
    const here = atVenue(venueId);
    return here.find((p) => p.preset.drink === venue?.lastDrink) ?? here[0];
  });

  const drink = $derived<Drink>(
    picked.drink ?? (picked.venueId || !top ? venue?.lastDrink : top.preset.drink) ?? DEFAULT_DRINK,
  );

  // café details come from the latest cup of this drink here; edits stick to venue + drink
  const detailsKey = $derived(`${venueId}:${drink}`);
  let edits = $state<{ key: string; form: CafeForm } | null>(null);
  const form = $derived.by(() => {
    if (edits && edits.key === detailsKey) return edits.form;
    const p = atVenue(venueId).find((x) => x.preset.drink === drink);
    return cafeToForm(p?.preset.lastCafe, p?.preset.lastBeanKnown, drink);
  });

  const presetKey = $derived(venueId && !isNew ? `cafe:${venueId}:${drink}:${form.milk}:${form.size}` : null);
  const preset = $derived(presets.data?.find((p) => p.preset.key === presetKey));
  const level = $derived<RatingLevel>(picked.level ?? preset?.preset.lastLevel ?? defaultLevel);

  // drinks you had before first (by uses), then the rest (README §9.2 "Drink ▾")
  const drinks = $derived.by(() => {
    const uses: Partial<Record<Drink, number>> = {};
    for (const p of presets.data ?? []) uses[p.preset.drink!] = (uses[p.preset.drink!] ?? 0) + p.preset.uses;
    return [...DRINKS].sort((a, b) => (uses[b] ?? 0) - (uses[a] ?? 0));
  });

  function choosePreset(p: PresetView): void {
    picked = { venueId: p.preset.venueId, drink: p.preset.drink, level: null };
    edits = { key: `${p.preset.venueId}:${p.preset.drink}`, form: cafeToForm(p.preset.lastCafe, p.preset.lastBeanKnown, p.preset.drink!) };
  }

  function chipLabel(p: PresetView): string {
    const parts = [p.venue?.name ?? '', t(`drink.${p.preset.drink}`)];
    if (p.preset.milk && p.preset.milk !== 'unknown') parts.push(t(`milk.${p.preset.milk}`));
    if (p.preset.size && p.preset.size !== 'regular') parts.push(t(`size.${p.preset.size}`));
    return parts.join(' · ');
  }

  const ready = $derived(isNew ? newVenueName.trim().length > 0 : !!venue);

  async function save(rating: Partial<LogCmd>): Promise<boolean> {
    let id = venueId;
    try {
      if (isNew) id = (await api().addVenue({ name: newVenueName.trim() })).id;
    } catch (e) {
      showError(e);
      return false;
    }
    if (!id || id === NEW_VENUE) return false;
    const ok = await logCup({ ...rating, level, source: 'cafe', venueId: id, ...formToCafe(form) });
    if (ok) {
      edits = null;
      newVenueName = '';
      picked = { venueId: id, drink, level: picked.level };
    }
    return ok;
  }
</script>

<PresetChips
  presets={(presets.data ?? []).slice(0, MAX_CHIPS)}
  activeKey={presetKey}
  label={chipLabel}
  onpick={choosePreset}
/>

<div class="row">
  <label class="field">
    <span>{t('log.venue')}</span>
    <select
      value={venueId ?? ''}
      onchange={(e) => (picked = { venueId: e.currentTarget.value, drink: null, level: null })}
      data-testid="log-venue"
    >
      {#each venues.data ?? [] as v (v.venue.id)}
        <option value={v.venue.id}>{v.venue.name}</option>
      {/each}
      <option value={NEW_VENUE}>{t('log.addVenue')}</option>
    </select>
  </label>
  <label class="field">
    <span>{t('log.drink')}</span>
    <select
      value={drink}
      onchange={(e) => (picked = { ...picked, venueId, drink: e.currentTarget.value as Drink, level: null })}
      data-testid="log-drink"
    >
      {#each drinks as d (d)}
        <option value={d}>{t(`drink.${d}`)}</option>
      {/each}
    </select>
  </label>
</div>

{#if isNew}
  <label class="field">
    <span>{t('log.venueName')}</span>
    <input bind:value={newVenueName} autocomplete="off" />
  </label>
{:else if lastHere && lastHere.preset.key !== presetKey}
  <button type="button" class="btn-block" onclick={() => choosePreset(lastHere)}>{t('log.sameAsLastTime')}</button>
{/if}
{#if venues.data?.length}
  <p class="small all"><a href="#/venues">{t('venues.all')}</a></p>
{/if}

<RatingPanel
  {level}
  onlevel={(l) => (picked = { ...picked, venueId, drink, level: l })}
  {ready}
  swipeTitle={`${venue?.name ?? newVenueName} · ${t(`drink.${drink}`)}`}
  swipeSubtitle={fmtTime(Date.now())}
  onsave={save}
>
  {#snippet details()}
    <CafeDetails {form} onchange={(f) => (edits = { key: detailsKey, form: f })} />
  {/snippet}
</RatingPanel>

<style>
  .all {
    margin: -0.25rem 0 0;
    text-align: right;
  }
</style>
