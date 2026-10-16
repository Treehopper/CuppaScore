<script lang="ts">
  import type { PresetView } from '@cuplog/api';
  import BrewDetails from '../../components/BrewDetails.svelte';
  import Icon from '../../components/Icon.svelte';
  import PresetChips from '../../components/PresetChips.svelte';
  import RatingPanel from '../../components/RatingPanel.svelte';
  import { fmtTime } from '../../i18n/format';
  import { t } from '../../i18n/i18n.svelte';
  import { api } from '../../lib/api';
  import type { BrewMethod, RatingLevel } from '../../lib/domain';
  import { bagTitle } from '../../lib/labels';
  import { logCup, type LogCmd } from '../../lib/logCup';
  import { brewToForm, formToBrew, type BrewForm } from '../../lib/logForm';
  import { query } from '../../lib/query.svelte';
  import { router } from '../../lib/router.svelte';

  /** Quick Log for home-made cups (README §9.2). */
  let { defaultLevel }: { defaultLevel: RatingLevel } = $props();

  const NEW_BAG = '__new__';
  const MAX_CHIPS = 4;

  const presets = query(() => api().listPresets({ source: 'home' }), ['ratings', 'bags', 'settings']);
  const bags = query(() => api().listBags({ status: ['open', 'unopened'] }), ['bags', 'ratings', 'products']);
  const methods = query(() => api().methodUsage(), ['ratings', 'settings']);

  // what the user picked explicitly; everything else falls back to the best preset
  let picked = $state<{ bagId: string | null; method: BrewMethod | null; level: RatingLevel | null }>({
    bagId: null,
    method: null,
    level: null,
  });

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
  const level = $derived<RatingLevel>(picked.level ?? preset?.preset.lastLevel ?? defaultLevel);
  const bagView = $derived(bags.data?.find((b) => b.bag.id === bagId));

  // brew details are copied from the preset (README §9.2); edits apply to this preset only
  let brewEdits = $state<{ key: string | null; form: BrewForm } | null>(null);
  const brewForm = $derived(
    brewEdits && brewEdits.key === presetKey ? brewEdits.form : brewToForm(preset?.preset.lastBrew),
  );

  const swipeSubtitle = $derived.by(() => {
    const days = bagView?.freshness.daysSinceRoast;
    const time = fmtTime(Date.now());
    return days === null || days === undefined ? time : `${time} · ${t('log.afterRoast', { days })}`;
  });

  function onBagChange(e: Event & { currentTarget: HTMLSelectElement }): void {
    if (e.currentTarget.value === NEW_BAG) router.go('/bags/new');
    else picked = { ...picked, bagId: e.currentTarget.value, method: null, level: null };
  }

  function chipLabel(p: PresetView): string {
    const bag = p.bag && p.product ? bagTitle({ bag: p.bag, product: p.product }) : '';
    return `${t(`brew.${p.preset.method}`)} · ${bag}`;
  }

  async function save(rating: Partial<LogCmd>): Promise<boolean> {
    if (!bagId || !method) return false;
    const ok = await logCup({ ...rating, level, source: 'home', bagId, brew: formToBrew(method, brewForm) });
    if (ok) {
      brewEdits = null;
      picked = { bagId, method, level: picked.level };
    }
    return ok;
  }
</script>

{#if bags.data && bags.data.length === 0}
  <div class="card stack">
    <p>{t('log.noBags')}</p>
    <a class="btn btn-primary" href="#/bags/new"><Icon name="plus" size={20} />{t('bags.add')}</a>
  </div>
{:else if bags.data}
  <PresetChips
    presets={(presets.data ?? []).slice(0, MAX_CHIPS)}
    activeKey={presetKey}
    label={chipLabel}
    onpick={(p) => (picked = { bagId: p.preset.bagId, method: p.preset.method, level: null })}
  />

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

  <RatingPanel
    {level}
    onlevel={(l) => (picked = { ...picked, bagId, method, level: l })}
    ready={!!bagId && !!method}
    swipeTitle={method && bagView ? `${t(`brew.${method}`)} · ${bagTitle(bagView)}` : ''}
    {swipeSubtitle}
    onsave={save}
  >
    {#snippet details()}
      {#if method}
        <BrewDetails {method} form={brewForm} onchange={(form) => (brewEdits = { key: presetKey, form })} />
      {/if}
    {/snippet}
  </RatingPanel>
{/if}
