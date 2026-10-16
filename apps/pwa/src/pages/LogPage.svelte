<script lang="ts">
  import type { PresetView, RatingDto } from '@cuplog/api';
  import Icon from '../components/Icon.svelte';
  import PageHeader from '../components/PageHeader.svelte';
  import StarInput from '../components/StarInput.svelte';
  import { t } from '../i18n/i18n.svelte';
  import { api } from '../lib/api';
  import { MEAL_CHOICES, RATING_LEVELS, type BrewMethod, type MealType, type RatingLevel } from '../lib/domain';
  import { showError } from '../lib/errors';
  import { bagTitle } from '../lib/labels';
  import { prefs, type LogMode } from '../lib/prefs.svelte';
  import { query } from '../lib/query.svelte';
  import { router } from '../lib/router.svelte';
  import { toasts } from '../lib/toast.svelte';

  type Brew = NonNullable<RatingDto['brew']>;

  const NEW_BAG = '__new__';
  const MAX_CHIPS = 4;

  // ?mode=home|cafe (manifest shortcuts) wins over the remembered mode
  const mode = $derived<LogMode>(
    router.current.query.mode === 'cafe' || router.current.query.mode === 'home'
      ? (router.current.query.mode as LogMode)
      : prefs.value.lastMode,
  );

  function setMode(m: LogMode): void {
    prefs.set('lastMode', m);
    if (router.current.query.mode) router.go('/log', { replace: true });
  }

  const settings = query(() => api().getSettings(), ['settings']);
  const presets = query(() => api().listPresets({ source: 'home' }), ['ratings', 'bags', 'settings']);
  const bags = query(() => api().listBags({ status: ['open', 'unopened'] }), ['bags', 'ratings', 'products']);
  const methods = query(() => api().methodUsage(), ['ratings', 'settings']);

  // what the user picked explicitly; everything else falls back to the best preset
  let picked = $state<{ bagId: string | null; method: BrewMethod | null; level: RatingLevel | null }>({
    bagId: null,
    method: null,
    level: null,
  });
  let stars = $state<number | null>(null);
  let meal = $state<MealType>('unspecified');
  let saving = $state(false);

  const top = $derived<PresetView | undefined>(presets.data?.[0]);
  const bagId = $derived(picked.bagId ?? top?.bag?.id ?? bags.data?.[0]?.bag.id ?? null);
  const method = $derived<BrewMethod | null>(
    picked.method ??
      (picked.bagId ? presets.data?.find((p) => p.preset.bagId === picked.bagId)?.preset.method : top?.preset.method) ??
      methods.data?.[0]?.method ??
      null,
  );
  const presetKey = $derived(bagId && method ? `home:${bagId}:${method}` : null);
  const preset = $derived(presets.data?.find((p) => p.preset.key === presetKey));
  // remembered per preset (B3b), else the default level
  const level = $derived<RatingLevel>(picked.level ?? preset?.preset.lastLevel ?? settings.data?.defaultLevel ?? 'stars');
  const chips = $derived((presets.data ?? []).slice(0, MAX_CHIPS));

  function choosePreset(p: PresetView): void {
    picked = { bagId: p.preset.bagId, method: p.preset.method, level: null };
  }

  function onBagChange(e: Event & { currentTarget: HTMLSelectElement }): void {
    if (e.currentTarget.value === NEW_BAG) router.go('/bags/new');
    else picked = { ...picked, bagId: e.currentTarget.value, method: null, level: null };
  }

  function chipLabel(p: PresetView): string {
    const bag = p.bag && p.product ? bagTitle({ bag: p.bag, product: p.product }) : '';
    return `${t(`brew.${p.preset.method}`)} · ${bag}`;
  }

  const canSave = $derived(
    !!bagId && !!method && !saving && (level !== 'stars' && level !== 'advanced' ? true : stars !== null),
  );

  async function save(extra: Partial<RatingDto> = {}): Promise<void> {
    if (!bagId || !method) return;
    saving = true;
    // all parameters are copied from the preset (README §9.2)
    const brew: Brew = { ...(preset?.preset.lastBrew ?? {}), method };
    if (brew.methodParams && brew.methodParams.kind !== method) delete brew.methodParams;
    try {
      const r = await api().logRating({
        level,
        source: 'home',
        bagId,
        brew,
        meal: { type: meal },
        ...(level === 'swipe' ? {} : { overall: stars ?? undefined }),
        ...extra,
      });
      stars = null;
      meal = 'unspecified';
      picked = { bagId, method, level: picked.level };
      if (navigator.vibrate) navigator.vibrate(15);
      toasts.show(t('log.saved'), {
        action: {
          label: t('common.undo'),
          run: async () => {
            await api().deleteRating(r.id);
            toasts.show(t('log.undone'));
          },
        },
      });
    } catch (e) {
      showError(e);
    } finally {
      saving = false;
    }
  }

  async function togglePin(p: PresetView): Promise<void> {
    try {
      await api().setPresetPinned(p.preset.key, !p.preset.pinned);
    } catch (e) {
      showError(e);
    }
  }
</script>

<PageHeader title={t('log.title')} />

<div class="stack">
  <div class="segmented" role="radiogroup" aria-label={t('log.mode')}>
    <button type="button" role="radio" aria-checked={mode === 'home'} onclick={() => setMode('home')}>
      <Icon name="home" size={20} />{t('source.home')}
    </button>
    <button type="button" role="radio" aria-checked={mode === 'cafe'} onclick={() => setMode('cafe')}>
      <Icon name="store" size={20} />{t('source.cafe')}
    </button>
  </div>

  {#if mode === 'cafe'}
    <p class="muted">{t('page.comingSoon')}</p>
  {:else if bags.data && bags.data.length === 0}
    <div class="card stack">
      <p>{t('log.noBags')}</p>
      <a class="btn btn-primary" href="#/bags/new"><Icon name="plus" size={20} />{t('bags.add')}</a>
    </div>
  {:else if bags.data}
    {#if chips.length}
      <section aria-label={t('log.presets')}>
        <ul class="list presets">
          {#each chips as p (p.preset.key)}
            <li class="preset-row">
              <button
                type="button"
                class="preset"
                aria-pressed={p.preset.key === presetKey}
                onclick={() => choosePreset(p)}
                data-testid="preset-chip"
              >
                <span class="dot" aria-hidden="true"></span>
                <span class="name">{chipLabel(p)}</span>
              </button>
              {#if p.preset.key === presetKey || p.preset.pinned}
                <button
                  type="button"
                  class="btn-ghost icon-btn pin"
                  class:on={p.preset.pinned}
                  aria-label={p.preset.pinned ? t('log.unpin') : t('log.pin')}
                  aria-pressed={p.preset.pinned}
                  onclick={() => togglePin(p)}><Icon name="pin" size={20} /></button
                >
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <div class="row">
      <label class="field">
        <span>{t('log.bag')}</span>
        <select value={bagId ?? ''} onchange={onBagChange} data-testid="log-bag">
          {#each bags.data as b (b.bag.id)}
            <option value={b.bag.id}>{bagTitle(b)}</option>
          {/each}
          <option value={NEW_BAG}>{t('log.addBag')}</option>
        </select>
      </label>
      <label class="field">
        <span>{t('log.method')}</span>
        <select
          value={method ?? ''}
          onchange={(e) => (picked = { ...picked, bagId, method: e.currentTarget.value as BrewMethod, level: null })}
          data-testid="log-method"
        >
          {#each methods.data ?? [] as m (m.method)}
            <option value={m.method}>{t(`brew.${m.method}`)}</option>
          {/each}
        </select>
      </label>
    </div>

    <div class="field">
      <span id="rate-level">{t('log.rate')}</span>
      <div class="segmented" role="radiogroup" aria-labelledby="rate-level">
        {#each RATING_LEVELS as l (l)}
          <button type="button" role="radio" aria-checked={level === l} onclick={() => (picked = { ...picked, bagId, method, level: l })}>
            {t(`level.${l}`)}
          </button>
        {/each}
      </div>
    </div>

    <section class="card stack rating">
      {#if level === 'swipe'}
        <div class="thumbs">
          <button type="button" class="thumb" disabled={saving} onclick={() => save({ swipe: 'less' })} aria-label={t('swipe.less')}>
            <Icon name="thumbDown" size={32} /><span>{t('swipe.less')}</span>
          </button>
          <button type="button" class="thumb" disabled={saving} onclick={() => save({ swipe: 'more' })} aria-label={t('swipe.more')}>
            <Icon name="thumbUp" size={32} /><span>{t('swipe.more')}</span>
          </button>
        </div>
      {:else}
        <StarInput bind:value={stars} label={t('log.stars')} />
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

      {#if level !== 'swipe'}
        <button type="button" class="btn-primary btn-block" disabled={!canSave} onclick={() => save()}>{t('common.save')}</button>
      {/if}
    </section>
  {/if}
</div>

<style>
  .presets {
    gap: 0.4rem;
  }
  .preset-row {
    display: flex;
    gap: 0.25rem;
    align-items: center;
  }
  .preset {
    flex: 1;
    justify-content: flex-start;
    text-align: left;
    min-height: 3rem;
    border-radius: var(--radius);
  }
  .preset[aria-pressed='true'] {
    border: 2px solid var(--accent);
    font-weight: 600;
  }
  .dot {
    flex-shrink: 0;
    width: 0.9rem;
    height: 0.9rem;
    border-radius: 50%;
    border: 2px solid var(--accent);
  }
  .preset[aria-pressed='true'] .dot {
    background: var(--accent);
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pin {
    color: var(--muted);
  }
  .pin.on {
    color: var(--accent);
  }
  .thumbs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--gap);
  }
  .thumb {
    flex-direction: column;
    min-height: 5.5rem;
    font-weight: 600;
  }
</style>
