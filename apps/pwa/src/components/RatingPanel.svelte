<script lang="ts">
  import type { Snippet } from 'svelte';
  import { t } from '../i18n/i18n.svelte';
  import { MEAL_CHOICES, RATING_LEVELS, type MealType, type RatingLevel } from '../lib/domain';
  import type { LogCmd } from '../lib/logCup';
  import { detailFields, emptyDetail } from '../lib/logForm';
  import DetailInput from './DetailInput.svelte';
  import Icon from './Icon.svelte';
  import StarInput from './StarInput.svelte';

  type RatingPart = Pick<LogCmd, 'swipe' | 'overall' | 'wouldBuyAgain' | 'strength' | 'profile' | 'wish' | 'flavourTags' | 'meal'>;

  /**
   * Level switch + the rating itself (Swipe / Stars / Detail), meal and Save; shared by home and
   * café logging. `onsave` gets only the fields of the current level and returns whether it saved.
   */
  let {
    level,
    onlevel,
    ready,
    swipeTitle,
    swipeSubtitle,
    details,
    onsave,
  }: {
    level: RatingLevel;
    onlevel: (l: RatingLevel) => void;
    /** context (bag/method or venue/drink) is complete */
    ready: boolean;
    swipeTitle: string;
    swipeSubtitle: string;
    /** brew or café details, shown at every level */
    details?: Snippet;
    onsave: (r: RatingPart) => Promise<boolean>;
  } = $props();

  let detail = $state(emptyDetail());
  let meal = $state<MealType>('unspecified');
  let saving = $state(false);

  const canSave = $derived(ready && !saving && detail.stars !== null);

  async function save(swipe?: 'more' | 'less'): Promise<void> {
    if (!ready || saving) return;
    saving = true;
    const ok = await onsave({
      meal: { type: meal },
      ...(level === 'swipe' ? { swipe } : detailFields(level, detail)),
    });
    saving = false;
    if (ok) {
      detail = emptyDetail();
      meal = 'unspecified';
    }
  }
</script>

<div class="field">
  <span id="rate-level">{t('log.rate')}</span>
  <div class="segmented" role="radiogroup" aria-labelledby="rate-level">
    {#each RATING_LEVELS as l (l)}
      <button type="button" role="radio" aria-checked={level === l} onclick={() => onlevel(l)}>
        {t(`level.${l}`)}
      </button>
    {/each}
  </div>
</div>

<section class="card stack rating">
  {#if level === 'swipe'}
    {#if ready}
      <p class="subject" data-testid="swipe-subject">
        <strong>{swipeTitle}</strong>
        <span class="muted small">{swipeSubtitle}</span>
      </p>
    {/if}
    <div class="thumbs">
      <button type="button" class="thumb" disabled={saving || !ready} onclick={() => save('less')} aria-label={t('swipe.less')}>
        <Icon name="thumbDown" size={40} /><span>{t('swipe.less')}</span>
      </button>
      <button type="button" class="thumb" disabled={saving || !ready} onclick={() => save('more')} aria-label={t('swipe.more')}>
        <Icon name="thumbUp" size={40} /><span>{t('swipe.more')}</span>
      </button>
    </div>
  {:else}
    <StarInput bind:value={detail.stars} label={t('log.stars')} />
    {#if level === 'advanced'}
      <DetailInput bind:value={detail} />
    {/if}
    <div class="field">
      <span id="buy-again">{t('log.wouldBuyAgain')}</span>
      <div class="chips" role="radiogroup" aria-labelledby="buy-again">
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

  <div class="field">
    <span id="meal">{t('log.meal')}{level === 'swipe' ? ` (${t('common.optional')})` : ''}</span>
    <div class="chips" role="radiogroup" aria-labelledby="meal">
      {#each MEAL_CHOICES as m (m)}
        <button
          type="button"
          class="chip"
          role="radio"
          aria-checked={meal === m}
          onclick={() => (meal = meal === m ? 'unspecified' : m)}>{t(`meal.${m}`)}</button
        >
      {/each}
    </div>
  </div>

  {@render details?.()}

  {#if level !== 'swipe'}
    <button type="button" class="btn-primary btn-block" disabled={!canSave} onclick={() => save()}>{t('common.save')}</button>
  {/if}
</section>

<style>
  .thumbs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--gap);
  }
  /* one tap saves; no drag gesture (unreliable on phones, owner feedback F2) */
  .thumb {
    flex-direction: column;
    min-height: 7rem;
    font-weight: 600;
  }
  .subject {
    display: grid;
    gap: 0.25rem;
    margin: 0;
    text-align: center;
  }
</style>
