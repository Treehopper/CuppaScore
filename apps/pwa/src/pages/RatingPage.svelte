<script lang="ts">
  import type { RatingDto } from '@cuplog/api';
  import { untrack } from 'svelte';
  import BrewDetails from '../components/BrewDetails.svelte';
  import CafeDetails from '../components/CafeDetails.svelte';
  import DetailInput from '../components/DetailInput.svelte';
  import PageHeader from '../components/PageHeader.svelte';
  import StarInput from '../components/StarInput.svelte';
  import { t } from '../i18n/i18n.svelte';
  import { api } from '../lib/api';
  import { MEAL_CHOICES, RATING_LEVELS, TIMES_OF_DAY, type MealType } from '../lib/domain';
  import { showError } from '../lib/errors';
  import { bagTitle } from '../lib/labels';
  import { brewToForm, cafeToForm, detailFromRating, formToBrew, formToCafe, levelPatch } from '../lib/logForm';
  import { query } from '../lib/query.svelte';
  import { router } from '../lib/router.svelte';
  import { toasts } from '../lib/toast.svelte';

  /** Edit or delete one cup, flag it as not representative (README §3 B9, B10). */
  let { initial }: { initial: RatingDto } = $props();

  type TimeOfDay = RatingDto['timeOfDay'];

  const r0 = untrack(() => initial);
  let level = $state(r0.level);
  let swipe = $state<'more' | 'less' | null>(r0.swipe ?? null);
  let detail = $state(detailFromRating(r0));
  let meal = $state<MealType>(r0.meal.type);
  let mealNote = $state(r0.meal.note ?? '');
  // wall-clock time as stored (settings time zone), edited without offset
  let when = $state(r0.ratedAt.slice(0, 16));
  let timeOfDay = $state<TimeOfDay | ''>('');
  let brewForm = $state(brewToForm(r0.brew));
  let cafeForm = $state(cafeToForm(r0.cafe, r0.beanKnown, r0.cafe?.drink ?? 'other'));
  let note = $state(r0.note);
  let excluded = $state(r0.excluded);
  let excludeReason = $state(r0.excludeReason ?? '');
  let saving = $state(false);

  const bag = query(() => (r0.bagId ? api().getBag(r0.bagId) : Promise.resolve(null)), ['bags']);
  const venues = query(() => api().listVenues(), ['venues']);
  const context = $derived(
    r0.source === 'home'
      ? [r0.brew ? t(`brew.${r0.brew.method}`) : '', bag.data ? bagTitle(bag.data) : ''].filter(Boolean).join(' · ')
      : [venues.data?.find((v) => v.venue.id === r0.venueId)?.venue.name ?? '', t(`drink.${cafeForm.drink}`)].join(' · '),
  );

  const valid = $derived(level === 'swipe' ? swipe !== null : detail.stars !== null);

  async function save(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    if (!valid) return;
    saving = true;
    try {
      await api().updateRating(r0.id, {
        level,
        ...levelPatch(level, detail, swipe),
        meal: mealNote.trim() ? { type: meal, note: mealNote.trim() } : { type: meal },
        ...(when !== r0.ratedAt.slice(0, 16) ? { ratedAt: when } : {}),
        ...(timeOfDay ? { timeOfDay } : {}),
        ...(r0.source === 'home' && r0.brew ? { brew: formToBrew(r0.brew.method, brewForm) } : {}),
        ...(r0.source === 'cafe' ? formToCafe(cafeForm) : {}),
        note,
      });
      if (excluded !== r0.excluded || (excluded && excludeReason !== (r0.excludeReason ?? ''))) {
        await api().setRatingExcluded(r0.id, excluded, excludeReason.trim() || undefined);
      }
      toasts.show(t('settings.saved'));
      history.back();
    } catch (err) {
      showError(err);
    } finally {
      saving = false;
    }
  }

  async function remove(): Promise<void> {
    try {
      await api().deleteRating(r0.id);
      toasts.show(t('rating.deleted'), {
        action: { label: t('common.undo'), run: () => api().restoreRating(r0.id).then(() => undefined) },
      });
      router.go('/ratings', { replace: true });
    } catch (err) {
      showError(err);
    }
  }
</script>

<PageHeader title={t('rating.editTitle')} back="/ratings" />

<form class="stack" onsubmit={save}>
  <p class="muted">{context}</p>

  <div class="field">
    <span id="edit-level">{t('log.rate')}</span>
    <div class="segmented" role="radiogroup" aria-labelledby="edit-level">
      {#each RATING_LEVELS as l (l)}
        <button type="button" role="radio" aria-checked={level === l} onclick={() => (level = l)}>{t(`level.${l}`)}</button>
      {/each}
    </div>
  </div>

  <section class="card stack">
    {#if level === 'swipe'}
      <div class="segmented" role="radiogroup" aria-label={t('level.swipe')}>
        <button type="button" role="radio" aria-checked={swipe === 'less'} onclick={() => (swipe = 'less')}>👎 {t('swipe.less')}</button>
        <button type="button" role="radio" aria-checked={swipe === 'more'} onclick={() => (swipe = 'more')}>👍 {t('swipe.more')}</button>
      </div>
    {:else}
      <StarInput bind:value={detail.stars} label={t('log.stars')} />
      {#if level === 'advanced'}<DetailInput bind:value={detail} />{/if}
      <div class="field">
        <span id="edit-buy">{t('log.wouldBuyAgain')}</span>
        <div class="chips" role="radiogroup" aria-labelledby="edit-buy">
          {#each [true, false] as v (v)}
            <button
              type="button"
              class="chip"
              role="radio"
              aria-checked={detail.wouldBuyAgain === v}
              onclick={() => (detail.wouldBuyAgain = detail.wouldBuyAgain === v ? null : v)}
              >{v ? t('common.yes') : t('common.no')}</button
            >
          {/each}
        </div>
      </div>
    {/if}
  </section>

  <div class="field">
    <span id="edit-meal">{t('log.meal')}</span>
    <div class="chips" role="radiogroup" aria-labelledby="edit-meal">
      {#each MEAL_CHOICES as m (m)}
        <button type="button" class="chip" role="radio" aria-checked={meal === m} onclick={() => (meal = meal === m ? 'unspecified' : m)}
          >{t(`meal.${m}`)}</button
        >
      {/each}
    </div>
  </div>
  <label class="field">
    <span>{t('rating.mealNote')}</span>
    <input bind:value={mealNote} maxlength="80" placeholder={t('rating.mealNoteHint')} />
  </label>

  <label class="field">
    <span>{t('rating.when')}</span>
    <input type="datetime-local" bind:value={when} required />
  </label>
  <label class="field">
    <span>{t('rating.timeOfDay')}</span>
    <select bind:value={timeOfDay}>
      <option value="">{t('rating.timeOfDayAuto', { bucket: t(`timeOfDay.${r0.timeOfDay}`) })}</option>
      {#each TIMES_OF_DAY as b (b)}
        <option value={b}>{t(`timeOfDay.${b}`)}</option>
      {/each}
    </select>
  </label>

  {#if r0.source === 'home' && r0.brew}
    <BrewDetails method={r0.brew.method} form={brewForm} onchange={(f) => (brewForm = f)} />
  {:else if r0.source === 'cafe'}
    <CafeDetails form={cafeForm} onchange={(f) => (cafeForm = f)} />
  {/if}

  <label class="field">
    <span>{t('bag.notes')}</span>
    <textarea bind:value={note} rows="2"></textarea>
  </label>

  <section class="card stack">
    <label class="check">
      <input type="checkbox" bind:checked={excluded} />
      <span>{t('rating.notRepresentative')}</span>
    </label>
    <p class="small muted">{t('rating.notRepresentativeHint')}</p>
    {#if excluded}
      <label class="field">
        <span>{t('rating.reason')}</span>
        <input bind:value={excludeReason} maxlength="200" placeholder={t('rating.reasonHint')} />
      </label>
    {/if}
  </section>

  <button type="submit" class="btn-primary btn-block" disabled={!valid || saving}>{t('common.save')}</button>
  <button type="button" class="btn-block danger" onclick={remove}>{t('common.delete')}</button>
</form>

<style>
  .danger {
    color: var(--bad);
  }
</style>
